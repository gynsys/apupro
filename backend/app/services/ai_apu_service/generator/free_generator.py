import json
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session
from app.services.llm_router import call_llm_json
from app.services.apu_labor_calibrator import calibrate_apu_crew_and_equipment
from app.services.ai_apu_service.helpers import _sanitize_llm_numbers
from app.services.ai_apu_service.prompts import _APU_SYSTEM_PROMPT
from app.services.ai_apu_service.domain_rules.scope_exclusions import _enforce_scope_exclusions
from app.services.ai_apu_service.domain_rules.safety_height import _enforce_rapel_and_height_equipment
from app.services.ai_apu_service.domain_rules.floor_ground import _enforce_floor_ground_equipment
from app.services.ai_apu_service.domain_rules.material_conflicts import _enforce_primary_materials_mutual_exclusion
from app.services.ai_apu_service.domain_rules.deep_well import _enforce_deep_well_dimensions
from app.services.ai_apu_service.domain_rules.sanitize_partida import _sanitize_partida_description
from app.services.ai_apu_service.reconciliation.equipment import (
    _normalize_equipment_prices,
    reconcile_equipment_with_database,
)
from app.services.ai_apu_service.reconciliation.materials import reconcile_materials_with_database
from app.services.ai_apu_service.reconciliation.labor import reconcile_labor_with_database


def generate_apu_with_ai(
    payload_llm: Dict[str, Any],
    history: Optional[List[Dict[str, Any]]] = None,
    db: Optional[Session] = None
) -> Dict[str, Any]:
    """
    Generación de APU usando el flujo clásico de preprocesamiento estadístico.
    Se usa cuando NO hay una partida base seleccionada por el usuario.
    """
    if payload_llm.get("modo") == "incongruencia_matematica":
        return {
            "status": "clarification_needed",
            "clarification_message": (
                "La descripción ingresada no tiene relación técnica reconocible con la categoría COVENIN seleccionada. "
                "Por favor, revisa la descripción técnica o ajusta la categoría."
            ),
            "options": [],
            "questions": [
                "1. ¿Qué actividad constructiva específica deseas presupuestar?",
                "2. ¿Cuál es el elemento principal a intervenir?",
                "3. ¿Qué materiales y especificaciones técnicas aplican?",
                "4. ¿En qué unidad de medida se computa la partida?"
            ],
            "guia_redaccion": "Estructura recomendada: [Acción] + [Elemento] + [Material/Especificación] + [Método o Ubicación].",
            "partida": None,
            "materials": [],
            "equipments": [],
            "labors": [],
            "advertencias": ["Incongruencia técnica detectada entre la descripción y el contexto COVENIN."]
        }

    history_text = ""
    if history:
        history_text = "\n# HISTORIAL DE CONVERSACIÓN\n"
        for msg in history:
            role = "USUARIO" if msg.get("role") == "user" else "SISTEMA/IA"
            history_text += f"{role}: {msg.get('content')}\n"

    prompt = f"""
# PAYLOAD DEL SISTEMA (datos históricos y catálogo)
{json.dumps(payload_llm, ensure_ascii=False)}
{history_text}

# REGLAS DE INTERPRETACIÓN
1. Si hay múltiples unidades en `rendimientos_historicos_por_unidad_partida`, elige la más lógica para la actividad.
2. Usa `cantidad_promedio` como base para cada insumo.
3. Insumos con presencia alta (> 70%) en las partidas históricas deben conservarse si aplican a la partida.
4. Ancla el rendimiento al promedio de las partidas históricas más similares.
"""
    result = call_llm_json(prompt, use_case="cost360", system_prompt=_APU_SYSTEM_PROMPT)
    _sanitize_llm_numbers(result)
    if "advertencias" not in result:
        result["advertencias"] = []

    result["debug_preprocesamiento"] = payload_llm

    if result.get("status") == "clarification_needed":
        result["options"] = []
        return result

    if payload_llm.get("advertencias_preprocesamiento"):
        result["advertencias"].extend(payload_llm["advertencias_preprocesamiento"])

    user_desc = (
        payload_llm.get("solicitud_usuario")
        or payload_llm.get("description")
        or payload_llm.get("user_description")
        or ""
    )
    if not user_desc and history:
        for msg in reversed(history):
            if msg.get("role") == "user" and msg.get("content"):
                user_desc = str(msg.get("content"))
                break

    _enforce_scope_exclusions(result, user_desc)
    _enforce_rapel_and_height_equipment(result, user_desc)
    _enforce_floor_ground_equipment(result, user_desc)
    _enforce_primary_materials_mutual_exclusion(result, user_desc)
    _enforce_deep_well_dimensions(result, user_desc)
    _sanitize_partida_description(result, user_desc)

    _normalize_equipment_prices(result)
    calibrate_apu_crew_and_equipment(result)
    reconcile_equipment_with_database(result, db)
    reconcile_materials_with_database(result, db)
    reconcile_labor_with_database(result, db)

    return result
