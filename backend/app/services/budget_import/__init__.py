"""Orquestador del importador de presupuestos desde archivo."""
import logging
from pathlib import Path
from typing import Any, Dict, List

from sqlalchemy.orm import Session

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

        key = (description.lower(), unit, round(quantity, 3), is_chapter)
        if key in seen:
            continue
        seen.add(key)

        result.append({
            "code": str(raw.get("code") or "")[:80],
            "description": description[:600],
            "unit": unit,
            "quantity": quantity,
            "is_chapter": is_chapter,
        })
        if len(result) >= MAX_ITEMS:
            break
    return result


def build_preview(data: bytes, filename: str, db: Session) -> Dict[str, Any]:
    """Extrae, estructura y cruza contra la base maestra todas las partidas del archivo."""
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
        item["selected_cod_par"] = candidates[0]["cod_par"] if candidates else None

    refine_with_llm(items)

    for item in items:
        if item.get("llm_rejected"):
            item["selected_cod_par"] = None
        elif item["candidates"]:
            item["selected_cod_par"] = item["candidates"][0]["cod_par"]
        else:
            item["selected_cod_par"] = None
        item["candidates"] = item["candidates"][:5]

    matched = sum(1 for item in items if not item["is_chapter"] and item["candidates"])
    generic = sum(1 for item in items if not item["is_chapter"] and not item["candidates"])
    chapters = sum(1 for item in items if item["is_chapter"])

    header["budget_name"] = (header.get("budget_name") or _fallback_name(filename)).strip()[:250]
    currency = str(header.get("currency") or "USD").upper()
    header["currency"] = "VES" if currency in {"VES", "BS", "BSF", "BOLIVAR", "BOLÍVAR"} else "USD"
    header["project_name"] = (header.get("project_name") or None)
    header["client_name"] = (header.get("client_name") or None)

    return {
        "filename": filename,
        "source_type": source_type,
        "header": header,
        "items": items,
        "stats": {
            "total": len(items),
            "matched": matched,
            "generic": generic,
            "chapters": chapters,
        },
        "warnings": warnings,
    }
