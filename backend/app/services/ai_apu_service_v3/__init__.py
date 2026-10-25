"""
AI APU Service v3.0 Package.
Three-Stage Architecture:
1. Enriched Candidate Retrieval (Top K candidates with real Materials, Equipment, and Labor recipes).
2. AI Best-Match Base Selection + Surgical Delta Planner.
3. Deterministic Delta Applier on Intact Official Base APU + Database Reconciliation.
"""

from app.services.ai_apu_service_v3.delta_applier import apply_v3_deltas_to_base_apu
from app.services.ai_apu_service_v3.schemas import (
    V3AdaptationPlan,
    V3EquipmentDeltaOp,
    V3GenerationMeta,
    V3LaborDeltaOp,
    V3MaterialDeltaOp,
)
from app.services.ai_apu_service_v3.selector_planner import (
    fetch_enriched_candidates_for_v3,
    plan_v3_selection_and_deltas,
)
from app.services.ai_apu_service_v3.service import generate_apu_v3

__all__ = [
    "V3AdaptationPlan",
    "V3MaterialDeltaOp",
    "V3EquipmentDeltaOp",
    "V3LaborDeltaOp",
    "V3GenerationMeta",
    "fetch_enriched_candidates_for_v3",
    "plan_v3_selection_and_deltas",
    "apply_v3_deltas_to_base_apu",
    "generate_apu_v3",
]
