from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Request
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from app.db.base import get_db
from app.crud import admin as crud_admin
from app.core.limiter import limiter
from app.tasks.email_tasks import _send_integrated_email
from app.services.notifications import trigger_doctor_event

router = APIRouter()

class ContactRequest(BaseModel):
    doctor_slug: str
    name: str
    email: EmailStr
    phone: str
    message: str

@router.post("/", status_code=200)
@limiter.limit("3/minute")
def send_contact_email(
    request: Request,
    contact_data: ContactRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """
    Send a contact email to the doctor.
    """
    doctor = crud_admin.get_tenant_by_slug(db, slug=contact_data.doctor_slug)
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")

    # Determine recipient email
    recipient_email = doctor.contact_email or doctor.email
    
    if not recipient_email:
        raise HTTPException(status_code=500, detail="Doctor has no email configured")

    # Trigger notification (centralized system)
    trigger_doctor_event(
        doctor_id=doctor.id,
        notification_type="doctor_new_contact_message",
        context={
            "event": "new_contact_message",
            "doctor_name": doctor.nombre_completo,
            "doctor_slug": getattr(doctor, "slug_url", ""),
            "patient_name": contact_data.name,
            "patient_email": contact_data.email,
            "patient_phone": contact_data.phone,
            "message_preview": contact_data.message[:100] + ("..." if len(contact_data.message) > 100 else ""),
            "full_message": contact_data.message
        },
        db=db
    )

    return {"message": "Email sent successfully"}
