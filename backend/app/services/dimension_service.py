"""
Módulo de Extracción y Comparación Dimensional Técnica para Construcción.

Permite extraer de forma estructurada dimensiones físicas (diámetros métricos e imperiales,
resistencias de concreto, presiones nominales, potencias, voltajes y calibres)
y comparar consultas con partidas para priorizar coincidencias dimensionales exactas
y penalizar dimensiones incompatibles.
"""

import re
from typing import Dict, List, Optional, Tuple
from app.core.logging import logger

REBAR_MAP: Dict[int, Tuple[float, str]] = {
    2: (6.35, '1/4"'),
    3: (9.525, '3/8"'),
    4: (12.7, '1/2"'),
    5: (15.875, '5/8"'),
    6: (19.05, '3/4"'),
    7: (22.225, '7/8"'),
    8: (25.4, '1"'),
    10: (31.75, '1-1/4"'),
}


def parse_fraction(s: str) -> Optional[float]:
    """
    Convierte cadenas numéricas fraccionarias o enteras ('1/2', '3/4', '1-1/2', '1 1/2', '2') a float.
    Retorna None si el formato no es válido.
    """
    if not s or not isinstance(s, str):
        return None

    try:
        cleaned = s.strip().replace('-', ' ')
        parts = cleaned.split()
        if len(parts) == 2:
            whole = float(parts[0])
            frac = parts[1].split('/')
            if len(frac) == 2 and float(frac[1]) != 0:
                return whole + float(frac[0]) / float(frac[1])
            return None
        elif len(parts) == 1:
            if '/' in parts[0]:
                frac = parts[0].split('/')
                if len(frac) == 2 and float(frac[1]) != 0:
                    return float(frac[0]) / float(frac[1])
                return None
            return float(parts[0])
    except Exception as exc:
        logger.error("Error parseando fraccion '%s': %s", s, exc, exc_info=True)
        return None
    return None


class DimensionToken:
    """Representa una magnitud técnica dimensional normalizada a unidades canónicas."""

    def __init__(self, dim_type: str, canonical_value: float, raw_text: str) -> None:
        if not dim_type or not isinstance(dim_type, str):
            raise ValueError("dim_type debe ser un string no vacío")
        self.dim_type: str = dim_type
        self.canonical_value: float = float(canonical_value)
        self.raw_text: str = str(raw_text)

    def __repr__(self) -> str:
        return f"<{self.dim_type}: {self.canonical_value} (raw: '{self.raw_text}')>"

    def matches(self, other: "DimensionToken") -> bool:
        """Determina si dos tokens dimensionales son físicamente equivalentes."""
        if not isinstance(other, DimensionToken) or self.dim_type != other.dim_type:
            return False

        # Para diámetros, tolerancia de 1.2 mm o 4% para contemplar redondeos (12.7 mm ~ 13 mm)
        if self.dim_type == "diameter_mm":
            return abs(self.canonical_value - other.canonical_value) <= max(1.2, 0.04 * self.canonical_value)

        # Para voltaje, 110V coincide con 115V o 120V (misma clase residencial), 208V con 220V/240V
        if self.dim_type == "voltage_v":
            v1, v2 = sorted([self.canonical_value, other.canonical_value])
            if v1 >= 110.0 and v2 <= 127.0:
                return True
            if v1 >= 208.0 and v2 <= 240.0:
                return True
            if v1 >= 440.0 and v2 <= 480.0:
                return True
            return abs(v1 - v2) < 5.0

        # Para resistencia de concreto (kg/cm2), tolerancia de 5.0 kg/cm2
        if self.dim_type == "concrete_kg_cm2":
            return abs(self.canonical_value - other.canonical_value) <= 5.0

        # Para presión nominal PN / SDR
        if self.dim_type.startswith("pressure_"):
            return abs(self.canonical_value - other.canonical_value) <= 0.5

        # Para potencia en HP
        if self.dim_type == "power_hp":
            return abs(self.canonical_value - other.canonical_value) <= 0.1

        # Para calibre AWG
        if self.dim_type == "gauge_awg":
            return abs(self.canonical_value - other.canonical_value) <= 0.1

        # Para número de cabilla
        if self.dim_type == "rebar_num":
            return abs(self.canonical_value - other.canonical_value) <= 0.1

        return abs(self.canonical_value - other.canonical_value) <= 0.05 * max(self.canonical_value, 1.0)


