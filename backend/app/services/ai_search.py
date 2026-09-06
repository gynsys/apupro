import os
import re
from typing import List, Dict, Any, Tuple, Set, Optional
import numpy as np
import pandas as pd
from sentence_transformers import SentenceTransformer
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.core.logging import logger
from app.services.synonyms_service import expand_technical_synonyms
from app.services.dimension_service import extract_unified_dimensions, score_dimension_match

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
        "ARCILLA": [r"\bARCILLA\b", r"\bADOBE\b", r"\bLADRILLO\b"],
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


class AISearchEngine:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(AISearchEngine, cls).__new__(cls)
            cls._instance.model = None
            cls._instance.embeddings = None
            cls._instance.ids_mapping = []
            cls._instance.is_loaded = False
        return cls._instance

    def load_brain(self):
        if self.is_loaded:
            return

        print("Iniciando carga del 'Cerebro' de IA...")
        
        # 1. Cargar el modelo transformer
        try:
            # paraphrase-multilingual-MiniLM-L12-v2
            self.model = SentenceTransformer('sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2')
            print("Modelo SentenceTransformer cargado exitosamente.")
        except Exception as e:
            print(f"Error cargando el modelo de IA: {e}")

        # 2. Cargar matriz NumPy
        # Orden de búsqueda: producción Docker (/app/ai_brain/) -> relativa -> local Windows
        npy_docker_path = '/app/ai_brain/embeddings_partidas.npy'
        npy_relative_path = os.path.join(os.path.dirname(__file__), '..', '..', 'embeddings_partidas.npy')
        npy_local_path = r'C:\Users\pablo\Desktop\BD_COST360\embeddings_partidas.npy'
        
        npy_path = None
        for candidate in [npy_docker_path, npy_relative_path, npy_local_path]:
            if os.path.exists(candidate):
                npy_path = candidate
                break

        if npy_path:
            self.embeddings = np.load(npy_path)
            print(f"Matriz de embeddings cargada desde {npy_path} con forma {self.embeddings.shape}")
        else:
            print(f"ERROR CRITICO: No se encontró embeddings_partidas.npy en ninguna ruta buscada.")
            
        # 3. Cargar mapeo de IDs desde el CSV
        # Orden de búsqueda: producción Docker (/app/ai_brain/) -> relativa -> local Windows
        csv_docker_path = '/app/ai_brain/Base_Datos_IA.csv'
        csv_relative_path = os.path.join(os.path.dirname(__file__), '..', '..', 'Base_Datos_IA.csv')
        csv_local_path = r'C:\Users\pablo\Desktop\BD_COST360\Base_Datos_IA.csv'
        
        csv_path_to_use = None
        for candidate in [csv_docker_path, csv_relative_path, csv_local_path]:
            if os.path.exists(candidate):
                csv_path_to_use = candidate
                break
            
        if csv_path_to_use:
            try:
                df = pd.read_csv(csv_path_to_use, sep=';', usecols=['Referencia'])
            except Exception:
                df = pd.read_csv(csv_path_to_use, usecols=['Referencia'])
            self.ids_mapping = df['Referencia'].astype(str).tolist()
            print(f"Cargados {len(self.ids_mapping)} IDs de mapeo desde {csv_path_to_use}.")
        else:
            print(f"ERROR CRITICO: No se encontró Base_Datos_IA.csv en ninguna ruta:")
            print(f"  - Relativa: {os.path.abspath(csv_relative_path)}")
            print(f"  - Local: {csv_local_path}")

        if self.model is not None and self.embeddings is not None and self.ids_mapping:
            self.is_loaded = True

    def calculate_cosine_similarity(self, query_embedding: np.ndarray) -> np.ndarray:
        if not self.is_loaded or self.embeddings is None:
            return np.array([])
        
        # similitud del coseno: (A . B) / (||A|| * ||B||)
        # Asumiendo que self.embeddings ya están normalizados (típico en sentence-transformers)
        # Si no lo están:
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
        if not self.is_loaded or self.embeddings is None or self.model is None:
            return []

        # Vectorizar query
        query_embedding = self.model.encode([query])

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

    def hybrid_search(self, db: Session, query: str, valid_ids: List[str] = None, limit: int = 40) -> List[Dict[str, Any]]:
        """
        Búsqueda Híbrida que combina el score Semántico (SentenceTransformers)
        con el score Léxico (PostgreSQL ts_rank).
        Si valid_ids se proporciona, solo busca en esos IDs.
        """
        if not self.is_loaded or self.embeddings is None or self.model is None:
            return []

        # 1. Puntaje Semántico (RAG)
        # Expandir siglas técnicas y sinónimos para asegurar coincidencia léxica y semántica
        expanded_query = expand_technical_synonyms(query)
        # Usamos chunking para no distraer al modelo con "sin incluir"
        main_query = self.extract_main_chunk(expanded_query)
        query_embedding = self.model.encode([main_query])
        
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
