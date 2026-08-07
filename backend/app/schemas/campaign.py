"""
Pydantic schemas for Diffusion Campaigns.
"""
from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional, List, Dict, Any

class DiffusionCampaignBase(BaseModel):
    title: str
    subject: str
    content_html: str
    content_text: Optional[str] = None
    source_type: str = "custom" # custom, blog, recommendation
    source_id: Optional[int] = None
    target_type: str = "all" # all, app_users, patients, selection
    selected_contact_ids: Optional[List[int]] = None

class DiffusionCampaignCreate(DiffusionCampaignBase):
    pass

class DiffusionCampaignUpdate(BaseModel):
    title: Optional[str] = None
    subject: Optional[str] = None
    content_html: Optional[str] = None
    status: Optional[str] = None # draft, sending, sent, failed

class DiffusionCampaignResponse(DiffusionCampaignBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    tenant_id: int
    status: str
    stats: Dict[str, Any]
    sent_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

class CampaignContactBase(BaseModel):
    full_name: str
    email: str
    phone: Optional[str] = None
    ci: Optional[str] = None
    city: Optional[str] = None
    patient_id: Optional[int] = None
    cycle_user_id: Optional[int] = None
    source: str = "manual"

class CampaignContactCreate(CampaignContactBase):
    pass

class CampaignContactUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    ci: Optional[str] = None
    city: Optional[str] = None

class CampaignContactResponse(CampaignContactBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    tenant_id: int
    is_active: bool
    created_at: datetime

class DiffusionSource(BaseModel):
    id: int
    title: str
    type: str # blog, recommendation
    summary: Optional[str] = None
    cover_image: Optional[str] = None # Renamed from image_url for consistency
    url: Optional[str] = None
