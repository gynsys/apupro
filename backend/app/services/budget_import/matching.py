"""Búsqueda de partidas candidatas en la base maestra para cada fila importada."""
import logging
import re
from typing import Any, Dict, List, Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db.models.cost360 import CostItem
from app.services.ai_search import ai_engine
from app.services.llm_router import call_llm_json

from .extractors import _normalize_header, _normalize_unit

logger = logging.getLogger(__name__)

MAX_CANDIDATES = 5
_CODED_COVENIN_RE = re.compile(r"^[A-Za-z]{1,2}[\.\-]?[0-9]")
_STOPWORDS = {
    "de", "del", "la", "el", "los", "las", "en", "para", "con", "por", "sin",
    "una", "uno", "un", "y", "o", "al", "a", "cm", "mm", "m2", "m3", "kg",
    "und", "pza", "gl", "segun", "tipo", "sobre", "hasta", "desde", "mas",
}
_DEMOLITION_TERMS = ("DEMOLICION", "REMOCION", "ROTURA", "DESINCORPORACION", "DESMONTE", "PICADO")
_TRANSPORT_TERMS = ("CARGA A MANO", "CARGA CON", "TRANSPORTE", "ACARREO", "BOTE DE MATERIAL", "RETIRO DE ESCOMBRO")


def _tokenize(text: str) -> set:
    normalized = _normalize_header(text)
    return {token for token in normalized.split() if len(token) > 2 and token not in _STOPWORDS}


def _has_any(text: str, terms) -> bool:
    upper = text.upper()
    return any(term in upper for term in terms)


def _normalize_code(value: Any) -> str:
    text = str(value or "").strip().upper()
    return re.sub(r"[.\-\s]", "", text)


def _unit_matches(query_unit: str, candidate_unit: str) -> bool:
    if not query_unit or not candidate_unit:
        return False
    return _normalize_unit(query_unit) == _normalize_unit(candidate_unit)


def _is_coded(cov_par: Optional[str]) -> bool:
    if not cov_par:
        return False
    value = str(cov_par).strip()
    if not value or "S/C" in value.upper():
        return False
    return bool(_CODED_COVENIN_RE.match(value))


def _exact_code_rows(db: Session, code: str) -> List[Any]:
    normalized = _normalize_code(code)
    if not normalized or len(normalized) < 4:
        return []
    if not any(ch.isalpha() for ch in normalized):
        return []

    sql = text("""
        SELECT "CodPar", "CovPar", "Descri", "UniPar"
        FROM cost360_items
        WHERE upper(replace(replace(replace(coalesce("CovPar", ''), '.', ''), '-', ''), ' ', '')) = :norm
           OR upper(replace(replace(coalesce("CodPar", ''), '.', ''), ' ', '')) = :norm
        LIMIT 5
    """)
    try:
        rows = db.execute(sql, {"norm": normalized}).fetchall()
        if rows:
            return rows

        # Prefijo: "E411" puede corresponder a "E411S/C" o variantes.
        prefix_sql = text("""
            SELECT "CodPar", "CovPar", "Descri", "UniPar"
            FROM cost360_items
            WHERE upper(replace(replace(replace(coalesce("CovPar", ''), '.', ''), '-', ''), ' ', '')) LIKE :prefix
               OR upper(replace(replace(coalesce("CodPar", ''), '.', ''), ' ', '')) LIKE :prefix
            LIMIT 5
        """)
        return db.execute(prefix_sql, {"prefix": f"{normalized}%"}).fetchall()
    except Exception as exc:
        logger.warning("No se pudo buscar la partida por código '%s': %s", code, exc)
        db.rollback()
        return []


def _sql_candidates(db: Session, description: str, limit: int = 8) -> List[Any]:
    """Búsqueda de respaldo: FTS español + similitud de trigramas."""
    if not description or len(description.strip()) < 3:
        return []

    try:
        db.execute(text("SET LOCAL pg_trgm.similarity_threshold = 0.12"))
    except Exception:
        pass

    sql = text("""
        WITH params AS (
            SELECT plainto_tsquery('spanish', f_unaccent(:q)) AS tsq,
                   f_unaccent(lower(:q)) AS qn
        )
        SELECT i."CodPar", i."CovPar", i."Descri", i."UniPar",
               ts_rank(to_tsvector('spanish', f_unaccent(i."Descri")), p.tsq) AS rank,
               similarity(f_unaccent(lower(i."Descri")), p.qn) AS sim
        FROM cost360_items i, params p
        WHERE to_tsvector('spanish', f_unaccent(i."Descri")) @@ p.tsq
           OR f_unaccent(lower(i."Descri")) % p.qn
        ORDER BY (
            ts_rank(to_tsvector('spanish', f_unaccent(i."Descri")), p.tsq) * 4.0
            + similarity(f_unaccent(lower(i."Descri")), p.qn)
        ) DESC
        LIMIT :limit
    """)
    try:
        return db.execute(sql, {"q": description, "limit": limit}).fetchall()
    except Exception as exc:
        logger.warning("Fallo la búsqueda FTS/trigram para '%s': %s", description[:60], exc)
        db.rollback()
        return []


