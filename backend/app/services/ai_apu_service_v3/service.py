"""
AI APU Service v3.0 - Unified Orchestration Entry Point.
Executes Three-Stage Generation:
  Stage 1: Enriched Top-K Candidate Retrieval (with real Materials, Equipment, and Labor recipes).
  Stage 2: AI Best-Match Base Selection + Surgical Delta Planning.
  Stage 3: Deterministic Delta Patching on Intact Official Base APU + Database Reconciliation.
"""

import time
from typing import Any, Dict, Optional
from sqlalchemy.orm import Session

from app.core.logging import logger
from app.services.ai_apu_service_v3.delta_applier import apply_v3_deltas_to_base_apu
from app.services.ai_apu_service_v3.selector_planner import (
    fetch_enriched_candidates_for_v3,
    plan_v3_selection_and_deltas,
)


def generate_apu_v3(
    user_description: str,
    db: Session,
    requested_unit: Optional[str] = None,
    covenin_prefix: Optional[str] = None,
    context: Optional[str] = None,
    manual_base_code: Optional[str] = None,
    execution_days: Optional[float] = None,
    deep_well_depth: Optional[float] = None,
    use_embeddings: bool = False,
    quantity: Optional[float] = None,
) -> Dict[str, Any]:
    """
    Punto de entrada principal para el Motor v3.0 (Selección de Mejor Partida Base + Ajustes Delta).
    Por defecto usa use_embeddings=False (búsqueda léxica IDF + ponderación técnica sin API externa de embeddings).
    """
    if not user_description or not isinstance(user_description, str) or not user_description.strip():
        raise ValueError("user_description es obligatorio y debe ser una cadena no vacía")
    if db is None:
        raise ValueError("db Session es obligatoria para el Motor v3.0")

    t_start = time.time()
    logger.info("[V3 Engine] Iniciando generación v3.0 (use_embeddings=%s, qty=%s) para: %.80s", use_embeddings, quantity, user_description)

    # ETAPA 1: Recuperar las mejores candidatas reales con sus insumos completos
    enriched_candidates, all_candidates_trace, retrieval_ms = fetch_enriched_candidates_for_v3(
        db=db,
        user_description=user_description,
        covenin_prefix=covenin_prefix or "",
        manual_base_code=manual_base_code,
        top_k=6,
        use_embeddings=use_embeddings,
    )

    # ETAPA 2: La IA elige la mejor partida base entre las candidatas (o sintetiza desde cero
    # bajo reglas estrictas COVENIN si ninguna candidata coincide o la lista está vacía)
    plan, selected_base_apu, llm_ms, prompt_sent = plan_v3_selection_and_deltas(
        user_description=user_description,
        enriched_candidates=enriched_candidates,
        requested_unit=requested_unit,
        execution_days=execution_days,
        context=context,
        quantity=quantity,
    )

    if plan.clarification_needed:
        total_ms = (time.time() - t_start) * 1000.0
        return {
            "status": "clarification_needed",
            "clarification_message": plan.clarification_reason or "Se requiere información adicional para ajustar el APU.",
            "options": plan.clarification_options or [],
            "questions": [plan.clarification_reason] if plan.clarification_reason else [],
            "generation_engine": "v3_delta",
            "v3_delta_plan": plan.model_dump(),
            "telemetria_v3": {
                "candidate_retrieval_ms": round(retrieval_ms, 1),
                "llm_selection_delta_ms": round(llm_ms, 1),
                "delta_apply_reconcile_ms": 0.0,
                "total_ms": round(total_ms, 1),
                "engine": "v3_delta",
            },
        }

    # ETAPA 3: Aplicar quirúrgicamente los Deltas sobre la partida base oficial intacta y reconciliar con BD
    result, apply_ms = apply_v3_deltas_to_base_apu(
        plan=plan,
        base_apu=selected_base_apu,
        user_description=user_description,
        db=db,
        requested_unit=requested_unit,
        execution_days=execution_days,
        covenin_prefix=covenin_prefix,
        deep_well_depth=deep_well_depth,
    )

    # ETAPA 4: Lazo Cerrado de Diagnóstico y Auto-Corrección Físico-Económica
    from app.services.ai_apu_service_v3.reviewer import review_and_correct_apu_closed_loop
    result, diagnostics, closed_loop_audit = review_and_correct_apu_closed_loop(
        apu=result,
        user_description=user_description,
        quantity=quantity,
        allow_llm_revision=True,
    )

    total_ms = (time.time() - t_start) * 1000.0
    total_deltas = len(plan.material_ops) + len(plan.equipment_ops) + len(plan.labor_ops)

    # Telemetría y trazabilidad compatible con el visor de auditoría y debugStorage.js
    result["generation_engine"] = "v3_delta"
    result["closed_loop_diagnostics"] = {
        "hh_per_unit": diagnostics.hh_per_unit,
        "implicit_execution_days": diagnostics.implicit_execution_days,
        "equipment_cost_day": diagnostics.equipment_cost_day,
        "labor_cost_day": diagnostics.labor_cost_day,
        "alerts_count": len(diagnostics.alerts),
        "alerts": diagnostics.alert_summary_lines,
        "actions_taken": closed_loop_audit,
    }
    result["telemetria_v3"] = {
        "engine": "v3_delta",
        "candidate_retrieval_ms": round(retrieval_ms, 1),
        "llm_selection_delta_ms": round(llm_ms, 1),
        "delta_apply_reconcile_ms": round(apply_ms, 1),
        "total_ms": round(total_ms, 1),
        "selected_codpar": plan.selected_codpar,
        "candidates_inspected": len(enriched_candidates),
        "total_deltas_applied": len(result.get("v3_applied_deltas", [])),
        "closed_loop_corrections": len(closed_loop_audit),
    }
    result["debug_meta"] = result["telemetria_v3"]
    result["debug_base_selection"] = {
        "modo_seleccion": "v3_ai_recipe_selector",
        "partida_elegida_codpar": plan.selected_codpar,
        "partida_elegida_covenin": selected_base_apu.get("covenin") or plan.selected_codpar,
        "partida_elegida_descripcion": selected_base_apu.get("descripcion"),
        "motivo_eleccion_ia": plan.selection_reason,
        "candidatas_evaluadas_con_receta": [
            {
                "codpar": c["codpar"],
                "covenin": c["apu"].get("covenin"),
                "descripcion": c["apu"].get("descripcion"),
                "unidad": c["apu"].get("unidad"),
                "rendimiento": c["apu"].get("rendimiento"),
                "score_rag": round(c["score"], 4),
            }
            for c in enriched_candidates
        ],
        "operaciones_delta_planificadas": {
            "material_ops": [op.model_dump() for op in plan.material_ops],
            "equipment_ops": [op.model_dump() for op in plan.equipment_ops],
            "labor_ops": [op.model_dump() for op in plan.labor_ops],
        },
        "ajustes_ejecutados": result.get("v3_applied_deltas", []),
    }
    result["debug_rag_trace"] = all_candidates_trace
    result["debug_base_apu"] = selected_base_apu
    result["prompt_enviado_al_llm"] = prompt_sent

    logger.info(
        "[V3 Engine] APU generado en %.1fms (RAG: %.1fms | LLM: %.1fms | Apply: %.1fms) | Base: %s | Deltas: %d | CD: $%.2f",
        total_ms,
        retrieval_ms,
        llm_ms,
        apply_ms,
        plan.selected_codpar,
        total_deltas,
        result.get("costo_directo", 0.0),
    )
    return result
