"""
Phase 1: Interpretation Engine (LLM -> WorkSpec)
Converts natural language user requests into a typed, validated WorkSpec Intermediate Representation (IR).
"""

from __future__ import annotations

import json
import re
import time
from typing import Any, Dict, List, Optional, Tuple

from app.core.logging import logger
from app.services.ai_apu_service.domain_rules.deep_well import (
    extract_depth,
    is_deep_well_item,
)
from app.services.ai_apu_service.domain_rules.discordant_pruning import (
    classify_pipe_mounting_condition,
    is_explicit_mortar_without_coarse_concrete,
    is_manual_mixing_requested,
    is_pipe_or_conduit_activity,
)
from app.services.ai_apu_service.reconciliation.specs_matcher import _normalize_unit
from app.services.ai_apu_service_v2.schemas import WorkSpec, WorkSpecDimensions
from app.services.element_geometry import (
    extract_discrete_volume_m3,
    extract_linear_length_m,
    is_linear_element,
)
from app.services.llm_router import call_llm_json

_SYSTEM_PROMPT = """Eres un Ingeniero Civil Senior venezolano experto en la Norma COVENIN 2000:1992.
Tu única tarea es extraer la intención constructiva, dimensiones y restricciones de la solicitud del usuario en un esquema JSON estructurado (WorkSpec).

REGLAS CRÍTICAS:
1. NO inventes precios, partidas, listas de materiales, cuadrillas ni rendimientos. Esa composición se hace en la Fase 2 determinista.
2. Identifica con rigor:
   - activity_type: CONSTRUCCION, INSTALACION, VACIADO, DEMOLICION, DESMONTAJE, REPARACION, MANTENIMIENTO, SUMINISTRO_E_INSTALACION, OTRO.
   - discipline: EDIFICACIONES, OBRAS_CIVILES, HIDROSANITARIA, ELECTRICA, VIALIDAD, MECANICA, ACABADOS, OTRO.
   - element: Nombre en mayúsculas del elemento principal (ej. DINTEL, MACHON, TUBERIA, POZO_PROFUNDO, LOSA, FRISO, TABLERO).
   - target_unit: Unidad métrica COVENIN (m, m2, m3, und, pza, kg, ton, pto, viaje).
   - mix_type: Si es mortero (arena-cemento, sin concreto) -> "MORTERO_ARENA_CEMENTO". Si es concreto estructural -> "CONCRETO_ESTRUCTURAL". Si no aplica -> "NINGUNA".
   - mounting_condition: EMBUTIDA, ENTERRADA, SUPERFICIAL_COLGANTE, A_LA_VISTA, NO_APLICA.
   - substrate: Si la actividad se realiza sobre un sustrato preexistente (ej. "LOSA_DE_CONCRETO", "PARED_DE_BLOQUE"), decláralo aquí.
   - dimensions: Extrae numéricamente length_m, width_m, height_m, depth_m, diameter_inches, area_m2, volume_m3 si se mencionan.
   - explicit_materials: Lista de insumos explícitos pedidos por el usuario.
   - excluded_materials: Lista de insumos excluidos (ej. "sin piedra picada", "sin cabilla").
   - manual_mixing: true si pidió mezcla hecha a mano.
   - work_at_height: true si involucra andamios o rapel.
   - clarification_needed: true solo si la descripción es totalmente vaga o incoherente y no se puede deducir la partida.
"""


def _build_interpreter_prompt(
    user_description: str,
    requested_unit: Optional[str] = None,
    context: Optional[str] = None
) -> str:
    """Construye el prompt compacto para el extractor WorkSpec."""
    prompt = (
        f"Solicitud técnica del usuario:\n"
        f'"{user_description}"\n\n'
    )
    if requested_unit:
        prompt += f"Unidad métrica solicitada por el usuario: {requested_unit}\n"
    if context:
        prompt += f"Contexto de la partida / proyecto: {context}\n"

    prompt += (
        "\nDevuelve ÚNICAMENTE un objeto JSON válido con los campos del WorkSpec:\n"
        "{\n"
        '  "activity_type": "...",\n'
        '  "discipline": "...",\n'
        '  "element": "...",\n'
        '  "target_unit": "...",\n'
        '  "mix_type": "...",\n'
        '  "mounting_condition": "...",\n'
        '  "substrate": null,\n'
        '  "dimensions": {"length_m": null, "depth_m": null, "diameter_inches": null, "area_m2": null, "volume_m3": null},\n'
        '  "explicit_materials": [],\n'
        '  "excluded_materials": [],\n'
        '  "manual_mixing": false,\n'
        '  "work_at_height": false,\n'
        '  "clarification_needed": false,\n'
        '  "clarification_reason": null,\n'
        '  "clarification_options": [],\n'
        '  "technical_assumptions": []\n'
        "}"
    )
    return prompt


