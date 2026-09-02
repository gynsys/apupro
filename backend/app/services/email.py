import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)

import requests

def send_email(to_email: str, subject: str, html_content: str) -> bool:
    if not settings.RESEND_API_KEY or not settings.RESEND_API_KEY.startswith("re_"):
        logger.warning(f"[EMAIL] SIMULACIÓN - RESEND_API_KEY no configurada o inválida. Para: {to_email} | Asunto: {subject}")
        return True
        
    try:
        logger.info(f"[EMAIL] Enviando a {to_email} via Resend. From: {settings.RESEND_FROM_EMAIL}")
        headers = {
            "Authorization": f"Bearer {settings.RESEND_API_KEY}",
            "Content-Type": "application/json"
        }
        data = {
            "from": settings.RESEND_FROM_EMAIL,
            "to": [to_email],
            "subject": subject,
            "html": html_content
        }
        
        response = requests.post("https://api.resend.com/emails", json=data, headers=headers, timeout=10)
        
        if response.status_code >= 400:
            logger.error(f"[EMAIL] Resend rechazó el correo a {to_email}. Status={response.status_code} Body={response.text}")
            return False
            
        logger.info(f"[EMAIL] Correo enviado exitosamente a {to_email}. Status={response.status_code} ID={response.json().get('id', 'N/A')}")
        return True
    except Exception as e:
        logger.error(f"[EMAIL] Error de conexión enviando a {to_email}: {str(e)}", exc_info=True)
        return False

def send_reset_password_email(email_to: str, code: str):
    subject = "Recuperación de contraseña en CostBase"
    html_content = f"""
    <html>
      <body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
        <h2 style="color: #1A6BB5;">Recuperación de contraseña</h2>
        <p>Hola,</p>
        <p>Hemos recibido una solicitud para restablecer la contraseña de tu cuenta en CostBase.</p>
        <p>Tu código de recuperación es:</p>
        <p style="margin: 30px 0; font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #1A6BB5;">
            {code}
        </p>
        <p>Ingresa este código en la plataforma para crear una nueva contraseña.</p>
        <p>Si no solicitaste esto, puedes ignorar este correo de forma segura.</p>
        <hr style="border: 0; border-top: 1px solid #eaeaea; margin: 30px 0;" />
        <p style="font-size: 12px; color: #888;">El equipo de CostBase.</p>
      </body>
    </html>
    """
    
    return send_email(email_to, subject, html_content)

def send_verification_email(email_to: str, code: str):
    subject = "Verifica tu correo electrónico en CostBase"
    html_content = f"""
    <html>
      <body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
        <h2 style="color: #1A6BB5;">¡Bienvenido a CostBase!</h2>
        <p>Hola,</p>
        <p>Gracias por registrarte. Para comenzar a utilizar la plataforma, por favor verifica tu dirección de correo electrónico ingresando el siguiente código:</p>
        <p style="margin: 30px 0; font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #1A6BB5;">
            {code}
        </p>
        <p>Si no creaste esta cuenta, ignora este mensaje.</p>
        <hr style="border: 0; border-top: 1px solid #eaeaea; margin: 30px 0;" />
        <p style="font-size: 12px; color: #888;">El equipo de CostBase.</p>
      </body>
    </html>
    """

    return send_email(email_to, subject, html_content)

def send_backup_email(to_email: str, budget_name: str, backup_file_path: str, backup_filename: str):
    """Envía un correo con el archivo de backup adjunto"""
    subject = f"Backup del presupuesto: {budget_name}"
    html_content = f"""
    <html>
      <body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
        <h2 style="color: #1A6BB5;">Backup de Presupuesto CostBase</h2>
        <p>Hola,</p>
        <p>Adjunto encontrarás el backup encriptado de tu presupuesto: <strong>{budget_name}</strong></p>
        <p><strong>Detalles del backup:</strong></p>
        <ul>
          <li>Nombre del presupuesto: {budget_name}</li>
          <li>Formato: CostBase Backup (.cb)</li>
          <li>Encriptación: AES-256</li>
          <li>Seguridad: Solo puede ser importado por tu cuenta</li>
        </ul>
        <p>Para restaurar este backup, utiliza la función de importación en la plataforma CostBase.</p>
        <p style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
          <strong>⚠️ Importante:</strong> Este archivo contiene información sensible y está encriptado. No lo compartas con terceros.
        </p>
        <hr style="border: 0; border-top: 1px solid #eaeaea; margin: 30px 0;" />
        <p style="font-size: 12px; color: #888;">El equipo de CostBase.</p>
      </body>
    </html>
    """

    # Si no hay configuración de Resend, usar SMTP estándar para adjuntos
    if not settings.RESEND_API_KEY or settings.RESEND_API_KEY.startswith("re_") is False:
        logger.warning(f"SIMULACIÓN DE CORREO CON ADJUNTO (Sin RESEND_API_KEY válido)")
        logger.warning(f"Para: {to_email}")
        logger.warning(f"Asunto: {subject}")
        logger.warning(f"Archivo adjunto: {backup_filename}")
        logger.warning(f"Contenido:\n{html_content}\n")
        return True

    try:
        # Como Resend no soporta adjuntos directamente, usaremos SMTP estándar
        msg = MIMEMultipart()
        msg['From'] = settings.RESEND_FROM_EMAIL
        msg['To'] = to_email
        msg['Subject'] = subject

        msg.attach(MIMEText(html_content, 'html'))

        # Adjuntar archivo
        with open(backup_file_path, 'rb') as attachment:
            part = MIMEBase('application', 'octet-stream')
            part.set_payload(attachment.read())
            encoders.encode_base64(part)
            part.add_header(
                'Content-Disposition',
                f'attachment; filename= {backup_filename}'
            )
            msg.attach(part)

        # Usar SMTP si está configurado, de lo contrario simular
        if hasattr(settings, 'SMTP_HOST') and settings.SMTP_HOST:
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
                if hasattr(settings, 'SMTP_USE_TLS') and settings.SMTP_USE_TLS:
                    server.starttls()
                if hasattr(settings, 'SMTP_USER') and settings.SMTP_USER:
                    server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.send_message(msg)
            logger.info(f"Correo con backup enviado exitosamente a {to_email} vía SMTP")
        else:
            # Simulación si no hay SMTP configurado
            logger.warning(f"SIMULACIÓN DE CORREO CON ADJUNTO (Sin SMTP configurado)")
            logger.warning(f"Para: {to_email}")
            logger.warning(f"Archivo: {backup_filename}")
            logger.warning(f"Tamaño del archivo: {os.path.getsize(backup_file_path)} bytes")

        return True

    except Exception as e:
        logger.error(f"Error al enviar correo con backup a {to_email}: {str(e)}", exc_info=True)
        return False
