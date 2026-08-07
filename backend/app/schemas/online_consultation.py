"""
Pydantic schemas for Online Consultation Settings.
"""
from typing import List, Dict, Optional
from pydantic import BaseModel, Field


class OnlineConsultationSettingsBase(BaseModel):
    """Base schema for online consultation settings."""
    first_consultation_price: float = Field(default=50.0, ge=0, description="Price for first consultation in specified currency")
    followup_price: float = Field(default=40.0, ge=0, description="Price for follow-up consultations")
    currency: str = Field(default="USD", max_length=10, description="Currency code (USD, EUR, etc.)")
    payment_methods: List[str] = Field(default=["zelle", "paypal", "bank_transfer"], description="Available payment methods")
    available_hours: Dict = Field(
        default={"start": "09:00", "end": "17:00", "days": [1, 2, 3, 4, 5]},
        description="Available hours and days for online consultations. Days: 0=Sunday, 1=Monday, ..., 6=Saturday"
    )
    session_duration_minutes: int = Field(default=45, ge=15, le=180, description="Duration of online consultation in minutes")
    is_active: bool = Field(default=True, description="Whether online consultations are enabled")
    video_url: Optional[str] = Field(None, description="URL for marketing video")


class OnlineConsultationSettingsCreate(OnlineConsultationSettingsBase):
    """Schema for creating online consultation settings."""
    pass


class OnlineConsultationSettingsUpdate(BaseModel):
    """Schema for updating online consultation settings (all fields optional)."""
    first_consultation_price: Optional[float] = Field(None, ge=0)
    followup_price: Optional[float] = Field(None, ge=0)
    currency: Optional[str] = Field(None, max_length=10)
    payment_methods: Optional[List[str]] = None
    available_hours: Optional[Dict] = None
    session_duration_minutes: Optional[int] = Field(None, ge=15, le=180)
    is_active: Optional[bool] = None
    video_url: Optional[str] = None


class OnlineConsultationSettings(OnlineConsultationSettingsBase):
    """Schema for reading online consultation settings."""
    id: int
    doctor_id: int

    class Config:
        from_attributes = True