def extract_unified_dimensions(text_input: str) -> List[DimensionToken]:
    """
    Extrae de forma precisa todas las dimensiones técnicas de un texto.
    Utiliza lookbehinds negativos para evitar falsos positivos con decimales (ej. 77.20 no coincide con 20).
    """
    if not text_input or not isinstance(text_input, str):
        return []

    tokens: List[DimensionToken] = []

    try:
        # 1. Diámetros métricos en mm: ej. 20 mm, 90 mm, 110 mm
        for m in re.finditer(r"(?<![\d.,])(\d+(?:[.,]\d+)?)\s*mm\b", text_input, re.IGNORECASE):
            val = float(m.group(1).replace(",", "."))
            tokens.append(DimensionToken("diameter_mm", round(val, 2), m.group(0)))

        # 2. Diámetros en pulgadas: ej. 1/2", 3/4", 1", 1-1/2", 2 pulg
        for m in re.finditer(r"(?<![\d.,])(\d+(?:\s*[-/]\s*\d+)?|\d+(?:[.,]\d+)?)\s*(?:[\"”]|pulg(?:adas?)?|plg\b)", text_input, re.IGNORECASE):
            frac = parse_fraction(m.group(1))
            if frac is not None and frac > 0:
                mm_val = frac * 25.4
                tokens.append(DimensionToken("diameter_mm", round(mm_val, 2), m.group(0)))

        # 3. Cabillas de refuerzo (#3, #4, #5, #6, #8, cabilla #4)
        for m in re.finditer(r"(?:cabilla|acero)?\s*(?:#|n[°o]\.?\s*)(\d+)\b", text_input, re.IGNORECASE):
            num = int(m.group(1))
            if num in REBAR_MAP:
                mm_val, _ = REBAR_MAP[num]
                tokens.append(DimensionToken("diameter_mm", mm_val, m.group(0)))
                tokens.append(DimensionToken("rebar_num", float(num), m.group(0)))

        # 4. Concreto / Mortero: kg/cm2 o f'c = 210
        for m in re.finditer(r"(?:f'?c\s*=?\s*|(?<![\d.,]))(\d+(?:[.,]\d+)?)\s*(?:kg/?cm2|kgf/?cm2)\b", text_input, re.IGNORECASE):
            val = float(m.group(1).replace(",", "."))
            tokens.append(DimensionToken("concrete_kg_cm2", val, m.group(0)))
        for m in re.finditer(r"\bf'?c\s*=?\s*(\d{2,3})\b", text_input, re.IGNORECASE):
            val = float(m.group(1))
            tokens.append(DimensionToken("concrete_kg_cm2", val, m.group(0)))

        # 5. Presión Nominal PN y SDR: PN 16, SDR 11
        for m in re.finditer(r"\b(pn|sdr)\s*(\d+(?:[.,]\d+)?)\b", text_input, re.IGNORECASE):
            tipo = m.group(1).lower()
            val = float(m.group(2).replace(",", "."))
            tokens.append(DimensionToken(f"pressure_{tipo}", val, m.group(0)))

        # 6. Voltaje: soporta voltajes simples (110v, 220v) y duales (110/220v, 220/440v)
        for m in re.finditer(r"(?<![\d.,])(\d+(?:[.,]\d+)?)(?:\s*/\s*(\d+(?:[.,]\d+)?))?\s*(v|kv|volt(?:ios?)?)\b", text_input, re.IGNORECASE):
            unit_str = (m.group(3) or "").lower()
            multiplier = 1000.0 if unit_str == "kv" else 1.0
            v1 = float(m.group(1).replace(",", ".")) * multiplier
            tokens.append(DimensionToken("voltage_v", v1, m.group(0)))
            if m.group(2):
                v2 = float(m.group(2).replace(",", ".")) * multiplier
                tokens.append(DimensionToken("voltage_v", v2, m.group(0)))

        # 7. Potencia: hp, kw
        for m in re.finditer(r"(?<![\d.,])(\d+(?:\s*[-/]\s*\d+)?|\d+(?:[.,]\d+)?)\s*(hp|kw)\b", text_input, re.IGNORECASE):
            frac = parse_fraction(m.group(1))
            unit_str = (m.group(2) or "").lower()
            if frac is not None:
                hp_val = frac * 1.341 if unit_str == "kw" else frac
                tokens.append(DimensionToken("power_hp", round(hp_val, 2), m.group(0)))

        # 8. Calibre de cables AWG
        for m in re.finditer(r"(?<![\d.,])(\d+)\s*(?:awg|calibre\s*#?\s*(\d+))\b", text_input, re.IGNORECASE):
            num_str = m.group(1) or m.group(2)
            if num_str:
                tokens.append(DimensionToken("gauge_awg", float(int(num_str)), m.group(0)))

    except Exception as exc:
        logger.error("Error extrayendo dimensiones de texto '%s': %s", text_input, exc, exc_info=True)

    return tokens


def score_dimension_match(query_tokens: List[DimensionToken], item_tokens: List[DimensionToken]) -> Tuple[float, List[str]]:
    """
    Calcula el ajuste de puntuación técnica por coincidencia o conflicto dimensional:
    - +0.15 por coincidencia completa en dimensiones compuestas (ej. 4x4, 100x100x3).
    - +0.12 por coincidencia simple en dimensiones unidimensionales (ej. 1/2", 210 kg/cm2).
    - -0.15 por conflicto geométrico parcial en dimensiones compuestas (ej. 2x4 cuando se solicitó 4x4).
    - -0.10 si no coincide ninguna dimensión solicitada pero el ítem posee dimensiones de ese tipo.
    """
    if not query_tokens or not isinstance(query_tokens, list):
        return 0.0, []

    # Agrupar tokens por tipo de dimensión
    q_types: Dict[str, List[DimensionToken]] = {}
    for qt in query_tokens:
        q_types.setdefault(qt.dim_type, []).append(qt)

    i_types: Dict[str, List[DimensionToken]] = {}
    for it in item_tokens:
        i_types.setdefault(it.dim_type, []).append(it)

    total_delta: float = 0.0
    debug_notes: List[str] = []

    for dim_type, q_list in q_types.items():
        if dim_type in i_types:
            i_list = list(i_types[dim_type])
            matched_count = 0
            for qt in q_list:
                for idx, it in enumerate(i_list):
                    if qt.matches(it):
                        matched_count += 1
                        i_list.pop(idx)
                        break

            total_req = len(q_list)
            if matched_count == total_req:
                total_delta += 0.25 if total_req > 1 else 0.15
                debug_notes.append(f"FULL MATCH {dim_type} ({matched_count}/{total_req})")
            elif matched_count > 0:
                if total_req > 1:
                    total_delta -= 0.25
                    debug_notes.append(f"GEOMETRIC CONFLICT {dim_type} ({matched_count}/{total_req})")
                else:
                    total_delta += 0.06
            else:
                total_delta -= 0.25
                debug_notes.append(f"CONFLICT {dim_type}")

    return total_delta, debug_notes
