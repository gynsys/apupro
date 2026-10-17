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


# Equivalencia nominal pulgadas <-> diámetro externo métrico ISO 4065 (PPR / PEAD / termofusión)
INCH_TO_METRIC_PLASTIC_OD_MM: List[Tuple[float, float]] = [
    (0.50, 20.0),   # 1/2"   <-> 20 mm
    (0.75, 25.0),   # 3/4"   <-> 25 mm
    (1.00, 32.0),   # 1"     <-> 32 mm
    (1.25, 40.0),   # 1 1/4" <-> 40 mm
    (1.50, 50.0),   # 1 1/2" <-> 50 mm
    (2.00, 63.0),   # 2"     <-> 63 mm
    (2.50, 75.0),   # 2 1/2" <-> 75 mm
    (3.00, 90.0),   # 3"     <-> 90 mm
    (4.00, 110.0),  # 4"     <-> 110 mm
    (6.00, 160.0),  # 6"     <-> 160 mm
]

_INTERNAL_DIAMETER_PARENS_RE = re.compile(
    r"\(\s*DIAMETRO\s+(?:INTERNO|NOMINAL)[^)]*\)",
    re.IGNORECASE,
)
_PIPE_CONTEXT_CUES: Tuple[str, ...] = (
    "TUBERIA", "TUBERÍA", "TUBO", "PPR", "POLIPROPILENO", "TERMOFUSION",
    "TERMOFUSIÓN", "POLIFUSION", "POLIFUSIÓN", "PVC", "CPVC", "PEAD", "HDPE", "HG",
)
_PLASTIC_METRIC_CUES: Tuple[str, ...] = (
    "POLIPROPILENO", "PPR", "TERMOFUSION", "TERMOFUSIÓN", "POLIFUSION", "POLIFUSIÓN", "PEAD", "HDPE",
)
_HVAC_CONTEXT_CUES: Tuple[str, ...] = (
    "AIRE ACONDICIONADO", "CLIMATIZACION", "CLIMATIZACIÓN", "SPLIT", "CHILLER",
    "FANCOIL", "FAN COIL", "UMA", "REFRIGERACION", "REFRIGERACIÓN", "EVAPORADOR",
    "CONDENSADOR", "CONDENSADORA", "BTU",
)


def _nominal_bore_mm_for_plastic_od(od_mm: float) -> Optional[float]:
    """Convierte un diámetro externo métrico ISO 4065 (ej. 20 mm, 25 mm, 32 mm) a su nominal en mm (pulg * 25.4)."""
    for inches, ref_od in INCH_TO_METRIC_PLASTIC_OD_MM:
        if abs(od_mm - ref_od) <= 0.6:
            return round(inches * 25.4, 2)
    return None


def _parse_thousand_aware_float(raw_num: str) -> Optional[float]:
    """
    Convierte cadenas numéricas reconociendo separadores de miles como '12.000', '24.000', '1.500'
    cuando tienen exactamente 3 dígitos tras el punto/coma, o decimales estándar ('1.5', '37,5').
    """
    if not raw_num or not isinstance(raw_num, str):
        return None
    s = raw_num.strip()
    if re.match(r"^\d{1,3}(?:[.,]\d{3})+$", s):
        return float(re.sub(r"[.,]", "", s))
    try:
        return float(s.replace(",", "."))
    except ValueError:
        return None


