import os
import re
from typing import List, Dict, Any, Tuple, Set, Optional
import numpy as np
import pandas as pd
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.core.config import settings
from app.core.logging import logger
from app.db.base import SessionLocal
from app.crud.llm import get_active_providers_for_use_case, decrypt_api_key
from app.services.synonyms_service import expand_technical_synonyms
from app.services.dimension_service import extract_unified_dimensions, score_dimension_match

try:
    from sentence_transformers import SentenceTransformer
    HAVE_SENTENCE_TRANSFORMERS = True
except ImportError:
    SentenceTransformer = None  # type: ignore
    HAVE_SENTENCE_TRANSFORMERS = False

try:
    import google.generativeai as genai
    HAVE_GEMINI = True
except ImportError:
    genai = None  # type: ignore
    HAVE_GEMINI = False


MATERIAL_CATEGORIES: Dict[str, Dict[str, List[str]]] = {
    "tuberia": {
        "POLIPROPILENO": [r"\bPOLIPROPILENO\b", r"\bPPR\b", r"\bPOLIFUSION\b"],
        "PEAD": [r"\bPEAD\b", r"\bPOLIETILENO DE ALTA DENSIDAD\b", r"\bPOLIETILENO\b"],
        "PVC": [r"\bPVC\b", r"\bCPVC\b", r"\bPOLICLORURO\b"],
        "COBRE": [r"\bCOBRE\b"],
        "HIERRO_GALVANIZADO": [r"\bHIERRO GALVANIZADO\b", r"\bHG\b", r"\bGALVANIZADO\b"],
        "HIERRO_FUNDIDO": [r"\bHIERRO FUNDIDO\b", r"\bHF\b"],
        "ACERO": [r"\bACERO AL CARBONO\b", r"\bACERO INOXIDABLE\b", r"\bACERO NEGRO\b"],
    },
    "estructuras": {
        "CONCRETO": [r"\bCONCRETO\b", r"\bHORMIGON\b"],
        "ACERO_ESTRUCTURAL": [r"\bESTRUCTURA METALICA\b", r"\bPERFIL METALICO\b", r"\bVIGA DE ACERO\b"],
        "MADERA": [r"\bMADERA\b", r"\bMACHIMBRADO\b"],
        "DRYWALL_YESO": [r"\bDRYWALL\b", r"\bYESO\b", r"\bTABLAYESO\b"],
    },
    "mamposteria": {
        "ARCILLA": [r"\bARCILLA\b", r"\bLADRILLO(S)?\b"],
        "ADOBE": [r"\bADOBE(S)?\b", r"\bTIERRA\s+CRUDA\b", r"\bBARRO\b"],
        "BLOQUE_CONCRETO": [r"\bBLOQUE(S)?\s+DE\s+CONCRETO\b", r"\bBLOQUE(S)?\s+CONCRETO\b"],
        "CONCRETO_ESTRUCTURAL": [r"\bCONCRETO\b", r"\bMACHON(ES)?\b", r"\bVIGA(S)?\s+DE\s+CORONA\b"],
    }
}


def detect_materials(text_input: str) -> Dict[str, Set[str]]:
    """Detecta materiales técnicos por categoría en un texto dado."""
    if not text_input or not isinstance(text_input, str):
        return {}
    upper = text_input.upper()
    found: Dict[str, Set[str]] = {}
    for cat_name, materials in MATERIAL_CATEGORIES.items():
        for mat_name, patterns in materials.items():
            for pat in patterns:
                if re.search(pat, upper):
                    if cat_name not in found:
                        found[cat_name] = set()
                    found[cat_name].add(mat_name)
                    break
    return found


