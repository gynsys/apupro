"""Reconciliación de partidas contra los códigos presentes en el documento.

La IA puede omitir filas al estructurar documentos largos. Este módulo detecta
los códigos de partida del texto original, rellena códigos vacíos y recupera
las partidas faltantes (con una llamada puntual al LLM y un fallback
determinista), insertándolas en su posición correcta.
"""
import difflib
import json
import logging
import re
from typing import Any, Dict, List, Tuple

from app.services.llm_router import call_llm_json

from .extractors import _looks_like_stop_row, _normalize_header, _normalize_unit, parse_quantity

logger = logging.getLogger(__name__)

CODE_RE = re.compile(r"^(\d{1,3}[A-Za-z]?(?:\.[A-Za-z0-9]{1,4}){2,})\b")
CHAPTER_RE = re.compile(r"^(\d{1,3}[A-Za-z]?\.[A-Za-z])\s+(.+)$")
DATE_RE = re.compile(r"^\d{1,2}\.\d{1,2}\.\d{2,4}$")

_UNIT_TOKENS = {
    "m2", "m3", "m", "ml", "und", "un", "pza", "gl", "global", "conjunto",
    "punto", "sistema", "bano", "mes", "kg", "ton", "sco", "gal", "lt",
    "dia", "hr", "pto", "sem", "rll", "doc", "cun", "pieza", "servicio",
}
_NOISE_PREFIXES = (
    "BAER |", "ESTACION DE BOMBEROS", "Código", "Descripción", "Unidad", "Cantidad",
)


def _is_noise(line: str) -> bool:
    upper = line.strip().upper()
    if not upper:
        return True
    if any(upper.startswith(prefix.upper()) for prefix in _NOISE_PREFIXES):
        return True
    return bool(re.match(r"^\d+\s*/\s*\d+$", upper))


def _is_unit(line: str) -> bool:
    normalized = _normalize_header(line)
    if normalized in _UNIT_TOKENS:
        return True
    return _normalize_unit(line) in {"m2", "m3", "m", "und", "pza", "gl", "kg", "ton", "sco", "gal", "lt", "día", "hr"}


def _build_source_index(text: str) -> Tuple[List[str], Dict[str, str]]:
    """Devuelve el orden de códigos/capítulos y el bloque de texto de cada partida."""
    lines = [line.strip() for line in text.splitlines()]
    ordered: List[str] = []
    blocks: Dict[str, str] = {}
    index = 0

    while index < len(lines):
        line = lines[index]
        if not line:
            index += 1
            continue

        chapter_match = CHAPTER_RE.match(line)
        if chapter_match:
            code = chapter_match.group(1)
            if code not in ordered:
                ordered.append(code)
            index += 1
            continue

        code_match = CODE_RE.match(line)
        if code_match:
            code = code_match.group(1)
            if DATE_RE.match(code) or code in blocks:
                index += 1
                continue

            block_lines = [line]
            cursor = index + 1
            while cursor < len(lines) and cursor <= index + 16:
                next_line = lines[cursor]
                if CODE_RE.match(next_line) or CHAPTER_RE.match(next_line):
                    break
                block_lines.append(next_line)
                cursor += 1

            blocks[code] = "\n".join(block_lines)
            ordered.append(code)
            index = cursor
            continue

        index += 1

    return ordered, blocks


def _expected_partida_codes(ordered: List[str]) -> List[str]:
    return [code for code in ordered if code.count(".") >= 2 and not DATE_RE.match(code)]


def _block_description(block: str) -> str:
    if not block:
        return ""
    lines = [line for line in block.splitlines() if not _is_noise(line)]
    if not lines:
        return ""
    first = CODE_RE.sub("", lines[0]).strip()
    return " ".join([first, *lines[1:]]).strip()


def _normalize_reconciled(raw: Dict[str, Any], forced_code: str) -> Any:
    description = raw.get("descripcion") or raw.get("description") or raw.get("concepto")
    if description is None:
        return None
    description = re.sub(r"\s+", " ", str(description)).strip()
    if len(description) < 3 or _looks_like_stop_row(description):
        return None

    unit_raw = raw.get("unidad") or raw.get("unit") or "und"
    unit = _normalize_unit(unit_raw) or "und"
    quantity = parse_quantity(raw.get("cantidad") or raw.get("quantity")) or 0.0
    return {
        "code": forced_code,
        "description": description[:600],
        "unit": unit,
        "quantity": float(quantity),
        "is_chapter": False,
    }


def _fallback_parse_block(code: str, block: str) -> Any:
    """Parser de respaldo para un bloque: código, descripción, unidad y cantidad."""
    lines = [line.strip() for line in block.splitlines() if not _is_noise(line)]
    if not lines:
        return None

    first = CODE_RE.sub("", lines[0]).strip()
    rest = ([first] if first else []) + lines[1:]
    if not rest:
        return None

    unit_index = next((i for i, line in enumerate(rest) if _is_unit(line)), None)
    if unit_index is None:
        description = " ".join(rest)
        unit = "und"
        quantity = 0.0
    else:
        unit = _normalize_unit(rest[unit_index]) or "und"
        quantity = parse_quantity(rest[unit_index + 1]) if unit_index + 1 < len(rest) else 0.0
        description = " ".join(rest[:unit_index] + rest[unit_index + 2:])
        quantity = float(quantity or 0.0)

    description = re.sub(r"\s+", " ", description).strip()
    if len(description) < 3:
        return None
    return {
        "code": code,
        "description": description[:600],
        "unit": unit,
        "quantity": quantity,
        "is_chapter": False,
    }


