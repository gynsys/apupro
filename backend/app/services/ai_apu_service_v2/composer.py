"""
Phase 2: Deterministic Composer Engine (WorkSpec + Catalog + Rules -> APU)
Assembles a complete, auditable COVENIN 2000:1992 APU without probabilistic LLM hallucination.
"""

import copy
import re
import time
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy.orm import Session

from app.core.logging import logger
from app.services.ai_apu_service.domain_rules.deep_well import _enforce_deep_well_dimensions
from app.services.ai_apu_service.domain_rules.discordant_pruning import enforce_discordant_inputs_purging
from app.services.ai_apu_service.domain_rules.structural_requirements import (
    align_description_with_requested_mix,
    enforce_fine_mix_plausibility,
    enforce_frp_structural_safeguards,
    enforce_reinforcement_for_structural_elements,
)
from app.services.ai_apu_service.generator.anchored_generator import (
    _enforce_base_apu_material_heritage,
    _enforce_floor_ground_equipment,
    _enforce_primary_materials_mutual_exclusion,
    _enforce_rapel_and_height_equipment,
    _enforce_scope_exclusions,
    _normalize_equipment_prices,
    _sanitize_partida_description,
)
from app.services.ai_apu_service.reconciliation.equipment import reconcile_equipment_with_database
from app.services.ai_apu_service.reconciliation.labor import reconcile_labor_with_database
from app.services.ai_apu_service.reconciliation.materials import reconcile_materials_with_database
from app.services.ai_apu_service.reconciliation.specs_matcher import _normalize_unit
from app.services.ai_apu_service_v2.schemas import WorkSpec
from app.services.apu_labor_calibrator import (
    EMPERICAL_HH_BENCHMARKS,
    _benchmark_unit,
    calibrate_apu_crew_and_equipment,
    classify_activity_typology,
)
from app.services.element_geometry import (
    extract_linear_length_m,
    is_linear_element,
)


def _ensure_normalized_apu_structure(apu: Dict[str, Any]) -> Dict[str, Any]:
    """Garantiza claves canónicas (partida, materials, equipments, labors, advertencias)."""
    if not isinstance(apu, dict):
        apu = {}

    cod_par = str(
        apu.get("cod_par") or apu.get("codpar") or
        (apu.get("partida", {}).get("cod_par") if isinstance(apu.get("partida"), dict) else "") or ""
    ).strip()
    cov_par = str(
        apu.get("cov_par") or apu.get("covenin") or apu.get("covpar") or
        (apu.get("partida", {}).get("cov_par") if isinstance(apu.get("partida"), dict) else "") or ""
    ).strip()
    codigo = cov_par or cod_par or (apu.get("codigo") if isinstance(apu.get("codigo"), str) else "") or (apu.get("partida", {}).get("codigo") if isinstance(apu.get("partida"), dict) else "") or "U-GEN-001"

    partida = apu.get("partida")
    if not isinstance(partida, dict):
        partida = {
            "codigo": codigo,
            "cod_par": cod_par or codigo,
            "cov_par": cov_par or codigo,
            "description": apu.get("description") or apu.get("descripcion") or "Partida de Construcción",
            "unit": apu.get("unit") or apu.get("unidad") or "und",
            "performance": float(apu.get("performance") or apu.get("rendimiento") or 0.0)
        }
    else:
        partida.setdefault("codigo", codigo)
        partida.setdefault("cod_par", cod_par or codigo)
        partida.setdefault("cov_par", cov_par or codigo)
        if "performance" not in partida and "rendimiento" in partida:
            partida["performance"] = float(partida["rendimiento"] or 0.0)
    apu["partida"] = partida

    # Normalizar materiales
    mats = apu.get("materials") or apu.get("materiales") or []
    apu["materials"] = [m for m in mats if isinstance(m, dict)]
    apu.pop("materiales", None)

    # Normalizar equipos
    eqs = apu.get("equipments") or apu.get("equipos") or []
    apu["equipments"] = [e for e in eqs if isinstance(e, dict)]
    apu.pop("equipos", None)

    # Normalizar mano de obra
    labs = apu.get("labors") or apu.get("mano_de_obra") or []
    apu["labors"] = [l for l in labs if isinstance(l, dict)]
    apu.pop("mano_de_obra", None)

    apu.setdefault("advertencias", [])
    apu.setdefault("notas_adaptacion", [])
    apu.setdefault("supuestos_tecnicos", [])
    return apu