def _apply_deterministic_overrides(workspec: WorkSpec, user_description: str, requested_unit: Optional[str]) -> WorkSpec:
    """
    Aplica guardias deterministas sobre el WorkSpec extraído por el LLM
    para asegurar 100% de cumplimiento con las reglas probadas de COVENIN y dominio.
    """
    desc = user_description or ""

    # 1. Unidad objetivo
    if requested_unit:
        workspec.target_unit = _normalize_unit(requested_unit)

    # 2. Respeto estricto a mortero vs concreto
    if is_explicit_mortar_without_coarse_concrete(desc):
        workspec.mix_type = "MORTERO_ARENA_CEMENTO"
        if "PIEDRA_PICADA" not in workspec.excluded_materials:
            workspec.excluded_materials.append("PIEDRA_PICADA")

    # 3. Mezcla manual
    if is_manual_mixing_requested(desc):
        workspec.manual_mixing = True

    # 4. Condición de montaje para tuberías / canalizaciones
    if is_pipe_or_conduit_activity(desc):
        mounting = classify_pipe_mounting_condition(desc)
        if mounting in ("EMBUTIDA", "ENTERRADA", "SUPERFICIAL_COLGANTE"):
            workspec.mounting_condition = mounting

    # 5. Pozos profundos: profundidad efectiva
    if is_deep_well_item(desc):
        workspec.element = "POZO_PROFUNDO"
        workspec.discipline = "HIDROSANITARIA"
        depth = extract_depth(desc)
        if depth:
            workspec.dimensions.depth_m = depth

    # 6. Geometría discreta y longitudes lineales
    lin_length = extract_linear_length_m(desc)
    if lin_length and not workspec.dimensions.length_m:
        workspec.dimensions.length_m = lin_length

    disc_vol = extract_discrete_volume_m3(desc)
    if disc_vol and not workspec.dimensions.volume_m3:
        workspec.dimensions.volume_m3 = disc_vol

    # 7. Elemento dintel / machón
    up = desc.upper()
    if re.search(r"\bDINTEL(?:ES)?\b", up):
        workspec.element = "DINTEL"
        workspec.discipline = "EDIFICACIONES"
    elif re.search(r"\b(?:MACHON(?:ES)?|COLUMNETA(?:S)?)\b", up):
        workspec.element = "MACHON"
        workspec.discipline = "EDIFICACIONES"

    return workspec


def interpret_user_prompt_to_workspec(
    user_description: str,
    requested_unit: Optional[str] = None,
    context: Optional[str] = None
) -> Tuple_WorkSpec_Latency:
    """
    Fase 1: Ejecuta la extracción de WorkSpec usando el LLM más rápido disponible
    y refuerza deterministamente los campos críticos.
    """
    if not user_description or not isinstance(user_description, str) or not user_description.strip():
        empty_spec = WorkSpec(
            clarification_needed=True,
            clarification_reason="Descripción vacía. Por favor ingrese los detalles de la partida a generar."
        )
        return empty_spec, 0.0

    t0 = time.time()
    prompt = _build_interpreter_prompt(user_description, requested_unit, context)

    raw_dict: Dict[str, Any] = {}
    try:
        raw_dict = call_llm_json(prompt, use_case="apu_generation", system_prompt=_SYSTEM_PROMPT)
    except Exception as exc:
        logger.error("Error en Fase 1 (LLM WorkSpec extraction): %s. Usando fallback heurístico.", exc, exc_info=True)
        raw_dict = {
            "activity_type": "CONSTRUCCION",
            "discipline": "EDIFICACIONES",
            "element": None,
            "target_unit": _normalize_unit(requested_unit or "und"),
            "mix_type": "NINGUNA",
            "mounting_condition": "NO_APLICA",
            "clarification_needed": False
        }

    # Validar y cargar mediante Pydantic
    try:
        if not isinstance(raw_dict, dict):
            raw_dict = {}
        workspec = WorkSpec.model_validate(raw_dict)
    except Exception as val_err:
        logger.error("Error validando WorkSpec extraído: %s. Recomponiendo con valores por defecto.", val_err, exc_info=True)
        workspec = WorkSpec(
            target_unit=_normalize_unit(requested_unit or "und")
        )

    # Aplicar salvaguardas deterministas sobre el WorkSpec
    workspec = _apply_deterministic_overrides(workspec, user_description, requested_unit)

    latency_ms = (time.time() - t0) * 1000.0
    logger.info(
        "Fase 1 completada en %.1fms | Elemento=%s | Unidad=%s | Mezcla=%s | Montaje=%s",
        latency_ms, workspec.element, workspec.target_unit, workspec.mix_type, workspec.mounting_condition
    )
    return workspec, latency_ms


# Type alias for return
Tuple_WorkSpec_Latency = Tuple[WorkSpec, float]
