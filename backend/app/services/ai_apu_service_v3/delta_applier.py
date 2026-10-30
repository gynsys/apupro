"""
Stage 3 of AI APU Service v3.0:
Deterministic Delta Applier + Official Database Reconciler.
Clones the selected official COVENIN base APU intact and applies ONLY the surgical Delta operations.
"""

import copy
import time
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy.orm import Session

from app.core.logging import logger
from app.services.ai_apu_service.domain_rules.deep_well import _enforce_deep_well_dimensions
from app.services.ai_apu_service.domain_rules.discordant_pruning import enforce_discordant_inputs_purging
from app.services.ai_apu_service.domain_rules.sanitize_partida import infer_covenin_prefix
from app.services.ai_apu_service.domain_rules.scope_exclusions import _enforce_scope_exclusions
from app.services.ai_apu_service.domain_rules.structural_requirements import (
    enforce_fine_mix_plausibility,
    enforce_frp_structural_safeguards,
    enforce_reinforcement_for_structural_elements,
)
from app.services.ai_apu_service.reconciliation.equipment import (
    _normalize_equipment_prices,
    reconcile_equipment_with_database,
)
from app.services.ai_apu_service.reconciliation.labor import reconcile_labor_with_database
from app.services.ai_apu_service.reconciliation.materials import (
    _enforce_base_apu_material_heritage,
    reconcile_materials_with_database,
)
from app.services.ai_apu_service.reconciliation.specs_matcher import _normalize_unit
from app.services.ai_apu_service_v3.schemas import (
    V3AdaptationPlan,
    V3EquipmentDeltaOp,
    V3LaborDeltaOp,
    V3MaterialDeltaOp,
)
from app.services.apu_labor_calibrator import calibrate_apu_crew_and_equipment


def _calculate_apu_subtotals(apu: Dict[str, Any]) -> None:
    """Calcula matemáticamente subtotales y costo unitario directo del APU."""
    rend = float(apu.get("partida", {}).get("performance") or 1.0)
    if rend <= 0:
        rend = 1.0

    tot_mat = 0.0
    for m in apu.get("materials", []):
        cant = float(m.get("cantidad") or 0.0)
        pu = float(m.get("precio_unitario") or 0.0)
        desp = float(m.get("desperdicio") or 0.0)
        factor_desp = 1.0 + (desp / 100.0) if desp > 0 else 1.0
        tot = cant * pu * factor_desp
        m["total"] = round(tot, 4)
        tot_mat += tot

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


def _find_target_index(items: List[Dict[str, Any]], target_code: Optional[str]) -> int:
    """
    Busca el índice de un insumo en la lista por código exacto primero,
    y como respaldo por coincidencia parcial de código o descripción.
    Retorna -1 si no se encuentra.
    """
    if not target_code or not isinstance(target_code, str) or not items:
        return -1

    needle = target_code.strip().upper().strip("[]")
    if not needle:
        return -1

    # 1. Coincidencia exacta por código
    for idx, it in enumerate(items):
        cod = str(it.get("codigo") or "").strip().upper()
        if cod and cod == needle:
            return idx

    # 2. Coincidencia exacta por descripción
    for idx, it in enumerate(items):
        desc = str(it.get("descripcion") or "").strip().upper()
        if desc and desc == needle:
            return idx

    # 3. Coincidencia de subcadena en código o descripción
    for idx, it in enumerate(items):
        cod = str(it.get("codigo") or "").strip().upper()
        desc = str(it.get("descripcion") or "").strip().upper()
        if (cod and needle in cod) or (desc and needle in desc) or (desc and desc in needle):
            return idx

    return -1