def _calculate_apu_subtotals(apu: Dict[str, Any]) -> None:
    """Calcula matemáticamente subtotales y costo unitario sin aproximaciones."""
    rend = float(apu.get("partida", {}).get("performance") or 1.0)
    if rend <= 0:
        rend = 1.0

    # Materiales
    tot_mat = 0.0
    for m in apu.get("materials", []):
        cant = float(m.get("cantidad") or 0.0)
        pu = float(m.get("precio_unitario") or 0.0)
        desp = float(m.get("desperdicio") or 0.0)
        factor_desp = 1.0 + (desp / 100.0) if desp > 0 else 1.0
        tot = cant * pu * factor_desp
        m["total"] = round(tot, 4)
        tot_mat += tot

    # Equipos
    tot_eq = 0.0
    for e in apu.get("equipments", []):
        cant = float(e.get("cantidad") or 0.0)
        pu = float(e.get("precio_unitario") or 0.0)
        dep = float(e.get("depreciacion") or 1.0)
        costo_dia = cant * pu * dep
        tot = costo_dia / rend
        e["costo_dia"] = round(costo_dia, 4)
        e["total"] = round(tot, 4)
        tot_eq += tot

    # Mano de obra
    tot_mo = 0.0
    for l in apu.get("labors", []):
        cant = float(l.get("cantidad") or 0.0)
        jornal = float(l.get("jornal") or 0.0)
        bono = float(l.get("bono") or 0.0)
        costo_dia = cant * (jornal + bono)
        tot = costo_dia / rend
        l["costo_dia"] = round(costo_dia, 4)
        l["total"] = round(tot, 4)
        tot_mo += tot

    apu["subtotal_materiales"] = round(tot_mat, 4)
    apu["subtotal_equipos"] = round(tot_eq, 4)
    apu["subtotal_mano_de_obra"] = round(tot_mo, 4)
    apu["costo_directo"] = round(tot_mat + tot_eq + tot_mo, 4)
    apu["precio_unitario"] = apu["costo_directo"]


