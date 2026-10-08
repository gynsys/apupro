"""
Submódulo de orquestadores de generación y adaptación de APUs con LLM.
"""
from app.services.ai_apu_service.generator.free_generator import generate_apu_with_ai
from app.services.ai_apu_service.generator.anchored_generator import generate_apu_with_ai_from_base

__all__ = [
    "generate_apu_with_ai",
    "generate_apu_with_ai_from_base",
]
