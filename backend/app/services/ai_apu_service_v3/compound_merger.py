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
import re
import unicodedata
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


def _labor_role_key(lab: Dict[str, Any]) -> str:
    desc = str(lab.get("descripcion") or "").strip()
    if desc:
        nfkd = unicodedata.normalize("NFKD", desc)
        clean = "".join(ch for ch in nfkd if not unicodedata.combining(ch)).upper()
        # Quitar sufijos de tabulador como "- TABULADOR CONSTRUCCION -N2" o "-N8" y puntos
        clean = re.sub(r"\s*-\s*TABULADOR.*$", "", clean)
        clean = re.sub(r"\s*-N\d+\b", "", clean)
        clean = clean.replace(".", "").strip()
        if "CAPORAL" in clean:
            return "ROLE::CAPORAL"
        if "MAESTRO DE OBRA" in clean or "MAESTRO GENERAL" in clean:
            return "ROLE::MAESTRO DE OBRA"
        if "AYUDANTE" in clean:
            return "ROLE::AYUDANTE"
        if "OBRERO" in clean:
            return "ROLE::OBRERO DE 1RA"
        if "OPERADOR DE EQUIPO PESADO" in clean or "OPERADOR DE MAQUINA PESADA" in clean:
            return "ROLE::OPERADOR DE EQUIPO PESADO DE 1RA"
        if "SOLDADOR" in clean:
            return "ROLE::SOLDADOR DE 1RA"
        if "HERRERO" in clean or "MONTADOR" in clean:
            return "ROLE::HERRERO DE 1RA"
        if "ALBANIL" in clean:
            return "ROLE::ALBANIL DE 1RA"
        if "CARPINTERO" in clean:
            return "ROLE::CARPINTERO DE 1RA"
        if "ELECTRICISTA" in clean:
            return "ROLE::ELECTRICISTA DE 1RA"
        if "PLOMERO" in clean:
            return "ROLE::PLOMERO DE 1RA"
        return f"ROLE::{clean}"
    code = str(lab.get("codigo") or lab.get("cod_ins") or "").strip().upper()
    return code or "OBRERO"


def _item_merge_key(item: Dict[str, Any], fallback_prefix: str, idx: int) -> str:
    code = str(item.get("codigo") or item.get("cod_ins") or "").strip().upper()
    desc = str(item.get("descripcion") or "").strip()
    nfkd = unicodedata.normalize("NFKD", desc)
    clean_desc = "".join(ch for ch in nfkd if not unicodedata.combining(ch)).upper()
    if code and clean_desc:
        return f"{code}::{clean_desc}"
    if code:
        return code
    if clean_desc:
        return clean_desc
    return f"{fallback_prefix}_{idx}"


