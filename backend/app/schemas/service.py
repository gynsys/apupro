from typing import Optional
from pydantic import BaseModel

class ServiceBase(BaseModel):
    title: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    is_active: Optional[bool] = True
    order: Optional[int] = 0
    blog_slug: Optional[str] = None

class ServiceCreate(ServiceBase):
    pass

class ServiceUpdate(ServiceBase):
    title: Optional[str] = None

class Service(ServiceBase):
    id: int
    doctor_id: int

    class Config:
        from_attributes = True
