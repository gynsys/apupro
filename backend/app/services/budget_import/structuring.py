"""Estructuración del texto extraído en partidas de presupuesto usando el LLM."""
import logging
import re
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.services.llm_router import call_llm_json

from .errors import StructuringError
from .extractors import _looks_like_stop_row, _normalize_header, _normalize_unit, parse_quantity

logger = logging.getLogger(__name__)

MAX_ITEMS = 300
MAX_CHUNK_CHARS = 12_000
MAX_CHUNKS = 5

_ITEM_SCHEMA = """{
  "budget_name": "Nombre del presupuesto si aparece, si no déjalo vacío",
  "project_name": "Nombre de la obra o proyecto si aparece",
  "client_name": "Cliente o contratante si aparece",
  "currency": "USD o VES",
  "items": [
    {
      "codigo": "código de la partida si aparece (puede ser vacío)",
      "descripcion": "descripción de la partida",
      "unidad": "m2, m3, m, und, pza, kg, gl, etc.",
      "cantidad": 0.0,
      "is_chapter": false
    }
  ]
}"""


def _chunk_text(text: str) -> List[str]:
    if len(text) <= MAX_CHUNK_CHARS:
        return [text]

    chunks: List[str] = []
    current: List[str] = []
    current_len = 0
    for line in text.splitlines():
        line_len = len(line) + 1
        if current and current_len + line_len > MAX_CHUNK_CHARS:
            chunks.append("\n".join(current))
            current = []
            current_len = 0
        if line_len > MAX_CHUNK_CHARS:
            for start in range(0, len(line), MAX_CHUNK_CHARS):
                chunks.append(line[start:start + MAX_CHUNK_CHARS])
            continue
        current.append(line)
        current_len += line_len
    if current:
        chunks.append("\n".join(current))
    return chunks[:MAX_CHUNKS]


def _build_prompt(chunk: str, chunk_index: int, total_chunks: int) -> str:
    fragment_note = (
        f"Este texto es el fragmento {chunk_index + 1} de {total_chunks}. "
        "Extrae únicamente las partidas que aparecen en este fragmento."
        if total_chunks > 1 else ""
    )
    return f"""
Eres un ingeniero de costos experto en presupuestos de obra venezolanos.
A continuación tienes el texto extraído de un archivo de presupuesto (Excel, PDF o imagen OCR).
{fragment_note}

Tu tarea es convertir el contenido en una lista LIMPIA de partidas de obra.

REGLAS OBLIGATORIAS:
1. Devuelve SOLO un objeto JSON válido, sin markdown ni explicaciones, con esta estructura exacta:
{_ITEM_SCHEMA}
2. Cada fila de la tabla debe ser una partida. NO inventes partidas que no estén en el texto.
3. Ignora por completo: totales, subtotales, IVA, montos globales, fechas, números de página, firmas, sellos, membretes y textos legales.
4. Si una fila es un título de capítulo/sección/rubro (por ejemplo "CAPÍTULO I: DEMOLICIONES") y no tiene cantidad, marca "is_chapter": true, "cantidad": 0 y "unidad": "".
5. Si la cantidad aparece con coma decimal venezolana (ej. "25,50"), conviértela a número: 25.5.
6. Si la unidad no aparece pero la partida sí, usa "und". No inventes unidades técnicas.
7. No repitas partidas idénticas. Mantén el orden del documento.
8. Si el documento no contiene partidas de obra, devuelve "items": [].

TEXTO DEL DOCUMENTO:
---
{chunk}
---
"""


def _first(data: Dict[str, Any], keys: List[str]) -> Any:
    for key in keys:
        value = data.get(key)
        if value not in (None, "", []):
            return value
    return None


def _as_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    if isinstance(value, str):
        return _normalize_header(value) in {"true", "si", "sí", "1", "yes", "capitulo", "capítulo"}
    return False


