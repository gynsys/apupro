"""
Schemas for AI APU Service v3.0 (Best-Match Base Selection + Surgical Delta Patching).
"""

from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field


class V3MaterialDeltaOp(BaseModel):
    """Operación puntual de ajuste sobre la lista de materiales del APU base."""
    op: Literal["remove", "replace", "modify_qty", "add"] = Field(
        description="Tipo de operación: 'remove' (eliminar), 'replace' (reemplazar), 'modify_qty' (cambiar cantidad), 'add' (agregar nuevo)"
    )
    target_code: Optional[str] = Field(
        default=None,
        description="Código (o descripción exacta) del material en el APU base sobre el que se aplica 'remove', 'replace' o 'modify_qty'"
    )
    new_description: Optional[str] = Field(
        default=None,
        description="Descripción técnica del material nuevo para operaciones 'replace' o 'add'"
    )
    new_unit: Optional[str] = Field(
        default=None,
        description="Unidad de medida del material nuevo para operaciones 'replace' o 'add' (ej. m, m2, m3, und, pza, kgf, saco, gal)"
    )
    new_quantity: Optional[float] = Field(
        default=None,
        description="Cantidad unitaria del material para operaciones 'replace', 'modify_qty' o 'add'"
    )
    new_waste_pct: Optional[float] = Field(
        default=None,
        description="Porcentaje de desperdicio opcional (0 a 30)"
    )
    estimated_price_usd: Optional[float] = Field(
        default=None,
        description="Precio unitario referencial en USD solo como respaldo si el nuevo material no existe en la BD oficial"
    )
    reason: str = Field(
        default="Ajuste técnico al requerimiento del usuario",
        description="Justificación técnica del ajuste"
    )


class V3EquipmentDeltaOp(BaseModel):
    """Operación puntual de ajuste sobre la lista de equipos del APU base."""
    op: Literal["remove", "replace", "modify_qty", "add"] = Field(
        description="Tipo de operación: 'remove', 'replace', 'modify_qty', 'add'"
    )
    target_code: Optional[str] = Field(
        default=None,
        description="Código (o descripción) del equipo en el APU base para 'remove', 'replace' o 'modify_qty'"
    )
    new_description: Optional[str] = Field(
        default=None,
        description="Descripción técnica del equipo nuevo para 'replace' o 'add'"
    )
    new_quantity: Optional[float] = Field(
        default=None,
        description="Cantidad de equipos para 'replace', 'modify_qty' o 'add'"
    )
    estimated_price_usd: Optional[float] = Field(
        default=None,
        description="Precio de reposición referencial en USD si no existe en catálogo"
    )
    depreciation_factor: Optional[float] = Field(
        default=None,
        description="Factor de depreciación/alquiler diario opcional"
    )
    price_basis: Optional[Literal["tarifa_diaria", "valor_reposicion"]] = Field(
        default="tarifa_diaria",
        description="Indica si estimated_price_usd es tarifa/alquiler diario (factor 1.0) o valor de reposición de compra (aplica depreciación 0.002-0.015)"
    )
    reason: str = Field(
        default="Ajuste de equipo según alcance solicitado",
        description="Justificación técnica del ajuste de equipo"
    )


class V3LaborDeltaOp(BaseModel):
    """Operación puntual de ajuste sobre la cuadrilla de mano de obra del APU base."""
    op: Literal["remove", "replace", "modify_qty", "add"] = Field(
        description="Tipo de operación: 'remove', 'replace', 'modify_qty', 'add'"
    )
    target_code: Optional[str] = Field(
        default=None,
        description="Código (o cargo) del trabajador en el APU base para 'remove', 'replace' o 'modify_qty'"
    )
    new_description: Optional[str] = Field(
        default=None,
        description="Cargo oficial COVENIN del trabajador para 'replace' o 'add' (ej. ALBAÑIL DE 1RA, PLOMERO DE 1RA, AYUDANTE)"
    )
    new_quantity: Optional[float] = Field(
        default=None,
        description="Cantidad de personas en ese cargo para 'replace', 'modify_qty' o 'add'"
    )
    reason: str = Field(
        default="Ajuste de cuadrilla según especialidad",
        description="Justificación técnica del ajuste de mano de obra"
    )


