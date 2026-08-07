from pydantic import BaseModel

class MaterialPriceBase(BaseModel):
    nombre: str
    unidad: str
    precio_usd: float

class MaterialPriceCreate(MaterialPriceBase):
    pass

class MaterialPriceUpdate(MaterialPriceBase):
    pass

class MaterialPriceResponse(MaterialPriceBase):
    id: int

    class Config:
        from_attributes = True
