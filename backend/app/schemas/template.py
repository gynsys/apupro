from typing import List, Optional, Any, Dict
from pydantic import BaseModel
from datetime import datetime

class TemplateBase(BaseModel):
    name: str
    description: Optional[str] = None
    questions: List[Dict[str, Any]]
    is_active: Optional[bool] = True

class TemplateCreate(TemplateBase):
    pass

class TemplateUpdate(TemplateBase):
    name: Optional[str] = None
    questions: Optional[List[Dict[str, Any]]] = None

class Template(TemplateBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
