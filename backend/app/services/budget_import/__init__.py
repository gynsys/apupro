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

        code = str(raw.get("code") or "").strip()
        key = ("code", code) if code else (description.lower(), unit, round(quantity, 3), is_chapter)
        if key in seen:
            continue
        seen.add(key)

        result.append({
            "code": code[:80],
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
    extracted = extract_from_file(data, filename, db)
    items: List[Dict[str, Any]] = list(extracted.get("items") or [])
    header: Dict[str, Any] = dict(extracted.get("header") or {})
    warnings: List[str] = list(extracted.get("warnings") or [])
    source_type = extracted.get("source_type") or "unknown"

    if mode == "compute_notes":
        text = extracted.get("text") or ""
        if not text.strip():
            raise FileExtractionError("No se pudo extraer texto del apunte de cómputos.")
        from .compute_notes import extract_compute_items
        structured = extract_compute_items(text, filename)
        items = list(structured.get("items") or [])
        structured_header = structured.get("header") or {}
        header = {
            "budget_name": header.get("budget_name") or structured_header.get("budget_name"),
            "project_name": header.get("project_name") or structured_header.get("project_name"),
            "client_name": header.get("client_name") or structured_header.get("client_name"),
            "currency": header.get("currency") or structured_header.get("currency") or "USD",
        }
        warnings.extend(structured.get("warnings") or [])
    elif not items:
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

    if mode != "compute_notes":
        refine_with_llm(items)

    for item in items:
        item["candidates"] = item.get("candidates", [])[:5]
        if item.get("is_chapter"):
            item["has_covenin_code_match"] = False
            item["selected_cod_par"] = None
            continue

        # Coincidencia estricta por código COVENIN en la base de datos
        code_candidates = [c for c in item["candidates"] if c.get("match_type") == "code"]
        if code_candidates:
            item["has_covenin_code_match"] = True
            item["selected_cod_par"] = code_candidates[0]["cod_par"]
        elif mode == "compute_notes" and item["candidates"]:
            top = item["candidates"][0]
            score = float(top.get("score") or 0.0)
            if score >= 0.45 or top.get("match_type") in {"code", "exact_description"}:
                item["has_covenin_code_match"] = True
                item["selected_cod_par"] = top["cod_par"]
            else:
                item["has_covenin_code_match"] = False
                item["selected_cod_par"] = None
        else:
            # Si no coincide con un código COVENIN de la BD, NO preseleccionar candidata
            # para que se genere el APU con IA conservando el código del archivo.
            item["has_covenin_code_match"] = False
            item["selected_cod_par"] = None

    covenin_matched = sum(1 for item in items if not item["is_chapter"] and item.get("has_covenin_code_match"))
    pending_ai = sum(1 for item in items if not item["is_chapter"] and not item.get("has_covenin_code_match"))
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
            "matched": covenin_matched,
            "selected": covenin_matched,
            "pending": pending_ai,
            "generic": 0,
            "chapters": chapters,
        },
        "warnings": warnings,
    }
