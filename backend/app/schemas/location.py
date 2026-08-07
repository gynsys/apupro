from typing import Optional, Any, Dict
from pydantic import BaseModel

class LocationBase(BaseModel):
    name: str
    address: str
    city: Optional[str] = None
    image_url: Optional[str] = None
    google_maps_url: Optional[str] = None
    phone: Optional[str] = None
    schedule: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = True

class LocationCreate(LocationBase):
    pass

class LocationUpdate(LocationBase):
    name: Optional[str] = None
    address: Optional[str] = None
    image_url: Optional[str] = None
    schedule: Optional[Dict[str, Any]] = None

class Location(LocationBase):
    id: int
    doctor_id: int

    class Config:
        from_attributes = True
