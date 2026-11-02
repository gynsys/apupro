"""Modelos SQLAlchemy del control de obra.

Las tablas se crean con Base.metadata.create_all al iniciar la aplicación.
No alteran las tablas existentes del presupuesto.
"""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, Date, DateTime, Float, ForeignKey, String, Text
from sqlalchemy.orm import relationship

from app.db.base import Base


def _uuid() -> str:
    return str(uuid.uuid4())


class ControlObraModification(Base):
    __tablename__ = "control_obra_modifications"

    id = Column(String, primary_key=True, default=_uuid)
    budget_id = Column(String, ForeignKey("budgets.id", ondelete="CASCADE"), nullable=False, index=True)
    kind = Column(String(30), nullable=False)  # increase | decrease | extra_work
    code = Column(String(80), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String(20), nullable=False, default="draft")  # draft | review | approved | rejected
    requested_at = Column(DateTime, default=datetime.utcnow)
    approved_at = Column(DateTime, nullable=True)
    created_by = Column(String(80), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    lines = relationship(
        "ControlObraModificationItem",
        back_populates="modification",
        cascade="all, delete-orphan",
    )


class ControlObraModificationItem(Base):
    __tablename__ = "control_obra_modification_items"

    id = Column(String, primary_key=True, default=_uuid)
    modification_id = Column(
        String,
        ForeignKey("control_obra_modifications.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    budget_item_id = Column(String, ForeignKey("budget_items.id", ondelete="SET NULL"), nullable=True, index=True)
    code = Column(String(80), nullable=True)
    description = Column(Text, nullable=True)
    unit = Column(String(20), nullable=True)
    quantity_delta = Column(Float, nullable=False, default=0.0)
    unit_price = Column(Float, nullable=False, default=0.0)
    is_new_item = Column(Boolean, nullable=False, default=False)
    modification = relationship("ControlObraModification", back_populates="lines")


class ControlObraAddendum(Base):
    __tablename__ = "control_obra_addenda"

    id = Column(String, primary_key=True, default=_uuid)
    budget_id = Column(String, ForeignKey("budgets.id", ondelete="CASCADE"), nullable=False, index=True)
    code = Column(String(80), nullable=False)
    description = Column(Text, nullable=True)
    amount = Column(Float, nullable=False, default=0.0)
    status = Column(String(20), nullable=False, default="draft")  # draft | review | approved | rejected
    approved_at = Column(DateTime, nullable=True)
    created_by = Column(String(80), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class ControlObraProgressEntry(Base):
    __tablename__ = "control_obra_progress_entries"

    id = Column(String, primary_key=True, default=_uuid)
    budget_id = Column(String, ForeignKey("budgets.id", ondelete="CASCADE"), nullable=False, index=True)
    budget_item_id = Column(String, ForeignKey("budget_items.id", ondelete="CASCADE"), nullable=False, index=True)
    entry_date = Column(Date, nullable=False)
    quantity = Column(Float, nullable=False, default=0.0)
    notes = Column(Text, nullable=True)
    entry_type = Column(String(20), nullable=False, default="execution")  # execution | adjustment | reversal
    created_by = Column(String(80), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class ControlObraPeriod(Base):
    __tablename__ = "control_obra_periods"

    id = Column(String, primary_key=True, default=_uuid)
    budget_id = Column(String, ForeignKey("budgets.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(120), nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    status = Column(String(20), nullable=False, default="open")  # open | closed | reopened
    closed_at = Column(DateTime, nullable=True)
    closed_by = Column(String(80), nullable=True)
    reopened_at = Column(DateTime, nullable=True)
    reopened_by = Column(String(80), nullable=True)
    reopen_reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class ControlObraPlan(Base):
    __tablename__ = "control_obra_plans"

    id = Column(String, primary_key=True, default=_uuid)
    budget_id = Column(String, ForeignKey("budgets.id", ondelete="CASCADE"), nullable=False, index=True)
    budget_item_id = Column(String, ForeignKey("budget_items.id", ondelete="CASCADE"), nullable=False, index=True)
    planned_start = Column(Date, nullable=False)
    planned_end = Column(Date, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class ControlObraAudit(Base):
    __tablename__ = "control_obra_audit"

    id = Column(String, primary_key=True, default=_uuid)
    budget_id = Column(String, ForeignKey("budgets.id", ondelete="CASCADE"), nullable=False, index=True)
    entity_type = Column(String(40), nullable=False)
    entity_id = Column(String(80), nullable=True)
    action = Column(String(50), nullable=False)
    reason = Column(Text, nullable=True)
    user_id = Column(String(80), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
