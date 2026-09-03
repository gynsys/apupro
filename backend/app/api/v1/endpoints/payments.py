from fastapi import APIRouter, Depends, Form, UploadFile, File, HTTPException
from app.api.v1.endpoints.arko import get_current_arko_admin
from app.db.arko_base import ArkoSessionLocal
from app.db.models.arko import ArkoAdmin
from app.db.base import Base, SessionLocal
from sqlalchemy.orm import Session
from app.db.models.notification import Notification
import os
from datetime import datetime

router = APIRouter()

@router.post("/report")
async def report_payment(
    plan: str = Form(...),
    method: str = Form(...),
    reference: str = Form(...),
    file: UploadFile = File(...),
    current_user = Depends(get_current_arko_admin)
):
    # Save the file
    upload_dir = "uploads/payments"
    os.makedirs(upload_dir, exist_ok=True)
    
    file_ext = os.path.splitext(file.filename)[1]
    safe_filename = f"{current_user.email.replace('@','_')}_{int(datetime.timestamp(datetime.utcnow()))}{file_ext}"
    file_path = os.path.join(upload_dir, safe_filename)
    
    with open(file_path, "wb") as buffer:
        content = await file.read()
        buffer.write(content)
        
    # Find superadmin
    with ArkoSessionLocal() as db_arko:
        superadmin = db_arko.query(ArkoAdmin).filter(ArkoAdmin.email == 'costbaseia@gmail.com').first()
        if not superadmin:
            raise HTTPException(status_code=500, detail="Superadmin no encontrado")
            
        superadmin_id = superadmin.id

    # Create notification for superadmin
    with SessionLocal() as db:
        notif = Notification(
            user_id=superadmin_id,
            message=f"El usuario {current_user.email} ha reportado un pago por el Plan {plan}. Referencia: {reference}. Archivo: {safe_filename}",
            type="payment_report"
        )
        db.add(notif)
        db.commit()

    return {"status": "success", "message": "Pago reportado exitosamente"}
