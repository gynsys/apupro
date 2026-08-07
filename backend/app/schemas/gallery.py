"""
Pydantic schemas for Gallery entity.
"""
from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime


class GalleryImageBase(BaseModel):
    """Base schema with common gallery image fields."""
    image_url: str
    title: Optional[str] = None
    description: Optional[str] = None
    crop: Optional[Dict[str, Any]] = None


class GalleryImageCreate(GalleryImageBase):
    """Schema for creating a new gallery image."""
    doctor_id: int
    display_order: Optional[int] = 0


class GalleryImageUpdate(BaseModel):
    """Schema for updating gallery image information."""
    image_url: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    display_order: Optional[int] = None
    is_active: Optional[bool] = None
    featured: Optional[bool] = None
    crop: Optional[Dict[str, Any]] = None


class GalleryImageInDB(GalleryImageBase):
    """Schema for gallery image in database."""
    id: int
    doctor_id: int
    display_order: int
    is_active: bool
    featured: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class GalleryImagePublic(GalleryImageBase):
    """Schema for public API (only active images)."""
    id: int
    featured: bool
    created_at: datetime

    class Config:
        from_attributes = True

