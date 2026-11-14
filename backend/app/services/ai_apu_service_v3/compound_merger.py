"""
Motor v3.0 - Fusion determinista de APUs de actividades multiples en un unico APU compuesto.

Caso de uso: pliegos que piden UNA partida compuesta en una unidad maestra (ej. toneladas)
cuya descripcion integra N actividades (apuntalamiento, demolicion, fragmentacion, carga,
separacion de ferrosos). Cada actividad se resuelve con su propio APU base (v3) y aqui se
normalizan a la unidad maestra y se funden sin perdida de costo.

Matematica (exacta):
    Para la actividad i con rendimiento R_i [u_i/dia] y f_i [u_i por tonelada maestra]:
      - Materiales: cantidad' = cantidad * f_i
      - Equipos y mano de obra (cantidad/dia): cantidad' = cantidad * f_i * R_m / R_i
    donde R_m = 1 / T y T = sum(f_i / R_i) son los dias-cuadrilla por tonelada.
    Resultado: costo directo por tonelada = sum(f_i * C_i), con C_i el costo directo unitario
    de cada actividad en su propia unidad.
"""

import copy
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from app.core.logging import logger
from app.services.ai_apu_service_v3.compound_params import (  # noqa: F401 (re-export)
    DEFAULT_FERROUS_PCT,
    DEFAULT_RUBBLE_DENSITY_T_PER_M3,
    MASTER_UNIT,
    MIN_FERROUS_PCT,
    resolve_ferrous_pct,
)
from app.services.ai_apu_service_v3.conversion_registry import MissingConversionData
from app.services.ai_apu_service_v3.delta_applier import _calculate_apu_subtotals

# Factor para convertir una unidad de masa a toneladas
_MASS_UNIT_TO_TON: Dict[str, float] = {
    "ton": 1.0,
    "t": 1.0,
    "tn": 1.0,
    "kg": 0.001,
    "kgf": 0.001,
}
_VOLUME_UNITS = ("m3",)
_LUMP_UNITS = ("gl", "sg")


@dataclass
class ActivityContribution:
    """APU ya resuelto (v3) de una actividad, listo para ser normalizado a toneladas."""
    tag: str
    apu: Dict[str, Any]
    unit: str
    share: float = 1.0  # fraccion de las toneladas totales que procesa esta actividad (0-1)
    density_t_m3: Optional[float] = None  # densidad propia (t/m3); si None se usa la por defecto
    units_per_ton_override: Optional[float] = None  # f_i dado por el usuario (obligatorio para m2 y m)


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


def units_per_master_ton(
    unit: str,
    share: float,
    total_tons: float,
    rubble_density_t_per_m3: float = DEFAULT_RUBBLE_DENSITY_T_PER_M3,
    units_per_ton_override: Optional[float] = None,
) -> float:
    """Calcula f_i: unidades propias de la actividad por cada tonelada de la partida maestra."""
    if total_tons is None or float(total_tons) <= 0:
        raise ValueError("total_tons debe ser mayor a 0")
    if share is None or not (0.0 < float(share) <= 1.0):
        raise ValueError("share debe estar en el intervalo (0, 1]")
    if rubble_density_t_per_m3 is None or float(rubble_density_t_per_m3) <= 0:
        raise ValueError("rubble_density_t_per_m3 debe ser mayor a 0")

    if units_per_ton_override is not None:
        if float(units_per_ton_override) <= 0:
            raise ValueError("units_per_ton_override debe ser mayor a 0")
        return float(units_per_ton_override)

    u = str(unit or "").strip().lower().replace("³", "3")
    if u in _LUMP_UNITS:
        # Suma global: se reparte entre el total de toneladas del contrato
        return 1.0 / float(total_tons)
    if u in _MASS_UNIT_TO_TON:
        return float(share) / _MASS_UNIT_TO_TON[u]
    if u in _VOLUME_UNITS:
        return float(share) / float(rubble_density_t_per_m3)
    if u in ("m2", "m"):
        raise MissingConversionData(
            "units_per_ton",
            f"Indica cuantos {u} de la actividad corresponden a cada tonelada (no hay factor universal).",
        )
    raise ValueError(f"Unidad '{unit}' no convertible a toneladas (use ton, kg, m3, Gl, m2 o m)")


