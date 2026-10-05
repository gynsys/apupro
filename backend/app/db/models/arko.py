from sqlalchemy import Column, Integer, String, DateTime, Boolean
from sqlalchemy.dialects.postgresql import JSONB
from datetime import datetime
from app.db.arko_base import ArkoBase

class ArkoAdmin(ArkoBase):
    __tablename__ = "arko_admins"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    username = Column(String(100), unique=True, index=True, nullable=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)
    is_email_verified = Column(Boolean, default=False)
    verification_code = Column(String(10), nullable=True)
    site_config = Column(JSONB, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Campos de plan y límites
    plan = Column(String(50), default='free')  # 'free', 'basic', 'pro', 'enterprise'
    max_budgets = Column(Integer, default=1)  # Límite de presupuestos según plan
    max_items_per_budget = Column(Integer, default=2)  # Límite de partidas por presupuesto
    has_ai_access = Column(Boolean, default=False)  # Acceso a generador APU con IA
    plan_started_at = Column(DateTime, nullable=True)  # Fecha de inicio del plan
    plan_expires_at = Column(DateTime, nullable=True)  # Fecha de expiración del plan
    max_ai_apus = Column(Integer, default=0)
    ai_apus_generated = Column(Integer, default=0)

    # Configuración de costos por usuario (fallback a site_config.costos si es null)
    costos_config = Column(JSONB, nullable=True)
