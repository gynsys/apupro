from sqlalchemy import Column, String, Float, Integer, DateTime, Boolean
from sqlalchemy.sql import func
from app.db.base import Base

class Cost360Database(Base):
    """
    Modelo para gestionar multiples bases de datos en CostBase.
    Permite duplicar bases de datos con indices de inflacion y eliminar bases personalizadas.
    """
    __tablename__ = "cost360_databases"
    
    id = Column(String, primary_key=True, index=True)  # Ej: 'master', 'personalizada'
    name = Column(String, nullable=False)  # Nombre legible: 'Base Maestra', 'Base Personalizada'
    description = Column(String, nullable=True)
    is_master = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    
    # Indices de inflacion aplicados al crear esta base (si fue duplicada)
    material_inflation = Column(Float, default=0.0)
    labor_inflation = Column(Float, default=0.0)
    equipment_inflation = Column(Float, default=0.0)
    
    # Metadatos
    source_database_id = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    created_by = Column(String, nullable=True)
    
    # Independencia de Usuarios y Versionamiento
    owner_id = Column(String, nullable=True, index=True)
    is_published = Column(Boolean, default=False)
    published_at = Column(DateTime(timezone=True), nullable=True)
    
    def __repr__(self):
        return f"<CostbaseDatabase(id={self.id}, name={self.name}, is_master={self.is_master}, owner={self.owner_id})>"

CostbaseDatabase = Cost360Database