def parse_fraction(s: str) -> Optional[float]:
    """
    Convierte cadenas numéricas fraccionarias o enteras ('1/2', '3/4', '1-1/2', '1 1/2', '2') a float.
    Retorna None si el formato no es válido.
    """
    if not s or not isinstance(s, str):
        return None

    try:
        cleaned = s.strip().replace(',', '.').replace('-', ' ')
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

    def __init__(
        self,
        dim_type: str,
        canonical_value: float,
        raw_text: str,
        metric_od_mm: Optional[float] = None,
    ) -> None:
        if not dim_type or not isinstance(dim_type, str):
            raise ValueError("dim_type debe ser un string no vacío")
        self.dim_type: str = dim_type
        self.canonical_value: float = float(canonical_value)
        self.raw_text: str = str(raw_text)
        self.metric_od_mm: Optional[float] = float(metric_od_mm) if metric_od_mm is not None else None

    def __repr__(self) -> str:
        return f"<{self.dim_type}: {self.canonical_value} (raw: '{self.raw_text}')>"

    def matches(self, other: "DimensionToken") -> bool:
        """Determina si dos tokens dimensionales son físicamente equivalentes."""
        if not isinstance(other, DimensionToken) or self.dim_type != other.dim_type:
            return False

        # Para diámetros: si ambos vienen en mm explícitos se compara el mm directo;
        # si uno viene en pulgadas y otro en mm nominal PPR/PEAD se compara canonical_value.
        if self.dim_type == "diameter_mm":
            if self.metric_od_mm is not None and other.metric_od_mm is not None:
                ref = max(self.metric_od_mm, other.metric_od_mm)
                if abs(self.metric_od_mm - other.metric_od_mm) <= max(1.2, 0.04 * ref):
                    return True
            ref_c = max(self.canonical_value, other.canonical_value)
            return abs(self.canonical_value - other.canonical_value) <= max(1.2, 0.04 * ref_c)

        # Para espesores en cm (ej. e=20 cm vs 0.20 m de espesor)
        if self.dim_type == "thickness_cm":
            return abs(self.canonical_value - other.canonical_value) <= max(0.5, 0.05 * self.canonical_value)

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

        # Para potencia aparente en kVA (transformadores, plantas eléctricas)
        if self.dim_type == "power_kva":
            ref_kva = max(self.canonical_value, other.canonical_value, 1.0)
            return abs(self.canonical_value - other.canonical_value) <= max(0.5, 0.03 * ref_kva)

        # Para capacidad térmica en BTU (climatización: 1 TR = 12.000 BTU)
        if self.dim_type == "thermal_btu":
            ref_btu = max(self.canonical_value, other.canonical_value, 1.0)
            return abs(self.canonical_value - other.canonical_value) <= max(600.0, 0.05 * ref_btu)

        # Para capacidad volumétrica en litros (tanques: 1 galón = 3.785 L, ej. 82 gal ≈ 310 L)
        if self.dim_type == "volume_liters":
            ref_vol = max(self.canonical_value, other.canonical_value, 1.0)
            return abs(self.canonical_value - other.canonical_value) <= max(10.0, 0.06 * ref_vol)

        # Para distancia de acarreo/transporte en km
        if self.dim_type == "distance_km":
            ref_km = max(self.canonical_value, other.canonical_value, 1.0)
            return abs(self.canonical_value - other.canonical_value) <= max(0.5, 0.05 * ref_km)

        # Para cantidad de circuitos en tableros eléctricos
        if self.dim_type == "circuits_count":
            return abs(self.canonical_value - other.canonical_value) <= 0.1

        # Para secciones o formatos bidimensionales en cm (ej. 60x60 cm, 15x20x40 cm)
        if self.dim_type == "section_cm":
            ref_sec = max(self.canonical_value, other.canonical_value, 1.0)
            return abs(self.canonical_value - other.canonical_value) <= max(0.5, 0.04 * ref_sec)

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
        cleaned_input = _INTERNAL_DIAMETER_PARENS_RE.sub(" ", text_input)
        upper_input = cleaned_input.upper()
        is_plastic_metric = any(cue in upper_input for cue in _PLASTIC_METRIC_CUES)

        # 1. Diámetros métricos en mm: ej. 20 mm, 90 mm, 110 mm (excluyendo espesores "e = 3.2 mm" y secciones "100x100 mm")
        for m in re.finditer(r"(?<![\d.,xX×])(\d+(?:[.,]\d+)?)\s*mm\b", cleaned_input, re.IGNORECASE):
            prefix = cleaned_input[max(0, m.start() - 14):m.start()]
            if re.search(r"(?:\be\s*=\s*|\bespesor\s*=?\s*|[xX×]\s*)$", prefix, re.IGNORECASE):
                continue
            val = float(m.group(1).replace(",", "."))
            nominal_mm = _nominal_bore_mm_for_plastic_od(val) if is_plastic_metric else None
            canonical = nominal_mm if nominal_mm is not None else round(val, 2)
            tok = DimensionToken("diameter_mm", canonical, m.group(0), metric_od_mm=round(val, 2))
            if not any(existing.dim_type == "diameter_mm" and existing.matches(tok) for existing in tokens):
                tokens.append(tok)

        # 2. Diámetros en pulgadas: ej. 2 1/2", 1-1/2", 1/2", 3/4", 1", 2 pulg
        for m in re.finditer(
            r"(?<!\d\s)(?<![\d.,/-])(\d+\s*[- ]\s*\d+\s*/\s*\d+|\d+\s*/\s*\d+|\d+(?:[.,]\d+)?)\s*(?:[\"”]|pulg(?:adas?)?|plg\b)",
            cleaned_input,
            re.IGNORECASE,
        ):
            frac = parse_fraction(m.group(1))
            if frac is not None and frac > 0:
                mm_val = round(frac * 25.4, 2)
                tok = DimensionToken("diameter_mm", mm_val, m.group(0))
                if not any(existing.dim_type == "diameter_mm" and existing.matches(tok) for existing in tokens):
                    tokens.append(tok)

        # 2b. Fracciones de pulgada sin comillas en contexto de tubería (ej. "ppr 1/2", "tubería 1 1/2")
        has_diameter = any(t.dim_type == "diameter_mm" for t in tokens)
        if not has_diameter and any(cue in upper_input for cue in _PIPE_CONTEXT_CUES):
            m_frac = re.search(
                r"(?<!\d\s)(?<![\d.,/:-])(\d+\s*[- ]\s*\d+\s*/\s*\d+|\d+\s*/\s*\d+)(?![\d.,/:])",
                cleaned_input,
            )
            if m_frac:
                frac_val = parse_fraction(m_frac.group(1))
                if frac_val is not None and 0.20 <= frac_val <= 12.0:
                    mm_val = round(frac_val * 25.4, 2)
                    tokens.append(DimensionToken("diameter_mm", mm_val, m_frac.group(0)))

        # 3. Cabillas de refuerzo (#3, #4, #5, #6, #8, cabilla #4), excluyendo calibres eléctricos (#8 AWG, #10 AWG)
        for m in re.finditer(r"(?:cabilla|acero)?\s*(?:#|n[°o]\.?\s*)(\d+)\b", cleaned_input, re.IGNORECASE):
            suffix = cleaned_input[m.end():m.end() + 10]
            if re.match(r"^\s*awg\b", suffix, re.IGNORECASE):
                continue
            if ("AWG" in upper_input or "CABLE" in upper_input or "CONDUCTOR" in upper_input) and not (
                "CABILLA" in upper_input or "REFUERZO" in upper_input
            ):
                continue
            num = int(m.group(1))
            if num in REBAR_MAP:
                mm_val, _ = REBAR_MAP[num]
                tokens.append(DimensionToken("diameter_mm", mm_val, m.group(0)))
                tokens.append(DimensionToken("rebar_num", float(num), m.group(0)))

        # 4. Concreto / Mortero: kg/cm2 o f'c = 210
        for m in re.finditer(r"(?:f'?c\s*=?\s*|(?<![\d.,]))(\d+(?:[.,]\d+)?)\s*(?:kg/?cm2|kgf/?cm2)\b", cleaned_input, re.IGNORECASE):
            val = float(m.group(1).replace(",", "."))
            tokens.append(DimensionToken("concrete_kg_cm2", val, m.group(0)))
        for m in re.finditer(r"\bf'?c\s*=?\s*(\d{2,3})\b", cleaned_input, re.IGNORECASE):
            val = float(m.group(1))
            if not any(t.dim_type == "concrete_kg_cm2" and abs(t.canonical_value - val) <= 1.0 for t in tokens):
                tokens.append(DimensionToken("concrete_kg_cm2", val, m.group(0)))

        # 5. Presión Nominal PN y SDR: PN 16, SDR 11
        for m in re.finditer(r"\b(pn|sdr)\s*(\d+(?:[.,]\d+)?)\b", cleaned_input, re.IGNORECASE):
            tipo = m.group(1).lower()
            val = float(m.group(2).replace(",", "."))
            tokens.append(DimensionToken(f"pressure_{tipo}", val, m.group(0)))

        # 6. Voltaje: soporta voltajes simples (110v, 220v) y duales (110/220v, 220/440v)
        for m in re.finditer(r"(?<![\d.,])(\d+(?:[.,]\d+)?)(?:\s*/\s*(\d+(?:[.,]\d+)?))?\s*(v|kv|volt(?:ios?)?)\b", cleaned_input, re.IGNORECASE):
            unit_str = (m.group(3) or "").lower()
            multiplier = 1000.0 if unit_str == "kv" else 1.0
            v1 = float(m.group(1).replace(",", ".")) * multiplier
            tokens.append(DimensionToken("voltage_v", v1, m.group(0)))
            if m.group(2):
                v2 = float(m.group(2).replace(",", ".")) * multiplier
                tokens.append(DimensionToken("voltage_v", v2, m.group(0)))

        # 7. Potencia mecánica: hp, kw
        for m in re.finditer(r"(?<!\d\s)(?<![\d.,/-])(\d+\s*[- ]\s*\d+\s*/\s*\d+|\d+\s*/\s*\d+|\d+(?:[.,]\d+)?)\s*(hp|kw)\b", cleaned_input, re.IGNORECASE):
            frac = parse_fraction(m.group(1))
            unit_str = (m.group(2) or "").lower()
            if frac is not None:
                hp_val = frac * 1.341 if unit_str == "kw" else frac
                tokens.append(DimensionToken("power_hp", round(hp_val, 2), m.group(0)))

        # 8. Calibre de cables AWG (incluye #12 AWG, 12 AWG, calibre #12 y 1/0 a 4/0 AWG)
        for m_zero in re.finditer(r"(?<![\d.,])([1-4])\s*/\s*0\s*awg\b", cleaned_input, re.IGNORECASE):
            zero_val = -float(int(m_zero.group(1)))
            tok_z = DimensionToken("gauge_awg", zero_val, m_zero.group(0))
            if not any(existing.dim_type == "gauge_awg" and existing.matches(tok_z) for existing in tokens):
                tokens.append(tok_z)

        for m in re.finditer(
            r"(?:calibre\s*(?:#|n[°o]\.?)?\s*(\d+)\b|(?:#|n[°o]\.?\s*)?(?<![\d.,/])(\d+)\s*awg\b)",
            cleaned_input,
            re.IGNORECASE,
        ):
            num_str = m.group(1) or m.group(2)
            if num_str:
                tok_awg = DimensionToken("gauge_awg", float(int(num_str)), m.group(0))
                if not any(existing.dim_type == "gauge_awg" and existing.matches(tok_awg) for existing in tokens):
                    tokens.append(tok_awg)

        # 9. Espesores en cm o m: "e=20 cm", "espesor 10 cm", "espesor 25 cms", "0.10 m de espesor"
        for m_th in re.finditer(
            r"(?:\be\s*=\s*|\bespesor\s*(?:de\s*)?=?\s*)(\d+(?:[.,]\d+)?)\s*(cm|cms|m|mm)\b"
            r"|(?<![\d.,])(\d+(?:[.,]\d+)?)\s*(cm|cms|m)\s+de\s+espesor\b",
            cleaned_input,
            re.IGNORECASE,
        ):
            num_s = m_th.group(1) or m_th.group(3)
            unit_s = (m_th.group(2) or m_th.group(4) or "cm").lower()
            val = float(num_s.replace(",", "."))
            cm_val = val * 100.0 if unit_s == "m" else (val / 10.0 if unit_s == "mm" else val)
            tok_th = DimensionToken("thickness_cm", round(cm_val, 2), m_th.group(0))
            if not any(existing.dim_type == "thickness_cm" and existing.matches(tok_th) for existing in tokens):
                tokens.append(tok_th)

        # 10. Capacidad Térmica (Climatización): BTU <-> TR / Toneladas de Refrigeración (1 TR = 12.000 BTU)
        for m_btu in re.finditer(
            r"(?<![\d.,])(\d{1,3}(?:[.,]\d{3})+|\d+(?:[.,]\d+)?)\s*btu(?:/h(?:r)?)?\b",
            cleaned_input,
            re.IGNORECASE,
        ):
            btu_val = _parse_thousand_aware_float(m_btu.group(1))
            if btu_val is not None and btu_val >= 3000.0:
                tok_btu = DimensionToken("thermal_btu", round(btu_val, 1), m_btu.group(0))
                if not any(existing.dim_type == "thermal_btu" and existing.matches(tok_btu) for existing in tokens):
                    tokens.append(tok_btu)

        for m_tr in re.finditer(
            r"(?<!\d\s)(?<![\d.,/-])(\d+\s*[- ]\s*\d+\s*/\s*\d+|\d+\s*/\s*\d+|\d+(?:[.,]\d+)?)\s*tr\b",
            cleaned_input,
            re.IGNORECASE,
        ):
            tr_val = parse_fraction(m_tr.group(1))
            if tr_val is not None and 0.5 <= tr_val <= 500.0:
                tok_tr = DimensionToken("thermal_btu", round(tr_val * 12000.0, 1), m_tr.group(0))
                if not any(existing.dim_type == "thermal_btu" and existing.matches(tok_tr) for existing in tokens):
                    tokens.append(tok_tr)

        if any(cue in upper_input for cue in _HVAC_CONTEXT_CUES):
            for m_ton in re.finditer(
                r"(?<!\d\s)(?<![\d.,/-])(\d+\s*[- ]\s*\d+\s*/\s*\d+|\d+\s*/\s*\d+|\d+(?:[.,]\d+)?)\s*ton(?:eladas?)?\b",
                cleaned_input,
                re.IGNORECASE,
            ):
                ton_val = parse_fraction(m_ton.group(1))
                if ton_val is not None and 0.5 <= ton_val <= 200.0:
                    tok_ton = DimensionToken("thermal_btu", round(ton_val * 12000.0, 1), m_ton.group(0))
                    if not any(existing.dim_type == "thermal_btu" and existing.matches(tok_ton) for existing in tokens):
                        tokens.append(tok_ton)

        # 11. Potencia Aparente Eléctrica: kVA / MVA (Transformadores y Plantas Eléctricas)
        for m_kva in re.finditer(r"(?<![\d.,])(\d+(?:[.,]\d+)?)\s*(kva|mva)\b", cleaned_input, re.IGNORECASE):
            val_kva = float(m_kva.group(1).replace(",", "."))
            if m_kva.group(2).lower() == "mva":
                val_kva *= 1000.0
            tok_kva = DimensionToken("power_kva", round(val_kva, 2), m_kva.group(0))
            if not any(existing.dim_type == "power_kva" and existing.matches(tok_kva) for existing in tokens):
                tokens.append(tok_kva)

        # 12. Capacidad Volumétrica: Litros <-> Galones (1 gal US = 3.78541 L)
        for m_vol in re.finditer(
            r"(?<![\d.,])(\d{1,3}(?:[.,]\d{3})+|\d+(?:[.,]\d+)?)\s*(litros?|lts?|gal(?:ones?)?)\b",
            cleaned_input,
            re.IGNORECASE,
        ):
            u_vol = m_vol.group(2).lower()
            raw_v = m_vol.group(1)
            v_num = _parse_thousand_aware_float(raw_v) if not u_vol.startswith("gal") else float(raw_v.replace(",", "."))
            if v_num is not None and v_num > 0:
                liters = v_num * 3.78541 if u_vol.startswith("gal") else v_num
                tok_vol = DimensionToken("volume_liters", round(liters, 1), m_vol.group(0))
                if not any(existing.dim_type == "volume_liters" and existing.matches(tok_vol) for existing in tokens):
                    tokens.append(tok_vol)

        # 13. Distancia de Acarreo/Transporte (km) y Cantidad de Circuitos en Tableros
        for m_km in re.finditer(r"(?<![\d.,])(\d+(?:[.,]\d+)?)\s*(?:km|kil[oó]metros?)\b", cleaned_input, re.IGNORECASE):
            val_km = float(m_km.group(1).replace(",", "."))
            if val_km > 0:
                tok_km = DimensionToken("distance_km", round(val_km, 2), m_km.group(0))
                if not any(existing.dim_type == "distance_km" and existing.matches(tok_km) for existing in tokens):
                    tokens.append(tok_km)

        for m_cir in re.finditer(r"(?<![\d.,])(\d+)\s*(?:circuitos?|ctos?)\b", cleaned_input, re.IGNORECASE):
            val_cir = float(int(m_cir.group(1)))
            if val_cir > 0:
                tok_cir = DimensionToken("circuits_count", val_cir, m_cir.group(0))
                if not any(existing.dim_type == "circuits_count" and existing.matches(tok_cir) for existing in tokens):
                    tokens.append(tok_cir)

        # 14. Secciones y Formatos Bidimensionales/Tridimensionales: ej. "60x60 cm", "15x20x40 cm", "100x100 mm"
        for m_sec in re.finditer(
            r"(?<![\d.,])(\d+(?:[.,]\d+)?)\s*[xX×]\s*(\d+(?:[.,]\d+)?)(?:\s*[xX×]\s*(\d+(?:[.,]\d+)?))?\s*(cm|cms|mm|m)\b",
            cleaned_input,
            re.IGNORECASE,
        ):
            u_sec = m_sec.group(4).lower()
            mult_cm = 100.0 if u_sec == "m" else (0.1 if u_sec == "mm" else 1.0)
            raw_sides = [m_sec.group(1), m_sec.group(2)]
            if m_sec.group(3):
                raw_sides.append(m_sec.group(3))
            sides_cm = sorted(round(float(s.replace(",", ".")) * mult_cm, 2) for s in raw_sides)
            for s_cm in sides_cm:
                tokens.append(DimensionToken("section_cm", s_cm, m_sec.group(0)))

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
