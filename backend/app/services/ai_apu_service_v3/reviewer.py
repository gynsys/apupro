"""
Revisor y Auto-Corrector de APUs en Lazo Cerrado (Motor v3.0).
Toma el diagnóstico físico y económico del APU generado, aplica correcciones
deterministas precisas o una revisión restringida de 1 sola ronda con el LLM,
y decide mediante código matemático si acepta o descarta la corrección.
"""

import copy
import time
from typing import Any, Dict, List, Optional, Tuple

from app.core.logging import logger
from app.services.ai_apu_service_v3.apu_diagnostics import (
    APUDiagnosticsResult,
    compute_apu_diagnostics,
)
from app.services.ai_apu_service_v3.delta_applier import _calculate_apu_subtotals
from app.services.ai_apu_service_v3.schemas import V3ReviewPatch
from app.services.llm_router import call_llm_json


def apply_deterministic_remediation(
    apu: Dict[str, Any],
    diagnostics: APUDiagnosticsResult,
    user_description: str = "",
) -> Tuple[Dict[str, Any], List[str]]:
    """
    Aplica correcciones deterministas directas sobre el APU para alertas matemáticas conocidas:
    1. Corrige factor de depreciación de camiones/equipos mayores (0.01 -> 1.0).
    2. Purga insumos discordantes (herramientas de excavación/postes en tareas de oficina).
    3. Dimensiona cuadrillas en tareas livianas (máximo 2 obreros).
    4. Escala rendimientos en unidades compuestas (M3-M y M3-KM).
    """
    remediated = copy.deepcopy(apu)
    actions_taken: List[str] = []

    partida = remediated.get("partida") or {}
    unit = str(partida.get("unit") or partida.get("unidad") or "und").strip().upper()
    perf = float(partida.get("performance") or partida.get("rendimiento") or 1.0)

    # 1. Corregir depreciación de equipos mayores
    for eq in remediated.get("equipments", []):
        desc = str(eq.get("descripcion") or "").upper()
        dep = float(eq.get("depreciacion") if eq.get("depreciacion") is not None else 1.0)
        pu = float(eq.get("precio_unitario") or 0.0)

        # Si es un camión de volteo o maquinaria y tiene dep <= 0.05 con PU >= 50
        if any(kw in desc for kw in ("CAMION", "CAMIÓN", "VOLTEO", "BOBCAT", "RETROEXCAVADORA")) and dep < 0.5:
            eq["depreciacion"] = 1.0
            actions_taken.append(f"Factor de depreciación de '{desc}' ajustado de {dep:g} a 1.0 (tarifa diaria de alquiler)")

    # 2. Purgar herramientas discordantes de oficinas/mobiliario
    desc_upper = (user_description or partida.get("description") or "").upper()
    is_office_task = any(kw in desc_upper for kw in ("MOBILIARIO", "MUEBLE", "ENSER", "OFICINA", "DESALOJO"))
    if is_office_task:
        filtered_eqs = []
        for eq in remediated.get("equipments", []):
            edesc = str(eq.get("descripcion") or "").upper()
            if any(dt in edesc for dt in ("EXCAVACION", "EXCAVACIÓN", "POSTES", "PERFORACION", "PERFORACIÓN")):
                actions_taken.append(f"Equipo discordante '{edesc}' eliminado de partida de mobiliario/oficina")
            else:
                filtered_eqs.append(eq)
        remediated["equipments"] = filtered_eqs

        # 3. Escalar cuadrilla excesiva en tareas livianas
        total_workers = sum(float(l.get("cantidad") or 0.0) for l in remediated.get("labors", []))
        if total_workers > 3.0:
            for l in remediated.get("labors", []):
                ldesc = str(l.get("descripcion") or "").upper()
                cant = float(l.get("cantidad") or 0.0)
                if "OBRERO" in ldesc or "AYUDANTE" in ldesc:
                    if cant > 2.0:
                        l["cantidad"] = 2.0
                        actions_taken.append(f"Cuadrilla de '{ldesc}' reducida de {cant:g} a 2.0 obreros para labor liviana")
                elif "CAPORAL" in ldesc or "MAESTRO" in ldesc:
                    if cant > 0.15:
                        l["cantidad"] = 0.10

    # 4. Ajustar rendimientos en unidades compuestas si quedaron en escala de M3 de tierra
    if unit in ("M3-M", "M3M", "M3/M") and perf < 80.0:
        new_perf = 150.0
        partida["performance"] = new_perf
        partida["rendimiento"] = new_perf
        actions_taken.append(f"Rendimiento en unidad M3-M escalado de {perf:g} a {new_perf:g} M3-M/día (escala volumen x distancia)")
    elif unit in ("M3-KM", "M3KM", "M3/KM") and perf < 200.0:
        new_perf = 400.0
        partida["performance"] = new_perf
        partida["rendimiento"] = new_perf
        actions_taken.append(f"Rendimiento en unidad M3-KM escalado de {perf:g} a {new_perf:g} M3-KM/día (flete vehicular continuo)")

    # Recalcular subtotales si hubo cambios
    if actions_taken:
        _calculate_apu_subtotals(remediated)

    return remediated, actions_taken