def _apply_material_deltas(
    materials: List[Dict[str, Any]],
    ops: List[V3MaterialDeltaOp],
    applied_log: List[str]
) -> List[Dict[str, Any]]:
    """Aplica las operaciones Delta sobre la lista de materiales del APU base."""
    result_mats = copy.deepcopy(materials)
    ia_counter = 1

    for op_item in ops:
        action = op_item.op
        idx = _find_target_index(result_mats, op_item.target_code)

        if action == "remove" or (action in ("replace", "modify_qty") and op_item.new_quantity is not None and float(op_item.new_quantity) <= 0.0):
            if idx >= 0:
                removed = result_mats.pop(idx)
                applied_log.append(
                    f"[Material Eliminado] {removed.get('codigo')} - {removed.get('descripcion')} ({op_item.reason})"
                )
        elif action == "modify_qty":
            if idx >= 0 and op_item.new_quantity is not None and op_item.new_quantity > 0:
                target = result_mats[idx]
                old_qty = float(target.get("cantidad") or 0.0)
                target["cantidad"] = round(float(op_item.new_quantity), 4)
                if op_item.new_waste_pct is not None and op_item.new_waste_pct >= 0:
                    target["desperdicio"] = round(float(op_item.new_waste_pct), 2)
                target["nota_calculo"] = op_item.reason
                applied_log.append(
                    f"[Material Cantidad Ajustada] {target.get('codigo')} - {target.get('descripcion')}: "
                    f"{old_qty:g} -> {target['cantidad']:g} {target.get('unidad', '')} ({op_item.reason})"
                )
        elif action == "replace":
            new_desc = (op_item.new_description or "").strip().upper()
            if not new_desc:
                continue
            old_ref = result_mats[idx] if idx >= 0 else {}
            new_unit = _normalize_unit(op_item.new_unit or str(old_ref.get("unidad") or "und"))
            new_qty = float(op_item.new_quantity) if (op_item.new_quantity is not None and op_item.new_quantity > 0) else float(old_ref.get("cantidad") or 1.0)
            new_waste = float(op_item.new_waste_pct) if (op_item.new_waste_pct is not None and op_item.new_waste_pct >= 0) else float(old_ref.get("desperdicio") or 0.0)
            est_price = float(op_item.estimated_price_usd) if (op_item.estimated_price_usd is not None and op_item.estimated_price_usd > 0) else float(old_ref.get("precio_unitario") or 1.0)

            replacement_mat: Dict[str, Any] = {
                "codigo": f"MAT-IA-{ia_counter:03d}",
                "descripcion": new_desc,
                "unidad": new_unit,
                "cantidad": round(new_qty, 4),
                "desperdicio": round(new_waste, 2),
                "precio_unitario": round(est_price, 4),
                "origen": "ia",
                "nota_calculo": op_item.reason
            }
            ia_counter += 1
            if idx >= 0:
                old_desc = f"{old_ref.get('codigo')} ({old_ref.get('descripcion')})"
                result_mats[idx] = replacement_mat
                applied_log.append(
                    f"[Material Reemplazado] {old_desc} -> {new_desc} ({new_qty:g} {new_unit}) ({op_item.reason})"
                )
            else:
                result_mats.append(replacement_mat)
                applied_log.append(
                    f"[Material Incorporado por Reemplazo] {new_desc} ({new_qty:g} {new_unit}) ({op_item.reason})"
                )
        elif action == "add":
            new_desc = (op_item.new_description or "").strip().upper()
            if not new_desc:
                continue
            new_unit = _normalize_unit(op_item.new_unit or "und")
            new_qty = float(op_item.new_quantity) if (op_item.new_quantity is not None and op_item.new_quantity > 0) else 1.0
            new_waste = float(op_item.new_waste_pct) if (op_item.new_waste_pct is not None and op_item.new_waste_pct >= 0) else 0.0
            est_price = float(op_item.estimated_price_usd) if (op_item.estimated_price_usd is not None and op_item.estimated_price_usd > 0) else 1.0

            added_mat: Dict[str, Any] = {
                "codigo": f"MAT-IA-{ia_counter:03d}",
                "descripcion": new_desc,
                "unidad": new_unit,
                "cantidad": round(new_qty, 4),
                "desperdicio": round(new_waste, 2),
                "precio_unitario": round(est_price, 4),
                "origen": "ia",
                "nota_calculo": op_item.reason
            }
            ia_counter += 1
            result_mats.append(added_mat)
            applied_log.append(
                f"[Material Agregado] {new_desc} ({new_qty:g} {new_unit}) ({op_item.reason})"
            )

    return result_mats


