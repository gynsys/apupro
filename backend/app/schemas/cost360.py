from pydantic import BaseModel
from typing import Dict, List, Optional
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

class MasterItemUpdate(BaseModel):
    Descri: Optional[str] = None
    UniPar: Optional[str] = None
    RenPar: Optional[float] = None

class APUComponentItem(BaseModel):
    id: Optional[str] = None
    codigo: Optional[str] = None
    descripcion: Optional[str] = None
    unidad: Optional[str] = None
    cantidad: float
    precio_unitario: Optional[float] = 0.0
    desperdicio: Optional[float] = 0.0
    depreciacion: Optional[float] = 1.0
    jornal: Optional[float] = 0.0
    bono: Optional[float] = 0.0

class MasterAPUUpdate(BaseModel):
    description: Optional[str] = None
    unit: Optional[str] = None
    performance: Optional[float] = None
    materials: Optional[List[APUComponentItem]] = None
    equipments: Optional[List[APUComponentItem]] = None
    labors: Optional[List[APUComponentItem]] = None


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

class ApuHistoryEntry(BaseModel):
    role: str
    content: str

class CustomApuExportRequest(BaseModel):
    item: Dict
    materials: List[Dict] = []
    equipments: List[Dict] = []
    labors: List[Dict] = []
    settings: Optional[Dict] = None

class MessageContext(BaseModel):
    role: str
    content: str

class AiApuGenerateRequest(BaseModel):
    description: str
    covenin_prefix: Optional[str] = None
    covenin_context: Optional[str] = None
    history: Optional[List[MessageContext]] = []
    only_preprocess: Optional[bool] = False
    # Smart Selector: partida base seleccionada por el usuario
    base_partida_code: Optional[str] = None
    smart_answers: Optional[Dict] = {}
    # Control interactivo de Match Exacto
    bypass_exact_match: Optional[bool] = False
    accept_exact_match_code: Optional[str] = None


class SmartSelectRequest(BaseModel):
    description: str
    covenin_prefix: str
    covenin_context: Optional[str] = None
    answers: Optional[Dict] = {}

class AiApuResponse(BaseModel):
    status: str = "completed"
    clarification_message: Optional[str] = None
    options: Optional[List[str]] = []
    questions: Optional[List[str]] = []
    
    partida: Optional[dict] = None
    materials: Optional[List[dict]] = []
    equipments: Optional[List[dict]] = []
    labors: Optional[List[dict]] = []
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
    owner_id: Optional[str] = None
    is_published: Optional[bool] = None
    published_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class Cost360DatabaseCreate(BaseModel):
    name: str
    description: Optional[str] = None
    material_inflation: Optional[float] = 0.0
    labor_inflation: Optional[float] = 0.0
    equipment_inflation: Optional[float] = 0.0
    source_database_id: Optional[str] = None  # Si no se especifica, usa 'master'

class Cost360DatabaseUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    is_published: Optional[bool] = None
    material_inflation: Optional[float] = None
    labor_inflation: Optional[float] = None
    equipment_inflation: Optional[float] = None
    notification_scope: Optional[str] = None  # 'quincenal' o 'mensual'

class Cost360DatabaseResponse(Cost360DatabaseBase):
    pass

class Cost360DatabaseListResponse(BaseModel):
    databases: List[Cost360DatabaseBase]
