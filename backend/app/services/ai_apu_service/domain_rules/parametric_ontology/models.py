"""Modelos de datos y dataclasses para el Motor Ontológico Paramétrico Universal (MOPTC)."""

import re
from dataclasses import dataclass, field
from typing import Any, List, Optional


@dataclass
class ParametricRequirement:
    """Define un parámetro técnico requerido por una familia constructiva."""

    param_id: str
    label: str
    detection_patterns: List[re.Pattern]
    question: str
    default_options: List[str]


@dataclass
class ConstructionFamilyOntology:
    """Define una familia constructiva y su contrato de parámetros técnicos."""

    family_id: str
    name: str
    activation_patterns: List[re.Pattern]
    exclusion_patterns: List[re.Pattern] = field(default_factory=list)
    required_parameters: List[ParametricRequirement] = field(default_factory=list)
    composite_options_generator: Optional[Any] = None