def _activity_rendimiento(apu: Dict[str, Any], tag: str) -> float:
    rend = float((apu.get("partida") or {}).get("performance") or 0.0)
    if rend <= 0:
        raise ValueError(f"La actividad '{tag}' no tiene rendimiento valido (> 0)")
    return rend


def merge_activity_apus_to_master_ton(
    contributions: List[ActivityContribution],
    total_tons: float,
    master_description: str,
    rubble_density_t_per_m3: float = DEFAULT_RUBBLE_DENSITY_T_PER_M3,
) -> Dict[str, Any]:
    """Funde N APUs de actividad en un unico APU en toneladas (costo exacto por tonelada)."""
    if not contributions:
        raise ValueError("Se requiere al menos una actividad para fusionar")
    if not master_description or not master_description.strip():
        raise ValueError("master_description es obligatoria")

    factors: List[float] = []
    rendimientos: List[float] = []
    for c in contributions:
        try:
            factors.append(
                units_per_master_ton(
                    c.unit,
                    c.share,
                    total_tons,
                    c.density_t_m3 or rubble_density_t_per_m3,
                    c.units_per_ton_override,
                )
            )
        except MissingConversionData as exc:
            raise MissingConversionData(f"units_per_ton:{c.tag}", f"[{c.tag}] {exc}") from exc
        except ValueError as exc:
            raise ValueError(f"[{c.tag}] {exc}") from exc
        rendimientos.append(_activity_rendimiento(c.apu, c.tag))

    crew_days_per_ton = sum(f / r for f, r in zip(factors, rendimientos))
    master_perf = round(1.0 / crew_days_per_ton, 6)

    materials: List[Dict[str, Any]] = []
    equipments: List[Dict[str, Any]] = []
    labors: List[Dict[str, Any]] = []
    notes: List[str] = []

    for c, f, r in zip(contributions, factors, rendimientos):
        day_scale = f * master_perf / r
        for m in c.apu.get("materials") or []:
            item = copy.deepcopy(m)
            item["cantidad"] = float(item.get("cantidad") or 0.0) * f
            item["actividad_origen"] = c.tag
            materials.append(item)
        for e in c.apu.get("equipments") or []:
            item = copy.deepcopy(e)
            item["cantidad"] = float(item.get("cantidad") or 0.0) * day_scale
            item["actividad_origen"] = c.tag
            equipments.append(item)
        for lab in c.apu.get("labors") or []:
            item = copy.deepcopy(lab)
            item["cantidad"] = float(item.get("cantidad") or 0.0) * day_scale
            item["actividad_origen"] = c.tag
            labors.append(item)
        notes.append(
            f"[{c.tag}] {f:.6g} {c.unit}/ton | rendimiento base {r:g} {c.unit}/dia"
        )

    result: Dict[str, Any] = {
        "status": "completed",
        "generation_engine": "v3_compound",
        "partida": {
            "description": master_description.strip().upper(),
            "unit": MASTER_UNIT,
            "performance": master_perf,
            "rendimiento": master_perf,
        },
        "materials": materials,
        "equipments": equipments,
        "labors": labors,
        "notas_adaptacion": notes,
        "advertencias": [],
        "compound_trace": [
            {"actividad": c.tag, "unidad": c.unit, "f_por_ton": f, "rendimiento_base": r, "share": c.share}
            for c, f, r in zip(contributions, factors, rendimientos)
        ],
    }
    _calculate_apu_subtotals(result)
    logger.info(
        "[V3 Compound] %d actividades fusionadas: R=%.4f ton/dia | CD=$%.2f/ton",
        len(contributions),
        master_perf,
        result.get("costo_directo", 0.0),
    )
    return result
