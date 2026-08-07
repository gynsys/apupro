from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class ConsultationAssetBase(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None

class ConsultationAssetCreate(ConsultationAssetBase):
    pass

class ConsultationAssetUpdate(ConsultationAssetBase):
    pass

class ConsultationAssetInDBBase(ConsultationAssetBase):
    id: int
    consultation_id: int
    file_path: str
    file_name: str
    file_type: str
    file_size_bytes: Optional[int] = None
    created_at: datetime

    class Config:
        orm_mode = True

class ConsultationAsset(ConsultationAssetInDBBase):
    pass
