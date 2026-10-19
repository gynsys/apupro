"""
AI APU Service v2.0 - Unified Orchestration Entry Point
Executes Two-Phase Generation (Phase 1: Interpretation -> WorkSpec, Phase 2: Deterministic Composition).
"""

import time
from typing import Any, Dict, Optional
from sqlalchemy.orm import Session

from app.core.logging import logger
from app.services.ai_apu_service_v2.composer import compose_apu_from_workspec
from app.services.ai_apu_service_v2.interpreter import interpret_user_prompt_to_workspec
from app.services.ai_apu_service_v2.schemas import WorkSpec


def generate_apu_v2(
    user_description: str,
    requested_unit: Optional[str] = None,
    covenin_prefix: Optional[str] = None,
    context: Optional[str] = None,
    base_apu: Optional[Dict[str, Any]] = None,
    db: Optional[Session] = None
) -> Dict[str, Any]:
    """
    Punto de entrada principal para el Motor v2.0 (WorkSpec + Compositor Determinista).
    """
    if not user_description or not isinstance(user_description, str):
        raise ValueError("user_description es obligatorio y debe ser una cadena no vacía")
    if db is None:
        raise ValueError("db Session es obligatoria para la reconciliación del catálogo")

    t_start = time.time()
    logger.info("[V2 Engine] Iniciando generación v2.0 para: %.80s", user_description)

    # FASE 1: Interpretación semántica ligera (LLM -> WorkSpec)
    workspec, p1_latency_ms = interpret_user_prompt_to_workspec(
        user_description=user_description,
        requested_unit=requested_unit,
        context=context
    )

    # Si se requiere aclaratoria, devolver de inmediato sin ejecutar Fase 2
    if workspec.clarification_needed:
        logger.info("[V2 Engine] Aclaratoria requerida tras %.1fms. Retornando al usuario.", p1_latency_ms)
        return {
            "status": "clarification_needed",
            "clarification_message": workspec.clarification_reason or "Se requiere aclaratoria técnica.",
            "options": workspec.clarification_options or [],
            "questions": [workspec.clarification_reason] if workspec.clarification_reason else [],
            "generation_engine": "v2_workspec",
            "workspec": workspec.model_dump(),
            "telemetria_v2": {
                "phase1_llm_ms": round(p1_latency_ms, 1),
                "phase2_composer_ms": 0.0,
                "total_ms": round((time.time() - t_start) * 1000.0, 1),
                "engine": "v2_workspec"
            }
        }

    # FASE 2: Composición determinista (WorkSpec + Catálogo + Reglas -> APU)
    result, p2_latency_ms = compose_apu_from_workspec(
        workspec=workspec,
        base_apu=base_apu,
        user_description=user_description,
        db=db
    )

    total_latency_ms = (time.time() - t_start) * 1000.0
    result["telemetria_v2"] = {
        "phase1_llm_ms": round(p1_latency_ms, 1),
        "phase2_composer_ms": round(p2_latency_ms, 1),
        "total_ms": round(total_latency_ms, 1),
        "engine": "v2_workspec"
    }

    logger.info(
        "[V2 Engine] APU generado con éxito en %.1fms (Fase 1: %.1fms | Fase 2: %.1fms) | Costo Directo: $%.2f",
        total_latency_ms, p1_latency_ms, p2_latency_ms, result.get("costo_directo", 0.0)
    )
    return result