def find_candidates(
    db: Session,
    description: str,
    code: str = "",
    unit: str = "",
    limit: int = MAX_CANDIDATES,
) -> List[Dict[str, Any]]:
    """Devuelve hasta `limit` partidas candidatas ordenadas por afinidad."""
    description = (description or "").strip()
    candidates: Dict[str, Dict[str, Any]] = {}

    for row in _exact_code_rows(db, code):
        candidates[row.CodPar] = {
            "cod_par": row.CodPar,
            "cov_par": row.CovPar,
            "description": row.Descri or "",
            "unit": row.UniPar or "",
            "_raw_score": 1.0,
            "match_type": "code",
        }

    raw_results: List[Dict[str, Any]] = []
    if len(description) >= 4:
        try:
            if getattr(ai_engine, "is_loaded", False):
                raw_results = ai_engine.hybrid_search(db, description, limit=10)
            else:
                # Sin embeddings cargados, la búsqueda léxica IDF evita el re-ranking
                # técnico que puede desordenar candidatos correctos por palabras sueltas.
                raw_results = ai_engine.lexical_search(db, description, limit=12)
        except Exception as exc:
            logger.warning("Fallo la búsqueda híbrida para '%s': %s", description[:60], exc)

    score_by_id: Dict[str, float] = {}
    ordered_ids: List[str] = []
    for result in raw_results:
        candidate_id = result.get("id")
        if not candidate_id:
            continue
        if candidate_id not in score_by_id:
            ordered_ids.append(candidate_id)
        score_by_id[candidate_id] = max(score_by_id.get(candidate_id, 0.0), float(result.get("score") or 0.0))

    if not ordered_ids and description:
        for row in _sql_candidates(db, description):
            candidate_id = row.CodPar
            if candidate_id not in score_by_id:
                ordered_ids.append(candidate_id)
            # rank ~0.05-0.6, sim ~0.1-0.9
            score_by_id[candidate_id] = max(
                score_by_id.get(candidate_id, 0.0),
                float(row.rank or 0.0) * 4.0 + float(row.sim or 0.0),
            )

    if ordered_ids:
        rows = db.query(CostItem).filter(CostItem.CodPar.in_(ordered_ids)).all()
        by_id = {row.CodPar: row for row in rows}
        query_tokens = _tokenize(description)
        query_is_demolition = _has_any(description, _DEMOLITION_TERMS)
        query_is_transport = _has_any(description, _TRANSPORT_TERMS)
        max_raw = max(score_by_id.values()) if score_by_id else 1.0
        if max_raw <= 0:
            max_raw = 1.0

        for candidate_id in ordered_ids:
            row = by_id.get(candidate_id)
            if not row or candidate_id in candidates:
                continue

            score = score_by_id.get(candidate_id, 0.0) / max_raw
            description_upper = (row.Descri or "").upper()

            # Evita que una demolición/remoción gane cuando se pide construir o instalar.
            if not query_is_demolition and _has_any(description_upper, _DEMOLITION_TERMS):
                score -= 0.28
            # Evita que una fila de carga/acarreo gane cuando no se pidió transporte.
            if not query_is_transport and _has_any(description_upper, _TRANSPORT_TERMS):
                score -= 0.15

            candidate_tokens = _tokenize(row.Descri or "")
            if query_tokens:
                overlap = len(query_tokens & candidate_tokens) / len(query_tokens)
                score += 0.12 * overlap

            if _unit_matches(unit, row.UniPar or ""):
                score += 0.05
            if _is_coded(row.CovPar):
                score += 0.02

            candidates[candidate_id] = {
                "cod_par": row.CodPar,
                "cov_par": row.CovPar,
                "description": row.Descri or "",
                "unit": row.UniPar or "",
                "_raw_score": score,
                "match_type": "description",
            }

    ordered = sorted(
        candidates.values(),
        key=lambda candidate: (candidate["_raw_score"], candidate["match_type"] == "code"),
        reverse=True,
    )[:limit]

    result: List[Dict[str, Any]] = []
    for candidate in ordered:
        raw_score = candidate.pop("_raw_score", 0.0)
        candidate["score"] = round(min(0.99, max(0.0, raw_score)), 4)
        result.append(candidate)
    return result


