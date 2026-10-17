"""
Utilidades geométricas independientes de disciplina para elementos constructivos lineales
(dinteles, machones, vigas de corona, brocales, cunetas, rodapiés, etc.).

Este módulo NO importa nada de `app` para evitar dependencias circulares entre el
motor RAG, el calibrador de mano de obra y las reglas de dominio.
"""
import re
import unicodedata
from typing import Optional

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
