"""Fase 1: apuntes de cómputos en imagen/PDF a partidas.

El OCR entrega texto libre. Este módulo reconoce una descripción y una
operación geométrica sencilla, por ejemplo:

    Demolición de manto asfáltico
    9,30 m x 8,90 m
    und m2

y la convierte en una partida con cantidad y cálculo explícito.
"""
from __future__ import annotations

import re
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any, Dict, List, Optional

from .extractors import _normalize_header, _normalize_unit

_DIMENSION_RE = re.compile(
    r"(?P<a>\d+(?:[.,]\d+)?)\s*(?:m|mts|metros)?\s*[x×]\s*"
    r"(?P<b>\d+(?:[.,]\d+)?)\s*(?:m|mts|metros)?"
    r"(?:\s*[x×]\s*(?P<c>\d+(?:[.,]\d+)?)\s*(?:m|mts|metros)?)?",
    re.IGNORECASE,
)
_UNIT_HINT_RE = re.compile(r"\b(und|m2|m²|m3|m³|ml|m|kg|ton|pza)\b", re.IGNORECASE)


def _number(value: str) -> float:
    text = str(value).strip()
    if "," in text:
        text = text.replace(".", "").replace(",", ".")
    return float(text)


def _clean_description(value: str) -> str:
    text = re.sub(r"[*#]+", "", value or "")
    # Nunca dejar medidas dentro de la descripción.
    text = _DIMENSION_RE.sub(" ", text)
    text = re.sub(r"\s+", " ", text).strip(" .;:-\t")
    text = re.sub(r"\b(?:und|m2|m²|m3|m³|ml)\s*$", "", text, flags=re.IGNORECASE).strip()

    # El OCR de manuscritos suele confundir "Demolición" con "Promoción",
    # "Pamoción" o "Pamocion". En el contexto de manto asfáltico, corregir
    # la acción antes de buscar la partida.
    if "manto asfaltico" in _normalize_header(text):
        first, _, rest = text.partition(" ")
        first_norm = _normalize_header(first)
        # Variantes típicas del OCR para "remoción" en manuscrito.
        if first_norm in {"promocion", "pamocion", "pamoción"}:
            text = f"REMOCIÓN {rest}".strip()
        else:
            best_action = None
            best_ratio = 0.0
            for action in ("demolicion", "remocion"):
                ratio = SequenceMatcher(None, first_norm, action).ratio()
                if ratio > best_ratio:
                    best_ratio = ratio
                    best_action = action
            if best_action and best_ratio >= 0.60:
                label = "DEMOLICIÓN" if best_action == "demolicion" else "REMOCIÓN"
                text = f"{label} {rest}".strip()

    # Las descripciones del catálogo se muestran en mayúsculas.
    return text.upper()


def _unit_from_text(text: str, dimensions: int) -> str:
    if dimensions == 3:
        return "m3"
    if dimensions == 2:
        return "m2"
    match = _UNIT_HINT_RE.search(text or "")
    if match:
        unit = _normalize_unit(match.group(1))
        if unit:
            return unit
    return "und"


def extract_compute_items(text: str, filename: str = "") -> Dict[str, Any]:
    """Extrae partidas y cálculos simples de un apunte de cómputos."""
    raw = re.sub(r"[ \t]+", " ", text or "").strip()
    if not raw:
        return {
            "header": {"budget_name": Path(filename or "").stem.title(), "project_name": None, "client_name": None, "currency": "USD"},
            "items": [],
            "warnings": ["No se pudo leer texto en el apunte de cómputos."],
        }

    items: List[Dict[str, Any]] = []
    warnings: List[str] = []
    last_end = 0
    matches = list(_DIMENSION_RE.finditer(raw))

    for index, match in enumerate(matches):
        before = raw[last_end:match.start()]
        description = _clean_description(before)
        if not description:
            # Si la descripción está en una línea anterior, tómala.
            previous_lines = [line.strip() for line in before.splitlines() if line.strip()]
            description = _clean_description(previous_lines[-1] if previous_lines else "")
        if len(description) < 3:
            continue

        dimensions = [match.group("a"), match.group("b"), match.group("c")]
        values = [_number(value) for value in dimensions if value]
        if not values:
            continue
        quantity = 1.0
        for value in values:
            quantity *= value
        quantity = round(quantity, 2)

        unit = _unit_from_text(raw[match.start():match.end() + 20], len(values))
        calculation = " × ".join(dimensions[:len(values)])
        items.append({
            "code": "",
            "description": description,
            "unit": unit,
            "quantity": quantity,
            "calculation": calculation,
            "confidence": "alta",
            "warnings": [],
            "is_chapter": False,
        })
        last_end = match.end()

    if not items:
        lines = [line.strip() for line in raw.splitlines() if line.strip()]
        description = _clean_description(" ".join(lines))
        if len(description) >= 3:
            items.append({
                "code": "",
                "description": description,
                "unit": _unit_from_text(raw, 0),
                "quantity": 0.0,
                "calculation": "",
                "confidence": "baja",
                "warnings": ["No se detectó una operación geométrica; revisa la cantidad."],
                "is_chapter": False,
            })
            warnings.append("No se detectó un cómputo numérico; la cantidad quedó pendiente.")

    return {
        "header": {
            "budget_name": Path(filename or "").stem.replace("_", " ").replace("-", " ").title() or "Apuntes de cómputos",
            "project_name": None,
            "client_name": None,
            "currency": "USD",
        },
        "items": items,
        "warnings": warnings,
    }
