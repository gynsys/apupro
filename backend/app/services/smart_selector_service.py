"""
Smart Selector Service.

Genera preguntas discriminantes a partir de las partidas COVENIN disponibles,
SIN usar LLM. Permite al usuario seleccionar la partida base más adecuada
antes de activar la IA, reduciendo al mínimo el consumo de tokens.
"""

import logging
import unicodedata
from collections import defaultdict
from typing import Any, Dict, List, Optional, Set, Tuple

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.db.models.cost360 import (
    CostItem,
    CostAPUMaterial,
    CostAPUEquipment,
    CostAPULabor,
    CostMaterial,
    CostEquipment,
    CostLabor,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Stopwords: generales + dominio construcción (palabras que aparecen en TODAS
# las descripciones y no aportan discriminación)
# ---------------------------------------------------------------------------
STOPWORDS: Set[str] = {
    "de", "la", "el", "en", "con", "sin", "para", "y", "o", "los", "las", "del",
    "a", "un", "una", "segun", "se", "su", "por", "uso", "que", "al", "sus",
    "este", "esta", "como", "no", "mas", "pero", "son", "fue", "han", "ha",
    "me", "te", "mi", "sus", "del", "lo", "les",
    # Dominio construcción genérico
    "area", "medido", "medida", "incluye", "incluir", "incluyen", "incluyendo",
    "utilizando", "materiales", "material", "construccion", "infraestructura",
    "recuperacion", "correspondiente", "dimensiones", "nivel", "piso", "tipo",
    "clase", "metros", "metro", "total", "general", "obra", "parte", "mismo",
    "apilamiento", "acarreo", "demolicion", "demoliciones", "segun", "excluye",
    "medida", "medido", "medicion", "manera", "forma", "hasta", "desde",
    "sobre", "entre", "bajo", "fecha", "precio", "costo", "valor", "unidad",
    "ancho", "largo", "alto", "altura", "longitud", "fondo",
}

MIN_WORD_LEN: int = 4


# ---------------------------------------------------------------------------
# Utilidades de texto
# ---------------------------------------------------------------------------
def _normalize(text: str) -> str:
    """Quita acentos y convierte a minúsculas."""
    if not text:
        return ""
    nfkd = unicodedata.normalize("NFD", text.lower())
    return "".join(c for c in nfkd if not unicodedata.combining(c))


def _tokenize(description: str) -> Set[str]:
    """Tokeniza una descripción eliminando stopwords y palabras cortas."""
    if not description:
        return set()
    normalized = _normalize(description)
    # Reemplazar caracteres no alfabéticos con espacios
    cleaned = "".join(c if c.isalpha() else " " for c in normalized)
    return {
        w for w in cleaned.split()
        if len(w) >= MIN_WORD_LEN and w not in STOPWORDS
    }


# ---------------------------------------------------------------------------
# Algoritmo principal
# ---------------------------------------------------------------------------
def _build_inverted_index(items: List[CostItem]) -> Dict[str, Set[str]]:
    """
    Índice invertido: palabra → conjunto de CodPar que la contienen.
    Usa el tokenizador que elimina stopwords.
    """
    index: Dict[str, Set[str]] = defaultdict(set)
    for item in items:
        if not item.Descri:
            continue
        for token in _tokenize(item.Descri):
            index[token].add(item.CodPar)
    return dict(index)


def _find_discriminating_pairs(
    index: Dict[str, Set[str]],
    total: int,
    min_ratio: float = 0.08,
    max_ratio: float = 0.85,
) -> List[Tuple[str, str, float]]:
    """
    Encuentra pares de palabras mutuamente discriminantes:
    - Cada palabra aparece en 8%-85% de las partidas (no es universal)
    - Son casi mutuamente excluyentes (raramente juntas en la misma partida)

    Returns lista de (word_a, word_b, score) ordenada descendente.
    """
    discriminating = {
        word: codes
        for word, codes in index.items()
        if total > 0 and min_ratio <= len(codes) / total <= max_ratio
    }

    pairs: List[Tuple[str, str, float]] = []
    words = list(discriminating.keys())

    for i in range(len(words)):
        for j in range(i + 1, len(words)):
            word_a = words[i]
            word_b = words[j]
            set_a = discriminating[word_a]
            set_b = discriminating[word_b]

            intersection = len(set_a & set_b)
            union = len(set_a | set_b)
            if union == 0:
                continue

            jaccard = intersection / union        # Bajo → más exclusivos
            coverage = union / total              # Alto → cubren más partidas
            # Queremos alta cobertura y baja superposición
            score = coverage * (1.0 - jaccard)

            # Filtro: superposición < 30% del conjunto más pequeño
            max_single = max(len(set_a), len(set_b))
            if score > 0.10 and intersection < max_single * 0.30:
                pairs.append((word_a, word_b, score))

    pairs.sort(key=lambda x: x[2], reverse=True)
    return pairs


def _pairs_to_questions(
    pairs: List[Tuple[str, str, float]],
    max_questions: int = 4,
) -> List[Dict[str, Any]]:
    """
    Convierte pares discriminantes en preguntas con opciones.
    Evita reutilizar palabras ya usadas en preguntas anteriores.
    """
    questions: List[Dict[str, Any]] = []
    used_words: Set[str] = set()

    for word_a, word_b, score in pairs:
        if word_a in used_words or word_b in used_words:
            continue
        if len(questions) >= max_questions:
            break

        questions.append({
            "id": f"q{len(questions)}",
            "question": f"¿El elemento o trabajo involucra {word_a} o {word_b}?",
            "options": [
                {"value": word_a, "label": word_a.capitalize()},
                {"value": word_b, "label": word_b.capitalize()},
            ],
            "score": round(score, 3),
        })
        used_words.add(word_a)
        used_words.add(word_b)

    return questions


def _filter_candidates(
    items: List[CostItem],
    answers: Dict[str, str],
) -> List[CostItem]:
    """
    Filtra partidas candidatas según las respuestas del usuario.
    Cada respuesta retiene solo las que contienen esa palabra en su descripción.
    """
    candidates = items
    for _qid, selected_word in answers.items():
        normalized = _normalize(selected_word)
        candidates = [
            item for item in candidates
            if item.Descri and normalized in _normalize(item.Descri)
        ]
    return candidates if candidates else items  # nunca dejar vacío


def _score_candidates(
    candidates: List[CostItem],
    user_description: str,
) -> List[Tuple[CostItem, float]]:
    """
    Puntúa los candidatos por overlap de tokens con la descripción del usuario.
    """
    user_tokens = _tokenize(user_description)
    scored: List[Tuple[CostItem, float]] = []

    for item in candidates:
        item_tokens = _tokenize(item.Descri or "")
        if not item_tokens or not user_tokens:
            scored.append((item, 0.0))
            continue
        overlap = len(user_tokens & item_tokens) / max(len(user_tokens | item_tokens), 1)
        scored.append((item, overlap))

    scored.sort(key=lambda x: x[1], reverse=True)
    return scored


# ---------------------------------------------------------------------------
# Función pública principal
# ---------------------------------------------------------------------------
def get_smart_selector_data(
    db: Session,
    description: str,
    covenin_prefix: str,
    covenin_context: Optional[str] = None,
    answers: Optional[Dict[str, str]] = None,
) -> Dict[str, Any]:
    """
    Punto de entrada del Smart Selector.

    1. Carga todas las partidas del prefijo COVENIN (sin S/C).
    2. Aplica filtros basados en respuestas del usuario.
    3. Genera nuevas preguntas discriminantes sobre los candidatos actuales.
    4. Devuelve: questions, candidates, best_match, confidence.

    No llama a ningún LLM.
    """
    if not covenin_prefix:
        return {
            "error": "Se requiere un prefijo COVENIN",
            "questions": [],
            "candidates": [],
            "best_match": None,
            "confidence": 0.0,
            "ready_to_generate": False,
        }

    # --- Cargar partidas ---
    try:
        all_items: List[CostItem] = (
            db.query(CostItem)
            .filter(
                or_(
                    CostItem.CovPar.startswith(covenin_prefix),
                    CostItem.CodPar.startswith(covenin_prefix),
                )
            )
            .filter(~CostItem.CovPar.like("% S/C%"))
            .all()
        )
    except Exception as exc:
        logger.error("Error en get_smart_selector_data (query): %s", exc, exc_info=True)
        return {
            "error": str(exc),
            "questions": [],
            "candidates": [],
            "best_match": None,
            "confidence": 0.0,
            "ready_to_generate": False,
        }

    if not all_items:
        return {
            "error": f"No hay partidas clasificadas para el prefijo '{covenin_prefix}'. "
                     "Prueba con un prefijo más amplio o revisa los selectores.",
            "questions": [],
            "candidates": [],
            "best_match": None,
            "confidence": 0.0,
            "ready_to_generate": False,
        }

    # --- Aplicar respuestas del usuario ---
    answers = answers or {}
    filtered = _filter_candidates(all_items, answers)

    # --- Generar preguntas sobre los candidatos restantes ---
    index = _build_inverted_index(filtered)
    pairs = _find_discriminating_pairs(index, len(filtered))
    questions = _pairs_to_questions(pairs, max_questions=4)

    # Eliminar preguntas cuyas palabras ya fueron respondidas
    answered_words: Set[str] = {_normalize(v) for v in answers.values()}
    questions = [
        q for q in questions
        if not any(_normalize(opt["value"]) in answered_words for opt in q["options"])
    ]

    # --- Puntuar candidatos ---
    scored = _score_candidates(filtered, description)

    best_match = None
    confidence = 0.0
    if scored:
        best_item, best_score = scored[0]
        confidence = best_score
        best_match = {
            "codpar": best_item.CodPar,
            "covenin": best_item.CovPar,
            "descripcion": best_item.Descri,
            "unidad": best_item.UniPar,
            "score": round(best_score, 3),
        }

    # Lista limpia de top candidatos para mostrar en UI
    candidates_out = [
        {
            "codpar": item.CodPar,
            "covenin": item.CovPar,
            "descripcion": item.Descri,
            "unidad": item.UniPar,
            "score": round(score, 3),
        }
        for item, score in scored[:12]
    ]

    # Listo para generar cuando: sin más preguntas útiles O confianza alta O
    # el usuario respondió ≥ 2 preguntas
    ready = (
        len(questions) == 0
        or confidence > 0.35
        or len(answers) >= 2
    )

    return {
        "covenin_prefix": covenin_prefix,
        "covenin_context": covenin_context,
        "description": description,
        "answers_received": answers,
        "total_partidas": len(all_items),
        "candidates_count": len(filtered),
        "questions": questions,
        "candidates": candidates_out,
        "best_match": best_match,
        "confidence": round(confidence, 3),
        "ready_to_generate": ready,
    }


# ---------------------------------------------------------------------------
# Fetch full APU data for a given base partida code (used by the endpoint)
# ---------------------------------------------------------------------------
def fetch_base_apu_for_prompt(db: Session, codpar: str) -> Dict[str, Any]:
    """
    Recupera los datos completos del APU de una partida histórica para
    pasarlos al LLM como base de adaptación.
    """
    item = db.query(CostItem).filter(CostItem.CodPar == codpar).first()
    if not item:
        return {}

    mat_rows = (
        db.query(CostAPUMaterial, CostMaterial)
        .join(CostMaterial, CostAPUMaterial.CodIns == CostMaterial.CodMat)
        .filter(CostAPUMaterial.CodPar == codpar)
        .all()
    )
    eq_rows = (
        db.query(CostAPUEquipment, CostEquipment)
        .join(CostEquipment, CostAPUEquipment.CodIns == CostEquipment.CodEqu)
        .filter(CostAPUEquipment.CodPar == codpar)
        .all()
    )
    mo_rows = (
        db.query(CostAPULabor, CostLabor)
        .join(CostLabor, CostAPULabor.CodIns == CostLabor.CodMan)
        .filter(CostAPULabor.CodPar == codpar)
        .all()
    )

    return {
        "codpar": item.CodPar,
        "covenin": item.CovPar,
        "descripcion": item.Descri,
        "unidad": item.UniPar,
        "rendimiento": item.RenPar or 1.0,
        "materiales": [
            {
                "codigo": mat.CodMat,
                "descripcion": mat.Descri,
                "unidad": mat.UniMat,
                "cantidad": rel.CanIns,
                "desperdicio": getattr(rel, "Desper", 0.0) or 0.0,
                "precio_unitario": mat.CosMat or 0.0,
            }
            for rel, mat in mat_rows
        ],
        "equipos": [
            {
                "codigo": eq.CodEqu,
                "descripcion": eq.Descri,
                "cantidad": rel.CanIns,
                "depreciacion": getattr(rel, "Deprec", 1.0) or 1.0,
                "precio_diario": eq.CosDia or 0.0,
            }
            for rel, eq in eq_rows
        ],
        "mano_obra": [
            {
                "codigo": mo.CodMan,
                "descripcion": mo.Descri,
                "cantidad": rel.CanIns,
                "jornal": mo.Jornal or 0.0,
                "bono": mo.Bono or 0.0,
            }
            for rel, mo in mo_rows
        ],
    }
