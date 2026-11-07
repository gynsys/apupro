"""Esquemas Pydantic para el módulo de Revisión y Auditoría de Presupuestos."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field


class AuditFromBudgetRequest(BaseModel):
    """Solicitud para auditar un presupuesto existente en CostBase (o nueva versión corregida)."""

    budget_id: str = Field(..., min_length=1)
    database_id: str = Field(default="master")
    parent_snapshot_id: Optional[str] = None
    name: Optional[str] = None
    project_name: Optional[str] = None
    client_name: Optional[str] = None
    auditor_notes: Optional[str] = None
    report_code: Optional[str] = None
    reviewer_name: Optional[str] = None
    reviewer_civ: Optional[str] = None
    document_reference: Optional[str] = None
    institution_name: Optional[str] = None
    conclusion_text: Optional[str] = None


class ReviewSnapshotUpdateRequest(BaseModel):
    """Solicitud para Guardar cambios sobre una auditoría existente (metadatos, estado y notas)."""

    name: Optional[str] = None
    project_name: Optional[str] = None
    client_name: Optional[str] = None
    review_status: Optional[str] = None
    auditor_notes: Optional[str] = None
    report_code: Optional[str] = None
    reviewer_name: Optional[str] = None
    reviewer_civ: Optional[str] = None
    document_reference: Optional[str] = None
    institution_name: Optional[str] = None
    conclusion_text: Optional[str] = None


class ReviewSnapshotCloneRequest(BaseModel):
    """Solicitud para Guardar Como (clonar la auditoría bajo un nuevo nombre o expediente)."""

    name: str = Field(..., min_length=1)
    project_name: Optional[str] = None
    client_name: Optional[str] = None
    review_status: Optional[str] = "EN_REVISION"
    auditor_notes: Optional[str] = None
    report_code: Optional[str] = None
    reviewer_name: Optional[str] = None
    reviewer_civ: Optional[str] = None
    document_reference: Optional[str] = None
    institution_name: Optional[str] = None
    conclusion_text: Optional[str] = None


class ReviewFindingUpdateRequest(BaseModel):
    """Solicitud para actualizar el estado de revisión o comentario de un hallazgo puntual."""

    finding_status: str = Field(..., min_length=1)
    auditor_comment: Optional[str] = None


class FindingOut(BaseModel):
    """Representación de un hallazgo de auditoría."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    review_item_id: Optional[str] = None
    rule_id: str
    category: str
    severity: str
    item_code: str
    covenin_code: Optional[str] = None
    component_code: Optional[str] = None
    component_description: Optional[str] = None
    field_name: str
    imported_value: Optional[str] = None
    master_value: Optional[str] = None
    diff_percent: Optional[float] = None
    message: str
    suggestion: Optional[str] = None
    finding_status: str = "PENDIENTE"
    auditor_comment: Optional[str] = None


class ReviewComponentOut(BaseModel):
    """Insumo de APU en el snapshot de revisión con su contraparte maestra."""

    model_config = ConfigDict(from_attributes=True)

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

    model_config = ConfigDict(from_attributes=True)

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
    ai_audit_status: Optional[str] = None
    ai_audit_summary: Optional[str] = None
    components: List[ReviewComponentOut] = []
    findings: List[FindingOut] = []


class ReviewSnapshotSummaryOut(BaseModel):
    """Resumen de una auditoría realizada para el listado histórico y el árbol de versiones."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    project_name: Optional[str] = None
    client_name: Optional[str] = None
    source_type: str
    source_filename: Optional[str] = None
    source_budget_id: Optional[str] = None
    database_id: str
    currency: str
    audit_group_id: Optional[str] = None
    parent_snapshot_id: Optional[str] = None
    version_number: int = 1
    review_status: str = "EN_REVISION"
    auditor_notes: Optional[str] = None
    report_code: Optional[str] = None
    reviewer_name: Optional[str] = None
    reviewer_civ: Optional[str] = None
    document_reference: Optional[str] = None
    institution_name: Optional[str] = None
    conclusion_text: Optional[str] = None
    chapters_count: int = 0
    total_items: int
    coded_items_count: int
    uncoded_items_count: int
    critical_findings_count: int
    high_findings_count: int
    medium_findings_count: int
    info_findings_count: int
    health_score: float
    created_at: datetime
    updated_at: Optional[datetime] = None


class VersionComparisonSummary(BaseModel):
    """Comparativa automática entre la versión auditada actual y la versión anterior (antes de correcciones)."""

    previous_snapshot_id: str
    previous_version_number: int
    previous_name: str
    previous_health_score: float
    health_delta: float
    resolved_findings_count: int
    persistent_findings_count: int
    new_findings_count: int
    resolved_findings: List[Dict[str, Any]] = []
    persistent_keys: List[str] = []
    new_keys: List[str] = []


class ReviewSnapshotDetailOut(ReviewSnapshotSummaryOut):
    """Detalle completo de un snapshot de auditoría incluyendo partidas, recetas, hallazgos y versiones."""

    fcas_percent: float
    admin_percent: float
    profit_percent: float
    iva_percent: float
    origin_breakdown: Dict[str, int] = {}
    category_breakdown: Dict[str, int] = {}
    version_history: List[ReviewSnapshotSummaryOut] = []
    version_comparison: Optional[VersionComparisonSummary] = None
    items: List[ReviewItemOut] = []
    findings: List[FindingOut] = []