# ---------------------------------------------------------------------------
# Re-ranking con LLM (una sola llamada por lote de partidas)
# ---------------------------------------------------------------------------

_REFINE_BATCH_SIZE = 40
_MAX_REFINE_BATCHES = 4


def _build_refine_prompt(batch: List[Dict[str, Any]]) -> str:
    import json

    return f"""
Eres un ingeniero de costos experto en presupuestos de obra venezolanos (normativa COVENIN).
Para cada partida importada de un archivo, elige entre sus candidatas la que MEJOR corresponda
técnicamente al trabajo descrito. Compara la acción (construir, demoler, instalar, pintar,
excavar, suministrar), el elemento constructivo, el material, las dimensiones y la unidad.

REGLAS:
1. Devuelve SOLO un objeto JSON con esta estructura:
   {{"selections": [{{"row": 1, "cod_par": "CODIGO_EXACTO_DE_LAS_CANDIDATAS O null", "confianza": "alta|media|baja", "motivo": "breve"}}]}}
2. Usa únicamente códigos que aparezcan en las candidatas de esa fila. NUNCA inventes códigos.
3. Si NINGUNA candidata corresponde al trabajo descrito, devuelve "cod_par": null.
4. Prioriza la coincidencia de acción y elemento sobre palabras sueltas.
5. Si la unidad de la partida importada difiere de la candidata, no la descartes: elige por afinidad técnica.

PARTIDAS Y CANDIDATAS:
{json.dumps(batch, ensure_ascii=False, indent=1)}
"""


def refine_with_llm(items: List[Dict[str, Any]]) -> None:
    """Reordena las candidatas usando el LLM como árbitro técnico.

    Modifica `items` en sitio: deja la mejor candidata primero y marca
    `selected_cod_par`. Si el LLM falla, se conserva el orden heurístico.
    """
    refinable = [item for item in items if not item.get("is_chapter") and item.get("candidates")]
    if not refinable:
        return

    for batch_index in range(0, len(refinable), _REFINE_BATCH_SIZE):
        if batch_index // _REFINE_BATCH_SIZE >= _MAX_REFINE_BATCHES:
            logger.info("Se alcanzó el máximo de lotes de re-ranking; el resto conserva el orden heurístico.")
            break

        batch_items = refinable[batch_index:batch_index + _REFINE_BATCH_SIZE]
        payload = [
            {
                "row": item["row"],
                "descripcion": item["description"],
                "unidad": item["unit"],
                "cantidad": item["quantity"],
                "candidatas": [
                    {
                        "cod_par": candidate["cod_par"],
                        "descripcion": candidate["description"],
                        "unidad": candidate["unit"],
                    }
                    for candidate in item["candidates"]
                ],
            }
            for item in batch_items
        ]

        try:
            data = call_llm_json(_build_refine_prompt(payload))
        except Exception as exc:
            logger.warning("No se pudo re-ranking con LLM (lote %s): %s", batch_index, exc)
            continue

        if isinstance(data, dict):
            selections = data.get("selections") or data.get("items") or []
        elif isinstance(data, list):
            selections = data
        else:
            selections = []
        if not isinstance(selections, list):
            continue

        by_row: Dict[int, Dict[str, Any]] = {}
        for selection in selections:
            if not isinstance(selection, dict):
                continue
            try:
                row = int(selection.get("row"))
            except (TypeError, ValueError):
                continue
            by_row[row] = selection

        for item in batch_items:
            selection = by_row.get(item["row"])
            if not selection:
                continue

            raw_code = selection.get("cod_par") or selection.get("codigo")
            if raw_code is None or str(raw_code).strip().lower() in {"null", "none", ""}:
                item["llm_rejected"] = True
                item["selected_cod_par"] = None
                continue

            code = str(raw_code).strip()
            chosen = next(
                (candidate for candidate in item["candidates"] if candidate["cod_par"] == code),
                None,
            )
            if not chosen:
                logger.info("El LLM propuso un código fuera de las candidatas (%s); se ignora.", code)
                continue

            item["candidates"].remove(chosen)
            item["candidates"].insert(0, chosen)
            item["selected_cod_par"] = code
            item.pop("llm_rejected", None)