class V3AdaptationPlan(BaseModel):
    """
    Plan de Selección y Adaptación Delta (Motor v3.0):
    1. Elige la mejor partida base entre las candidatas reales de PostgreSQL.
    2. Define únicamente los cambios puntuales (Delta) respecto a esa partida base.
    """
    selected_codpar: str = Field(
        default="",
        description="Código CodPar exacto de la partida candidata seleccionada como mejor molde constructivo"
    )
    selection_reason: str = Field(
        default="Partida histórica con mayor afinidad constructiva y de insumos",
        description="Explicación técnica de por qué se eligió esta partida base sobre las demás candidatas"
    )
    adapted_description: str = Field(
        default="",
        description="Descripción técnica formal estilo COVENIN ajustada exactamente a la solicitud del usuario"
    )
    target_unit: str = Field(
        default="und",
        description="Unidad de medida final de la partida (m, m2, m3, und, pza, kgf, pto, Gl)"
    )
    keep_base_performance: bool = Field(
        default=True,
        description="True si se conserva el rendimiento diario original de la partida base; False solo si cambió la unidad o escala física"
    )
    new_performance: Optional[float] = Field(
        default=None,
        description="Nuevo rendimiento diario solo cuando keep_base_performance es False"
    )
    performance_reason: Optional[str] = Field(
        default=None,
        description="Justificación técnica si se ajustó el rendimiento"
    )
    material_ops: List[V3MaterialDeltaOp] = Field(
        default_factory=list,
        description="Lista de ajustes puntuales a realizar sobre los materiales del APU base"
    )
    equipment_ops: List[V3EquipmentDeltaOp] = Field(
        default_factory=list,
        description="Lista de ajustes puntuales a realizar sobre los equipos del APU base"
    )
    labor_ops: List[V3LaborDeltaOp] = Field(
        default_factory=list,
        description="Lista de ajustes puntuales a realizar sobre la mano de obra del APU base"
    )
    technical_assumptions: List[str] = Field(
        default_factory=list,
        description="Notas técnicas o supuestos aplicados en la adaptación"
    )
    clarification_needed: bool = Field(
        default=False,
        description="True únicamente si es imposible determinar la actividad o unidad sin consultar al usuario"
    )
    clarification_reason: Optional[str] = Field(
        default=None,
        description="Mensaje de aclaratoria si clarification_needed es True"
    )
    clarification_options: List[str] = Field(
        default_factory=list,
        description="Opciones sugeridas para responder la aclaratoria"
    )


class V3GenerationMeta(BaseModel):
    """Telemetría del Motor v3.0 (Base Selection + Delta Patching)."""
    engine: str = "v3_delta"
    candidate_retrieval_ms: float = 0.0
    llm_selection_delta_ms: float = 0.0
    delta_apply_reconcile_ms: float = 0.0
    total_latency_ms: float = 0.0
    selected_codpar: str = ""
    candidates_evaluated: int = 0
    total_deltas_applied: int = 0
    summary: Dict[str, Any] = Field(default_factory=dict)


class V3ReviewPatch(BaseModel):
    """
    Esquema restringido para la auto-revisión física y económica del APU en Lazo Cerrado.
    La IA solo tiene permitido ajustar perillas existentes (rendimiento, cantidades de obreros
    o factores de equipos), sin inventar nuevos insumos ni cambiar la unidad o el contrato.
    """
    new_performance: Optional[float] = Field(
        default=None,
        description="Nuevo rendimiento diario corregido si el anterior generaba HH/unidad o días irreales"
    )
    performance_reason: Optional[str] = Field(
        default=None,
        description="Explicación física del ajuste de rendimiento"
    )
    crew_qty_adjustments: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Ajuste de cantidades de cargos existentes: [{'codigo': '...', 'new_quantity': ...}]"
    )
    equipment_adjustments: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Ajuste de equipos existentes: [{'codigo': '...', 'new_quantity': ..., 'depreciation_factor': ...}]"
    )
    equipment_removals: List[str] = Field(
        default_factory=list,
        description="Códigos de insumos de equipo ajenos a la actividad a eliminar (ej. herramientas de postes o excavación en mudanzas)"
    )
    labor_removals: List[str] = Field(
        default_factory=list,
        description="Códigos de cargos de mano de obra ajenos a eliminar"
    )
    technical_justification: str = Field(
        default="Ajuste de consistencia física y económica",
        description="Justificación técnica integral de la corrección"
    )
