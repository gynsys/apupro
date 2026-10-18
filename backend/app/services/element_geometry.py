"""
Utilidades geométricas independientes de disciplina para elementos constructivos lineales
(dinteles, machones, vigas de corona, brocales, cunetas, rodapiés, etc.).

Este módulo NO importa nada de `app` para evitar dependencias circulares entre el
motor RAG, el calibrador de mano de obra y las reglas de dominio.
"""
import re
import unicodedata
from typing import Dict, Optional

_NUM = r"(\d+(?:[.,]\d+)?)"
_LEN_UNIT = r"(?:ML|MTS|MT|METROS|METRO|M)"

# Elementos constructivos cuya unidad natural de medición es el metro lineal,
# aunque el usuario los pida por unidad ("und") indicando su longitud típica.
_LINEAR_ELEMENT_PATTERN = re.compile(
    r"\b(?:DINTEL(?:ES)?|MACHON(?:ES)?|COLUMNETA(?:S)?|VIGA(?:S)?(?:\s+DE\s+(?:CORONA|RIOSTRA|AMARRE))?|"
    r"BROCAL(?:ES)?|CUNETA(?:S)?|RODAPIE(?:S)?|GOTERO(?:S)?|BORDILLO(?:S)?|CORNISA(?:S)?|MEDIA\s+CANA(?:S)?)\b"
)

_RANGE_PATTERNS = (
    re.compile(rf"\bENTRE\s+{_NUM}\s*{_LEN_UNIT}?\s+Y\s+{_NUM}\s*{_LEN_UNIT}\b"),
    re.compile(rf"\bDE\s+{_NUM}\s*{_LEN_UNIT}?\s+A\s+{_NUM}\s*{_LEN_UNIT}\b"),
)
_SINGLE_PATTERNS = (
    re.compile(rf"\b(?:LONGITUD|LARGO)\s*(?:DE|=|:)?\s*{_NUM}\s*{_LEN_UNIT}\b"),
    re.compile(rf"\b{_NUM}\s*{_LEN_UNIT}\s+DE\s+(?:LONGITUD|LARGO)\b"),
    re.compile(rf"\bL\s*=\s*{_NUM}\s*{_LEN_UNIT}\b"),
)

_MIN_LENGTH_M = 0.10
_MAX_LENGTH_M = 30.0


def _normalize_geometry_text(text: str) -> str:
    """Mayúsculas sin acentos para comparar patrones."""
    if not isinstance(text, str):
        raise ValueError("text debe ser str")
    decomposed = unicodedata.normalize("NFKD", text)
    return "".join(c for c in decomposed if not unicodedata.combining(c)).upper()


def _to_float(raw: str) -> float:
    return float(raw.replace(",", "."))


def is_linear_element(text: str) -> bool:
    """True si la descripción nombra un elemento constructivo de naturaleza lineal."""
    if not text or not isinstance(text, str):
        return False
    return bool(_LINEAR_ELEMENT_PATTERN.search(_normalize_geometry_text(text)))


def extract_linear_length_m(text: str) -> Optional[float]:
    """
    Extrae la longitud típica (m) declarada en el texto.
    - Rango ("entre 0.80 y 1.00 m", "de 0.80 a 1.00 m") -> promedio.
    - Valor único ("L=1.20 m", "1.00 m de longitud", "longitud de 0.9 m").
    Retorna None si no hay una longitud inequívoca dentro de [0.10, 30] m.
    """
    if not text or not isinstance(text, str):
        return None
    up = _normalize_geometry_text(text)

    for pat in _RANGE_PATTERNS:
        m = pat.search(up)
        if m:
            low, high = _to_float(m.group(1)), _to_float(m.group(2))
            avg = (low + high) / 2.0
            if _MIN_LENGTH_M <= avg <= _MAX_LENGTH_M:
                return round(avg, 3)

    for pat in _SINGLE_PATTERNS:
        m = pat.search(up)
        if m:
            val = _to_float(m.group(1))
            if _MIN_LENGTH_M <= val <= _MAX_LENGTH_M:
                return round(val, 3)
    return None


def _to_meters(val: float, unit_str: Optional[str]) -> float:
    """Convierte una dimensión numérica a metros según su unidad."""
    u = (unit_str or "").upper().strip()
    if u in ("CM", "CMS", "CENTIMETROS", "CENTIMETRO"):
        return val / 100.0
    if u in ("MM", "MILIMETROS"):
        return val / 1000.0
    if u in ('"', "PULG", "PULGADAS"):
        return val * 0.0254
    return val


