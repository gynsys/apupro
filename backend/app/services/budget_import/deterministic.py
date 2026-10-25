"""Extracción determinista de partidas codificadas en texto de PDF/OCR.

La ruta principal es por código: si el documento trae códigos de partida,
no es necesario enviar todo el texto al LLM. El texto residual se usa
únicamente como respaldo para partidas sin código.
"""
from __future__ import annotations

import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from .extractors import _looks_like_stop_row, _normalize_unit, parse_quantity
from .reconcile import _is_unit

_CODE_RE = re.compile(
    r"(?:"
    r"[A-Z]{1,2}\.\d{6,}(?:\.\d+)*"          # C.028200102
    r"|[A-Z]{1,2}\.S/C"                       # C.S/C
    r"|[A-Z]{1,2}-?\d{4,}"                    # CUST-1234
    r")",
    re.IGNORECASE,
)
_NUMBERED_CODE_RE = re.compile(r"^\s*\d+\s+(" + _CODE_RE.pattern + r")\s*$", re.IGNORECASE)
_TABLE_ROW_RE = re.compile(
    r"^(.*?)\s+([A-Za-zÁÉÍÓÚÜÑáéíóúüñ/]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s*$"
)

_CHAPTER_PREFIX_RE = re.compile(
    r"^(?:cap[ií]tulo|secci[oó]n|rubro|partida|etapa|fase)\b[:\s\-]*",
    re.IGNORECASE,
)
_NUMBERING_RE = re.compile(r"^\s*(?:\d{1,3}|[IVXLCDM]{1,6})[\.\)\-:]\s+", re.IGNORECASE)
_TOTAL_RE = re.compile(r"^(?:total|subtotal|gran total)\b", re.IGNORECASE)

_HEADER_WORDS = {
    "datalaing", "maprex", "presupuesto", "part no", "partida no",
    "descripcion", "descripción", "und", "unidad", "cantidad",
    "precio unitario", "total bs", "pagina", "página", "obra",
    "contratante", "fecha", "elaborado por", "aprobado por",
}

# Unidades que aparecen al inicio de una descripción cuando el PDF no
# conserva la columna de unidad.
_KNOWN_UNITS = {
    "m2", "m3", "m", "ml", "und", "un", "pza", "gl", "global", "conjunto",
    "punto", "sistema", "mes", "kg", "kgf", "ton", "tonf", "sco", "gal",
    "lt", "dia", "día", "hr", "hora", "pto", "sem", "rll", "doc", "cun",
    "pieza", "servicio", "tfxkm", "tfxkm",
}


def _clean(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "").replace("\xa0", " ")).strip()


def _letters(value: str) -> str:
    return "".join(c for c in value if c.isalpha())


def _is_noise(line: str) -> bool:
    if not line:
        return True
    key = _clean(line).lower()
    if key in _HEADER_WORDS:
        return True
    if any(term in key for term in ("part. no", "descripcion", "descripción", "precio unitario", "total bs")):
        return True
    if key.startswith(("obra:", "contratante:", "presupuesto:", "página ", "pagina ", "maprex", "datalaing")):
        return True
    if key.replace(" ", "") in {"presupuesto", "datalaing", "maprex"}:
        return True
    if _TOTAL_RE.match(key):
        return True
    if _looks_like_stop_row(key):
        return True
    return False


def _extract_code(line: str) -> str:
    raw = _clean(line)
    match = _CODE_RE.search(raw)
    return match.group(0).strip() if match else ""


def _is_code(line: str) -> bool:
    return bool(_extract_code(line))


def _chapter_text(line: str) -> Optional[str]:
    raw = _clean(line)
    if not raw or _is_code(raw) or _is_noise(raw):
        return None
    text = _NUMBERING_RE.sub("", raw).strip()
    if not text or len(text) > 90:
        return None
    # Un título de capítulo no debería contener unidades, cantidades ni precios.
    if any(char.isdigit() for char in text):
        return None
    letters = _letters(text)
    if not letters:
        return None
    if _CHAPTER_PREFIX_RE.match(text):
        return text
    uppercase_ratio = sum(1 for c in letters if c.isupper()) / max(1, len(letters))
    if uppercase_ratio >= 0.8:
        return text
    return None