def calculate_v2_deterministic_performance(
    workspec: WorkSpec,
    labors: List[Dict[str, Any]],
    user_description: str,
    base_apu: Optional[Dict[str, Any]] = None
) -> Tuple[float, List[str]]:
    """
    Calcula matemáticamente el rendimiento diario de la cuadrilla para el Motor v2.0
    aplicando la formulación canónica COVENIN (Horas-Hombre y benchmarks empíricos):
    R = round(Total_HH_activa / median_hh_benchmark, 2).
    """
    if not isinstance(workspec, WorkSpec):
        raise ValueError("workspec debe ser una instancia válida de WorkSpec")
    if not isinstance(labors, list):
        raise ValueError("labors debe ser una lista de trabajadores")

    notes: List[str] = []
    target_unit = _normalize_unit(workspec.target_unit)

    # 1. Si la partida base histórica tiene la MISMA unidad y un rendimiento válido (> 1.0),
    # evaluar si puede conservarse como punto de partida
    if base_apu and isinstance(base_apu, dict):
        base_unit = _normalize_unit(
            base_apu.get("unidad") or
            (base_apu.get("partida", {}).get("unit") if isinstance(base_apu.get("partida"), dict) else "")
        )
        base_perf = float(
            base_apu.get("rendimiento") or
            (base_apu.get("partida", {}).get("performance") if isinstance(base_apu.get("partida"), dict) else 0.0) or
            0.0
        )
        if base_perf > 1.0 and base_unit == target_unit:
            notes.append(f"Rendimiento heredado de partida base histórica: {base_perf:.2f} {target_unit}/día.")
            return round(base_perf, 2), notes

    # 2. Casos especiales: Unidades globales (Gl / SG)
    if target_unit in ("gl", "sg"):
        days = float(workspec.execution_days) if workspec.execution_days and float(workspec.execution_days) > 0 else 1.0
        ren_global = round(1.0 / days, 4)
        notes.append(f"Rendimiento global determinista: {ren_global:.4f} Gl/día ({days:g} días de ejecución).")
        return ren_global, notes

    # 3. Sumar total de Horas-Hombre del personal activo en la cuadrilla
    active_workers = 0.0
    for l in labors:
        if not isinstance(l, dict):
            continue
        desc = str(l.get("descripcion", "")).upper()
        if any(sup in desc for sup in ("CAPORAL", "MAESTRO", "SUPERVIS")):
            continue
        active_workers += float(l.get("cantidad", 1.0) or 1.0)

    if active_workers <= 0.0:
        # Si toda la cuadrilla es supervisión o vino vacía, sumar todos los trabajadores (mínimo 1)
        active_workers = max(1.0, sum(float(l.get("cantidad", 1.0) or 1.0) for l in labors if isinstance(l, dict)))

    total_hh_daily = active_workers * 8.0  # 8 horas legales por jornada diaria

    # 4. Clasificar tipología constructiva
    covenin_code = ""
    if base_apu and isinstance(base_apu, dict):
        covenin_code = str(
            base_apu.get("covenin") or base_apu.get("codpar") or
            (base_apu.get("partida", {}).get("cov_par") if isinstance(base_apu.get("partida"), dict) else "") or ""
        )

    desc_for_typology = user_description or (f"{workspec.activity_type} {workspec.element}" if workspec.element else "")
    typology = classify_activity_typology(desc_for_typology, target_unit, covenin_code)

    is_maintenance = (
        workspec.activity_type in ("REPARACION", "MANTENIMIENTO", "DESMONTAJE") or
        any(k in desc_for_typology.upper() for k in [
            "MANTENIMIENTO", "SANEAMIENTO", "REPARACION", "RECONSTRUCCION", "RESTAURACION",
            "REHABILITACION", "REACONDICIONAMIENTO", "ACONDICIONAMIENTO", "DEMOLICION",
            "REMOCION", "SUSTITUCION", "REEMPLAZO"
        ])
    )
    difficulty_factor = 1.30 if (is_maintenance and typology not in ("REPARACIONES_PUNTUALES", "MANTENIMIENTO_ELECTROMECANICO")) else 1.0

    # 5. Elementos lineales discretos pedidos en und/pza (ej. dintel de 1.5m en und)
    if target_unit in ("und", "pza", "u") and is_linear_element(desc_for_typology):
        length_m = workspec.dimensions.length_m or extract_linear_length_m(desc_for_typology)
        linear_bench = EMPERICAL_HH_BENCHMARKS.get(f"{typology}_m")
        if length_m and linear_bench and "median" in linear_bench:
            p50_hh = linear_bench["median"] * length_m * difficulty_factor
            calc_perf = round(total_hh_daily / p50_hh, 2)
            notes.append(
                f"Rendimiento determinista derivado linealmente: {calc_perf:.2f} {target_unit}/día "
                f"({total_hh_daily:.1f} HH/día / {p50_hh:.3f} HH/und para L={length_m:.2f}m)."
            )
            return max(0.5, calc_perf), notes

    # 6. Benchmark empírico directo por tipología y unidad
    bench_unit = _benchmark_unit(target_unit)
    benchmark_key = f"{typology}_{bench_unit}"
    benchmark = EMPERICAL_HH_BENCHMARKS.get(benchmark_key)

    # Si no coincide exactamente, buscar benchmark compatible con la misma unidad
    if not benchmark:
        for k, v in EMPERICAL_HH_BENCHMARKS.items():
            if k.endswith(f"_{bench_unit}") and k.startswith(typology):
                benchmark = v
                benchmark_key = k
                break

    if benchmark and "median" in benchmark:
        median_hh = benchmark["median"] * difficulty_factor
        calc_perf = round(total_hh_daily / median_hh, 2)
        notes.append(
            f"Rendimiento determinista COVENIN P50: {calc_perf:.2f} {target_unit}/día "
            f"({total_hh_daily:.1f} HH/día cuadrilla / {median_hh:.4f} HH/{target_unit} de {benchmark_key})."
        )
        return max(0.2, calc_perf), notes

    # 7. Tabulador estándar empírico por unidad de medida si no hay benchmark directo
    default_performances: Dict[str, float] = {
        "m2": 25.0,
        "m": 30.0,
        "pza": 16.0,
        "und": 12.0,
        "m3": 8.0,
        "kgf": 500.0,
        "kg": 500.0,
        "ton": 5.0,
        "pto": 4.0,
        "viaje": 6.0,
    }
    fallback_perf = default_performances.get(bench_unit, 10.0)
    if is_maintenance:
        fallback_perf = round(fallback_perf * 0.70, 2)

    notes.append(
        f"Rendimiento determinista asignado por tabulador normativo: {fallback_perf:.2f} {target_unit}/día "
        f"para tipología '{typology}' en '{target_unit}'."
    )
    return fallback_perf, notes