def extract_discrete_dimensions(text: str) -> Optional[Dict[str, float]]:
    """
    Extrae las dimensiones 3D físicas (largo, ancho, alto/espesor en metros)
    y calcula el volumen en m3 de un elemento constructivo discreto.
    Soporta notación 3D ('0.90 m x 15 cm x 5 cm', '0.90x0.15x0.05m')
    y expresiones semánticas con rangos ('entre 0.8 a 1.00 m con ancho 0.15 y alto 5 cm').
    """
    if not text or not isinstance(text, str):
        return None
    norm = _normalize_geometry_text(text)

    # 1. Patrón compacto 3D (ej. 0.90 m x 15 cm x 5 cm o 0.90 x 0.15 x 0.05 m)
    pat_3d = re.search(
        r'(\d+(?:[.,]\d+)?)\s*(M|MTS|MT|CMS?|MM)?\s*[xX*]\s*'
        r'(\d+(?:[.,]\d+)?)\s*(M|MTS|MT|CMS?|MM)?\s*[xX*]\s*'
        r'(\d+(?:[.,]\d+)?)\s*(M|MTS|MT|CMS?|MM)?',
        norm
    )
    if pat_3d:
        v1 = _to_float(pat_3d.group(1))
        u1 = pat_3d.group(2) or pat_3d.group(6) or "M"
        v2 = _to_float(pat_3d.group(3))
        u2 = pat_3d.group(4) or pat_3d.group(6) or "M"
        v3 = _to_float(pat_3d.group(5))
        u3 = pat_3d.group(6) or "M"

        m1 = _to_meters(v1, u1)
        m2 = _to_meters(v2, u2)
        m3 = _to_meters(v3, u3)
        dims = sorted([m1, m2, m3], reverse=True)
        vol = round(m1 * m2 * m3, 6)
        return {
            "length_m": round(dims[0], 3),
            "width_m": round(dims[1], 3),
            "height_m": round(dims[2], 3),
            "volume_m3": vol
        }

    # 2. Patrones semánticos desglosados (Largo, Ancho, Alto/Espesor con rangos o valores únicos)
    length: Optional[float] = None
    width: Optional[float] = None
    height: Optional[float] = None

    # Longitud / Largo
    m_len_range = re.search(
        r'(?:LARGO|LONGITUD|LUZ|ENTRE|DE)\s+(\d+(?:[.,]\d+)?)\s*(?:M|MTS|MT|CMS?|CENTIMETROS)?\s*(?:A|Y|-)\s*(\d+(?:[.,]\d+)?)\s*(M|MTS|MT|CMS?|CENTIMETROS)?',
        norm
    )
    if m_len_range:
        u = m_len_range.group(3) or "M"
        length = (_to_meters(_to_float(m_len_range.group(1)), u) + _to_meters(_to_float(m_len_range.group(2)), u)) / 2.0
    else:
        m_len_single = re.search(
            r'(?:LARGO|LONGITUD|LUZ)\s*(?:DE|=|:)?\s*(\d+(?:[.,]\d+)?)\s*(M|MTS|MT|CMS?|CENTIMETROS)?',
            norm
        )
        if m_len_single:
            u = m_len_single.group(2) or "M"
            length = _to_meters(_to_float(m_len_single.group(1)), u)

    # Ancho
    m_w_range = re.search(
        r'ANCHO\s*(?:ENTRE|DE)?\s*(\d+(?:[.,]\d+)?)\s*(?:M|MTS|MT|CMS?|CENTIMETROS)?\s*(?:A|Y|-)\s*(\d+(?:[.,]\d+)?)\s*(M|MTS|MT|CMS?|CENTIMETROS)?',
        norm
    )
    if m_w_range:
        u = m_w_range.group(3) or "M"
        width = (_to_meters(_to_float(m_w_range.group(1)), u) + _to_meters(_to_float(m_w_range.group(2)), u)) / 2.0
    else:
        m_w_single = re.search(
            r'ANCHO\s*(?:DE|=|:)?\s*(\d+(?:[.,]\d+)?)\s*(M|MTS|MT|CMS?|CENTIMETROS)?',
            norm
        )
        if m_w_single:
            u = m_w_single.group(2) or "M"
            width = _to_meters(_to_float(m_w_single.group(1)), u)

    # Alto / Espesor / Peralte
    m_h_range = re.search(
        r'(?:ALTO|ALTURA|ESPESOR|PERALTE)\s*(?:ENTRE|DE)?\s*(\d+(?:[.,]\d+)?)\s*(?:M|MTS|MT|CMS?|CENTIMETROS)?\s*(?:A|Y|-)\s*(\d+(?:[.,]\d+)?)\s*(M|MTS|MT|CMS?|CENTIMETROS)?',
        norm
    )
    if m_h_range:
        u = m_h_range.group(3) or "M"
        height = (_to_meters(_to_float(m_h_range.group(1)), u) + _to_meters(_to_float(m_h_range.group(2)), u)) / 2.0
    else:
        m_h_single = re.search(
            r'(?:ALTO|ALTURA|ESPESOR|PERALTE)\s*(?:DE|=|:)?\s*(\d+(?:[.,]\d+)?)\s*(M|MTS|MT|CMS?|CENTIMETROS)?',
            norm
        )
        if m_h_single:
            u = m_h_single.group(2) or "M"
            height = _to_meters(_to_float(m_h_single.group(1)), u)

    if length is not None and width is not None and height is not None:
        vol = round(length * width * height, 6)
        dims = sorted([length, width, height], reverse=True)
        return {
            "length_m": round(dims[0], 3),
            "width_m": round(dims[1], 3),
            "height_m": round(dims[2], 3),
            "volume_m3": vol
        }

    return None


def extract_discrete_volume_m3(text: str) -> Optional[float]:
    """
    Retorna directamente el volumen en m3 si se pueden determinar las 3 dimensiones del elemento.
    """
    dims = extract_discrete_dimensions(text)
    if dims and "volume_m3" in dims:
        return dims["volume_m3"]
    return None
