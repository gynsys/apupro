"""
Pydantic schemas for simplified notification system.
"""
from datetime import datetime
from typing import Optional, Dict, Any, List

from pydantic import BaseModel, Field, validator


# Lista de tipos válidos para validación
VALID_TYPES = [
    "contraceptive_daily", "contraceptive_rest_start", "contraceptive_rest_end", "contraceptive_missed",
    "period_prediction", "period_start", "period_confirmation_0", "period_confirmation_1", "period_confirmation_2", "period_irregular",
    "fertile_window_start", "fertility_peak", "ovulation_day", "fertile_window_end",
    "prenatal_weekly", "prenatal_milestone", "prenatal_daily_tip", "prenatal_alert",
    "annual_checkup"
]


# ==================== READ ONLY (Response) ====================

class NotificationRuleBase(BaseModel):
    notification_type: str
    title_template: str
    message_template: str
    message_text_template: Optional[str] = None
    channel: str = "dual"
    send_time: str = "08:00"
    is_active: bool = True
    is_edited: bool = False


class NotificationRuleResponse(NotificationRuleBase):
    id: int
    tenant_id: Optional[int] = None
    priority: int
    trigger_condition: Dict[str, Any]  # Read-only
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class NotificationRuleListResponse(BaseModel):
    """Simplified list view."""
    notification_type: str
    title_template: str
    is_active: bool
    is_edited: bool
    channel: str
    
    class Config:
        from_attributes = True


# ==================== EDITABLE (Request) ====================

class NotificationRuleUpdate(BaseModel):
    """
    ONLY these fields can be edited.
    Creating new types or changing triggers is NOT allowed.
    """
    title_template: Optional[str] = Field(None, max_length=255)
    message_template: Optional[str] = None
    message_text_template: Optional[str] = None
    send_time: Optional[str] = Field(None, pattern="^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$")


# ==================== NO LONGER SUPPORTED ====================
# class NotificationRuleCreate(BaseModel):  # ELIMINADO
#     """Creation of new notification types is NOT allowed."""
#     pass


# ==================== UTILITY ====================

class NotificationRestoreDefault(BaseModel):
    """Request to restore default content."""
    confirm: bool = True  # Safety check


class NotificationLogResponse(BaseModel):
    id: int
    notification_type: str
    title_sent: str
    channel_used: str
    status: str
    sent_at: datetime
    recipient_id: Optional[int] = None
    doctor_id: Optional[int] = None
    error_message: Optional[str] = None
    received_at: Optional[datetime] = None
    clicked_at: Optional[datetime] = None
    recipient_name: Optional[str] = None
    recipient_email: Optional[str] = None
    image_url: Optional[str] = None
    event_metadata: Optional[Dict[str, Any]] = None
    
    class Config:
        from_attributes = True


class PendingNotificationResponse(BaseModel):
    id: int
    recipient_id: Optional[int] = None
    doctor_id: Optional[int] = None
    notification_rule_id: Optional[int] = None
    subject: str
    scheduled_for: datetime
    channel: str
    status: str
    retry_count: int
    last_error: Optional[str] = None
    created_at: datetime
    sent_at: Optional[datetime] = None
    recipient_name: Optional[str] = None
    recipient_email: Optional[str] = None
    image_url: Optional[str] = None
    
    class Config:
        from_attributes = True


class NotificationTestRequest(BaseModel):
    notification_type: str  # Must be one of VALID_TYPES
    
    @validator('notification_type')
    def validate_type(cls, v):
        if v not in VALID_TYPES:
            raise ValueError(f'Invalid notification type. Must be one of: {", ".join(VALID_TYPES)}')
        return v


class NotificationTestResponse(BaseModel):
    status: str
    message: str
    notification_type: str
    preview: Dict[str, str]  # Rendered title and message


class PushKeys(BaseModel):
    p256dh: Optional[str] = None
    auth: Optional[str] = None


class PushSubscriptionSchema(BaseModel):
    endpoint: Optional[str] = None
    keys: Optional[PushKeys] = None
    token: Optional[str] = None # For Capacitor native push


class NotificationTrackRequest(BaseModel):
    notification_id: int
    event: str  # "received" or "clicked"
    metadata: Optional[Dict[str, Any]] = None


class VapidKeyResponse(BaseModel):
    public_key: str