def _llm_recover(payload: List[Dict[str, str]], batch_size: int = 15) -> List[Dict[str, Any]]:
    recovered: List[Dict[str, Any]] = []
    for start in range(0, len(payload), batch_size):
        batch = payload[start:start + batch_size]
        prompt = f"""
Eres un extractor de partidas de un presupuesto de obra.
Para cada fragmento, extrae la partida indicada por su código: descripción, unidad y cantidad.
No omitas ninguna. Si la cantidad dice "Por medir" o "Por definir", usa 0.

Devuelve SOLO un objeto JSON:
{{"items": [{{"codigo": "CODIGO", "descripcion": "...", "unidad": "...", "cantidad": 0.0}}]}}

FRAGMENTOS:
{json.dumps(payload, ensure_ascii=False, indent=1)}
"""
        try:
            data = call_llm_json(prompt)
        except Exception as exc:
            logger.warning("No se pudieron recuperar partidas omitidas con LLM: %s", exc)
            continue

        raw_items = data.get("items") if isinstance(data, dict) else data
        if not isinstance(raw_items, list):
            continue
        for raw in raw_items:
            if not isinstance(raw, dict):
                continue
            code = str(raw.get("codigo") or raw.get("code") or "").strip()
            if not code:
                continue
            normalized = _normalize_reconciled(raw, code)
            if normalized:
                recovered.append(normalized)
    return recovered


def _insert_in_order(items: List[Dict[str, Any]], new_item: Dict[str, Any], ordered: List[str]) -> None:
    code = new_item["code"]
    try:
        position = ordered.index(code)
    except ValueError:
        items.append(new_item)
        return

    for previous_code in reversed(ordered[:position]):
        positions = [index for index, item in enumerate(items) if item.get("code") == previous_code]
        if positions:
            items.insert(positions[-1] + 1, new_item)
            return
    items.append(new_item)


def reconcile_items(text: str, items: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], List[str]]:
    """Completa y ordena las partidas usando los códigos del documento original."""
    if not text or not items:
        return items, []

    ordered, blocks = _build_source_index(text)
    expected = _expected_partida_codes(ordered)
    if len(expected) < 3:
        return items, []

    # 1. Eliminar duplicados por código (conservando el primero).
    seen = set()
    deduped: List[Dict[str, Any]] = []
    for item in items:
        code = (item.get("code") or "").strip()
        if code and code in seen:
            continue
        if code:
            seen.add(code)
        deduped.append(item)
    items = deduped

    # 2. Rellenar códigos vacíos: por secuencia (M.05 -> M.07) o por similitud.
    missing = [code for code in expected if code not in seen]
    for index, item in enumerate(items):
        if item.get("code"):
            continue
        previous_code = next((items[j].get("code") for j in range(index - 1, -1, -1) if items[j].get("code")), "")
        next_code = next((items[j].get("code") for j in range(index + 1, len(items)) if items[j].get("code")), "")

        candidate = None
        if previous_code and next_code:
            previous_prefix, _, previous_suffix = previous_code.rpartition(".")
            next_prefix, _, next_suffix = next_code.rpartition(".")
            if previous_prefix and previous_prefix == next_prefix:
                try:
                    if int(next_suffix) - int(previous_suffix) == 2:
                        candidate = f"{previous_prefix}.{int(previous_suffix) + 1:02d}"
                except ValueError:
                    candidate = None

        if not candidate and missing:
            description_norm = _normalize_header(item.get("description") or "")
            best_code = None
            best_ratio = 0.0
            for code in missing:
                block_norm = _normalize_header(_block_description(blocks.get(code, "")))
                ratio = difflib.SequenceMatcher(None, description_norm, block_norm).ratio()
                if ratio > best_ratio:
                    best_ratio = ratio
                    best_code = code
            if best_code and best_ratio >= 0.55:
                candidate = best_code

        if candidate:
            item["code"] = candidate
            if candidate in missing:
                missing.remove(candidate)
            seen.add(candidate)

    # 3. Recuperar las partidas que la IA omitió.
    recoverable = [{"codigo": code, "fragmento": blocks.get(code, "")} for code in missing if blocks.get(code)]
    recovered = _llm_recover(recoverable) if recoverable else []
    recovered_codes = {item["code"] for item in recovered}

    # 4. Fallback determinista para las que el LLM no devolvió.
    for code in missing:
        if code in recovered_codes:
            continue
        block = blocks.get(code, "")
        if not block:
            continue
        fallback = _fallback_parse_block(code, block)
        if fallback:
            recovered.append(fallback)
            recovered_codes.add(code)

    warnings: List[str] = []
    if recovered:
        codes_text = ", ".join(sorted(recovered_codes))
        warnings.append(
            f"Se recuperaron {len(recovered)} partidas que la IA había omitido: {codes_text}."
        )
        for item in recovered:
            _insert_in_order(items, item, ordered)

    return items, warnings
