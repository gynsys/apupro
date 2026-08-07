from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class CostItemBase(BaseModel):
    CodPar: str
    Descri: Optional[str] = None
    CovPar: Optional[str] = None  # Codigo COVENIN
    UniPar: Optional[str] = None
    PreUni: Optional[float] = None
    RenPar: Optional[float] = None

    class Config:
        from_attributes = True

class CostItemListResponse(BaseModel):
    total: int
    items: List[CostItemBase]

class CostMaterialSchema(BaseModel):
    CodMat: str
    Descri: Optional[str] = None
    UniMat: Optional[str] = None
    CosMat: Optional[float] = None
    class Config: from_attributes = True

class CostEquipmentSchema(BaseModel):
    CodEqu: str
    Descri: Optional[str] = None
    CosDia: Optional[float] = None
    class Config: from_attributes = True

class CostLaborSchema(BaseModel):
    CodMan: str
    Descri: Optional[str] = None
    Jornal: Optional[float] = None
    Bono: Optional[float] = None
    class Config: from_attributes = True

class APUComponent(BaseModel):
    codigo: str
    descripcion: str
    unidad: str
    cantidad: float
    precio_unitario: float
    subtotal: float
    desperdicio: Optional[float] = None
    depreciacion: Optional[float] = None
    jornal: Optional[float] = None
    bono: Optional[float] = None
    tot_jornal: Optional[float] = None
    tot_bono: Optional[float] = None
    
    # AI Engine Fields
    origen: Optional[str] = None
    nota_calculo: Optional[str] = None

class APUResponse(BaseModel):
    partida: CostItemBase
    materiales: List[APUComponent]
    equipos: List[APUComponent]
    mano_obra: List[APUComponent]
    total_directo: float

class CostMaterialUpdate(BaseModel):
    CosMat: Optional[float] = None
    Descri: Optional[str] = None

class CostEquipmentUpdate(BaseModel):
    CosDia: Optional[float] = None
    Descri: Optional[str] = None

class CostLaborUpdate(BaseModel):
    Jornal: Optional[float] = None
    Bono: Optional[float] = None
    Descri: Optional[str] = None

class CustomCostItemCreate(BaseModel):
    description: str
    unit: str
    performance: float
    apu_data: str  # JSON encoded string of the APU details

class CustomCostItemResponse(BaseModel):
    id: str
    user_id: Optional[int]
    description: str
    unit: str
    performance: float
    apu_data: str
    created_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class AiApuGenerateRequest(BaseModel):
    description: str
    categoria: Optional[str] = None
    tipo_actividad: Optional[str] = None

class AiApuResponse(BaseModel):
    partida: dict
    materials: List[dict]
    equipments: List[dict]
    labors: List[dict]
    advertencias: Optional[List[str]] = []

# Database Management Schemas
class Cost360DatabaseBase(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    is_master: bool
    is_active: bool
    material_inflation: float
    labor_inflation: float
    equipment_inflation: float
    source_database_id: Optional[str] = None
    created_at: Optional[datetime] = None
    created_by: Optional[str] = None
    
    class Config:
        from_attributes = True

class Cost360DatabaseCreate(BaseModel):
    name: str
    description: Optional[str] = None
    material_inflation: float = 0.0
    labor_inflation: float = 0.0
    equipment_inflation: float = 0.0
    source_database_id: Optional[str] = None  # Si no se especifica, usa 'master'

class Cost360DatabaseUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None

class Cost360DatabaseResponse(Cost360DatabaseBase):
    pass

class Cost360DatabaseListResponse(BaseModel):
    databases: List[Cost360DatabaseBase]