def _apply_equipment_deltas(
    equipments: List[Dict[str, Any]],
    ops: List[V3EquipmentDeltaOp],
    applied_log: List[str]
) -> List[Dict[str, Any]]:
    """Aplica las operaciones Delta sobre la lista de equipos del APU base."""
    result_eqs = copy.deepcopy(equipments)
    ia_counter = 1

    for op_item in ops:
        action = op_item.op
        idx = _find_target_index(result_eqs, op_item.target_code)

        if action == "remove":
            if idx >= 0:
                removed = result_eqs.pop(idx)
                applied_log.append(
                    f"[Equipo Eliminado] {removed.get('codigo')} - {removed.get('descripcion')} ({op_item.reason})"
                )
        elif action == "modify_qty":
            if idx >= 0 and op_item.new_quantity is not None and op_item.new_quantity > 0:
                target = result_eqs[idx]
                old_qty = float(target.get("cantidad") or 0.0)
                target["cantidad"] = round(float(op_item.new_quantity), 4)
                target["nota_calculo"] = op_item.reason
                applied_log.append(
                    f"[Equipo Cantidad Ajustada] {target.get('codigo')} - {target.get('descripcion')}: "
                    f"{old_qty:g} -> {target['cantidad']:g} ({op_item.reason})"
                )
        elif action in ("replace", "add"):
            new_desc = (op_item.new_description or "").strip().upper()
            if not new_desc:
                continue
            old_ref = result_eqs[idx] if (action == "replace" and idx >= 0) else {}
            new_qty = float(op_item.new_quantity) if (op_item.new_quantity is not None and op_item.new_quantity > 0) else float(old_ref.get("cantidad") or 1.0)
            est_price = float(op_item.estimated_price_usd) if (op_item.estimated_price_usd is not None and op_item.estimated_price_usd > 0) else float(old_ref.get("precio_unitario") or 100.0)
            
            # Determinación inteligente de factor de depreciación/alquiler:
            if op_item.depreciation_factor is not None and op_item.depreciation_factor > 0:
                dep_factor = float(op_item.depreciation_factor)
            elif old_ref.get("depreciacion") is not None and float(old_ref.get("depreciacion")) > 0:
                dep_factor = float(old_ref.get("depreciacion"))
            else:
                basis = getattr(op_item, "price_basis", "tarifa_diaria") or "tarifa_diaria"
                # Si es tarifa diaria o el precio parece tarifa (< 500 USD), el factor diario es 1.0
                if basis == "tarifa_diaria" or est_price <= 400.0:
                    dep_factor = 1.0
                else:
                    dep_factor = 0.01

            new_eq: Dict[str, Any] = {
                "codigo": f"EQ-IA-{ia_counter:03d}",
                "descripcion": new_desc,
                "unidad": "día",
                "cantidad": round(new_qty, 4),
                "depreciacion": round(dep_factor, 5),
                "precio_unitario": round(est_price, 2),
                "origen": "ia",
                "nota_calculo": op_item.reason
            }
            ia_counter += 1
            if action == "replace" and idx >= 0:
                old_desc = f"{old_ref.get('codigo')} ({old_ref.get('descripcion')})"
                result_eqs[idx] = new_eq
                applied_log.append(
                    f"[Equipo Reemplazado] {old_desc} -> {new_desc} (cant={new_qty:g}) ({op_item.reason})"
                )
            else:
                result_eqs.append(new_eq)
                applied_log.append(
                    f"[Equipo Agregado] {new_desc} (cant={new_qty:g}) ({op_item.reason})"
                )

    return result_eqs


