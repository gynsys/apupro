"""Motor Ontológico de Contratos Paramétricos de Obras Civiles (MOPTC) — Capa Pre-RAG.

Paquete modularizado que preserva retrocompatibilidad 100% con todas las importaciones
existentes en el proyecto.
"""

from .models import ParametricRequirement, ConstructionFamilyOntology
from .patterns import (
    DEMOLITION_OR_REMOVAL_PATTERNS,
    SURFACE_TREATMENTS_AND_FINISHES_PATTERNS,
    MAINTENANCE_AND_REPAIR_PATTERNS,
    NON_FABRICATION_EXCLUSION_PATTERNS,
    strip_accents,
)
from .registry import ONTOLOGY_REGISTRY
from .contextual_options import get_contextual_options
from .evaluator import evaluate_parametric_ontology_contract

# Alias interno para retrocompatibilidad
_strip_accents = strip_accents

__all__ = [
    "ParametricRequirement",
    "ConstructionFamilyOntology",
    "DEMOLITION_OR_REMOVAL_PATTERNS",
    "SURFACE_TREATMENTS_AND_FINISHES_PATTERNS",
    "MAINTENANCE_AND_REPAIR_PATTERNS",
    "NON_FABRICATION_EXCLUSION_PATTERNS",
    "strip_accents",
    "_strip_accents",
    "ONTOLOGY_REGISTRY",
    "get_contextual_options",
    "evaluate_parametric_ontology_contract",
]
