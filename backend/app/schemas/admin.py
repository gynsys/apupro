"""
Pydantic schemas for admin system models.
"""
from typing import Optional, List, Union
from pydantic import BaseModel, EmailStr, Field
from datetime import datetime


# Tenant schemas
class TenantBase(BaseModel):
    email: EmailStr
    nombre_completo: str
    telefono: Optional[str] = None
    especialidad: Optional[str] = None
    biografia: Optional[str] = None
    slug: str
    logo_url: Optional[str] = None
    photo_url: Optional[str] = None
    theme_primary_color: Optional[str] = None
    plan_id: Optional[int] = None
    stripe_customer_id: Optional[str] = None
    subscription_end_date: Optional[datetime] = None
    
    # Social Media
    social_youtube: Optional[str] = None
    social_instagram: Optional[str] = None
    social_tiktok: Optional[str] = None
    social_x: Optional[str] = None
    social_facebook: Optional[str] = None


class TenantCreate(TenantBase):
    password: str
    is_clinic: Optional[bool] = False



class TenantUpdate(BaseModel):
    email: Optional[EmailStr] = None
    nombre_completo: Optional[str] = None
    telefono: Optional[str] = None
    especialidad: Optional[str] = None
    biografia: Optional[str] = None
    slug: Optional[str] = None
    logo_url: Optional[str] = None
    photo_url: Optional[str] = None
    theme_primary_color: Optional[str] = None
    plan_id: Optional[int] = None
    stripe_customer_id: Optional[str] = None
    subscription_end_date: Optional[datetime] = None
    
    # Social Media
    social_youtube: Optional[str] = None
    social_instagram: Optional[str] = None
    social_tiktok: Optional[str] = None
    social_x: Optional[str] = None
    social_facebook: Optional[str] = None
    is_clinic: Optional[bool] = None



class TenantStatusUpdate(BaseModel):
    status: str  # 'active', 'paused', 'suspended', 'approved', 'rejected'


class Tenant(TenantBase):
    id: int
    status: str
    enabled_modules: List[str] = Field(default=[], validation_alias="enabled_module_codes")
    is_active: bool
    is_verified: bool
    created_at: datetime
    slug: str = Field(..., validation_alias="slug_url")
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True
        populate_by_name = True


# Plan schemas
class PlanBase(BaseModel):
    name: str
    description: Optional[str]
    price: Optional[float]
    max_testimonials: Optional[int] = 10
    max_gallery_images: Optional[int] = 20
    max_faqs: Optional[int] = 15
    max_staff_members: Optional[int] = 0
    custom_domain: Optional[bool] = False
    analytics_dashboard: Optional[bool] = False
    priority_support: Optional[bool] = False



class PlanCreate(PlanBase):
    pass


class PlanUpdate(PlanBase):
    name: Optional[str]
    is_active: Optional[bool]


class Plan(PlanBase):
    id: int
    features: Optional[dict]
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


# Module schemas
class ModuleBase(BaseModel):
    name: str
    description: Optional[str]
    code: str


class ModuleCreate(ModuleBase):
    pass


class ModuleUpdate(BaseModel):
    name: Optional[str]
    description: Optional[str]
    is_active: Optional[bool]


class Module(ModuleBase):
    id: int
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


# Tenant-Module relationship schemas
class TenantModuleBase(BaseModel):
    tenant_id: int
    module_id: int
    is_enabled: bool = True


class TenantModuleCreate(TenantModuleBase):
    pass


class TenantModuleUpdate(BaseModel):
    module_id: int
    is_enabled: bool


class TenantModule(TenantModuleBase):
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


# Response schemas with relationships
class TenantWithModules(Tenant):
    plan: Optional[Plan]
    enabled_modules: List[Module] = []

    class Config:
        from_attributes = True


class PlanWithTenants(Plan):
    tenants: List[Tenant] = []

    class Config:
        from_attributes = True


class ModuleWithTenants(Module):
    tenants: List[Tenant] = []

    class Config:
        from_attributes = True