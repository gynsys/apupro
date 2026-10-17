import math
import os
import re
import unicodedata
from collections import defaultdict
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

_UI_UNIT_CLAUSE_RE = re.compile(
    r"\bunidad\s+(?:ml|m2|m3|m|und|pza|pto|kgf|kg|ton|gl|sg|l|lt|lts|gal|km|ha|mes|dia|hr|h)\b",
    re.IGNORECASE,
)
_NEGATIVE_CLAUSE_SPLIT_RE = re.compile(
    r"\b(?:NO\s+INCLUYE|SIN\s+INCLUIR|EXCLUYE(?:NDO)?|SIN\s+EMPLEO\s+DE|SIN\s+USO\s+DE|SIN\s+MAQUINARIA|SIN\s+EQUIPO|SIN\s+MIXER|EXCEPTUANDO)\b",
    re.IGNORECASE,
)
_LEX_TOKEN_RE = re.compile(r"[A-Z0-9]+")
_LEX_MAX_DF_RATIO: float = 0.18

# Sustantivos núcleo de elementos constructivos civiles cuya identidad prevalece sobre el aglomerante genérico
_PRIMARY_CONSTRUCTIVE_ELEMENT_STEMS: Set[str] = {
    "DINTEL", "MACHON", "BROCAL", "CUNETA", "GOTERO", "RODAPIE",
    "ALFEIZAR", "TANQUILLA", "SUMIDERO", "ZAPATA", "PEDESTAL", "ESCALON", "PELDANO",
}
_GENERIC_BINDER_STEMS: Set[str] = {
    "MORTERO", "ARENA", "CEMENTO", "AGUA", "MEZCLA", "INTERIOR", "EXTERIOR",
}

# Muletillas contractuales, preposiciones y verbos genéricos que no definen disciplina ni insumo
_CONTRACTUAL_STOP_STEMS: Set[str] = {
    "CON", "PARA", "POR", "SIN", "DEL", "LOS", "LAS", "UNA", "UNO", "ENTRE", "HASTA",
    "DESDE", "SEGUN", "COMO", "MAS", "MENO", "MAYOR", "MENOR", "IGUAL", "SIMILAR",
    "TIPO", "USO", "EMPLEO", "MEDIANTE", "UTILIZANDO", "EMPLEANDO", "CORRESPONDIENTE",
    "SUMINISTRO", "TRANSPORTE", "INSTALACION", "COLOCACION", "CONSTRUCCION", "APLICACION",
    "ELABORACION", "EJECUCION", "INCLUYE", "EXCLUYE", "INCLUIDO", "UNIDAD", "UND",
    "MATERIAL", "INSUMO", "EQUIPO", "HERRAMIENTA", "OBRA", "SITIO",
}


def _strip_accents_upper(value: str) -> str:
    """Normaliza una cadena a mayúsculas sin tildes."""
    if not value or not isinstance(value, str):
        return ""
    decomposed = unicodedata.normalize("NFKD", value.upper())
    return "".join(ch for ch in decomposed if not unicodedata.combining(ch))


def _strip_negative_exclusion_clauses(value: str) -> str:
    """
    Recorta cláusulas contractuales negativas ('NO INCLUYE MACHONES, DINTELES...', 'EXCLUYE...', 'SIN INCLUIR...')
    para evitar que los elementos excluidos contaminen el índice léxico IDF o disparen falsos positivos.
    """
    if not value or not isinstance(value, str):
        return ""
    parts = _NEGATIVE_CLAUSE_SPLIT_RE.split(value)
    if parts:
        head = parts[0].strip(" ,.-")
        if len(head) > 5:
            return head
    return value


def _stem_spanish_token(token: str) -> str:
    """
    Stemming plural fonotáctico del español técnico:
    - '-CES' -> '-Z' (LUCES -> LUZ, CRUCES -> CRUZ)
    - Vocal + [DLNR] + 'ES' -> quita 'ES' (PAREDES -> PARED, PANELES -> PANEL,
      MATERIALES -> MATERIAL, INTERIORES -> INTERIOR, CONEXIONES -> CONEXION)
    - Consonante + [DLNR] + 'ES' o vocal + 'S' -> quita 'S' (CABLES -> CABLE,
      COBRES -> COBRE, BLOQUES -> BLOQUE, TUBERIAS -> TUBERIA)
    """
    if len(token) > 4 and token.endswith("CES"):
        return token[:-3] + "Z"
    if len(token) > 4 and token.endswith("ES") and token[-3] in "DLNR" and token[-4] in "AEIOU":
        return token[:-2]
    if len(token) > 3 and token.endswith("S"):
        return token[:-1]
    return token