def _apply_labor_deltas(
    labors: List[Dict[str, Any]],
    ops: List[V3LaborDeltaOp],
    applied_log: List[str]
) -> List[Dict[str, Any]]:
    """Aplica las operaciones Delta sobre la cuadrilla de mano de obra del APU base."""
    result_labs = copy.deepcopy(labors)
    ia_counter = 1

    for op_item in ops:
        action = op_item.op
        idx = _find_target_index(result_labs, op_item.target_code)

        if action == "remove":
            if idx >= 0:
                removed = result_labs.pop(idx)
                applied_log.append(
                    f"[Mano de Obra Eliminada] {removed.get('codigo')} - {removed.get('descripcion')} ({op_item.reason})"
                )
        elif action == "modify_qty":
            if idx >= 0 and op_item.new_quantity is not None and op_item.new_quantity > 0:
                target = result_labs[idx]
                old_qty = float(target.get("cantidad") or 0.0)
                target["cantidad"] = round(float(op_item.new_quantity), 4)
                target["nota_calculo"] = op_item.reason
                applied_log.append(
                    f"[Mano de Obra Cantidad Ajustada] {target.get('codigo')} - {target.get('descripcion')}: "
                    f"{old_qty:g} -> {target['cantidad']:g} ({op_item.reason})"
                )
        elif action in ("replace", "add"):
            new_desc = (op_item.new_description or "").strip().upper()
            if not new_desc:
                continue
            old_ref = result_labs[idx] if (action == "replace" and idx >= 0) else {}
            new_qty = float(op_item.new_quantity) if (op_item.new_quantity is not None and op_item.new_quantity > 0) else float(old_ref.get("cantidad") or 1.0)
            jornal = float(old_ref.get("jornal") or 15.0)
            bono = float(old_ref.get("bono") or 0.0)

            new_lab: Dict[str, Any] = {
                "codigo": f"MO-IA-{ia_counter:03d}",
                "descripcion": new_desc,
                "unidad": "día",
                "cantidad": round(new_qty, 4),
                "jornal": round(jornal, 2),
                "bono": round(bono, 2),
                "origen": "ia",
                "nota_calculo": op_item.reason
            }
            ia_counter += 1
            if action == "replace" and idx >= 0:
                old_desc = f"{old_ref.get('codigo')} ({old_ref.get('descripcion')})"
                result_labs[idx] = new_lab
                applied_log.append(
                    f"[Mano de Obra Reemplazada] {old_desc} -> {new_desc} (cant={new_qty:g}) ({op_item.reason})"
                )
            else:
                result_labs.append(new_lab)
                applied_log.append(
                    f"[Mano de Obra Agregada] {new_desc} (cant={new_qty:g}) ({op_item.reason})"
                )

    return result_labs


