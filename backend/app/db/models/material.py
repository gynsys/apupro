from sqlalchemy import Column, Integer, String, Float
from app.db.arko_base import ArkoBase

class MaterialPrice(ArkoBase):
    __tablename__ = "material_prices"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String, index=True, unique=True, nullable=False)
    unidad = Column(String, nullable=False)
    precio_usd = Column(Float, nullable=False, default=0.0)