def extract_negative_exclusions(query: str) -> List[str]:
    """
    Detecta términos y conceptos explícitamente excluidos en la consulta
    mediante cláusulas como 'sin ...' para penalizar ítems que los contengan.
    """
    if not query or not isinstance(query, str):
        return []

    exclusions: List[str] = []

    # 1. Concreto: sin mixer / sin premezclado
    if re.search(r"\b(sin\s+mixer|sin\s+premezclado|sin\s+camion\s+mezclador)\b", query, re.IGNORECASE):
        exclusions.extend(["PREMEZCLADO", "MIXER"])

    # 2. Obras de tierra: sin maquinaria / sin equipo / excavación a mano
    if re.search(r"\b(sin\s+maquinaria|sin\s+equipo|a\s+mano\s+sin|sin\s+retroexcavadora)\b", query, re.IGNORECASE):
        exclusions.extend(["RETROEXCAVADORA", "TRACTOR", "MAQUINARIA", "EQUIPO PESADO"])

    return exclusions


class GeminiModelShim:
    """Wrapper compatible con la interfaz de SentenceTransformer para Gemini."""
    def __init__(self, engine: "AISearchEngine") -> None:
        self.engine = engine

    def encode(self, texts: List[str]) -> np.ndarray:
        if not texts or not isinstance(texts, list):
            raise ValueError("texts must be a non-empty list of strings.")
        vectors = []
        for text_item in texts:
            vec = self.engine.encode_query(text_item)
            vectors.append(vec)
        return np.array(vectors, dtype=np.float32)


