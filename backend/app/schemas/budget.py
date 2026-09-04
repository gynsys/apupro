from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

# ================================
# APU Components (Budget specific)
# ================================

class BudgetAPUComponentBase(BaseModel):
    codigo: str
    descripcion: str
    cantidad: float

class BudgetAPUMaterialBase(BudgetAPUComponentBase):
    unidad: str
    precio_unitario: float
    desperdicio: Optional[float] = 0.0

class BudgetAPUEquipmentBase(BudgetAPUComponentBase):
    unidad: str
    precio_unitario: float
    depreciacion: Optional[float] = 1.0

class BudgetAPULaborBase(BudgetAPUComponentBase):
    jornal: float
    bono: float

class BudgetAPUComponentUpdate(BaseModel):
    codigo: Optional[str] = None
    descripcion: Optional[str] = None
    cantidad: Optional[float] = None

class BudgetAPUMaterialUpdate(BudgetAPUComponentUpdate):
    unidad: Optional[str] = None
    precio_unitario: Optional[float] = None
    desperdicio: Optional[float] = None

class BudgetAPUEquipmentUpdate(BudgetAPUComponentUpdate):
    unidad: Optional[str] = None
    precio_unitario: Optional[float] = None
    depreciacion: Optional[float] = None

class BudgetAPULaborUpdate(BudgetAPUComponentUpdate):
    jornal: Optional[float] = None
    bono: Optional[float] = None

# Responses
class BudgetAPUMaterial(BudgetAPUMaterialBase):
    id: str
    budget_item_id: str
    class Config:
        from_attributes = True

class BudgetAPUEquipment(BudgetAPUEquipmentBase):
    id: str
    budget_item_id: str
    class Config:
        from_attributes = True

class BudgetAPULabor(BudgetAPULaborBase):
    id: str
    budget_item_id: str
    class Config:
        from_attributes = True


# ================================
# Budget Items
# ================================

class BudgetItemBase(BaseModel):
    cod_par: str
    cov_par: Optional[str] = None
    description: str
    unit: str
    quantity: float = 0.0
    performance: float = 1.0
    order: int = 0
    is_chapter: bool = False

class BudgetItemCreate(BudgetItemBase):
    materials: Optional[List[BudgetAPUMaterialBase]] = None
    equipments: Optional[List[BudgetAPUEquipmentBase]] = None
    labors: Optional[List[BudgetAPULaborBase]] = None

class BudgetItemUpdate(BaseModel):
    cov_par: Optional[str] = None
    description: Optional[str] = None
    quantity: Optional[float] = None
    performance: Optional[float] = None
    order: Optional[int] = None
    is_chapter: Optional[bool] = None

class BudgetItem(BudgetItemBase):
    id: str
    budget_id: str
    materials: List[BudgetAPUMaterial] = []
    equipments: List[BudgetAPUEquipment] = []
    labors: List[BudgetAPULabor] = []
    class Config:
        from_attributes = True


# ================================
# Budgets
# ================================

class BudgetBase(BaseModel):
    name: str
    description: Optional[str] = None
    notes: Optional[str] = None
    company_name: Optional[str] = None
    company_rif: Optional[str] = None
    project_name: Optional[str] = None
    client_name: Optional[str] = None
    currency: str = "USD"
    exchange_rate: float = 1.0
    fcas_percent: float = 417.0
    admin_percent: float = 15.0
    profit_percent: float = 10.0
    iva_percent: float = 16.0
    labor_bonus: float = 0.0
    material_inflation: float = 0.0
    labor_inflation: float = 0.0
    equipment_inflation: float = 0.0

class BudgetCreate(BudgetBase):
    pass

class BudgetUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    notes: Optional[str] = None
    company_name: Optional[str] = None
    company_rif: Optional[str] = None
    project_name: Optional[str] = None
    client_name: Optional[str] = None
    currency: Optional[str] = "USD"
    exchange_rate: Optional[float] = 1.0
    fcas_percent: Optional[float] = 417.0
    admin_percent: Optional[float] = 15.0
    profit_percent: Optional[float] = 10.0
    iva_percent: Optional[float] = 16.0
    labor_bonus: Optional[float] = 0.0
    material_inflation: Optional[float] = None
    labor_inflation: Optional[float] = None
    equipment_inflation: Optional[float] = None

class Budget(BudgetBase):
    id: str
    created_at: datetime
    updated_at: datetime
    items: List[BudgetItem] = []
    class Config:
        from_attributes = True

class BudgetSummary(BudgetBase):
    id: str
    created_at: datetime
    updated_at: datetime
    class Config:
        from_attributes = True
