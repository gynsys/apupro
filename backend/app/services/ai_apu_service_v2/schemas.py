"""
Schemas for AI APU Service v2.0 (Two-Phase Architecture: WorkSpec + Deterministic Composer).
"""

from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field


class WorkSpecDimensions(BaseModel):
    """Physical dimensions extracted from the user's technical description."""
    length_m: Optional[float] = Field(default=None, description="Longitud en metros (ej. longitud de dintel, tubería)")
    width_m: Optional[float] = Field(default=None, description="Ancho o base en metros")
    height_m: Optional[float] = Field(default=None, description="Altura o espesor en metros")
    depth_m: Optional[float] = Field(default=None, description="Profundidad en metros (ej. perforación de pozo, zanja)")
    diameter_inches: Optional[float] = Field(default=None, description="Diámetro nominal en pulgadas (ej. 2 pulg, 4 pulg)")
    area_m2: Optional[float] = Field(default=None, description="Área superficial en metros cuadrados")
    volume_m3: Optional[float] = Field(default=None, description="Volumen geométrico en metros cúbicos")


class WorkSpec(BaseModel):
    """
    WorkSpec: Intermediate Representation (IR) extracted by the LLM in Phase 1.
    Fully typed, deterministic, and free of hallucinated prices or arbitrary crew benchmarks.
    """
    activity_type: Literal[
        "CONSTRUCCION",
        "INSTALACION",
        "VACIADO",
        "DEMOLICION",
        "DESMONTAJE",
        "REPARACION",
        "MANTENIMIENTO",
        "SUMINISTRO_E_INSTALACION",
        "OTRO"
    ] = Field(default="CONSTRUCCION", description="Tipo de intervención constructiva")

    discipline: Literal[
        "EDIFICACIONES",
        "OBRAS_CIVILES",
        "HIDROSANITARIA",
        "ELECTRICA",
        "VIALIDAD",
        "MECANICA",
        "ACABADOS",
        "OTRO"
    ] = Field(default="EDIFICACIONES", description="Disciplina técnica de la partida")

    element: Optional[str] = Field(
        default=None,
        description="Elemento constructivo principal (ej. DINTEL, MACHON, TUBERIA, POZO_PROFUNDO, LOSA, FRISO, TABLERO)"
    )

    target_unit: str = Field(
        default="und",
        description="Unidad métrica normalizada COVENIN (m, m2, m3, und, pza, kg, ton, pto, viaje)"
    )

    mix_type: Literal[
        "CONCRETO_ESTRUCTURAL",
        "MORTERO_ARENA_CEMENTO",
        "PASTA_YESO",
        "ASFALTO",
        "NINGUNA"
    ] = Field(default="NINGUNA", description="Tipo de aglomerante o mezcla requerido")

    mounting_condition: Literal[
        "EMBUTIDA",
        "ENTERRADA",
        "SUPERFICIAL_COLGANTE",
        "A_LA_VISTA",
        "NO_APLICA"
    ] = Field(default="NO_APLICA", description="Condición física de fijación o montaje")

    substrate: Optional[str] = Field(
        default=None,
        description="Sustrato o estructura preexistente de soporte (ej. LOSA_DE_CONCRETO, PARED_DE_BLOQUE, TIERRA)"
    )

    dimensions: WorkSpecDimensions = Field(
        default_factory=WorkSpecDimensions,
        description="Dimensiones físicas cuantificables"
    )

    explicit_materials: List[str] = Field(
        default_factory=list,
        description="Materiales o especificaciones solicitadas explícitamente (ej. PVC, ACERO, CEMENTO)"
    )

    excluded_materials: List[str] = Field(
        default_factory=list,
        description="Materiales excluidos explícitamente por el usuario (ej. PIEDRA_PICADA, CABILLA)"
    )

    manual_mixing: bool = Field(
        default=False,
        description="True si el usuario solicitó mezcla elaborada a mano (sin mezcladora)"
    )

    work_at_height: bool = Field(
        default=False,
        description="True si la actividad se ejecuta en altura (>2m) requiriendo andamio o rapel"
    )

    execution_days: Optional[float] = Field(
        default=None,
        description="Días de ejecución estimados para partidas globales (Gl/S.G.)"
    )

    clarification_needed: bool = Field(
        default=False,
        description="True si la solicitud es ambigua y no se puede componer el APU sin datos clave"
    )

    clarification_reason: Optional[str] = Field(
        default=None,
        description="Pregunta técnica clara o motivo de la aclaratoria requerida"
    )

    clarification_options: List[str] = Field(
        default_factory=list,
        description="Opciones técnicas concretas sugeridas para resolver la aclaratoria"
    )

    technical_assumptions: List[str] = Field(
        default_factory=list,
        description="Supuestos técnicos de ingeniería asumidos para la composición"
    )


class V2GenerationMeta(BaseModel):
    """Telemetría y trazabilidad del motor v2.0."""
    engine: str = "v2_workspec"
    phase1_llm_latency_ms: float = 0.0
    phase2_composer_latency_ms: float = 0.0
    total_latency_ms: float = 0.0
    tokens_used: Optional[int] = None
    workspec_summary: Dict[str, Any] = Field(default_factory=dict)
