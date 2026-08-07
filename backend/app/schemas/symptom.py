"""
Pydantic schemas for symptom tracking in cycle predictor.
"""
from pydantic import BaseModel, Field, field_validator
from datetime import date
from typing import Optional, List
from enum import Enum


class FlowIntensity(str, Enum):
    """Flow intensity levels"""
    light = "light"
    medium = "medium"
    heavy = "heavy"


class Mood(str, Enum):
    """Mood options"""
    happy = "happy"
    sad = "sad"
    anxious = "anxious"
    irritable = "irritable"
    calm = "calm"


class SymptomBase(BaseModel):
    """Base symptom schema"""
    date: date = Field(..., description="Date of symptom log")
    flow_intensity: Optional[FlowIntensity] = Field(None, description="Flow intensity")
    pain_level: Optional[int] = Field(None, ge=0, le=10, description="Pain level 0-10")
    mood: Optional[Mood] = Field(None, description="Mood")
    symptoms: Optional[List[str]] = Field(default=[], description="List of symptoms")
    notes: Optional[str] = Field(None, max_length=500, description="Additional notes")

    @field_validator('symptoms')
    @classmethod
    def validate_symptoms(cls, v):
        """Ensure symptoms is a list"""
        if v is None:
            return []
        return v


class SymptomCreate(SymptomBase):
    """Schema for creating a symptom log"""
    pass


class SymptomUpdate(BaseModel):
    """Schema for updating a symptom log - all fields optional"""
    date: Optional[date] = None
    flow_intensity: Optional[FlowIntensity] = None
    pain_level: Optional[int] = Field(None, ge=0, le=10)
    mood: Optional[Mood] = None
    symptoms: Optional[List[str]] = None
    notes: Optional[str] = Field(None, max_length=500)


class SymptomResponse(SymptomBase):
    """Schema for symptom response"""
    id: int
    cycle_user_id: int
    doctor_id: int

    class Config:
        from_attributes = True
