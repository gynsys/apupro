"""Esquemas Pydantic para el módulo de Revisión y Auditoría de Presupuestos."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class AuditFromBudgetRequest(BaseModel):
    """Solicitud para auditar un presupuesto existente en CostBase."""

    budget_id: str = Field(..., min_length=1)
    database_id: str = Field(default="master")


class FindingOut(BaseModel):
    """Representación de un hallazgo de auditoría."""

    id: int
    review_item_id: Optional[str] = None
    rule_id: str
    category: str
    severity: str
    item_code: str
    component_code: Optional[str] = None
    component_description: Optional[str] = None
    field_name: str
    imported_value: Optional[str] = None
    master_value: Optional[str] = None
    diff_percent: Optional[float] = None
    message: str
    suggestion: Optional[str] = None


class ReviewComponentOut(BaseModel):
    """Insumo de APU en el snapshot de revisión con su contraparte maestra."""

    id: str
    component_type: str
    code: str
    resolved_master_code: Optional[str] = None
    description: str
    unit: str
    quantity: float
    master_quantity: Optional[float] = None
    unit_price: float
    master_unit_price: Optional[float] = None
    waste_or_deprec: float
    master_waste_or_deprec: Optional[float] = None
    bonus: float = 0.0


class ReviewItemOut(BaseModel):
    """Partida auditada con sus métricas comparativas y hallazgos."""

    id: str
    row_number: int
    sheet_name: Optional[str] = None
    original_code: str
    normalized_code: str
    covenin_code: Optional[str] = None
    matched_master_code: Optional[str] = None
    origin_source: Optional[str] = None
    description: str
    master_description: Optional[str] = None
    description_similarity: float
    unit: str
    master_unit: Optional[str] = None
    quantity: float
    performance: float
    master_performance: Optional[float] = None
    imported_unit_price: float
    calculated_unit_price: float
    master_unit_price: Optional[float] = None
    is_chapter: bool
    is_uncoded: bool
    suggested_equivalent_code: Optional[str] = None
    suggested_equivalent_desc: Optional[str] = None
    suggested_equivalent_score: Optional[float] = None
    components: List[ReviewComponentOut] = []
    findings: List[FindingOut] = []


class ReviewSnapshotSummaryOut(BaseModel):
    """Resumen de una auditoría realizada para el listado histórico."""

    id: str
    name: str
    project_name: Optional[str] = None
    client_name: Optional[str] = None
    source_type: str
    source_filename: Optional[str] = None
    source_budget_id: Optional[str] = None
    database_id: str
    currency: str
    total_items: int
    coded_items_count: int
    uncoded_items_count: int
    critical_findings_count: int
    high_findings_count: int
    medium_findings_count: int
    info_findings_count: int
    health_score: float
    created_at: datetime


class ReviewSnapshotDetailOut(ReviewSnapshotSummaryOut):
    """Detalle completo de un snapshot de auditoría incluyendo partidas, recetas y hallazgos."""

    fcas_percent: float
    admin_percent: float
    profit_percent: float
    iva_percent: float
    origin_breakdown: Dict[str, int] = {}
    category_breakdown: Dict[str, int] = {}
    items: List[ReviewItemOut] = []
    findings: List[FindingOut] = []
