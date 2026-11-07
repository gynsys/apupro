"""Modelos SQLAlchemy aislados para el módulo de Revisión y Auditoría de Presupuestos."""
from __future__ import annotations

from datetime import datetime
from typing import List
import uuid

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.db.base import Base


def generate_review_uuid() -> str:
    """Genera un identificador único UUID4 como cadena."""
    return str(uuid.uuid4())


class ReviewSnapshot(Base):
    """Copia normalizada e inmutable de un presupuesto sometido a auditoría."""

    __tablename__ = "review_budget_snapshots"

    id = Column(String, primary_key=True, default=generate_review_uuid)
    user_id = Column(String, nullable=False, index=True)
    source_type = Column(String, nullable=False, default="file")  # 'file' | 'existing_budget'
    source_budget_id = Column(String, nullable=True, index=True)
    source_filename = Column(String, nullable=True)
    database_id = Column(String, nullable=False, default="master")

    name = Column(String, nullable=False)
    project_name = Column(Text, nullable=True)
    client_name = Column(String, nullable=True)
    currency = Column(String, nullable=False, default="USD")

    # Datos ejecutivos del informe y del Ingeniero Revisor
    report_code = Column(String(100), nullable=True)
    reviewer_name = Column(String(200), nullable=True)
    reviewer_civ = Column(String(100), nullable=True)
    document_reference = Column(String(255), nullable=True)
    institution_name = Column(String(255), nullable=True)
    institution_logo = Column(Text, nullable=True)
    conclusion_text = Column(Text, nullable=True)

    # Firma de Conformidad por el Ente Contratante
    approver_name = Column(String(200), nullable=True)
    approver_civ = Column(String(100), nullable=True)
    approver_department = Column(String(255), nullable=True)

    # Control de expediente, versiones y estado de revisión (CRUD Auditoría)
    audit_group_id = Column(String, nullable=True, index=True)
    parent_snapshot_id = Column(String, nullable=True, index=True)
    version_number = Column(Integer, nullable=False, default=1)
    review_status = Column(String, nullable=False, default="EN_REVISION")
    # Estados: 'EN_REVISION', 'CON_OBSERVACIONES', 'CORREGIDO', 'APROBADO', 'RECHAZADO'
    auditor_notes = Column(Text, nullable=True)

    fcas_percent = Column(Float, nullable=False, default=417.0)
    admin_percent = Column(Float, nullable=False, default=15.0)
    profit_percent = Column(Float, nullable=False, default=10.0)
    iva_percent = Column(Float, nullable=False, default=16.0)

    total_items = Column(Integer, nullable=False, default=0)
    coded_items_count = Column(Integer, nullable=False, default=0)
    uncoded_items_count = Column(Integer, nullable=False, default=0)
    critical_findings_count = Column(Integer, nullable=False, default=0)
    high_findings_count = Column(Integer, nullable=False, default=0)
    medium_findings_count = Column(Integer, nullable=False, default=0)
    info_findings_count = Column(Integer, nullable=False, default=0)
    health_score = Column(Float, nullable=False, default=100.0)

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    items = relationship(
        "ReviewItem",
        back_populates="snapshot",
        cascade="all, delete-orphan",
        order_by="ReviewItem.row_number",
    )
    findings = relationship(
        "ReviewFinding",
        back_populates="snapshot",
        cascade="all, delete-orphan",
        order_by="ReviewFinding.id",
    )


