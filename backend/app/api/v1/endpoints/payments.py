import base64
import mimetypes
import os
import threading
from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, Depends, Form, UploadFile, File, HTTPException
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.logging import logger
from app.api.v1.endpoints.arko import get_current_arko_admin
from app.db.arko_base import ArkoSessionLocal
from app.db.models.arko import ArkoAdmin
from app.db.base import Base, SessionLocal
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
    admin_users: List[ArkoAdmin] = []
    admin_emails: List[str] = []

    with ArkoSessionLocal() as db_arko:
        # 1. Superadmin por ADMIN_EMAIL configurado en backend (.env)
        if settings.ADMIN_EMAIL:
            admin_by_env = db_arko.query(ArkoAdmin).filter(ArkoAdmin.email == settings.ADMIN_EMAIL).first()
            if admin_by_env and admin_by_env.email not in admin_emails:
                admin_users.append(admin_by_env)
                admin_emails.append(admin_by_env.email)
            elif settings.ADMIN_EMAIL not in admin_emails:
                admin_emails.append(settings.ADMIN_EMAIL)
                
        # 2. Superadmin con configuración de sitio (root admin: admin@arko360.net)
        admin_root = db_arko.query(ArkoAdmin).filter(ArkoAdmin.site_config.isnot(None)).first()
        if admin_root and admin_root.email not in admin_emails:
            admin_users.append(admin_root)
            admin_emails.append(admin_root.email)
            
        # 3. Cuentas administradoras estándar del sistema si existen
        for default_admin_email in ["admin@arko360.net", "admin@arko360.com"]:
            admin_def = db_arko.query(ArkoAdmin).filter(ArkoAdmin.email == default_admin_email).first()
            if admin_def and admin_def.email not in admin_emails:
                admin_users.append(admin_def)
                admin_emails.append(admin_def.email)

        # Fallback de respaldo si no se encontró ninguno de los anteriores
        if not admin_users:
            first_admin = db_arko.query(ArkoAdmin).first()
            if first_admin:
                admin_users.append(first_admin)
                if first_admin.email not in admin_emails:
                    admin_emails.append(first_admin.email)

    # Crear notificación interna en campana para los administradores
    amount_str = f" por un monto de {amount}" if amount else ""
    notif_msg = f"El usuario {current_user.email} ha reportado un pago{amount_str} por el Plan {plan}. Referencia: {reference}. Archivo: {safe_filename}"
    
    with SessionLocal() as db:
        for a_user in admin_users:
            notif = Notification(
                user_id=a_user.id,
                message=notif_msg,
                type="payment_report"
            )
            db.add(notif)
        db.commit()
        
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