def _tokenize_for_lexical_idf(value: str) -> List[str]:
    """Extrae tokens alfanuméricos normalizados (>=3 caracteres, no puramente numéricos) con stemming."""
    if not value or not isinstance(value, str):
        return []
    cleaned = _UI_UNIT_CLAUSE_RE.sub(" ", _strip_negative_exclusion_clauses(value))
    return [
        _stem_spanish_token(tok)
        for tok in _LEX_TOKEN_RE.findall(_strip_accents_upper(cleaned))
        if len(tok) >= 3 and not tok.isdigit()
    ]


MATERIAL_CATEGORIES: Dict[str, Dict[str, List[str]]] = {
    "tuberia": {
        "POLIPROPILENO": [r"\bPOLIPROPILENO\b", r"\bPPR\b", r"\bPOLIFUSION\b"],
        "PEAD": [r"\bPEAD\b", r"\bPOLIETILENO DE ALTA DENSIDAD\b", r"\bPOLIETILENO\b"],
        "PVC": [r"\bPVC\b", r"\bCPVC\b", r"\bPOLICLORURO\b"],
        "COBRE": [r"\bCOBRE\b"],
        "HIERRO_GALVANIZADO": [r"\bHIERRO GALVANIZADO\b", r"\bHG\b", r"\bGALVANIZADO\b"],
        "HIERRO_FUNDIDO": [r"\bHIERRO FUNDIDO\b", r"\bHF\b"],
        "ACERO": [
            r"\bACERO AL CARBONO\b",
            r"\bACERO INOXIDABLE\b",
            r"\bACERO NEGRO\b",
            r"\bTUBERIA\s+DE\s+ACERO\b",
            r"\bTUBO\s+DE\s+ACERO\b",
            r"\bASTM\s+A-?53\b",
        ],
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
    },
    "elemento_constructivo_civil": {
        "DINTEL_MACHON": [
            r"(?<!PARA\s)(?<!EN\s)\bDINTEL(ES)?\b",
            r"\bMACHON(ES)?\b",
            r"\bVIGA(S)?\s+DE\s+CORONA\b",
            r"\bVIGA(S)?\s+DE\s+RIOSTRA\b",
        ],
        "MEDIA_CANA": [r"\bMEDIA\s+CANA\b"],
        "PENDIENTE_LOSA": [
            r"\bPENDIENTE(S)?\s+EN\s+LOSA(S)?\b",
            r"\bCONSTRUCCION\s+DE\s+PENDIENTE(S)?\b",
        ],
        "BROCAL_CUNETA": [r"\bBROCAL(ES)?\b", r"\bCUNETA(S)?\b"],
        "RODAPIE": [r"\bRODAPIE(S)?\b"],
        "GOTERO": [r"\bGOTERO(S)?\b"],
        "FRISO_REVESTIMIENTO": [
            r"\bFRISO(S)?\b",
            r"\bREVOQUE(S)?\b",
            r"\bREVESTIMIENTO\s+(?:INTERIOR|EXTERIOR|DE\s+PARED(ES)?|EN\s+PARED(ES)?)\b",
            r"\bENLUCIDO\b",
        ],
    },
    "pintura_recubrimiento": {
        "EPOXICA": [r"\bEPOXI\w*\b"],
        "ESMALTE": [r"\bESMALTE\b", r"\bALQUIDIC\w*\b", r"\bPINTURA\s+DE\s+ACEITE\b"],
        "CAUCHO": [r"\bCAUCHO\b", r"\bLATEX\b", r"\bEMULSION\b", r"\bVINILICA\b"],
        "POLIURETANO": [r"\bPOLIURETANO\b"],
        "TRAFICO": [r"\bTRAFICO\b", r"\bTERMOPLASTIC\w*\b"],
        "ANTICORROSIVO": [r"\bANTICORROSIV\w*\b", r"\bCROMATO\b", r"\bMINIO\b", r"\bFONDO\s+DE\s+HERRERIA\b"],
    },
    "pisos_revestimiento": {
        "PORCELANATO": [r"\bPORCELANATO\b", r"\bPORCELANICO\b"],
        "CERAMICA": [r"\bCERAMIC\w*\b", r"\bBALDOSA\b", r"\bAZULEJO\b"],
        "CAICO": [r"\bCAICO\b", r"\bTERRACOTA\b", r"\bARCILLA\s+VITRIFICADA\b"],
        "GRANITO": [r"\bGRANITO\b", r"\bMARMOL\b"],
        "VINIL": [r"\bVINIL\w*\b", r"\bPVC\s+PISO\b", r"\bLINOLEO\b"],
        "CEMENTO_PULIDO": [r"\bCEMENTO\s+PULIDO\b", r"\bMICROCEMENTO\b"],
    },
    "impermeabilizacion": {
        "MANTO_ASFALTICO": [r"\bMANTO\b", r"\bTERMOSOLDABLE\b", r"\bEDIL\b"],
        "PINTURA_ASFALTICA": [r"\bPRIMER\s+ASFALTICO\b", r"\bIMPRIMACION\b", r"\bPINTURA\s+ASFALTICA\b"],
        "MEMBRANA_LIQUIDA": [r"\bPOLIURETANO\s+LIQUIDO\b", r"\bMEMBRANA\s+ACRILICA\b", r"\bIMPERMEABILIZANTE\s+ACRILICO\b"],
    },
    "cubiertas_techos": {
        "ACEROLIT": [r"\bACEROLIT\b", r"\bLAMINA\s+TERMOACUSTICA\b", r"\bTERMOACUSTIC\w*\b"],
        "TEJA": [r"\bTEJA\b", r"\bCRIOLITA\b"],
        "MACHIHEMBRADO": [r"\bMACHIHEMBRADO\b", r"\bMACHIMBRADO\b"],
        "LOSACERO": [r"\bLOSACERO\b", r"\bSOFALIT\b", r"\bLAMINA\s+DE\s+LOSA\b"],
    },
    "conductores_electricos": {
        "COBRE": [r"\bCABLE\w*\s+(?:DE\s+)?COBRE\b", r"\bCONDUCTOR\w*\s+(?:DE\s+)?COBRE\b"],
        "ALUMINIO": [
            r"\bCABLE\w*\s+(?:DE\s+)?ALUMINIO\b",
            r"\bCONDUCTOR\w*\s+(?:DE\s+)?ALUMINIO\b",
            r"\bARVIDAL\b",
            r"\bACSR\b",
        ],
    },
    "carpinteria_cerramientos": {
        "MADERA": [r"\bPUERTA\w*\s+(?:DE\s+)?MADERA\b", r"\bENTAMBORAD\w*\b", r"\bVENTANA\w*\s+(?:DE\s+)?MADERA\b"],
        "HIERRO_ACERO": [
            r"\bPUERTA\w*\s+METALIC\w*\b",
            r"\bPUERTA\w*\s+(?:DE\s+)?HIERRO\b",
            r"\bVENTANA\w*\s+(?:DE\s+)?HIERRO\b",
            r"\bREJA\w*\s+(?:DE\s+)?HIERRO\b",
        ],
        "ALUMINIO_VIDRIO": [
            r"\bVENTANA\w*\s+(?:DE\s+)?ALUMINIO\b",
            r"\bPUERTA\w*\s+(?:DE\s+)?ALUMINIO\b",
            r"\bVIDRIO\s+TEMPLADO\b",
            r"\bCARPINTERIA\s+DE\s+ALUMINIO\b",
        ],
    },
    "cercas_perimetrales": {
        "MALLA_CICLON": [r"\bMALLA\s+CICLON\b", r"\bALFAJOL\b"],
        "CONCERTINA": [r"\bCONCERTINA\b"],
        "ALAMBRE_PUAS": [r"\bALAMBRE\s+DE\s+PUAS\b"],
    },
}


