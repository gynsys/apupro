from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Boolean, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.base import Base
import uuid

def generate_uuid():
    return str(uuid.uuid4())

class Budget(Base):
    __tablename__ = "budgets"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    client_name = Column(String, nullable=True)
    
    # Datos Generales del Presupuesto
    currency = Column(String, default="USD") # USD o BS
    exchange_rate = Column(Float, default=1.0) # Tasa de cambio (e.g. 36.5)
    fcas_percent = Column(Float, default=417.0) # FCAS global del presupuesto
    admin_percent = Column(Float, default=15.0) # % de Administración
    profit_percent = Column(Float, default=10.0) # % de Utilidad e Imprevistos
    iva_percent = Column(Float, default=16.0) # % de I.V.A.
    labor_bonus = Column(Float, default=0.0) # Bono global para mano de obra
    
    # Índices de Inflación
    material_inflation = Column(Float, default=0.0)
    labor_inflation = Column(Float, default=0.0)
    equipment_inflation = Column(Float, default=0.0)
    
    # Datos de la Empresa y Obra
    company_name = Column(String, nullable=True)
    company_rif = Column(String, nullable=True)
    company_logo = Column(String, nullable=True) # URL o ruta del logo de la empresa
    project_name = Column(Text, nullable=True)
    
    # Fechas
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    items = relationship("BudgetItem", back_populates="budget", cascade="all, delete-orphan", order_by="BudgetItem.order")


class BudgetItem(Base):
    __tablename__ = "budget_items"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    budget_id = Column(String, ForeignKey("budgets.id", ondelete="CASCADE"), nullable=False)
    
    # Referencia a la base maestra Cost360
    cod_par = Column(String, nullable=False) # Codigo original (e.g. E0101)
    cov_par = Column(String, nullable=True) # Codigo COVENIN
    
    # Datos específicos del item en este presupuesto
    description = Column(Text, nullable=False)
    unit = Column(String, nullable=False)
    quantity = Column(Float, default=0.0)
    performance = Column(Float, default=1.0) # Rendimiento (Rend)
    
    # Orden y Estructura
    order = Column(Integer, default=0, nullable=False)
    is_chapter = Column(Boolean, default=False, nullable=False)
    
    budget = relationship("Budget", back_populates="items")
    
    materials = relationship("BudgetAPUMaterial", back_populates="item", cascade="all, delete-orphan")
    equipments = relationship("BudgetAPUEquipment", back_populates="item", cascade="all, delete-orphan")
    labors = relationship("BudgetAPULabor", back_populates="item", cascade="all, delete-orphan")


class BudgetAPUMaterial(Base):
    __tablename__ = "budget_apu_materials"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    budget_item_id = Column(String, ForeignKey("budget_items.id", ondelete="CASCADE"), nullable=False)
    
    codigo = Column(String, nullable=False)
    descripcion = Column(Text, nullable=False)
    unidad = Column(String, nullable=False)
    precio_unitario = Column(Float, nullable=False) # Copiado en el momento, pero puede ser override
    cantidad = Column(Float, nullable=False) # Cantidad de insumo por unidad de partida
    desperdicio = Column(Float, default=0.0) # Porcentaje de desperdicio
    
    item = relationship("BudgetItem", back_populates="materials")


class BudgetAPUEquipment(Base):
    __tablename__ = "budget_apu_equipments"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    budget_item_id = Column(String, ForeignKey("budget_items.id", ondelete="CASCADE"), nullable=False)
    
    codigo = Column(String, nullable=False)
    descripcion = Column(Text, nullable=False)
    unidad = Column(String, nullable=False) # Ej: Día, Hr
    precio_unitario = Column(Float, nullable=False) # Tarifa
    cantidad = Column(Float, nullable=False)
    depreciacion = Column(Float, default=1.0) # Coeficiente COP/Dep/Al
    
    item = relationship("BudgetItem", back_populates="equipments")


class BudgetAPULabor(Base):
    __tablename__ = "budget_apu_labors"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    budget_item_id = Column(String, ForeignKey("budget_items.id", ondelete="CASCADE"), nullable=False)
    
    codigo = Column(String, nullable=False)
    descripcion = Column(Text, nullable=False)
    cantidad = Column(Float, nullable=False)
    jornal = Column(Float, nullable=False)
    bono = Column(Float, nullable=False)
    
    item = relationship("BudgetItem", back_populates="labors")