def _normalize_item(raw: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    if not isinstance(raw, dict):
        return None

    description = _first(raw, ["descripcion", "description", "concepto", "detalle", "partida", "actividad"])
    if description is None:
        return None
    description = re.sub(r"\s+", " ", str(description)).strip()
    if len(description) < 3 or _looks_like_stop_row(description):
        return None

    unit_raw = _first(raw, ["unidad", "unit", "und", "unidad_medida", "um"])
    unit = _normalize_unit(unit_raw) if unit_raw is not None else ""

    quantity = parse_quantity(_first(raw, ["cantidad", "quantity", "metrado", "cant"]))
    is_chapter = _as_bool(_first(raw, ["is_chapter", "es_capitulo", "capitulo", "chapter"]))
    if not is_chapter and quantity is None and not unit:
        # Filas sin cantidad ni unidad suelen ser títulos de capítulo.
        letters = [ch for ch in description if ch.isalpha()]
        is_chapter = bool(letters) and (description.upper() == description or len(description) <= 90)

    if is_chapter:
        return {
            "code": str(_first(raw, ["codigo", "code", "cod_par", "cov_par"]) or "")[:80],
            "description": description[:600],
            "unit": "",
            "quantity": 0.0,
            "is_chapter": True,
        }

    if not unit:
        unit = "und"
    return {
        "code": str(_first(raw, ["codigo", "code", "cod_par", "cov_par"]) or "")[:80],
        "description": description[:600],
        "unit": unit,
        "quantity": float(quantity or 0.0),
        "is_chapter": False,
    }


def _dedupe(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    seen = set()
    result: List[Dict[str, Any]] = []
    for item in items:
        key = (
            _normalize_header(item["description"]),
            item["unit"],
            round(float(item["quantity"]), 3),
            bool(item["is_chapter"]),
        )
        if key in seen:
            continue
        seen.add(key)
        result.append(item)
    return result


def structure_text(text: str, filename: str) -> Dict[str, Any]:
    """Convierte texto libre (PDF/OCR/Excel volcado) en partidas normalizadas."""
    if not text or len(text.strip()) < 20:
        raise StructuringError("El documento no contiene texto suficiente para identificar partidas.")

    chunks = _chunk_text(text)
    if not chunks:
        raise StructuringError("No se pudo dividir el contenido del documento para su análisis.")

    header: Dict[str, Any] = {
        "budget_name": Path(filename).stem.replace("_", " ").replace("-", " ").strip().title(),
        "project_name": None,
        "client_name": None,
        "currency": "USD",
    }
    items: List[Dict[str, Any]] = []
    warnings: List[str] = []
    errors: List[str] = []

    for index, chunk in enumerate(chunks):
        try:
            data = call_llm_json(_build_prompt(chunk, index, len(chunks)))
        except Exception as exc:
            logger.warning("Fallo la estructuración IA del fragmento %s: %s", index + 1, exc)
            errors.append(str(exc))
            continue

        if isinstance(data, list):
            raw_items = data
        elif isinstance(data, dict):
            raw_items = _first(data, ["items", "partidas", "rows", "filas"]) or []
            if not isinstance(raw_items, list):
                raw_items = []
            if index == 0:
                budget_name = _first(data, ["budget_name", "nombre_presupuesto", "nombre", "titulo"])
                project_name = _first(data, ["project_name", "proyecto", "obra", "nombre_obra"])
                client_name = _first(data, ["client_name", "cliente", "contratante"])
                if budget_name:
                    header["budget_name"] = str(budget_name).strip()[:250]
                if project_name:
                    header["project_name"] = str(project_name).strip()[:250]
                if client_name:
                    header["client_name"] = str(client_name).strip()[:250]

                # Solo cambiamos la moneda si el documento la menciona explícitamente;
                # de lo contrario el LLM tiende a asumir VES por el contexto venezolano.
                chunk_upper = chunk.upper()
                has_ves = any(token in chunk_upper for token in ("BS.", "BSF", "VES", "BOLIVAR", "BOLÍVAR"))
                has_usd = any(token in chunk_upper for token in ("USD", "US$", "$"))
                if has_ves and not has_usd:
                    header["currency"] = "VES"
                elif has_usd and not has_ves:
                    header["currency"] = "USD"
        else:
            raw_items = []

        for raw in raw_items:
            normalized = _normalize_item(raw)
            if normalized:
                items.append(normalized)

    if not items:
        detail = f" Último error: {errors[-1]}" if errors else ""
        raise StructuringError(
            "No se pudieron identificar partidas en el documento. "
            "Verifica que el archivo tenga descripciones y cantidades legibles." + detail
        )

    items = _dedupe(items)
    if len(items) > MAX_ITEMS:
        warnings.append(f"Se detectaron {len(items)} filas; se importarán las primeras {MAX_ITEMS}.")
        items = items[:MAX_ITEMS]

    if len(chunks) > 1:
        warnings.append(f"El documento se procesó en {len(chunks)} fragmentos.")
    if errors:
        warnings.append("Algunos fragmentos no pudieron procesarse con IA; revisa las partidas detectadas.")

    return {"header": header, "items": items, "warnings": warnings}
