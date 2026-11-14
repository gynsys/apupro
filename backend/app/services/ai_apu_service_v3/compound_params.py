"""
Parametros normativos y validacion liviana para partidas compuestas en toneladas (Motor v3.0).
Sin dependencias pesadas para poder usarse en el detector y en pruebas rapidas.
"""

from typing import Optional

# --- Supuestos normativos configurables (deben ser validados por el ingeniero de costos) ---
MIN_FERROUS_PCT: float = 1.0
DEFAULT_FERROUS_PCT: float = 3.0
DEFAULT_RUBBLE_DENSITY_T_PER_M3: float = 1.4

MASTER_UNIT: str = "ton"


def resolve_ferrous_pct(user_pct: Optional[float]) -> float:
    """Devuelve el % de ferrosos (en peso) a usar; aplica default y piso normativo."""
    if user_pct is None:
        return DEFAULT_FERROUS_PCT
    pct = float(user_pct)
    if pct < MIN_FERROUS_PCT:
        raise ValueError(
            f"El porcentaje de ferrosos ({pct:g}%) es menor al minimo normativo ({MIN_FERROUS_PCT:g}%)"
        )
    if pct >= 100.0:
        raise ValueError("El porcentaje de ferrosos debe ser menor a 100%")
    return pct