def apply_v3_deltas_to_base_apu(
    plan: V3AdaptationPlan,
    base_apu: Optional[Dict[str, Any]],
    user_description: str,
    db: Session,
    requested_unit: Optional[str] = None,
    execution_days: Optional[float] = None,
    covenin_prefix: Optional[str] = None,
    deep_well_depth: Optional[float] = None
) -> Tuple[Dict[str, Any], float]:
    """
    Toma el APU oficial seleccionado (`base_apu`), preserva intactos todos sus insumos
    originales y aplica únicamente las operaciones Delta definidas en `plan`,
    o construye la receta desde cero bajo reglas COVENIN cuando `base_apu` es vacío (`selected_codpar="NONE"`),
    reconciliando cualquier insumo contra PostgreSQL.
    """
    if not isinstance(plan, V3AdaptationPlan):
        raise ValueError("plan debe ser una instancia válida de V3AdaptationPlan")
    if base_apu is None or not isinstance(base_apu, dict):
        base_apu = {}
    if db is None:
        raise ValueError("db Session es obligatoria en apply_v3_deltas_to_base_apu")

    t0 = time.time()

    if plan.clarification_needed:
        return {
            "status": "clarification_needed",
            "clarification_message": plan.clarification_reason or "Se requiere aclaratoria técnica para ajustar la partida.",
            "options": plan.clarification_options or [],
            "questions": [plan.clarification_reason] if plan.clarification_reason else [],
            "generation_engine": "v3_delta",
            "v3_plan": plan.model_dump()
        }, (time.time() - t0) * 1000.0

    is_from_scratch = not bool(base_apu.get("codpar")) or str(plan.selected_codpar or "").strip().upper() in ("NONE", "NULL", "N/A", "SIN_BASE", "CERO", "")
    base_codpar = "NONE" if is_from_scratch else str(base_apu.get("codpar") or "")
    base_covenin = "S/C" if is_from_scratch else str(base_apu.get("covenin") or base_codpar)
    base_unit = _normalize_unit(str(base_apu.get("unidad") or plan.target_unit or "und"))
    base_perf = float(base_apu.get("rendimiento") or plan.new_performance or 10.0)
    if base_perf <= 0:
        base_perf = 1.0

    # 1. Preparar insumos originales marcados como 100% históricos (vacíos si es síntesis desde cero)
    orig_mats: List[Dict[str, Any]] = []
    if not is_from_scratch:
        for m in base_apu.get("materiales") or []:
            if isinstance(m, dict):
                m_copy = copy.deepcopy(m)
                m_copy["origen"] = "historico"
                orig_mats.append(m_copy)

    orig_eqs: List[Dict[str, Any]] = []
    if not is_from_scratch:
        for e in base_apu.get("equipos") or []:
            if isinstance(e, dict):
                e_copy = copy.deepcopy(e)
                e_copy["origen"] = "historico"
                e_copy.setdefault("unidad", "día")
                orig_eqs.append(e_copy)

    orig_labs: List[Dict[str, Any]] = []
    if not is_from_scratch:
        for l in base_apu.get("mano_obra") or []:
            if isinstance(l, dict):
                l_copy = copy.deepcopy(l)
                l_copy["origen"] = "historico"
                l_copy.setdefault("unidad", "día")
                orig_labs.append(l_copy)

    # 2. Aplicar únicamente los Deltas solicitados (o las operaciones 'add' en síntesis regulada)
    applied_deltas_log: List[str] = []
    final_mats = _apply_material_deltas(orig_mats, plan.material_ops, applied_deltas_log)
    final_eqs = _apply_equipment_deltas(orig_eqs, plan.equipment_ops, applied_deltas_log)
    final_labs = _apply_labor_deltas(orig_labs, plan.labor_ops, applied_deltas_log)

    # En modalidad de creación desde cero, garantizar que siempre exista HERRAMIENTAS MENORES
    if is_from_scratch:
        has_minor_tools = any(
            "HERRAMIENTAS" in str(eq.get("descripcion") or "").upper()
            for eq in final_eqs if isinstance(eq, dict)
        )
        if not has_minor_tools:
            final_eqs.append({
                "codigo": "EQ-IA-999",
                "descripcion": "HERRAMIENTAS MENORES",
                "unidad": "día",
                "cantidad": 1.0,
                "depreciacion": 1.0,
                "precio_unitario": 1.50,
                "origen": "ia",
                "nota_calculo": "Dotación obligatoria de herramientas menores según norma COVENIN"
            })
            applied_deltas_log.append("[Equipo Agregado] HERRAMIENTAS MENORES (Dotación normativa por defecto)")

    # 3. Determinar Unidad y Rendimiento
    final_unit = _normalize_unit(requested_unit or plan.target_unit or base_unit)
    final_perf = base_perf
    if is_from_scratch:
        final_perf = round(float(plan.new_performance or 10.0), 2)
        perf_note = (
            f"Rendimiento calculado bajo reglas COVENIN (creación sin partida base): {final_perf:g} {final_unit}/día "
            f"({plan.performance_reason or 'Derivado de Horas-Hombre de la cuadrilla'})."
        )
    else:
        perf_note = f"Rendimiento oficial COVENIN preservado de partida base {base_covenin}: {base_perf:g} {final_unit}/día."

    if final_unit in ("gl", "sg"):
        days = float(execution_days) if (execution_days and float(execution_days) > 0) else 1.0
        final_perf = round(1.0 / days, 4)
        perf_note = f"Rendimiento global calculado para {days:g} día(s) de ejecución: {final_perf:g} Gl/día."
    elif not is_from_scratch and not plan.keep_base_performance and plan.new_performance and float(plan.new_performance) > 0:
        final_perf = round(float(plan.new_performance), 2)
        perf_note = (
            f"Rendimiento ajustado de {base_perf:g} ({base_unit}) a {final_perf:g} ({final_unit}): "
            f"{plan.performance_reason or 'Cambio de unidad/escala'}."
        )

    # 4. Código SC001 derivado del prefijo COVENIN de la partida base o inferido por especialidad
    expected_prefix = (covenin_prefix or "").strip().replace(".", "").replace("-", "")
    if not expected_prefix or len(expected_prefix) < 3:
        expected_prefix = infer_covenin_prefix(user_description, "" if is_from_scratch else (base_covenin or base_codpar))
    sc_code = f"{expected_prefix.upper()}SC001" if expected_prefix else "U-GEN-SC001"

    if is_from_scratch:
        notas_adaptacion: List[str] = [
            "Modalidad Motor v3.0: Síntesis Regulada desde Cero (sin partida base afín en BD; insumos reconciliados contra catálogo oficial).",
            f"Criterio: {plan.selection_reason}",
            perf_note,
        ]
    else:
        notas_adaptacion = [
            f"Partida Base Seleccionada (Motor v3.0): {base_covenin} ({base_codpar}) - {base_apu.get('descripcion', '')}",
            f"Criterio de Selección: {plan.selection_reason}",
            perf_note,
        ]
    notas_adaptacion.extend(applied_deltas_log)
    for note in plan.technical_assumptions:
        if note and note not in notas_adaptacion:
            notas_adaptacion.append(note)

    result: Dict[str, Any] = {
        "status": "completed",
        "generation_engine": "v3_delta",
        "partida": {
            "codigo": sc_code,
            "cod_par": sc_code,
            "cov_par": sc_code,
            "description": (plan.adapted_description or user_description).strip().upper(),
            "unit": final_unit,
            "performance": final_perf,
            "rendimiento": final_perf,
        },
        "materials": final_mats,
        "equipments": final_eqs,
        "labors": final_labs,
        "notas_adaptacion": notas_adaptacion,
        "advertencias": [],
        "supuestos_tecnicos": plan.technical_assumptions,
        "v3_delta_plan": plan.model_dump(),
        "v3_applied_deltas": applied_deltas_log,
    }

    # 5. Salvaguardas deterministas esenciales (exclusiones explícitas, mortero fino, refuerzo en dinteles y pozos profundos)
    _enforce_scope_exclusions(result, user_description)
    enforce_discordant_inputs_purging(result, user_description, base_apu)
    enforce_reinforcement_for_structural_elements(result, user_description)
    enforce_fine_mix_plausibility(result, user_description)
    enforce_frp_structural_safeguards(result, user_description)
    if deep_well_depth:
        _enforce_deep_well_dimensions(result, user_description, deep_well_depth)

    # 6. Reconciliar insumos nuevos o reemplazados contra el catálogo PostgreSQL
    _normalize_equipment_prices(result, base_apu, [])
    _enforce_base_apu_material_heritage(result, base_apu, [])
    reconcile_materials_with_database(result, db)
    reconcile_equipment_with_database(result, db)
    reconcile_labor_with_database(result, db)

    # Solo calibrar cuadrilla/rendimiento si cambió la unidad respecto a la partida base
    # o si la cuadrilla sufrió alteraciones
    if final_unit != base_unit or not plan.keep_base_performance or len(plan.labor_ops) > 0:
        calibrate_apu_crew_and_equipment(result, base_apu)
    enforce_discordant_inputs_purging(result, user_description, base_apu)

    # 7. Calcular subtotales matemáticos exactos
    _calculate_apu_subtotals(result)

    apply_ms = (time.time() - t0) * 1000.0
    logger.info(
        "[V3 Applier] APU compuesto desde base %s con %d ajustes en %.1fms | Costo Directo: $%.2f",
        base_codpar,
        len(applied_deltas_log),
        apply_ms,
        result.get("costo_directo", 0.0)
    )
    return result, apply_ms
