from sqlalchemy import Column, String, Float, Integer, DateTime, Boolean
from sqlalchemy.sql import func
from app.db.base import Base

class Cost360Database(Base):
    """
    Modelo para gestionar múltiples bases de datos de Cost360.
    Permite duplicar bases de datos con índices de inflación y eliminar bases personalizadas.
    """
    __tablename__ = "cost360_databases"
    
    id = Column(String, primary_key=True, index=True)  # Ej: 'master', 'personalizada', 'julio_2024'
    name = Column(String, nullable=False)  # Nombre legible: 'Base Maestra', 'Base Personalizada'
    description = Column(String, nullable=True)  # Descripción opcional
    is_master = Column(Boolean, default=False)  # True para la base maestra (no se puede eliminar)
    is_active = Column(Boolean, default=True)  # Para desactivar sin eliminar
    
    # Índices de inflación aplicados al crear esta base (si fue duplicada)
    material_inflation = Column(Float, default=0.0)  # % inflación materiales
    labor_inflation = Column(Float, default=0.0)  # % inflación mano de obra
    equipment_inflation = Column(Float, default=0.0)  # % inflación equipos
    
    # Metadatos
    source_database_id = Column(String, nullable=True)  # ID de la base de datos origen (si fue duplicada)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    created_by = Column(String, nullable=True)  # Usuario que creó la base (opcional)
    
    def __repr__(self):
        return f"<Cost360Database(id={self.id}, name={self.name}, is_master={self.is_master})>"
