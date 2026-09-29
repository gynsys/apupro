from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class StrategicAllyBase(BaseModel):
    name: str
    logo_url: Optional[str] = None
    website_url: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    is_active: bool = True
    order: int = 0


class StrategicAllyCreate(StrategicAllyBase):
    pass


class StrategicAllyUpdate(BaseModel):
    name: Optional[str] = None
    logo_url: Optional[str] = None
    website_url: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    order: Optional[int] = None


class StrategicAllyResponse(StrategicAllyBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
