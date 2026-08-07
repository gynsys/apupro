"""
Pydantic schemas for Testimonial entity.
"""
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime


class TestimonialBase(BaseModel):
    """Base schema with common testimonial fields."""
    patient_name: str
    patient_email: Optional[EmailStr] = None
    photo_url: Optional[str] = None
    content: str
    rating: Optional[int] = None  # 1-5


class TestimonialCreate(TestimonialBase):
    """Schema for creating a new testimonial."""
    doctor_id: int


class TestimonialUpdate(BaseModel):
    """Schema for updating testimonial information."""
    patient_name: Optional[str] = None
    patient_email: Optional[EmailStr] = None
    photo_url: Optional[str] = None
    content: Optional[str] = None
    rating: Optional[int] = None
    is_approved: Optional[bool] = None
    is_featured: Optional[bool] = None


class TestimonialInDB(TestimonialBase):
    """Schema for testimonial in database."""
    id: int
    doctor_id: int
    is_approved: bool
    is_featured: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class TestimonialPublic(BaseModel):
    """Schema for public API (only approved testimonials)."""
    id: int
    patient_name: str
    photo_url: Optional[str] = None
    content: str
    rating: Optional[int] = None
    created_at: datetime
    is_featured: bool = False

    class Config:
        from_attributes = True
        # Ensure None values are included in JSON
        json_encoders = {
            type(None): lambda v: None
        }

