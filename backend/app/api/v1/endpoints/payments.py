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
        
    # Send email to superadmin
    try:
        from app.services.email import send_email
        import threading
        
        subject = f"¡Nuevo Pago Reportado! - Plan {plan}"
        html = f"""
        <html>
            <body>
                <h2>Nuevo Pago Reportado en la Plataforma</h2>
                <p><strong>Usuario:</strong> {current_user.email}</p>
                <p><strong>Plan solicitado:</strong> {plan}</p>
                <p><strong>Método de pago:</strong> {method}</p>
                <p><strong>Referencia:</strong> {reference}</p>
                <p><strong>Archivo adjunto:</strong> {safe_filename}</p>
                <p>Por favor revisa el comprobante y activa el plan desde el panel administrativo.</p>
            </body>
        </html>
        """
        threading.Thread(target=send_email, args=(superadmin.email, subject, html)).start()
    except Exception as e:
        import logging
        logging.error(f"Error enviando correo al superadmin sobre pago: {e}")

    return {"status": "success", "message": "Pago reportado exitosamente"}
