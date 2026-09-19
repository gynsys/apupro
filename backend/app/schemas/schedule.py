from typing import List, Optional
from datetime import date, datetime
from pydantic import BaseModel, Field, field_validator, ConfigDict


class DependencyBase(BaseModel):
    predecessor_id: str = Field(..., description="ID de la actividad predecesora")
    successor_id: str = Field(..., description="ID de la actividad sucesora")
    type: str = Field("FS", description="Tipo de relación: FS, SS, FF, SF")
    lag: float = Field(0.0, description="Desfase en días (positivo o negativo)")

    @field_validator("type")
    @classmethod
    def validate_type(cls, v: str) -> str:
        upper = v.strip().upper()
        if upper not in ("FS", "SS", "FF", "SF"):
            raise ValueError("El tipo de dependencia debe ser FS, SS, FF o SF.")
        return upper


class DependencyCreate(DependencyBase):
    pass


class DependencyOut(DependencyBase):
    id: str
    schedule_id: str

    model_config = ConfigDict(from_attributes=True)


class ActivityBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=500, description="Nombre de la actividad")
    code: Optional[str] = Field(None, description="Código WBS / EDT")
    duration: float = Field(1.0, ge=0.0, description="Duración en días hábiles")
    quantity: Optional[float] = Field(None, ge=0.0, description="Cantidad de obra")
    rendimiento: Optional[float] = Field(None, gt=0.0, description="Rendimiento del APU")
    cuadrillas: float = Field(1.0, gt=0.0, description="Número de cuadrillas asignadas")
    color: Optional[str] = Field(None, description="Color hexadecimal para la barra de Gantt")
    order: int = Field(0, description="Orden de presentación")


class ActivityCreate(ActivityBase):
    budget_item_id: Optional[str] = None


class ActivityUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    duration: Optional[float] = Field(None, ge=0.0)
    quantity: Optional[float] = Field(None, ge=0.0)
    rendimiento: Optional[float] = Field(None, gt=0.0)
    cuadrillas: Optional[float] = Field(None, gt=0.0)
    color: Optional[str] = None
    order: Optional[int] = None


class ActivityOut(ActivityBase):
    id: str
    schedule_id: str
    budget_item_id: Optional[str] = None

    # Resultados calculados por CPM
    early_start: float = 0.0
    early_finish: float = 0.0
    late_start: float = 0.0
    late_finish: float = 0.0
    total_float: float = 0.0
    free_float: float = 0.0
    is_critical: bool = False

    calendar_start: Optional[date] = None
    calendar_end: Optional[date] = None

    model_config = ConfigDict(from_attributes=True)


class ScheduleBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    start_date: date = Field(default_factory=date.today)
    work_days_per_week: int = Field(5, description="5 para L-V, 6 para L-S")

    @field_validator("work_days_per_week")
    @classmethod
    def validate_work_days(cls, v: int) -> int:
        if v not in (5, 6):
            raise ValueError("work_days_per_week debe ser 5 (Lunes a Viernes) o 6 (Lunes a Sábado).")
        return v


class ScheduleCreate(ScheduleBase):
    budget_id: Optional[str] = None


class ScheduleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    start_date: Optional[date] = None
    work_days_per_week: Optional[int] = None

    @field_validator("work_days_per_week")
    @classmethod
    def validate_work_days(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and v not in (5, 6):
            raise ValueError("work_days_per_week debe ser 5 o 6.")
        return v


class ScheduleOut(ScheduleBase):
    id: str
    budget_id: Optional[str] = None
    user_id: str
    total_duration: float = 0.0
    end_date: Optional[date] = None
    created_at: datetime
    updated_at: datetime
    activities: List[ActivityOut] = []
    dependencies: List[DependencyOut] = []

    model_config = ConfigDict(from_attributes=True)


class ScheduleCalculateResponse(BaseModel):
    total_duration: float
    critical_path: List[str]
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    activities: List[ActivityOut]


class ImportItemsRequest(BaseModel):
    round_up: bool = True
    default_cuadrillas: float = 1.0