def review_and_correct_apu_closed_loop(
    apu: Dict[str, Any],
    user_description: str,
    quantity: Optional[float] = None,
    allow_llm_revision: bool = True,
) -> Tuple[Dict[str, Any], APUDiagnosticsResult, List[str]]:
    """
    Punto de entrada del ciclo de revisión en Lazo Cerrado:
    1. Diagnostica métricas físicas y económicas.
    2. Si no hay alertas críticas, retorna el APU intacto.
    3. Si hay alertas, aplica remediación determinista.
    4. Si aún persisten alertas y allow_llm_revision es True, ejecuta UNA sola revisión IA restringida.
    5. Python re-evalúa y acepta la versión solo si las alertas críticas desaparecen.
    """
    initial_diag = compute_apu_diagnostics(apu, quantity=quantity, user_description=user_description)
    if not initial_diag.has_critical_alerts:
        return apu, initial_diag, []

    audit_log: List[str] = []
    logger.info(
        "[Lazo Cerrado] Alertas críticas detectadas en APU para '%s': %s",
        user_description[:50],
        initial_diag.alert_summary_lines,
    )

    # Paso 1: Remediación determinista
    remediated_apu, det_actions = apply_deterministic_remediation(apu, initial_diag, user_description)
    audit_log.extend(det_actions)
    second_diag = compute_apu_diagnostics(remediated_apu, quantity=quantity, user_description=user_description)

    # Si la remediación determinista eliminó todas las alertas críticas, retornar
    if not second_diag.has_critical_alerts:
        # Agregar notas al APU
        notas = remediated_apu.setdefault("notas_adaptacion", [])
        for act in det_actions:
            notas.append(f"[Lazo Cerrado] {act}")
        return remediated_apu, second_diag, audit_log

    # Paso 2: Si aún persisten alertas y se permite LLM, ejecutar 1 sola ronda de ajuste restringido
    if allow_llm_revision:
        try:
            revised_apu, llm_actions = _execute_restricted_llm_review(
                remediated_apu,
                second_diag,
                user_description,
                quantity=quantity,
            )
            third_diag = compute_apu_diagnostics(revised_apu, quantity=quantity, user_description=user_description)
            if len(third_diag.alerts) <= len(second_diag.alerts):
                audit_log.extend(llm_actions)
                notas = revised_apu.setdefault("notas_adaptacion", [])
                for act in llm_actions:
                    notas.append(f"[Revisión IA Lazo Cerrado] {act}")
                return revised_apu, third_diag, audit_log
        except Exception as exc_rev:
            logger.warning("[Lazo Cerrado] Error en revisión restringida LLM: %s. Conservando remediación determinista.", exc_rev)

    # Si la revisión LLM no mejoró o falló, se entrega la remediación determinista
    return remediated_apu, second_diag, audit_log


