from sqlalchemy import Column, String, Float, ForeignKey, Integer, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base import Base

class CostMaterialFamily(Base):
    __tablename__ = "cost360_material_families"
    
    id = Column(String, primary_key=True, index=True) # UUID o código corto ej. 'FAM-ACERO'
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class CostMarketIndicator(Base):
    __tablename__ = "cost360_market_indicators"
    
    id = Column(String, primary_key=True, index=True) # UUID o código ej. 'IND-CEM-POR'
    name = Column(String, nullable=False) # ej. "Saco de Cemento Portland"
    commercial_unit = Column(String, nullable=False) # ej. "saco 42.5kg"
    current_price = Column(Float, default=0.0)
    family_id = Column(String, ForeignKey("cost360_material_families.id"), nullable=True)
    last_updated = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    family = relationship("CostMaterialFamily")