class ReviewItem(Base):
    """Partida individual dentro de un snapshot de revisión."""

    __tablename__ = "review_budget_items"

    id = Column(String, primary_key=True, default=generate_review_uuid)
    snapshot_id = Column(
        String,
        ForeignKey("review_budget_snapshots.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    row_number = Column(Integer, nullable=False, default=0)
    sheet_name = Column(String, nullable=True)

    original_code = Column(String, nullable=False, default="")
    normalized_code = Column(String, nullable=False, default="")
    covenin_code = Column(String, nullable=True)
    matched_master_code = Column(String, nullable=True, index=True)
    origin_source = Column(String, nullable=True)  # MAPREX_BASE, COVENIN_M, LULOWIN_R, UNCODED, etc.

    description = Column(Text, nullable=False, default="")
    master_description = Column(Text, nullable=True)
    description_similarity = Column(Float, nullable=False, default=0.0)

    unit = Column(String, nullable=False, default="")
    master_unit = Column(String, nullable=True)

    quantity = Column(Float, nullable=False, default=0.0)
    performance = Column(Float, nullable=False, default=1.0)
    master_performance = Column(Float, nullable=True)

    imported_unit_price = Column(Float, nullable=False, default=0.0)
    calculated_unit_price = Column(Float, nullable=False, default=0.0)
    master_unit_price = Column(Float, nullable=True)

    is_chapter = Column(Boolean, nullable=False, default=False)
    is_uncoded = Column(Boolean, nullable=False, default=False)
    suggested_equivalent_code = Column(String, nullable=True)
    suggested_equivalent_desc = Column(Text, nullable=True)
    suggested_equivalent_score = Column(Float, nullable=True)
    ai_audit_status = Column(String, nullable=True)  # CONFORME | OBSERVADO
    ai_audit_summary = Column(Text, nullable=True)

    snapshot = relationship("ReviewSnapshot", back_populates="items")
    components = relationship(
        "ReviewAPUComponent",
        back_populates="item",
        cascade="all, delete-orphan",
    )
    findings = relationship(
        "ReviewFinding",
        back_populates="item",
        cascade="all, delete-orphan",
    )


class ReviewAPUComponent(Base):
    """Insumo (Material, Equipo o Mano de Obra) del APU importado en el snapshot de revisión."""

    __tablename__ = "review_apu_components"

    id = Column(String, primary_key=True, default=generate_review_uuid)
    review_item_id = Column(
        String,
        ForeignKey("review_budget_items.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    component_type = Column(String, nullable=False)  # 'material' | 'equipment' | 'labor'
    code = Column(String, nullable=False, default="")
    resolved_master_code = Column(String, nullable=True)
    description = Column(Text, nullable=False, default="")
    unit = Column(String, nullable=False, default="")

    quantity = Column(Float, nullable=False, default=0.0)
    master_quantity = Column(Float, nullable=True)

    unit_price = Column(Float, nullable=False, default=0.0)
    master_unit_price = Column(Float, nullable=True)

    waste_or_deprec = Column(Float, nullable=False, default=0.0)
    master_waste_or_deprec = Column(Float, nullable=True)

    bonus = Column(Float, nullable=False, default=0.0)

    item = relationship("ReviewItem", back_populates="components")


class ReviewFinding(Base):
    """Hallazgo detectado por el motor de auditoría sobre una partida o componente APU."""

    __tablename__ = "review_findings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    snapshot_id = Column(
        String,
        ForeignKey("review_budget_snapshots.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    review_item_id = Column(
        String,
        ForeignKey("review_budget_items.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    rule_id = Column(String, nullable=False, index=True)
    category = Column(String, nullable=False, index=True)
    # Categorías: 'ESTRUCTURA', 'RENDIMIENTO', 'MATERIALES', 'EQUIPOS', 'MANO_OBRA', 'COHERENCIA', 'SIN_CODIGO'
    severity = Column(String, nullable=False, index=True)
    # Severidades: 'CRITICA', 'ALTA', 'MEDIA', 'INFO_MAPREX'

    item_code = Column(String, nullable=False, default="")
    component_code = Column(String, nullable=True)
    component_description = Column(Text, nullable=True)
    field_name = Column(String, nullable=False, default="")

    imported_value = Column(String, nullable=True)
    master_value = Column(String, nullable=True)
    diff_percent = Column(Float, nullable=True)

    message = Column(Text, nullable=False)
    suggestion = Column(Text, nullable=True)

    finding_status = Column(String, nullable=False, default="PENDIENTE")
    # Estados: 'PENDIENTE', 'CORREGIDO', 'JUSTIFICADO', 'RECHAZADO'
    auditor_comment = Column(Text, nullable=True)

    snapshot = relationship("ReviewSnapshot", back_populates="findings")
    item = relationship("ReviewItem", back_populates="findings")

    @property
    def covenin_code(self) -> Optional[str]:
        """Retorna el código COVENIN oficial asociado a la partida si existe."""
        if self.item and self.item.covenin_code:
            return self.item.covenin_code
        return None