def merge_activity_apus_to_master_ton(
    contributions: List[ActivityContribution],
    total_tons: float,
    master_description: str,
    rubble_density_t_per_m3: float = DEFAULT_RUBBLE_DENSITY_T_PER_M3,
) -> Dict[str, Any]:
    """
    Funde N APUs de actividad en un unico APU en toneladas:
    1. Consolida la cuadrilla por oficio y redondea la cantidad de cada trabajador a un NUMERO ENTERO >= 1.
    2. Ajusta el rendimiento diario maestro R_master (ton/dia) de esa cuadrilla entera de modo que el
       costo unitario de mano de obra por tonelada sea exactamente sum(f_i * SubtotalMO_i).
    3. Escala los equipos por (f_i * R_master / R_i) y los materiales por f_i, consolidando insumos repetidos
       y conservando el costo directo exacto por tonelada: CD_master = sum(f_i * CD_i).
    """
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
    base_master_perf = 1.0 / crew_days_per_ton if crew_days_per_ton > 0 else 1.0

    # --- 1. Consolidar mano de obra en números enteros >= 1 y calcular TargetMO por tonelada ---
    labor_buckets: Dict[str, Dict[str, Any]] = {}
    target_mo_per_ton = 0.0

    for c, f, r in zip(contributions, factors, rendimientos):
        d_i = f / r  # dias-cuadrilla de la sub-partida i por tonelada
        for lab in c.apu.get("labors") or []:
            qty = max(1, int(round(float(lab.get("cantidad") or 1.0))))
            jornal = float(lab.get("jornal") or 0.0)
            bono = float(lab.get("bono") or 0.0)
            rate = jornal + bono
            if rate <= 0.0:
                rate = float(lab.get("precio_unitario") or 0.0)
                jornal = rate
            target_mo_per_ton += d_i * qty * rate

            role_key = _labor_role_key(lab)
            if role_key not in labor_buckets:
                template = copy.deepcopy(lab)
                template["jornal"] = jornal
                template["bono"] = bono
                labor_buckets[role_key] = {
                    "template": template,
                    "weighted_person_days": d_i * qty,
                    "tags": [c.tag],
                }
            else:
                labor_buckets[role_key]["weighted_person_days"] += d_i * qty
                if c.tag not in labor_buckets[role_key]["tags"]:
                    labor_buckets[role_key]["tags"].append(c.tag)

    labors: List[Dict[str, Any]] = []
    master_crew_daily_cost = 0.0
    for bucket in labor_buckets.values():
        avg_workers = bucket["weighted_person_days"] / crew_days_per_ton if crew_days_per_ton > 0 else 1.0
        int_workers = max(1, int(round(avg_workers)))
        item = bucket["template"]
        item["cantidad"] = int_workers
        item["actividad_origen"] = ", ".join(bucket["tags"])
        rate = float(item.get("jornal") or 0.0) + float(item.get("bono") or 0.0)
        master_crew_daily_cost += int_workers * rate
        labors.append(item)

    if target_mo_per_ton > 0.0 and master_crew_daily_cost > 0.0:
        master_perf = round(master_crew_daily_cost / target_mo_per_ton, 6)
    else:
        master_perf = round(base_master_perf, 6)

    # --- 2. Escalar y consolidar materiales y equipos con el R_master calibrado ---
    mat_buckets: Dict[str, Dict[str, Any]] = {}
    eq_buckets: Dict[str, Dict[str, Any]] = {}
    notes: List[str] = []

    for c, f, r in zip(contributions, factors, rendimientos):
        day_scale = f * master_perf / r
        for idx_m, m in enumerate(c.apu.get("materials") or []):
            m_key = _item_merge_key(m, f"MAT_{c.tag}", idx_m)
            scaled_qty = float(m.get("cantidad") or 0.0) * f
            if m_key not in mat_buckets:
                item = copy.deepcopy(m)
                item["cantidad"] = scaled_qty
                mat_buckets[m_key] = {"item": item, "tags": [c.tag]}
            else:
                mat_buckets[m_key]["item"]["cantidad"] += scaled_qty
                if c.tag not in mat_buckets[m_key]["tags"]:
                    mat_buckets[m_key]["tags"].append(c.tag)

        for idx_e, e in enumerate(c.apu.get("equipments") or []):
            e_key = _item_merge_key(e, f"EQ_{c.tag}", idx_e)
            scaled_qty = float(e.get("cantidad") or 0.0) * day_scale
            if e_key not in eq_buckets:
                item = copy.deepcopy(e)
                item["cantidad"] = scaled_qty
                eq_buckets[e_key] = {"item": item, "tags": [c.tag]}
            else:
                eq_buckets[e_key]["item"]["cantidad"] += scaled_qty
                if c.tag not in eq_buckets[e_key]["tags"]:
                    eq_buckets[e_key]["tags"].append(c.tag)

        notes.append(
            f"[{c.tag}] {f:.6g} {c.unit}/ton | rendimiento base {r:g} {c.unit}/dia"
        )

    materials: List[Dict[str, Any]] = []
    for mb in mat_buckets.values():
        it = mb["item"]
        it["actividad_origen"] = ", ".join(mb["tags"])
        materials.append(it)

    equipments: List[Dict[str, Any]] = []
    for eb in eq_buckets.values():
        it = eb["item"]
        it["actividad_origen"] = ", ".join(eb["tags"])
        equipments.append(it)

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