def _execute_restricted_llm_review(
    apu: Dict[str, Any],
    diagnostics: APUDiagnosticsResult,
    user_description: str,
    quantity: Optional[float] = None,
) -> Tuple[Dict[str, Any], List[str]]:
    """
    Ejecuta UNA sola consulta restringida al LLM pasándole las alertas físicas y económicas.
    Solo puede ajustar rendimiento y cantidades existentes mediante V3ReviewPatch.
    """
    partida = apu.get("partida") or {}
    unit = str(partida.get("unit") or partida.get("unidad") or "und").strip().upper()
    perf = float(partida.get("performance") or partida.get("rendimiento") or 1.0)

    crew_summary = "; ".join(f"{l.get('codigo')}: {l.get('descripcion')} (cant={l.get('cantidad')})" for l in apu.get("labors", []))
    eq_summary = "; ".join(f"{e.get('codigo')}: {e.get('descripcion')} (cant={e.get('cantidad')}, dep={e.get('depreciacion')})" for e in apu.get("equipments", []))

    prompt = (
        f"AUDITORÍA FÍSICA Y ECONÓMICA DE APU GENERADO:\n"
        f"Partida solicitada: \"{user_description}\"\n"
        f"Unidad: {unit} | Rendimiento actual: {perf:g}/día\n"
        f"Cuadrilla actual: {crew_summary}\n"
        f"Equipos actuales: {eq_summary}\n\n"
        f"ALERTAS MATEMÁTICAS Y FÍSICAS DETECTADAS:\n"
        + "\n".join(f"- {line}" for line in diagnostics.alert_summary_lines) + "\n\n"
        f"MÉTRICAS RESULTANTES:\n"
        f"- Esfuerzo físico actual: {diagnostics.hh_per_unit:.2f} Horas-Hombre por cada {unit}\n"
        f"- Costo diario de cuadrilla: ${diagnostics.labor_cost_day:.2f}/día\n"
        f"- Costo unitario actual: ${diagnostics.costo_directo:.2f}/{unit}\n"
        + (f"- Días de ejecución estimados para {quantity:g} {unit}: {diagnostics.implicit_execution_days:.1f} días\n" if diagnostics.implicit_execution_days else "")
        + "\nINSTRUCCIONES DE CORRECCIÓN RESTINGIDA:\n"
        "1. Corrige el rendimiento (`new_performance`) para que las Horas-Hombre y los Días de Ejecución sean físicamente coherentes.\n"
        "2. Si la cuadrilla está sobredimensionada, ajusta cantidades en `crew_qty_adjustments`.\n"
        "3. Si un equipo mayor tiene depreciación errónea (ej. 0.01), corrígelo a 1.0 en `equipment_adjustments`.\n"
        "4. Si hay equipos o cargos ajenos, especifica sus códigos en `equipment_removals` o `labor_removals`.\n"
        "PROHIBIDO: No inventes nuevos insumos ni cambies la unidad. Responde ÚNICAMENTE en JSON con el esquema de V3ReviewPatch.\n"
    )

    review_res = call_llm_json(
        prompt=prompt,
        use_case="cost360",
        system_prompt="Eres un Auditor de Costos e Ingeniería Civil experto. Corrige estrictamente las alertas físicas numéricas dadas sin inventar nada nuevo."
    )

    patch = V3ReviewPatch.model_validate(review_res)
    revised = copy.deepcopy(apu)
    actions: List[str] = []

    # Aplicar new_performance si es válido
    if patch.new_performance and patch.new_performance > 0:
        rev_perf = round(float(patch.new_performance), 2)
        revised["partida"]["performance"] = rev_perf
        revised["partida"]["rendimiento"] = rev_perf
        actions.append(f"Rendimiento corregido a {rev_perf:g} {unit}/día ({patch.performance_reason or 'revisión física'})")

    # Aplicar crew_qty_adjustments
    for ca in patch.crew_qty_adjustments:
        target_code = str(ca.get("codigo") or "").strip().upper()
        new_q = float(ca.get("new_quantity") or 0.0)
        if target_code and new_q > 0:
            for l in revised.get("labors", []):
                if str(l.get("codigo") or "").strip().upper() == target_code or target_code in str(l.get("descripcion") or "").upper():
                    old_q = float(l.get("cantidad") or 0.0)
                    l["cantidad"] = new_q
                    actions.append(f"Mano de obra {l.get('descripcion')}: cantidad ajustada de {old_q:g} a {new_q:g}")

    # Aplicar equipment_adjustments
    for ea in patch.equipment_adjustments:
        target_code = str(ea.get("codigo") or "").strip().upper()
        if target_code:
            for e in revised.get("equipments", []):
                if str(e.get("codigo") or "").strip().upper() == target_code or target_code in str(e.get("descripcion") or "").upper():
                    if ea.get("new_quantity") is not None and float(ea.get("new_quantity")) > 0:
                        e["cantidad"] = float(ea.get("new_quantity"))
                    if ea.get("depreciation_factor") is not None and float(ea.get("depreciation_factor")) > 0:
                        e["depreciacion"] = float(ea.get("depreciation_factor"))
                        actions.append(f"Equipo {e.get('descripcion')}: depreciación fijada en {e['depreciacion']}")

    # Removals
    if patch.equipment_removals:
        rem_set = {str(c).strip().upper() for c in patch.equipment_removals}
        filtered_eq = [e for e in revised.get("equipments", []) if str(e.get("codigo") or "").strip().upper() not in rem_set]
        revised["equipments"] = filtered_eq
        actions.append(f"Equipos removidos por auditoría: {patch.equipment_removals}")

    if patch.labor_removals:
        rem_set = {str(c).strip().upper() for c in patch.labor_removals}
        filtered_lab = [l for l in revised.get("labors", []) if str(l.get("codigo") or "").strip().upper() not in rem_set]
        revised["labors"] = filtered_lab
        actions.append(f"Mano de obra removida por auditoría: {patch.labor_removals}")

    _calculate_apu_subtotals(revised)
    return revised, actions
