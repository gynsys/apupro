"""
AI APU Service v2.0 Package.
Two-Phase Architecture: WorkSpec Intermediate Representation + Deterministic Composer.
"""

from app.services.ai_apu_service_v2.schemas import WorkSpec, WorkSpecDimensions, V2GenerationMeta
from app.services.ai_apu_service_v2.interpreter import interpret_user_prompt_to_workspec
from app.services.ai_apu_service_v2.composer import compose_apu_from_workspec
from app.services.ai_apu_service_v2.service import generate_apu_v2

__all__ = [
    "WorkSpec",
    "WorkSpecDimensions",
    "V2GenerationMeta",
    "interpret_user_prompt_to_workspec",
    "compose_apu_from_workspec",
    "generate_apu_v2",
]