def detect_materials(text_input: str) -> Dict[str, Set[str]]:
    """Detecta materiales y elementos constructivos técnicos por categoría en un texto dado (insensible a tildes y excluyendo cláusulas negativas)."""
    if not text_input or not isinstance(text_input, str):
        return {}
    upper = _strip_accents_upper(_strip_negative_exclusion_clauses(text_input))
    is_signage = any(s in upper for s in ["SENAL", "FOTOLUMINISCENTE", "MODULO DE IDENTIFICACION"])
    found: Dict[str, Set[str]] = {}
    for cat_name, materials in MATERIAL_CATEGORIES.items():
        for mat_name, patterns in materials.items():
            if cat_name == "elemento_constructivo_civil" and mat_name == "DINTEL_MACHON" and is_signage:
                continue
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
            cls._instance._lex_postings = {}
            cls._instance._lex_idf = {}
            cls._instance._lex_stops = set()
            cls._instance._lex_desc_map = {}
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

    def _ensure_lexical_index(self, db: Session) -> None:
        """
        Inicializa una sola vez en memoria el índice invertido IDF sobre cost360_items.
        Elimina el sesgo de muletillas contractuales y el corte duro de 1000 filas.
        """
        if self._lex_postings:
            return
        if db is None:
            raise ValueError("La sesion de base de datos es requerida para construir el indice lexico.")

        try:
            rows = db.execute(
                text('SELECT "CodPar", "Descri" FROM public.cost360_items WHERE "CodPar" IS NOT NULL')
            ).fetchall()
            postings: Dict[str, List[str]] = defaultdict(list)
            df_counts: Dict[str, int] = defaultdict(int)
            desc_map: Dict[str, str] = {}

            for row in rows:
                cod = str(row.CodPar)
                desc = str(row.Descri or "")
                desc_map[cod] = desc
                unique_stems = set(_tokenize_for_lexical_idf(desc))
                for stem in unique_stems:
                    postings[stem].append(cod)
                    df_counts[stem] += 1

            n_docs = max(len(desc_map), 1)
            idf_map = {
                stem: math.log((n_docs + 1.0) / (count + 1.0))
                for stem, count in df_counts.items()
            }
            df_stops = {
                stem for stem, count in df_counts.items()
                if (count / n_docs) > _LEX_MAX_DF_RATIO
            }

            self._lex_postings = dict(postings)
            self._lex_idf = idf_map
            self._lex_stops = df_stops | _CONTRACTUAL_STOP_STEMS
            self._lex_desc_map = desc_map
            logger.info(
                "Indice lexico IDF en memoria inicializado con %d partidas y %d terminos.",
                n_docs,
                len(idf_map),
            )
        except Exception as exc:
            db.rollback()
            logger.error("Error inicializando el indice lexico IDF en memoria: %s", exc, exc_info=True)

    def extract_main_chunk(self, query: str) -> str:
        """
        Limpia el sufijo de serialización de unidad de la UI ('unidad ml', 'unidad und', etc.)
        y recorta únicamente cláusulas de exclusión negativa ('sin incluir', 'no incluye', 'sin mixer').
        """
        if not query or not isinstance(query, str):
            return ""

        cleaned = _UI_UNIT_CLAUSE_RE.sub(" ", query)
        splitters = re.compile(
            r'\b(sin incluir|no incluye|sin empleo de|sin uso de|sin maquinaria|sin equipo|sin mixer)\b',
            re.IGNORECASE,
        )
        parts = splitters.split(cleaned)
        if parts:
            main_chunk = parts[0].strip(" ,.-")
            return main_chunk if len(main_chunk) > 5 else cleaned.strip(" ,.-")
        return cleaned.strip(" ,.-")

    def lexical_search(self, db: Session, query: str, limit: int = 50) -> List[Dict[str, Any]]:
        """
        Búsqueda Léxica ponderada por IDF con stemming técnico en español y filtrado
        de muletillas contractuales. Si el índice en memoria está disponible, evalúa el
        catálogo completo sin sesgo por longitud ni corte prematuro; de lo contrario,
        usa PostgreSQL Full-Text Search como respaldo.
        """
        if not query or not isinstance(query, str) or db is None:
            return []

        self._ensure_lexical_index(db)
        if self._lex_postings:
            q_stems = _tokenize_for_lexical_idf(query)
            unique_stems: List[str] = []
            seen: Set[str] = set()
            for stem in q_stems:
                if stem not in seen:
                    seen.add(stem)
                    unique_stems.append(stem)

            informative = [
                stem for stem in unique_stems
                if stem not in self._lex_stops and stem in self._lex_idf
            ]
            if not informative:
                informative = [stem for stem in unique_stems if stem in self._lex_idf]
            if not informative:
                return []

            has_primary_elem = any(s in _PRIMARY_CONSTRUCTIVE_ELEMENT_STEMS for s in informative)
            has_generic_binder = any(s in _GENERIC_BINDER_STEMS for s in informative)

            scores: Dict[str, float] = defaultdict(float)
            for stem in informative:
                weight = self._lex_idf[stem]
                if has_primary_elem and has_generic_binder:
                    if stem in _PRIMARY_CONSTRUCTIVE_ELEMENT_STEMS:
                        weight *= 2.5
                    elif stem in _GENERIC_BINDER_STEMS:
                        weight *= 0.45
                for cod in self._lex_postings.get(stem, ()):
                    scores[cod] += weight

            if not scores:
                return []

            ranked = sorted(scores.items(), key=lambda x: x[1], reverse=True)[:limit]
            return [
                {
                    "id": cod,
                    "score": float(sc),
                    "desc": self._lex_desc_map.get(cod, ""),
                }
                for cod, sc in ranked
            ]

        # Respaldo en PostgreSQL si el índice en memoria no pudo construirse
        cleaned = _UI_UNIT_CLAUSE_RE.sub(" ", query)
        raw_words = re.findall(r'[a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]+', cleaned)
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
        con el score Léxico ponderado por IDF sobre el catálogo completo.
        Si valid_ids se proporciona, solo busca en esos IDs.
        """
        if not query or not isinstance(query, str):
            raise ValueError("La consulta debe ser una cadena no vacia.")
        if db is None:
            raise ValueError("La sesion de base de datos es requerida.")

        # 1. Expandir siglas técnicas y sinónimos para asegurar coincidencia léxica y semántica
        expanded_query = expand_technical_synonyms(query)
        main_query = self.extract_main_chunk(expanded_query)

        # 2. Puntaje Léxico IDF sobre todo el catálogo (sin corte arbitrario de 1000 filas)
        self._ensure_lexical_index(db)
        lex_limit = max(len(self._lex_desc_map), 1000)
        lexical_results = self.lexical_search(db, main_query, limit=lex_limit)
        lexical_scores = {r['id']: r['score'] for r in lexical_results}
        max_lex_score = max(lexical_scores.values()) if lexical_scores else 1.0
        if max_lex_score == 0:
            max_lex_score = 1.0

        # 3. Puntaje Semántico (RAG)
        semantic_scores: Dict[str, float] = {}
        if self.is_loaded and self.embeddings is not None:
            try:
                query_embedding = self.encode_query(main_query)
                norm_query = np.linalg.norm(query_embedding)
                norm_embeddings = np.linalg.norm(self.embeddings, axis=1)
                dot_product = np.dot(self.embeddings, query_embedding.T).flatten()
                sem_similarities = dot_product / (norm_embeddings * norm_query + 1e-10)

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
            except Exception as exc:
                logger.warning("Fallo en vectorización semántica de '%s': %s. Usando fallback léxico calibrado.", main_query, exc)
                semantic_scores = {}

        # 4. Fusión Híbrida Equilibrada o Fallback Léxico Calibrado
        hybrid_results = []
        if semantic_scores:
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
        else:
            # Fallback 100% Léxico calibrado: garantiza candidatos válidos cuando el modelo semántico no responde
            for r in lexical_results:
                raw_lex = r['score']
                norm_lex = raw_lex / max_lex_score
                # Escalar de 0.65 a 0.88 para superar el umbral de Capa 2 (0.32) con partidas de obra válidas
                calibrated_score = 0.65 + (norm_lex * 0.23)
                hybrid_results.append({
                    "id": r['id'],
                    "score": calibrated_score,
                    "sem_score": calibrated_score,
                    "lex_score": norm_lex
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
                    desc_map: Dict[str, str] = {}
                    missing_ids: List[str] = []
                    for cid in eval_ids:
                        cached_desc = self._lex_desc_map.get(cid)
                        if cached_desc is not None:
                            desc_map[cid] = cached_desc
                        else:
                            missing_ids.append(cid)

                    if missing_ids:
                        sql_desc = text('SELECT "CodPar", "Descri" FROM cost360_items WHERE "CodPar" IN :id_tuple')
                        desc_rows = db.execute(sql_desc, {"id_tuple": tuple(missing_ids)}).fetchall()
                        for row in desc_rows:
                            desc_map[row.CodPar] = row.Descri

                    for candidate in top_candidates:
                        desc = desc_map.get(candidate["id"], "")
                        score_mod = 0.0

                        # 4a. Ponderación por Material Técnico y Elemento Constructivo
                        if query_mats:
                            item_mats = detect_materials(desc)
                            for cat, q_mat_set in query_mats.items():
                                it_mat_set = item_mats.get(cat, set())
                                match_bonus = 0.18 if cat == "elemento_constructivo_civil" else 0.12
                                conflict_pen = 0.18 if cat == "elemento_constructivo_civil" else 0.08
                                # Coincidencia exacta del material o elemento constructivo solicitado
                                if q_mat_set & it_mat_set:
                                    score_mod += match_bonus
                                # Conflicto con material o elemento constructivo incompatible de la misma categoría
                                elif it_mat_set and not (q_mat_set & it_mat_set):
                                    score_mod -= conflict_pen

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