class AISearchEngine:
    _instance = None

    def __new__(cls) -> "AISearchEngine":
        if cls._instance is None:
            cls._instance = super(AISearchEngine, cls).__new__(cls)
            cls._instance.model = None
            cls._instance.embeddings = None
            cls._instance.ids_mapping = []
            cls._instance.provider = "local"
            cls._instance.is_loaded = False
        return cls._instance

    def _resolve_gemini_api_key(self) -> Optional[str]:
        """Obtiene la clave API de Gemini desde settings o de la tabla llm_providers."""
        if settings.GEMINI_API_KEY:
            return settings.GEMINI_API_KEY

        db: Session = SessionLocal()
        try:
            providers = get_active_providers_for_use_case(db)
            gemini_prov = next((p for p in providers if p.provider_key == "gemini"), None)
            if gemini_prov and gemini_prov.api_key_enc:
                return decrypt_api_key(gemini_prov.api_key_enc)
        except Exception as exc:
            logger.error("No se pudo obtener la clave de Gemini desde la base de datos: %s", exc, exc_info=True)
            return None
        finally:
            db.close()
        return None

    def load(self, provider: Optional[str] = None) -> None:
        """Alias compatible para load_brain."""
        self.load_brain(provider=provider)

    def load_brain(self, provider: Optional[str] = None) -> None:
        if self.is_loaded:
            return

        target_provider = (provider or settings.AI_EMBEDDING_PROVIDER or "local").lower()
        logger.info("Iniciando carga del 'Cerebro' de IA con proveedor objetivo: %s", target_provider)

        gemini_ready = False
        if target_provider == "gemini":
            if HAVE_GEMINI and genai is not None:
                api_key = self._resolve_gemini_api_key()
                if api_key:
                    try:
                        genai.configure(api_key=api_key)
                        gemini_ready = True
                        self.provider = "gemini"
                        self.model = GeminiModelShim(self)
                        logger.info("Proveedor Gemini configurado exitosamente.")
                    except Exception as exc:
                        logger.error("Error al configurar genai: %s", exc, exc_info=True)
                else:
                    logger.warning("No se encontro API key de Gemini para proveedor 'gemini'.")
            else:
                logger.warning("SDK google.generativeai no disponible en este entorno.")

        # Si el proveedor es 'local' o si 'gemini' no pudo configurarse y tenemos sentence-transformers:
        if not gemini_ready and target_provider == "local":
            self.provider = "local"
            if HAVE_SENTENCE_TRANSFORMERS and SentenceTransformer is not None:
                try:
                    self.model = SentenceTransformer('sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2')
                    logger.info("Modelo SentenceTransformer local cargado exitosamente.")
                except Exception as exc:
                    logger.error("Error cargando modelo local SentenceTransformer: %s", exc, exc_info=True)
            else:
                logger.warning("SentenceTransformer no disponible en el entorno.")

        # 2. Cargar matriz NumPy segun proveedor
        candidates_gemini = [
            '/app/ai_brain/embeddings_gemini.npy',
            os.path.join(os.path.dirname(__file__), '..', '..', 'embeddings_gemini.npy'),
            r'C:\Users\pablo\Desktop\BD_COST360\embeddings_gemini.npy'
        ]
        candidates_local = [
            '/app/ai_brain/embeddings_partidas.npy',
            os.path.join(os.path.dirname(__file__), '..', '..', 'embeddings_partidas.npy'),
            r'C:\Users\pablo\Desktop\BD_COST360\embeddings_partidas.npy'
        ]

        candidates_npy = candidates_gemini if self.provider == "gemini" else candidates_local
        npy_path = None
        for candidate in candidates_npy:
            if os.path.exists(candidate):
                npy_path = candidate
                break

        # Fallback inteligente si se configuro gemini pero embeddings_gemini.npy no esta listo todavia:
        if not npy_path and self.provider == "gemini":
            logger.warning("embeddings_gemini.npy no encontrado. Intentando fallback a embeddings_partidas.npy local...")
            for fallback_cand in candidates_local:
                if os.path.exists(fallback_cand):
                    npy_path = fallback_cand
                    self.provider = "local"
                    if HAVE_SENTENCE_TRANSFORMERS and SentenceTransformer is not None:
                        try:
                            self.model = SentenceTransformer('sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2')
                        except Exception as exc:
                            logger.error("Error en fallback local SentenceTransformer: %s", exc, exc_info=True)
                    break

        if npy_path:
            try:
                self.embeddings = np.load(npy_path)
                logger.info("Matriz de embeddings cargada desde %s con forma %s (Proveedor activo: %s)", npy_path, self.embeddings.shape, self.provider)
            except Exception as exc:
                logger.error("Error al cargar matriz de embeddings desde %s: %s", npy_path, exc, exc_info=True)
        else:
            logger.error("ERROR CRITICO: No se encontro matriz de embeddings .npy en ninguna ruta.")

        # 3. Cargar mapeo de IDs desde CSV
        candidates_csv = [
            '/app/ai_brain/Base_Datos_IA_Gemini.csv' if self.provider == "gemini" else "",
            '/app/ai_brain/Base_Datos_IA.csv',
            os.path.join(os.path.dirname(__file__), '..', '..', 'Base_Datos_IA.csv'),
            r'C:\Users\pablo\Desktop\BD_COST360\Base_Datos_IA.csv'
        ]
        csv_path_to_use = None
        for candidate in candidates_csv:
            if candidate and os.path.exists(candidate):
                csv_path_to_use = candidate
                break

        if csv_path_to_use:
            try:
                df = pd.read_csv(csv_path_to_use, sep=';', usecols=['Referencia'])
            except Exception:
                try:
                    df = pd.read_csv(csv_path_to_use, usecols=['Referencia'])
                except Exception as exc:
                    logger.error("Error al leer CSV de IDs: %s", exc, exc_info=True)
                    df = None

            if df is not None:
                self.ids_mapping = df['Referencia'].astype(str).tolist()
                logger.info("Cargados %d IDs de mapeo desde %s", len(self.ids_mapping), csv_path_to_use)
        else:
            logger.error("ERROR CRITICO: No se encontro CSV de mapeo de IDs.")

        if self.embeddings is not None and self.ids_mapping:
            if (self.provider == "gemini" and gemini_ready) or (self.provider == "local" and self.model is not None and not isinstance(self.model, GeminiModelShim)):
                self.is_loaded = True
                logger.info("AISearchEngine inicializado exitosamente en modo '%s'.", self.provider)

    def encode_query(self, query: str) -> np.ndarray:
        """
        Vectoriza una consulta individual utilizando el proveedor configurado (Gemini o MiniLM).
        Retorna un vector 1D de NumPy en float32.
        """
        if not query or not isinstance(query, str):
            raise ValueError("La consulta debe ser una cadena de texto no vacia.")

        if self.provider == "gemini":
            if not HAVE_GEMINI or genai is None:
                raise RuntimeError("El modulo google.generativeai no esta disponible.")
            try:
                res = genai.embed_content(
                    model=settings.GEMINI_EMBEDDING_MODEL,
                    content=query,
                    output_dimensionality=settings.GEMINI_EMBEDDING_DIM
                )
                return np.array(res["embedding"], dtype=np.float32)
            except Exception as exc:
                logger.error("Error al generar embedding de consulta con Gemini: %s", exc, exc_info=True)
                if self.model is not None and not isinstance(self.model, GeminiModelShim):
                    logger.warning("Recurriendo a modelo local SentenceTransformer tras fallo en Gemini.")
                    emb = self.model.encode([query])[0]
                    return np.array(emb, dtype=np.float32)
                raise
        else:
            if self.model is None or isinstance(self.model, GeminiModelShim):
                raise RuntimeError("El modelo local SentenceTransformer no esta disponible.")
            emb = self.model.encode([query])[0]
            return np.array(emb, dtype=np.float32)

    def calculate_cosine_similarity(self, query_embedding: np.ndarray) -> np.ndarray:
        if not self.is_loaded or self.embeddings is None:
            return np.array([], dtype=np.float32)

        if query_embedding is None or len(query_embedding) == 0:
            return np.array([], dtype=np.float32)

        norm_query = np.linalg.norm(query_embedding)
        norm_embeddings = np.linalg.norm(self.embeddings, axis=1)

        dot_product = np.dot(self.embeddings, query_embedding.T).flatten()
        similarities = dot_product / (norm_embeddings * norm_query + 1e-10)
        return similarities

    def calculate_similarity_for_subset(self, query: str, valid_ids: List[str]) -> List[Dict[str, Any]]:
        """
        Calcula la similitud semántica solo para un subconjunto de IDs.
        Retorna una lista ordenada de diccionarios con {'id': ..., 'score': ...}.
        """
        if not query or not isinstance(query, str):
            raise ValueError("La consulta debe ser una cadena no vacia.")
        if not valid_ids:
            return []
        if not self.is_loaded or self.embeddings is None:
            return []

        # Vectorizar query
        query_embedding = self.encode_query(query)

        # Obtener índices del subconjunto (usamos un set para búsqueda rápida)
        valid_ids_set = set(valid_ids)
        valid_indices = []
        valid_id_map = []
        for i, id_val in enumerate(self.ids_mapping):
            if id_val in valid_ids_set:
                valid_indices.append(i)
                valid_id_map.append(id_val)

        if not valid_indices:
            return []

        # Extraer embeddings del subconjunto
        subset_embeddings = self.embeddings[valid_indices]

        # Calcular similitud coseno
        norm_query = np.linalg.norm(query_embedding)
        norm_embeddings = np.linalg.norm(subset_embeddings, axis=1)

        dot_product = np.dot(subset_embeddings, query_embedding.T).flatten()
        similarities = dot_product / (norm_embeddings * norm_query + 1e-10)

        # Armar y ordenar resultados
        results = [
            {"id": valid_id_map[i], "score": float(similarities[i])}
            for i in range(len(valid_indices))
        ]
        results.sort(key=lambda x: x["score"], reverse=True)
        return results

    def extract_main_chunk(self, query: str) -> str:
        """
        Divide la consulta y extrae solo la parte principal ignorando modificadores
        como 'sin incluir', 'no incluye', 'utilizando', 'con'.
        Esto evita que la IA se distraiga con palabras secundarias.
        """
        if not query or not isinstance(query, str):
            return ""

        # Expresión regular para separar la frase en base a palabras clave de exclusión/condición
        splitters = re.compile(
            r'\b(sin incluir|no incluye|sin empleo de|sin uso de|sin maquinaria|sin equipo|sin mixer|utilizando|con empleo de|empleando)\b',
            re.IGNORECASE,
        )
        parts = splitters.split(query)
        if parts:
            # La primera parte suele ser la intención principal de búsqueda
            main_chunk = parts[0].strip(" ,.-")
            return main_chunk if len(main_chunk) > 5 else query
        return query

    def lexical_search(self, db: Session, query: str, limit: int = 50) -> List[Dict[str, Any]]:
        """
        Búsqueda Tradicional (Full-Text Search) usando PostgreSQL.
        Busca coincidencias exactas de las palabras en el campo Descri.
        """
        if not query or not isinstance(query, str):
            return []

        # Extraer únicamente tokens alfanuméricos limpios (sin comas, puntos ni caracteres especiales)
        raw_words = re.findall(r'[a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]+', query)
        words = [w.lower() for w in raw_words if len(w) > 2]
        if not words:
            return []
        
        tsquery_str = " | ".join(words)
        
        sql = text('''
            SELECT "CodPar", "CovPar", "Descri",
                   ts_rank(to_tsvector('spanish', "Descri"), to_tsquery('spanish', :tsquery)) as rank
            FROM public.cost360_items
            WHERE to_tsvector('spanish', "Descri") @@ to_tsquery('spanish', :tsquery)
            ORDER BY rank DESC
            LIMIT :limit
        ''')
        
        try:
            results = db.execute(sql, {"tsquery": tsquery_str, "limit": limit}).fetchall()
            return [
                {"id": row.CodPar, "score": float(row.rank), "desc": row.Descri}
                for row in results
            ]
        except Exception as exc:
            db.rollback()
            logger.error("Error en lexical_search con tsquery '%s': %s", tsquery_str, exc, exc_info=True)
            return []

    def hybrid_search(self, db: Session, query: str, valid_ids: Optional[List[str]] = None, limit: int = 40) -> List[Dict[str, Any]]:
        """
        Búsqueda Híbrida que combina el score Semántico (SentenceTransformers o Gemini)
        con el score Léxico (PostgreSQL ts_rank).
        Si valid_ids se proporciona, solo busca en esos IDs.
        """
        if not query or not isinstance(query, str):
            raise ValueError("La consulta debe ser una cadena no vacia.")
        if db is None:
            raise ValueError("La sesion de base de datos es requerida.")
        if not self.is_loaded or self.embeddings is None:
            return []

        # 1. Puntaje Semántico (RAG)
        # Expandir siglas técnicas y sinónimos para asegurar coincidencia léxica y semántica
        expanded_query = expand_technical_synonyms(query)
        # Usamos chunking para no distraer al modelo con "sin incluir"
        main_query = self.extract_main_chunk(expanded_query)
        query_embedding = self.encode_query(main_query)
        
        norm_query = np.linalg.norm(query_embedding)
        norm_embeddings = np.linalg.norm(self.embeddings, axis=1)
        dot_product = np.dot(self.embeddings, query_embedding.T).flatten()
        sem_similarities = dot_product / (norm_embeddings * norm_query + 1e-10)

        # Si hay limitación de IDs (Ej. filtrado por categoría), filtramos los semánticos
        valid_indices = []
        if valid_ids is not None:
            valid_ids_set = set(valid_ids)
            for i, id_val in enumerate(self.ids_mapping):
                if id_val in valid_ids_set:
                    valid_indices.append(i)
        else:
            valid_indices = list(range(len(self.ids_mapping)))

        semantic_scores = {
            self.ids_mapping[i]: float(sem_similarities[i])
            for i in valid_indices
        }

        # 2. Puntaje Léxico (Traditional)
        lexical_results = self.lexical_search(db, main_query, limit=1000)
        lexical_scores = {r['id']: r['score'] for r in lexical_results}

        # Normalizar scores léxicos (max rank puede ser > 1.0, lo normalizamos a 0-1)
        max_lex_score = max(lexical_scores.values()) if lexical_scores else 1.0
        if max_lex_score == 0: max_lex_score = 1.0

        # 3. Fusión Híbrida Equilibrada
        # Fórmula: 55% Semántico + 45% Léxico
        # Si un ítem tiene 0 palabras clave (lex_score == 0.0), se penaliza severamente (sem_score * 0.45)
        # para evitar que partidas semánticamente ambiguas desplacen a coincidencias conceptuales exactas.
        hybrid_results = []
        for item_id, sem_score in semantic_scores.items():
            raw_lex = lexical_scores.get(item_id, 0.0)
            lex_score = raw_lex / max_lex_score
            
            if lex_score == 0.0:
                final_score = sem_score * 0.45
            else:
                final_score = (sem_score * 0.55) + (lex_score * 0.45)
                
            hybrid_results.append({
                "id": item_id,
                "score": final_score,
                "sem_score": sem_score,
                "lex_score": lex_score
            })

        # Ordenar preliminarmente por el score híbrido
        hybrid_results.sort(key=lambda x: x["score"], reverse=True)

        # 4. Ponderación Técnica: Materiales, Dimensiones Físicas y Exclusiones Negativas
        query_mats = detect_materials(main_query)
        query_dims = extract_unified_dimensions(main_query)
        query_exclusions = extract_negative_exclusions(query)

        if (query_mats or query_dims or query_exclusions) and hybrid_results:
            top_eval_count = min(len(hybrid_results), max(limit * 5, 200))
            top_candidates = hybrid_results[:top_eval_count]
            remaining_candidates = hybrid_results[top_eval_count:]
            
            eval_ids = [c["id"] for c in top_candidates]
            if eval_ids:
                try:
                    sql_desc = text('SELECT "CodPar", "Descri" FROM cost360_items WHERE "CodPar" IN :id_tuple')
                    desc_rows = db.execute(sql_desc, {"id_tuple": tuple(eval_ids)}).fetchall()
                    desc_map = {row.CodPar: row.Descri for row in desc_rows}
                    
                    for candidate in top_candidates:
                        desc = desc_map.get(candidate["id"], "")
                        score_mod = 0.0
                        
                        # 4a. Ponderación por Material Técnico
                        if query_mats:
                            item_mats = detect_materials(desc)
                            for cat, q_mat_set in query_mats.items():
                                it_mat_set = item_mats.get(cat, set())
                                # Coincidencia exacta del material solicitado
                                if q_mat_set & it_mat_set:
                                    score_mod += 0.12
                                # Conflicto con material incompatible de la misma categoría
                                elif it_mat_set and not (q_mat_set & it_mat_set):
                                    score_mod -= 0.08

                        # 4b. Ponderación por Dimensiones Técnicas (Exact Match & Conflict Penalty)
                        if query_dims:
                            item_dims = extract_unified_dimensions(desc)
                            dim_delta, _ = score_dimension_match(query_dims, item_dims)
                            score_mod += dim_delta

                        # 4c. Penalización Severa por Exclusiones Explícitas ("sin mixer", "sin maquinaria")
                        if query_exclusions:
                            desc_upper = desc.upper()
                            for ex in query_exclusions:
                                if re.search(r"\b" + re.escape(ex) + r"\b", desc_upper):
                                    score_mod -= 0.35
                                    break
                                
                        candidate["score"] = candidate["score"] + score_mod
                    
                    top_candidates.sort(key=lambda x: x["score"], reverse=True)
                    hybrid_results = top_candidates + remaining_candidates
                except Exception as exc:
                    logger.error("Error aplicando ponderacion tecnica (materiales/dimensiones) en hybrid_search: %s", exc, exc_info=True)

        return hybrid_results[:limit]

ai_engine = AISearchEngine()
