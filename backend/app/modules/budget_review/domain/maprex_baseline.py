import re
from typing import Dict, FrozenSet, Optional, Tuple

HEX8_PATTERN = re.compile(r"^[0-9A-F]{8}$")

# Equipos cuyo factor de depreciación en Maprex nativo es alquiler diario (1.0 o 0.05)
# pero en CostBase fue convertido a factor compuesto (0.0025 - 0.02).
MAPREX_NATIVE_EQUIPMENT_DEPREC: Dict[str, Tuple[float, float]] = {
    "ALB153": (1.0, 0.0035),
    "COM010": (1.0, 0.00348),
    "COM014": (1.0, 0.0091),
    "COM015": (1.0, 0.02),
    "COM016": (1.0, 0.006272),
    "ESP012": (1.0, 0.006272),
    "PLO020": (0.05, 0.01),
    "VEH005": (1.0, 0.0025),
}

# Equivalencias de unidades entre Maprex y CostBase que no constituyen error técnico.
UNIT_EQUIVALENCES: Dict[str, str] = {
    "DIA": "DIA",
    "DÍA": "DIA",
    "XDIA": "DIA",
    "XDÍA": "DIA",
    "UND": "UND",
    "PZA": "UND",
    "PIEZA": "UND",
    "KGF": "KGF",
    "KG": "KGF",
    "M2": "M2",
    "M3": "M3",
    "ML": "M",
    "M": "M",
    "LTS": "LT",
    "LT": "LT",
    "ITS": "LT",
    "GLN": "GAL",
    "GAL": "GAL",
}

# Códigos donde Maprex y CostBase representan partidas o materiales distintos (colisión de código).
KNOWN_PARTIDA_CODE_COLLISIONS: FrozenSet[str] = frozenset({
    "ARB034",
    "CCS228",
    "CCS229",
    "CCS230",
    "CCS231",
    "CMT176",
})

KNOWN_MATERIAL_CODE_COLLISIONS: FrozenSet[str] = frozenset({
    "COVI39",
    "COVI40",
    "COVI41",
    "COVI42",
    "COVI43",
    "COVI44",
    "COVI46",
    "COVI47",
})


def normalize_unit(unit: str) -> str:
    """Normaliza una unidad de medida para comparar Maprex vs CostBase sin falsos positivos."""
    if not isinstance(unit, str):
        raise ValueError("La unidad debe ser una cadena de texto.")
    cleaned = unit.strip().upper()
    if not cleaned:
        return ""
    return UNIT_EQUIVALENCES.get(cleaned, cleaned)


def classify_costbase_item_origin(cod_par: str, cov_par: Optional[str] = None) -> str:
    """Clasifica el origen histórico de una partida en CostBase respecto a Maprex."""
    if not isinstance(cod_par, str) or not cod_par.strip():
        raise ValueError("El código de partida (cod_par) es obligatorio.")
    code = cod_par.strip().upper()
    cov = (cov_par or "").strip().upper()

    if HEX8_PATTERN.match(code):
        if cov.startswith("R"):
            return "LULOWIN_IP3_REPARACIONES_R"
        if cov.startswith("A"):
            return "LULOWIN_IP3_VIALIDAD_AMBIENTAL_A"
        if "RA" in cov:
            return "CADAFE_REDES_ELECTRICAS_RA"
        return "LULOWIN_IP3_HEX"

    if code.startswith("M") and len(code) >= 9:
        return "COVENIN_MANTENIMIENTO_M"
    if code.startswith("U") and len(code) >= 9:
        return "COVENIN_URBANISMO_U"
    if code.startswith("TOR"):
        return "TORRES_TELECOM_ELECTRICIDAD"
    if code.startswith("BAN") or (code.startswith("B") and code[1:3].isdigit()):
        return "CORPORATIVO_BANCA"

    return "MAPREX_BASE_OR_EDIFICACIONES"


def is_native_maprex_deprec_difference(
    cod_equ: str,
    imported_deprec: float,
    master_deprec: float,
    tolerance: float = 1e-4,
) -> bool:
    """Determina si una diferencia de depreciación proviene del valor nativo de Maprex y no de manipulación."""
    if not isinstance(cod_equ, str) or not cod_equ.strip():
        raise ValueError("El código de equipo (cod_equ) es obligatorio.")
    code = cod_equ.strip().upper()
    if code in MAPREX_NATIVE_EQUIPMENT_DEPREC:
        maprex_val, costbase_val = MAPREX_NATIVE_EQUIPMENT_DEPREC[code]
        if abs(imported_deprec - maprex_val) <= tolerance and abs(master_deprec - costbase_val) <= tolerance:
            return True
    # En 343 pares de ObraPainEqui, Maprex trae 1.0 y CostBase 0.01
    if abs(imported_deprec - 1.0) <= tolerance and abs(master_deprec - 0.01) <= tolerance:
        return True
    return False
