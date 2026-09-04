import base64
import mimetypes
import os
import threading
from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, Depends, Form, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.core.config import settings
from app.core.logging import logger
from app.api.v1.endpoints.arko import get_current_arko_admin
from app.db.arko_base import ArkoSessionLocal
from app.db.models.arko import ArkoAdmin
from app.db.models.notification import Notification
from app.services.email import send_email

router = APIRouter()

@router.post("/report")
async def report_payment(
    plan: str = Form(...),
    method: str = Form(...),
    reference: str = Form(...),
    amount: Optional[str] = Form(None),
    file: UploadFile = File(...),
    current_user: ArkoAdmin = Depends(get_current_arko_admin)
) -> dict:
    if not plan or not method or not reference:
        raise HTTPException(status_code=400, detail="Plan, método de pago y referencia son obligatorios.")

    # Guardar archivo en disco
    upload_dir = "uploads/payments"
    os.makedirs(upload_dir, exist_ok=True)
    
    file_ext = os.path.splitext(file.filename)[1].lower() if file.filename else ".png"
    safe_filename = f"{current_user.email.replace('@','_')}_{int(datetime.timestamp(datetime.utcnow()))}{file_ext}"
    file_path = os.path.join(upload_dir, safe_filename)
    
    content = await file.read()
    with open(file_path, "wb") as buffer:
        buffer.write(content)
        
    encoded_file = base64.b64encode(content).decode("utf-8")
    guessed_type = mimetypes.guess_type(safe_filename)[0]
    mime_type = guessed_type or ("image/png" if file_ext in [".png", ".jpg", ".jpeg", ".webp"] else "application/octet-stream")
    is_image = mime_type.startswith("image/")

    # Determinar superadmin(s) reales para notificación interna y correo
    admin_ids: List[int] = []
    admin_emails: List[str] = []

    with ArkoSessionLocal() as db_arko:
        target_admins = db_arko.query(ArkoAdmin).filter(
            or_(
                ArkoAdmin.email == "admin@arko360.net",
                ArkoAdmin.site_config.isnot(None),
                ArkoAdmin.email == (settings.ADMIN_EMAIL or "")
            )
        ).all()
        for a in target_admins:
            if a.id and a.id not in admin_ids:
                admin_ids.append(a.id)
            if a.email and a.email not in admin_emails:
                admin_emails.append(a.email)

        # Siempre asegurar admin@arko360.net
        if "admin@arko360.net" not in admin_emails:
            admin_emails.append("admin@arko360.net")
            super_admin = db_arko.query(ArkoAdmin).filter(ArkoAdmin.email == "admin@arko360.net").first()
            if super_admin and super_admin.id and super_admin.id not in admin_ids:
                admin_ids.append(super_admin.id)

        if not admin_ids:
            first_admin = db_arko.query(ArkoAdmin).first()
            if first_admin and first_admin.id:
                admin_ids.append(first_admin.id)
                if first_admin.email and first_admin.email not in admin_emails:
                    admin_emails.append(first_admin.email)

        # Crear notificación interna en campana para los administradores
        amount_str = f" por un monto de {amount}" if amount else ""
        user_name = current_user.full_name or current_user.email
        notif_msg = f"El usuario {user_name} ({current_user.email}) ha reportado un pago{amount_str} por el Plan {plan}. Referencia: {reference}. Archivo: {safe_filename}"
        
        for a_id in admin_ids:
            notif = Notification(
                user_id=a_id,
                message=notif_msg,
                type="payment_report"
            )
            db_arko.add(notif)
        db_arko.commit()
        
    # Enviar correo a los administradores con el comprobante adjunto e incrustado visualmente
    try:
        subject = f"¡Nuevo Pago Reportado! - Plan {plan}"
        
        if is_image:
            image_preview_html = f"""
            <div style="margin: 20px 0; padding: 15px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #f8fafc;">
                <p style="margin: 0 0 10px 0; font-weight: bold; color: #1e293b;">Comprobante de Pago Adjunto:</p>
                <img src="data:{mime_type};base64,{encoded_file}" alt="Comprobante de Pago" style="max-width: 100%; height: auto; border-radius: 6px; border: 1px solid #cbd5e1; display: block;" />
            </div>
            """
        else:
            image_preview_html = f"""
            <div style="margin: 20px 0; padding: 15px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #f8fafc;">
                <p style="margin: 0; font-weight: bold; color: #1e293b;">📄 Archivo PDF adjunto al correo: {safe_filename}</p>
            </div>
            """

        amount_row = f"<p style='margin: 6px 0;'><strong>Monto a pagar / pagado:</strong> {amount or 'No especificado'}</p>"

        html = f"""
        <html>
            <body style="font-family: Arial, sans-serif; color: #334155; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #0284c7; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; margin-top: 0;">Nuevo Pago Reportado en la Plataforma</h2>
                <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0;">
                    <p style="margin: 6px 0;"><strong>Usuario:</strong> {current_user.email}</p>
                    <p style="margin: 6px 0;"><strong>Plan solicitado:</strong> {plan}</p>
                    <p style="margin: 6px 0;"><strong>Método de pago:</strong> {method}</p>
                    {amount_row}
                    <p style="margin: 6px 0;"><strong>Referencia:</strong> {reference}</p>
                    <p style="margin: 6px 0;"><strong>Archivo adjunto:</strong> {safe_filename}</p>
                </div>
                {image_preview_html}
                <p style="margin-top: 20px; font-size: 13px; color: #64748b;">
                    Por favor revisa el comprobante y activa el plan desde el panel administrativo de CostBase.
                </p>
            </body>
        </html>
        """
        
        attachments = [{
            "filename": safe_filename,
            "content": encoded_file
        }]
        
        for email_addr in admin_emails:
            threading.Thread(
                target=send_email,
                args=(email_addr, subject, html),
                kwargs={"attachments": attachments}
            ).start()
            
    except Exception as e:
        logger.error(f"Error enviando correo al superadmin sobre pago: {e}", exc_info=True)

    return {"status": "success", "message": "Pago reportado exitosamente"}
