from sqlalchemy import Column, String, Float, ForeignKey, Integer, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base import Base

class CostItem(Base):
    __tablename__ = "cost360_items"
    CodPar = Column(String, primary_key=True, index=True)
    Descri = Column(String)
    CovPar = Column(String)  # Codigo COVENIN
    UniPar = Column(String)
    PreUni = Column(Float)
    RenPar = Column(Float)
    Categoria = Column(String, index=True)
    TipoActividad = Column(String, index=True)
    
    # Campos tecnicos para busqueda IA / Motor V6
    disciplina = Column(String)
    diametro_pulg = Column(String)
    resistencia_fc = Column(Float)
    material = Column(String)
    preparacion = Column(String)
    desc_limpia = Column(String)
    
    apu_materials = relationship("CostAPUMaterial", back_populates="item")
    apu_labors = relationship("CostAPULabor", back_populates="item")
    apu_equipments = relationship("CostAPUEquipment", back_populates="item")

# Alias CostBase
CostbaseItem = CostItem

class CostMaterial(Base):
    __tablename__ = "cost360_materials"
    CodMat = Column(String, primary_key=True, index=True)
    ref_code = Column(String, index=True, nullable=True)
    Descri = Column(String)
    UniMat = Column(String)
    CosMat = Column(Float)
    
    # Automatizacion y Scraping
    family_id = Column(String, index=True)
    market_indicator_id = Column(String, index=True)
    market_factor = Column(Float, default=1.0)

CostbaseMaterial = CostMaterial

class CostLabor(Base):
    __tablename__ = "cost360_labor"
    CodMan = Column(String, primary_key=True, index=True)
    ref_code = Column(String, index=True, nullable=True)
    Descri = Column(String)
    Jornal = Column(Float)  # Salario base
    Bono = Column(Float)

CostbaseLabor = CostLabor

class CostEquipment(Base):
    __tablename__ = "cost360_equipment"
    CodEqu = Column(String, primary_key=True, index=True)
    ref_code = Column(String, index=True, nullable=True)
    Descri = Column(String)
    CosDia = Column(Float)
    precio = Column(Float, nullable=True)
    deprec_factor = Column(Float, default=1.0)

CostbaseEquipment = CostEquipment

class CostAPUMaterial(Base):
    __tablename__ = "cost360_apu_materials"
    CodPar = Column(String, ForeignKey("cost360_items.CodPar"), primary_key=True)
    CodIns = Column(String, ForeignKey("cost360_materials.CodMat"), primary_key=True)
    CanIns = Column(Float)
    Desper = Column(Float)
    
    item = relationship("CostItem", back_populates="apu_materials")
    material = relationship("CostMaterial")

CostbaseAPUMaterial = CostAPUMaterial

class CostAPULabor(Base):
    __tablename__ = "cost360_apu_labor"
    CodPar = Column(String, ForeignKey("cost360_items.CodPar"), primary_key=True)
    CodIns = Column(String, ForeignKey("cost360_labor.CodMan"), primary_key=True)
    CanIns = Column(Float)

    item = relationship("CostItem", back_populates="apu_labors")
    labor = relationship("CostLabor")

CostbaseAPULabor = CostAPULabor

class CostAPUEquipment(Base):
    __tablename__ = "cost360_apu_equipment"
    CodPar = Column(String, ForeignKey("cost360_items.CodPar"), primary_key=True)
    CodIns = Column(String, ForeignKey("cost360_equipment.CodEqu"), primary_key=True)
    CanIns = Column(Float)
    Deprec = Column(Float, default=1.0)

    item = relationship("CostItem", back_populates="apu_equipments")
    equipment = relationship("CostEquipment")

CostbaseAPUEquipment = CostAPUEquipment

class CustomCostItem(Base):
    __tablename__ = "cost360_custom_items"
    
    id = Column(String, primary_key=True, index=True)  # UUID
    user_id = Column(Integer, nullable=True)
    description = Column(String, nullable=False)
    unit = Column(String, nullable=False)
    performance = Column(Float, default=1.0)
    
    apu_data = Column(String)  # JSON encoded string
    created_at = Column(DateTime(timezone=True), server_default=func.now())

CustomCostbaseItem = CustomCostItem

class MaterialSynonym(Base):
    """Tabla de aprendizaje para Update desde PDFs. Asocia descripciones comerciales con codigos internos."""
    __tablename__ = "cost360_material_synonyms"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    provider_text = Column(String, unique=True, index=True)
    CodMat = Column(String, ForeignKey("cost360_materials.CodMat"))
    confidence = Column(Float, default=1.0)
