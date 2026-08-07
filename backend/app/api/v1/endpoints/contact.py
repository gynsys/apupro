from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Request
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from app.db.arko_base import get_arko_db
from app.db.models.arko import ArkoAdmin
from app.core.limiter import limiter
from app.services.email import send_contact_notification

router = APIRouter()

class ContactRequest(BaseModel):
    name: str
    email: EmailStr
    phone: str
    message: str
    project_type: str = ""

@router.post("", status_code=200)
@limiter.limit("2/day")
def send_contact_email(
    request: Request,
    contact_data: ContactRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_arko_db),
):
    """
    Send a contact email to the system admin.
    """
    # Assuming this is sent to the global admin since there's no doctor_slug passed by frontend
    doctor = db.query(ArkoAdmin).first()
        
    if not doctor:
        raise HTTPException(status_code=404, detail="Admin not found")

    # Determine recipient email
    # TEMPORAL: Forzamos el envío a proingenioca@gmail.com para pruebas
    # ya que los MX del dominio arko360 están apagados y rebotaría.
    recipient_email = "proingenioca@gmail.com"
    
    if not recipient_email:
        raise HTTPException(status_code=500, detail="Admin has no email configured")

    # Trigger notification (centralized system)
    # Send Real Email via Resend
    background_tasks.add_task(
        send_contact_notification,
        doctor_email=recipient_email,
        doctor_name=doctor.full_name or "Administrador",
        patient_name=contact_data.name,
        patient_email=contact_data.email,
        patient_phone=contact_data.phone,
        message=contact_data.message,
        logo_url="https://arko360.net/logo.png"
    )

    return {"message": "Email sent successfully"}
