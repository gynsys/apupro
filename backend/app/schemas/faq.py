"""
FAQ schemas for validation and serialization.
"""
from typing import Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class FAQBase(BaseModel):
    question: str
    answer: str
    display_order: int = 0


class FAQCreate(FAQBase):
    pass


class FAQUpdate(BaseModel):
    question: Optional[str] = None
    answer: Optional[str] = None
    display_order: Optional[int] = None


class FAQInDB(FAQBase):
    id: int
    doctor_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class FAQPublic(FAQBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

