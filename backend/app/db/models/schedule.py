from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Date, Boolean, Text
from sqlalchemy.orm import relationship
from datetime import datetime, date
import uuid
from app.db.base import Base


def generate_uuid() -> str:
    return str(uuid.uuid4())


class ScheduleProject(Base):
    __tablename__ = "schedules"

    id = Column(String, primary_key=True, default=generate_uuid)
    budget_id = Column(String, ForeignKey("budgets.id", ondelete="CASCADE"), nullable=True, index=True)
    user_id = Column(String, nullable=False, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)

    # Configuración de jornada
    start_date = Column(Date, default=date.today, nullable=False)
    work_days_per_week = Column(Integer, default=5, nullable=False)  # 5 (L-V) o 6 (L-S)

    # Métricas calculadas por CPM
    total_duration = Column(Float, default=0.0)
    end_date = Column(Date, nullable=True)

    # Auditoría
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relaciones
    budget = relationship("Budget")
    activities = relationship(
        "ScheduleActivity",
        back_populates="schedule",
        cascade="all, delete-orphan",
        order_by="ScheduleActivity.order"
    )
    dependencies = relationship(
        "ScheduleDependency",
        back_populates="schedule",
        cascade="all, delete-orphan"
    )


class ScheduleActivity(Base):
    __tablename__ = "schedule_activities"

    id = Column(String, primary_key=True, default=generate_uuid)
    schedule_id = Column(String, ForeignKey("schedules.id", ondelete="CASCADE"), nullable=False, index=True)
    budget_item_id = Column(String, ForeignKey("budget_items.id", ondelete="SET NULL"), nullable=True, index=True)

    # Identificación y estructura de desglose (EDT / WBS)
    code = Column(String, nullable=True)  # Ej: 1.01, ACT-01
    name = Column(String, nullable=False)
    order = Column(Integer, default=0, nullable=False)
    color = Column(String, nullable=True)

    # Parámetros de duración y APU
    quantity = Column(Float, nullable=True)
    rendimiento = Column(Float, nullable=True)
    cuadrillas = Column(Float, default=1.0)
    duration = Column(Float, default=1.0, nullable=False)  # En días hábiles

    # Resultados calculados por CPM
    early_start = Column(Float, default=0.0)
    early_finish = Column(Float, default=0.0)
    late_start = Column(Float, default=0.0)
    late_finish = Column(Float, default=0.0)
    total_float = Column(Float, default=0.0)
    free_float = Column(Float, default=0.0)
    is_critical = Column(Boolean, default=False)

    # Fechas calendario
    calendar_start = Column(Date, nullable=True)
    calendar_end = Column(Date, nullable=True)

    # Relaciones
    schedule = relationship("ScheduleProject", back_populates="activities")
    budget_item = relationship("BudgetItem")

    predecessors = relationship(
        "ScheduleDependency",
        foreign_keys="[ScheduleDependency.successor_id]",
        back_populates="successor",
        cascade="all, delete-orphan"
    )
    successors = relationship(
        "ScheduleDependency",
        foreign_keys="[ScheduleDependency.predecessor_id]",
        back_populates="predecessor",
        cascade="all, delete-orphan"
    )


class ScheduleDependency(Base):
    __tablename__ = "schedule_dependencies"

    id = Column(String, primary_key=True, default=generate_uuid)
    schedule_id = Column(String, ForeignKey("schedules.id", ondelete="CASCADE"), nullable=False, index=True)
    predecessor_id = Column(String, ForeignKey("schedule_activities.id", ondelete="CASCADE"), nullable=False, index=True)
    successor_id = Column(String, ForeignKey("schedule_activities.id", ondelete="CASCADE"), nullable=False, index=True)

    type = Column(String(10), default="FS", nullable=False)  # FS, SS, FF, SF
    lag = Column(Float, default=0.0, nullable=False)  # Desfase en días

    schedule = relationship("ScheduleProject", back_populates="dependencies")
    predecessor = relationship("ScheduleActivity", foreign_keys=[predecessor_id], back_populates="successors")
    successor = relationship("ScheduleActivity", foreign_keys=[successor_id], back_populates="predecessors")
