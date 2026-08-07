from typing import List, Optional, Any
from pydantic import BaseModel

class PreconsultationQuestionBase(BaseModel):
    text: str
    type: str
    category: str
    required: bool = False
    options: Optional[List[str]] = []
    order: int = 0
    is_active: bool = True

class PreconsultationQuestionCreate(PreconsultationQuestionBase):
    id: str

class PreconsultationQuestionUpdate(PreconsultationQuestionBase):
    text: Optional[str] = None
    type: Optional[str] = None
    category: Optional[str] = None
    required: Optional[bool] = None
    options: Optional[List[str]] = None
    order: Optional[int] = None
    is_active: Optional[bool] = None

class PreconsultationQuestion(PreconsultationQuestionBase):
    id: str

    class Config:
        from_attributes = True
