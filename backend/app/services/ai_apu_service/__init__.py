"""
Paquete ai_apu_service: Motor de Análisis de Precios Unitarios (APU) asistido por IA.

Facade de compatibilidad total hacia atrás (Zero-Breaking-Changes).
Re-exporta todas las funciones, directivas y enforcers desde sus respectivos submódulos.
"""
from app.db.base import get_db_session

# 1. Helpers numéricos y detección de códigos
from app.services.ai_apu_service.helpers import (
    _safe_float,
    _sanitize_llm_numbers,
    is_code_input,
    COMMON_CONSTRUCTION_TERMS,
)

# 2. Prompts y normativas
from app.services.ai_apu_service.prompts import (
    _FORMATO_SALIDA,
    _REGLAS_COVENIN,
    _REGLAS_DESCRIPCION,
    _REGLAS_ORIGEN,
    _REGLAS_EQUIPOS_ESCALA,
    _REGLAS_NUMERICAS,
    _REGLAS_INSUMOS_PRECIOS,
    _CRITERIO_CLARIFICACION,
    _APU_SYSTEM_PROMPT,
)

# 3. Reconciliación con bases de datos
from app.services.ai_apu_service.reconciliation.specs_matcher import (
    _extract_technical_specs,
    _has_technical_spec_conflict,
    _has_primary_noun_conflict,
    _normalize_unit,
    _convert_material_quantity,
)
from app.services.ai_apu_service.reconciliation.equipment import (
    _normalize_equipment_prices,
    _execute_equipment_reconciliation,
    reconcile_equipment_with_database,
)
from app.services.ai_apu_service.reconciliation.materials import (
    _execute_material_reconciliation,
    reconcile_materials_with_database,
    _enforce_base_apu_material_heritage,
)
from app.services.ai_apu_service.reconciliation.labor import (
    _execute_labor_reconciliation,
    reconcile_labor_with_database,
)

# 4. Reglas normativas y enforcers de ingeniería
from app.services.ai_apu_service.domain_rules.scope_exclusions import _enforce_scope_exclusions
from app.services.ai_apu_service.domain_rules.safety_height import _enforce_rapel_and_height_equipment
from app.services.ai_apu_service.domain_rules.floor_ground import _enforce_floor_ground_equipment
from app.services.ai_apu_service.domain_rules.sanitize_partida import (
    _sanitize_partida_description,
    infer_covenin_prefix,
)
from app.services.ai_apu_service.domain_rules.material_conflicts import _enforce_primary_materials_mutual_exclusion
from app.services.ai_apu_service.domain_rules.deep_well import _enforce_deep_well_dimensions

# 5. RAG y contexto histórico
from app.services.ai_apu_service.rag_context.pruning import _prune_apu_for_prompt
from app.services.ai_apu_service.rag_context.base_apu_fetcher import fetch_base_apu_for_prompt
from app.services.ai_apu_service.rag_context.candidates import (
    get_dynamic_candidates,
    _apply_technical_scoring_adjustments,
    INCOMPATIBLE_POLARITY_RULES,
    CORE_EQUIPMENT_KEYWORDS,
    AUXILIARY_CIVIL_OR_FITTING_TERMS,
)
from app.services.ai_apu_service.rag_context.complementary_selector import (
    select_relevant_complementary_apus,
    _extract_surgical_insumos,
    SECONDARY_ACTIVITY_PATTERNS,
)

# 6. Orquestadores principales de generación LLM
from app.services.ai_apu_service.generator.free_generator import generate_apu_with_ai
from app.services.ai_apu_service.generator.anchored_generator import generate_apu_with_ai_from_base


__all__ = [
    # DB session hook para compatibilidad de tests
    "get_db_session",
    # Helpers
    "_safe_float",
    "_sanitize_llm_numbers",
    "is_code_input",
    "COMMON_CONSTRUCTION_TERMS",
    # Prompts
    "_FORMATO_SALIDA",
    "_REGLAS_COVENIN",
    "_REGLAS_DESCRIPCION",
    "_REGLAS_ORIGEN",
    "_REGLAS_EQUIPOS_ESCALA",
    "_REGLAS_NUMERICAS",
    "_REGLAS_INSUMOS_PRECIOS",
    "_CRITERIO_CLARIFICACION",
    "_APU_SYSTEM_PROMPT",
    # Specs & Matching
    "_extract_technical_specs",
    "_has_technical_spec_conflict",
    "_has_primary_noun_conflict",
    "_normalize_unit",
    "_convert_material_quantity",
    # Reconciliation
    "_normalize_equipment_prices",
    "_execute_equipment_reconciliation",
    "reconcile_equipment_with_database",
    "_execute_material_reconciliation",
    "reconcile_materials_with_database",
    "_enforce_base_apu_material_heritage",
    "_execute_labor_reconciliation",
    "reconcile_labor_with_database",
    # Domain Rules
    "_enforce_scope_exclusions",
    "_enforce_rapel_and_height_equipment",
    "_enforce_floor_ground_equipment",
    "_sanitize_partida_description",
    "infer_covenin_prefix",
    "_enforce_primary_materials_mutual_exclusion",
    "_enforce_deep_well_dimensions",
    # RAG Context
    "_prune_apu_for_prompt",
    "fetch_base_apu_for_prompt",
    "get_dynamic_candidates",
    "_apply_technical_scoring_adjustments",
    "INCOMPATIBLE_POLARITY_RULES",
    "CORE_EQUIPMENT_KEYWORDS",
    "AUXILIARY_CIVIL_OR_FITTING_TERMS",
    "select_relevant_complementary_apus",
    "_extract_surgical_insumos",
    "SECONDARY_ACTIVITY_PATTERNS",
    # Generators
    "generate_apu_with_ai",
    "generate_apu_with_ai_from_base",
]
