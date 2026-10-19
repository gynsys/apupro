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
from app.services.apu_labor_calibrator import calibrate_apu_crew_and_equipment


def _ensure_normalized_apu_structure(apu: Dict[str, Any]) -> Dict[str, Any]:
    """Garantiza claves canónicas (partida, materials, equipments, labors, advertencias)."""
    if not isinstance(apu, dict):
        apu = {}

    partida = apu.get("partida")
    if not isinstance(partida, dict):
        partida = {
            "codigo": apu.get("codigo") or apu.get("covpar") or "U-GEN-001",
            "description": apu.get("description") or apu.get("descripcion") or "Partida de Construcción",
            "unit": apu.get("unit") or apu.get("unidad") or "und",
            "performance": float(apu.get("performance") or apu.get("rendimiento") or 1.0)
        }
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
    result["partida"]["unit"] = _normalize_unit(workspec.target_unit)
    if workspec.element and not base_apu:
        result["partida"]["description"] = f"{workspec.activity_type.capitalize()} de {workspec.element}"

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
