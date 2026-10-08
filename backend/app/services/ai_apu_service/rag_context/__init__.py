"""
Submódulo de recuperación RAG y contexto histórico de APUs.
"""
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

__all__ = [
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
]