def compose_apu_from_workspec(
    workspec: WorkSpec,
    base_apu: Optional[Dict[str, Any]],
    user_description: str,
    db: Session
) -> Tuple[Dict[str, Any], float]:
    """
    Fase 2: Compositor determinista.
    Ensambla el APU completo aplicando recetas, dimensiones y reconciliación contra BD.
    Retorna (apu_dict, latency_ms).
    """
    if not isinstance(workspec, WorkSpec):
        raise ValueError("workspec debe ser una instancia válida de WorkSpec")
    if not isinstance(user_description, str):
        raise ValueError("user_description debe ser una cadena de texto")

    t0 = time.time()

    # Si se requirió aclaratoria en Fase 1, devolverla inmediatamente
    if workspec.clarification_needed:
        clarification_resp: Dict[str, Any] = {
            "status": "clarification_needed",
            "clarification_message": workspec.clarification_reason or "Se requiere aclaratoria técnica para continuar.",
            "options": workspec.clarification_options or [],
            "questions": [workspec.clarification_reason] if workspec.clarification_reason else [],
            "generation_engine": "v2_workspec",
            "workspec": workspec.model_dump()
        }
        return clarification_resp, (time.time() - t0) * 1000.0

    # 1. Inicialización de la receta base
    if base_apu and isinstance(base_apu, dict):
        result = copy.deepcopy(base_apu)
    else:
        # Plantilla canónica si no hay base histórica disponible
        result = {
            "partida": {
                "codigo": "U-GEN-001",
                "description": f"{workspec.activity_type.capitalize()} de {workspec.element or 'elemento constructivo'}",
                "unit": workspec.target_unit,
                "performance": 1.0
            },
            "materials": [],
            "equipments": [
                {
                    "codigo": "EQ-HERR-01",
                    "descripcion": "HERRAMIENTAS MENORES (% MO)",
                    "cantidad": 1.0,
                    "precio_unitario": 5.0,
                    "depreciacion": 1.0
                }
            ],
            "labors": [
                {
                    "codigo": "MO-ALB-01",
                    "descripcion": "ALBAÑIL DE PRIMERA",
                    "cantidad": 1.0,
                    "jornal": 15.0,
                    "bono": 0.0
                },
                {
                    "codigo": "MO-OBR-01",
                    "descripcion": "OBRERO",
                    "cantidad": 1.0,
                    "jornal": 10.0,
                    "bono": 0.0
                }
            ]
        }

    _ensure_normalized_apu_structure(result)
    result["workspec"] = workspec.model_dump()
    if workspec.dimensions.length_m:
        result["partida"]["longitud_m"] = workspec.dimensions.length_m

    # 2. Asignación de unidad y descripción
    target_unit = _normalize_unit(workspec.target_unit)
    result["partida"]["unit"] = target_unit
    if workspec.element and not base_apu:
        result["partida"]["description"] = f"{workspec.activity_type.capitalize()} de {workspec.element}"

    # Cálculo determinista del rendimiento diario canónico COVENIN (Horas-Hombre y benchmarks)
    calc_perf, perf_notes = calculate_v2_deterministic_performance(
        workspec=workspec,
        labors=result.get("labors", []),
        user_description=user_description,
        base_apu=base_apu
    )
    result["partida"]["performance"] = calc_perf
    result["partida"]["rendimiento"] = calc_perf
    for p_note in perf_notes:
        if p_note not in result["notas_adaptacion"]:
            result["notas_adaptacion"].append(p_note)

    # 3. Aplicación de salvaguardas de dominio de ingeniería
    _enforce_scope_exclusions(result, user_description)
    _enforce_rapel_and_height_equipment(result, user_description)
    _enforce_floor_ground_equipment(result, user_description)
    _enforce_primary_materials_mutual_exclusion(result, user_description)
    enforce_discordant_inputs_purging(result, user_description, base_apu or {})
    _sanitize_partida_description(result, user_description)

    # Pozo profundo: pasar profundidad del WorkSpec
    depth_val = workspec.dimensions.depth_m
    _enforce_deep_well_dimensions(result, user_description, depth_val)

    # Coherencia de mezclas y requerimientos estructurales
    align_description_with_requested_mix(result, user_description)
    enforce_reinforcement_for_structural_elements(result, user_description)
    enforce_fine_mix_plausibility(result, user_description)
    enforce_frp_structural_safeguards(result, user_description)

    # 4. Calibración y Reconciliación contra Catálogo PostgreSQL
    _normalize_equipment_prices(result, base_apu or {}, [])
    calibrate_apu_crew_and_equipment(result, base_apu or {})
    _enforce_base_apu_material_heritage(result, base_apu or {}, [])

    reconcile_equipment_with_database(result, db)
    reconcile_materials_with_database(result, db)
    reconcile_labor_with_database(result, db)

    # Poda final tras reconciliaciones
    enforce_discordant_inputs_purging(result, user_description, base_apu or {})
    _enforce_deep_well_dimensions(result, user_description, depth_val)

    # 5. Cálculo exacto de subtotales y costos
    _calculate_apu_subtotals(result)

    result["status"] = "completed"
    result["generation_engine"] = "v2_workspec"
    result["workspec"] = workspec.model_dump()

    latency_ms = (time.time() - t0) * 1000.0
    logger.info("Fase 2 (Compositor determinista) completada en %.1fms", latency_ms)
    return result, latency_ms