def _parse_block(code: str, block: List[str]) -> Optional[Dict[str, Any]]:
    unit = ""
    numbers: List[float] = []
    description_lines: List[str] = []

    for raw in block:
        line = _clean(raw)
        if not line or _is_noise(line):
            continue
        if _is_code(line):
            break

        table_match = _TABLE_ROW_RE.match(line)
        if table_match:
            description_part, unit_part, q1, q2, q3 = table_match.groups()
            if description_part:
                description_lines.append(description_part.strip())
            candidate_unit = _normalize_unit(unit_part) or unit_part.lower()
            if _is_unit(unit_part) or len(unit_part) <= 6:
                unit = candidate_unit
            for raw_number in (q1, q2, q3):
                number = parse_quantity(raw_number)
                if number is not None:
                    numbers.append(float(number))
            continue

        # Algunas extracciones de PDF pegan descripción, unidad y los tres
        # valores monetarios en una sola línea.
        tokens = line.split()
        numeric_positions = [
            i for i, token in enumerate(tokens)
            if parse_quantity(token) is not None
        ]
        if len(numeric_positions) >= 3:
            last_three = numeric_positions[-3:]
            unit_position = last_three[0] - 1
            if unit_position >= 0:
                unit_token = tokens[unit_position]
                if _is_unit(unit_token) or len(unit_token) <= 6:
                    unit = _normalize_unit(unit_token) or unit_token.lower()
                    description_lines.append(" ".join(tokens[:unit_position]))
                    numbers.extend(
                        float(parse_quantity(tokens[pos]))
                        for pos in last_three
                        if parse_quantity(tokens[pos]) is not None
                    )
                    continue

        if _is_unit(line):
            unit = _normalize_unit(line) or "und"
            continue
        number = parse_quantity(line)
        if number is not None and not any(c.isalpha() for c in line):
            numbers.append(float(number))
            continue
        if any(c.isalpha() for c in line):
            description_lines.append(line)

    description = re.sub(r"\s+", " ", " ".join(description_lines)).strip()

    # Si la unidad quedó al inicio de la descripción (por ejemplo
    # "tfxkm TRANSPORTE..."), separarla del texto de la partida.
    if description:
        first_token, _, remainder = description.partition(" ")
        first_unit = _normalize_unit(first_token)
        if first_unit in _KNOWN_UNITS and remainder.strip():
            if not unit or _normalize_unit(unit) not in _KNOWN_UNITS:
                unit = first_unit
            description = remainder.strip()

    if len(description) < 3:
        return None

    quantity = None
    if len(numbers) >= 3:
        # Los PDFs suelen extraer Total, Precio, Cantidad en ese orden.
        # Buscamos un par cuyo producto sea el tercer número.
        best = None
        for i in range(len(numbers)):
            for j in range(i + 1, len(numbers)):
                for k in range(len(numbers)):
                    if k in (i, j):
                        continue
                    a, b, total = numbers[i], numbers[j], numbers[k]
                    if a <= 0 or b <= 0 or total <= 0:
                        continue
                    if abs((a * b) - total) <= max(0.02, total * 0.01):
                        def decimals(value: float) -> int:
                            text = f"{value:.6f}".rstrip("0").rstrip(".")
                            return len(text.split(".")[1]) if "." in text else 0
                        q = a if (decimals(a), a) <= (decimals(b), b) else b
                        best = q
                        break
                if best is not None:
                    break
            if best is not None:
                break
        quantity = best
    if quantity is None and len(numbers) >= 2:
        quantity = min(numbers)
    if quantity is None and numbers:
        quantity = numbers[0]

    return {
        "code": code,
        "description": description[:600],
        "unit": unit or "und",
        "quantity": float(quantity or 0.0),
        "is_chapter": False,
    }


def _header_from_lines(lines: List[str], filename: str) -> Dict[str, Any]:
    header = {
        "budget_name": Path(filename or "").stem.replace("_", " ").replace("-", " ").strip().title(),
        "project_name": None,
        "client_name": None,
        "currency": "USD",
    }
    for line in lines[:30]:
        upper = line.upper()
        if "OBRA:" in upper:
            header["project_name"] = _clean(line.split(":", 1)[1])
        elif "CONTRATANTE:" in upper:
            header["client_name"] = _clean(line.split(":", 1)[1])
    joined = " ".join(lines[:40]).upper()
    if any(token in joined for token in ("BS.", "BSF", "VES", "BOLIVAR", "BOLÍVAR")):
        header["currency"] = "VES"
    return header


def parse_coded_document(text: str, filename: str = "") -> Optional[Dict[str, Any]]:
    """Extrae partidas y capítulos cuando el documento trae códigos.

    Devuelve None si no encuentra un bloque codificado, para que el llamador
    use el flujo LLM existente.
    """
    lines = [_clean(line) for line in (text or "").splitlines()]
    if not lines:
        return None

    items: List[Dict[str, Any]] = []
    residual: List[str] = []
    index = 0

    while index < len(lines):
        line = lines[index]
        if not line:
            index += 1
            continue

        if _is_code(line):
            code = _extract_code(line)
            block: List[str] = []
            cursor = index + 1
            while cursor < len(lines) and cursor <= index + 25:
                candidate = lines[cursor]
                if _is_code(candidate):
                    break
                if _TOTAL_RE.match(candidate):
                    break
                block.append(candidate)
                cursor += 1
            item = _parse_block(code, block)
            if item:
                items.append(item)
                index = cursor
                continue
            index += 1
            continue

        chapter = _chapter_text(line)
        if chapter:
            items.append({
                "code": "",
                "description": chapter[:600],
                "unit": "",
                "quantity": 0.0,
                "is_chapter": True,
            })
            index += 1
            continue

        if not _is_noise(line):
            residual.append(line)
        index += 1

    if not items:
        return None

    return {
        "header": _header_from_lines(lines, filename),
        "items": items,
        "residual_text": "\n".join(residual),
    }
