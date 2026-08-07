from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime

class ScheduledAppointmentBase(BaseModel):
    patient_ci: str
    patient_name: str
    patient_email: Optional[EmailStr] = None
    patient_phone: Optional[str] = None
    scheduled_date: datetime
    interval_type: Optional[str] = None
    notes: Optional[str] = None

class ScheduledAppointmentCreate(ScheduledAppointmentBase):
    doctor_id: Optional[int] = None
    original_appointment_id: Optional[int] = None
    original_consultation_id: Optional[int] = None

class ScheduledAppointmentUpdate(BaseModel):
    status: Optional[str] = None
    scheduled_date: Optional[datetime] = None
    notes: Optional[str] = None
    reminder_sent: Optional[bool] = None

class ScheduledAppointmentInDBBase(ScheduledAppointmentBase):
    id: int
    doctor_id: int
    status: str
    reminder_sent: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        orm_mode = True

class ScheduledAppointment(ScheduledAppointmentInDBBase):
    """
    Schema for scheduled appointment data returned to the user.
    """
    pass
