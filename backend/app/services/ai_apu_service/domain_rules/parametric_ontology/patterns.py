"""Patrones regex de exclusión y funciones auxiliares de normalización para MOPTC."""

import re
import unicodedata
from typing import List


def strip_accents(text: str) -> str:
    """Elimina acentos y normaliza a minúsculas para comparaciones robustas."""
    if not text:
        return ""
    nfkd = unicodedata.normalize("NFKD", text.lower())
    return "".join(c for c in nfkd if not unicodedata.combining(c))


# Patrones genéricos de demolición y desmontaje (donde no aplica exigir dosificación de mezcla o fabricación nueva)
DEMOLITION_OR_REMOVAL_PATTERNS: List[re.Pattern] = [
    re.compile(
        r"\b(demolici[oó]n|demoler|picar|picado|tumbar|derribar|desmontaje|desmontar|desmonte|desmontes|desinstalaci[oó]n|desinstalar|retiro|retirar|desmantelamiento|desmantelar|desarme|desarmar|extracci[oó]n|extraer)\b",
        re.IGNORECASE,
    )
]

# Patrones de acabados, pinturas, impermeabilizaciones y tratamientos superficiales
# (donde no aplica exigir espesores de vaciado estructural, dosificación de concreto o espesor de losa)
SURFACE_TREATMENTS_AND_FINISHES_PATTERNS: List[re.Pattern] = [
    re.compile(
        r"\b(pintura|pintar|esmaltar?|esmalte|caucho|[oó]leo|acrilic[oa]|epoxi\w*|impermeabili\w+|manto|asfalto|asf[aá]ltic[oa]|sellador|sellado|lavado|limpieza|demarcaci[oó]n|revestimiento|acabado|fondo|anticorrosivo|estuco|empastado|friso|frisado)\b",
        re.IGNORECASE,
    )
]

# Patrones genéricos de mantenimiento correctivo, reparación, resanado y reacondicionamiento
# (donde no aplica exigir parámetros de fabricación nueva como f'c, dosificación de mezcla o dimensiones de taller)
MAINTENANCE_AND_REPAIR_PATTERNS: List[re.Pattern] = [
    re.compile(
        r"\b(mantenimiento|mantener|reparaci[oó]n|reparar|arreglo|arreglar|rehabilitaci[oó]n|rehabilitar|reacondicionamiento|reacondicionar|recuperaci[oó]n|recuperar|refacci[oó]n|refaccionar|resane|resanado|resanar|cepillado|cepillar|lavado|limpieza|desinfecci[oó]n|saneamiento|destape|destapar|achique|achicar|repicado|repicar|escarificaci[oó]n|escarificar|desmanchado|desmanchar|decapado|decapar)\b",
        re.IGNORECASE,
    )
]

# Combinación universal para familias de fabricación estructural y física nueva
NON_FABRICATION_EXCLUSION_PATTERNS: List[re.Pattern] = (
    DEMOLITION_OR_REMOVAL_PATTERNS
    + SURFACE_TREATMENTS_AND_FINISHES_PATTERNS
    + MAINTENANCE_AND_REPAIR_PATTERNS
)
