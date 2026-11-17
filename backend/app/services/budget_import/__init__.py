"""Orquestador del importador de presupuestos desde archivo."""
import logging
from pathlib import Path
from typing import Any, Dict, List

from sqlalchemy.orm import Session

from .apu_workbook import extract_from_apu_workbook, is_apu_workbook
from .errors import BudgetImportError, FileExtractionError
from .extractors import _looks_like_stop_row, _normalize_unit, extract_from_file
from .matching import find_candidates, refine_with_llm
from .structuring import MAX_ITEMS, structure_text

logger = logging.getLogger(__name__)


def _fallback_name(filename: str) -> str:
    return Path(filename or "").stem.replace("_", " ").replace("-", " ").strip().title() or "Presupuesto importado"


def _finalize_items(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    result: List[Dict[str, Any]] = []
    seen = set()
    for raw in items:
        description = str(raw.get("description") or "").strip()
        if len(description) < 3 or _looks_like_stop_row(description):
            continue

        is_chapter = bool(raw.get("is_chapter"))
        unit = "" if is_chapter else (_normalize_unit(raw.get("unit")) or "und")
        try:
            quantity = float(raw.get("quantity") or 0.0)
        except (TypeError, ValueError):
            quantity = 0.0
        quantity = max(0.0, quantity)

        code = str(raw.get("code") or "").strip()
        cov_par = str(raw.get("cov_par") or "").strip()
        # Clave única para evitar duplicados reales sin descartar partidas legítimas que comparten código (ej. S/C)
        key = (code.lower(), description.lower(), unit.lower(), round(quantity, 4), is_chapter)
        if key in seen:
            continue
        seen.add(key)

        result.append({
            "code": code[:80],
            "cov_par": cov_par[:80] if cov_par else "",
            "description": description[:600],
            "unit": unit,
            "quantity": quantity,
            "is_chapter": is_chapter,
            "calculation": str(raw.get("calculation") or "").strip(),
            "confidence": str(raw.get("confidence") or "").strip(),
            "warnings": list(raw.get("warnings") or []),
        })
        if len(result) >= MAX_ITEMS:
            break
    return result


def build_preview(data: bytes, filename: str, db: Session, mode: str = "budget") -> Dict[str, Any]:
    """Extrae, estructura y cruza contra la base maestra todas las partidas del archivo."""
    # 0. Detección prioritaria de Libros de APUs (Excel con hojas modelo APU)
    ext = Path(filename or "").suffix.lower()
    if mode == "apu_workbook" or (mode == "budget" and ext in {".xlsx", ".xlsm"} and is_apu_workbook(data)):
        return extract_from_apu_workbook(data, filename)

    extracted = extract_from_file(data, filename, db)
    items: List[Dict[str, Any]] = list(extracted.get("items") or [])
    header: Dict[str, Any] = dict(extracted.get("header") or {})
    warnings: List[str] = list(extracted.get("warnings") or [])
    source_type = extracted.get("source_type") or "unknown"

    if not items:
        text = extracted.get("text") or ""
        if not text.strip():
            raise FileExtractionError("No se pudo extraer contenido del archivo.")
        structured = structure_text(text, filename)
        items = list(structured.get("items") or [])
        structured_header = structured.get("header") or {}
        header = {
            "budget_name": header.get("budget_name") or structured_header.get("budget_name"),
            "project_name": header.get("project_name") or structured_header.get("project_name"),
            "client_name": header.get("client_name") or structured_header.get("client_name"),
            "currency": header.get("currency") or structured_header.get("currency") or "USD",
        }
        warnings.extend(structured.get("warnings") or [])

    items = _finalize_items(items)
    if not items:
        raise BudgetImportError("No se encontraron partidas válidas en el archivo.")

    for index, item in enumerate(items, start=1):
        item["row"] = index
        candidates = [] if item["is_chapter"] else find_candidates(
            db,
            item["description"],
            code=item["code"],
            unit=item["unit"],
            limit=8,
        )
        item["candidates"] = candidates
        item["selected_cod_par"] = None
        item["has_covenin_code_match"] = False

    for item in items:
        item["candidates"] = item.get("candidates", [])[:5]
        if item.get("is_chapter"):
            item["has_covenin_code_match"] = False
            item["selected_cod_par"] = None
            continue

        # 1. Coincidencia estricta por código COVENIN en la base de datos
        code_candidates = [c for c in item["candidates"] if c.get("match_type") == "code"]
        if code_candidates:
            item["has_covenin_code_match"] = True
            item["selected_cod_par"] = code_candidates[0]["cod_par"]
            continue

        # 2. Coincidencia exacta por descripción normalizada en la base de datos
        exact_desc_candidates = [c for c in item["candidates"] if c.get("match_type") == "exact_description"]
        if exact_desc_candidates:
            item["has_covenin_code_match"] = False
            item["selected_cod_par"] = exact_desc_candidates[0]["cod_par"]
            continue

        item["has_covenin_code_match"] = False
        item["selected_cod_par"] = None

    # 3. Cruce semántico por descripción con LLM para las partidas sin match directo de código o descripción exacta.
    # Si alguna candidata corresponde plenamente al trabajo descrito, refine_with_llm asigna selected_cod_par;
    # si ninguna corresponde, la deja sin asignar (None) para que se genere únicamente la que haga falta.
    try:
        refine_with_llm(items)
    except Exception as exc:
        logger.warning("No se pudo refinar coincidencias por descripción con LLM: %s", exc)

    # Respaldo determinista si el LLM no evaluó la fila (ni la rechazó explícitamente)
    for item in items:
        if item.get("is_chapter") or item.get("selected_cod_par") or item.get("llm_rejected"):
            continue
        candidates = item.get("candidates") or []
        if candidates and float(candidates[0].get("score") or 0.0) >= 0.85:
            item["selected_cod_par"] = candidates[0]["cod_par"]

    matched_total = sum(1 for item in items if not item["is_chapter"] and item.get("selected_cod_par"))
    pending_ai = sum(1 for item in items if not item["is_chapter"] and not item.get("selected_cod_par"))
    chapters = sum(1 for item in items if item["is_chapter"])

    header["budget_name"] = (header.get("budget_name") or _fallback_name(filename)).strip()[:250]
    currency = str(header.get("currency") or "USD").upper()
    header["currency"] = "VES" if currency in {"VES", "BS", "BSF", "BOLIVAR", "BOLÍVAR"} else "USD"
    header["project_name"] = (header.get("project_name") or None)
    header["client_name"] = (header.get("client_name") or None)
    raw_iva = header.get("iva_percent")
    header["iva_percent"] = float(raw_iva) if (raw_iva is not None and float(raw_iva) >= 1.0) else 16.0

    return {
        "filename": filename,
        "source_type": source_type,
        "header": header,
        "items": items,
        "stats": {
            "total": len(items),
            "matched": matched_total,
            "selected": matched_total,
            "pending": pending_ai,
            "generic": 0,
            "chapters": chapters,
        },
        "warnings": warnings,
    }
