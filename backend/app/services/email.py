import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)

# Configuración por defecto para Resend SMTP
SMTP_HOST = "smtp.resend.com"
SMTP_PORT = 587
SMTP_USER = "resend"
# La contraseña de SMTP es el RESEND_API_KEY
SMTP_PASSWORD = settings.RESEND_API_KEY

def send_email(to_email: str, subject: str, html_content: str):
    if not SMTP_PASSWORD:
        logger.warning(f"SIMULACIÓN DE CORREO (Sin RESEND_API_KEY)")
        logger.warning(f"Para: {to_email}")
        logger.warning(f"Asunto: {subject}")
        logger.warning(f"Contenido:\n{html_content}\n")
        return True
        
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = settings.RESEND_FROM_EMAIL
        msg["To"] = to_email

        part = MIMEText(html_content, "html")
        msg.attach(part)

        server = smtplib.SMTP(SMTP_HOST, SMTP_PORT)
        server.starttls()
        server.login(SMTP_USER, SMTP_PASSWORD)
        server.sendmail(settings.RESEND_FROM_EMAIL, to_email, msg.as_string())
        server.quit()
        logger.info(f"Correo enviado exitosamente a {to_email}")
        return True
    except Exception as e:
        logger.error(f"Error al enviar correo a {to_email}: {str(e)}", exc_info=True)
        return False

def send_reset_password_email(email_to: str, token: str):
    # Asumiendo que el frontend estará en la misma URL pero con /reset-password
    # Puedes ajustar la base de la URL según sea necesario
    # Para desarrollo: http://localhost:5173
    # Para prod: https://costbase.arko360.net
    # Por seguridad, es mejor que el token vaya limpio y el front construya su ruta.
    
    frontend_url = "https://costbase.arko360.net" # O lo que uses en tu config
    reset_url = f"{frontend_url}/reset-password?token={token}"
    
    subject = "Recuperación de contraseña en CostBase"
    html_content = f"""
    <html>
      <body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
        <h2 style="color: #1A6BB5;">Recuperación de contraseña</h2>
        <p>Hola,</p>
        <p>Hemos recibido una solicitud para restablecer la contraseña de tu cuenta en CostBase.</p>
        <p>Haz clic en el siguiente enlace para crear una nueva contraseña:</p>
        <p style="margin: 30px 0;">
            <a href="{reset_url}" style="background-color: #1A6BB5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Restablecer mi contraseña</a>
        </p>
        <p>O copia y pega esta URL en tu navegador:</p>
        <p><a href="{reset_url}">{reset_url}</a></p>
        <p>Si no solicitaste esto, puedes ignorar este correo de forma segura.</p>
        <hr style="border: 0; border-top: 1px solid #eaeaea; margin: 30px 0;" />
        <p style="font-size: 12px; color: #888;">El equipo de CostBase.</p>
      </body>
    </html>
    """
    
    return send_email(email_to, subject, html_content)

def send_verification_email(email_to: str, token: str):
    frontend_url = "https://costbase.arko360.net"
    verify_url = f"{frontend_url}/verify-email?token={token}"
    
    subject = "Verifica tu correo electrónico en CostBase"
    html_content = f"""
    <html>
      <body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
        <h2 style="color: #1A6BB5;">¡Bienvenido a CostBase!</h2>
        <p>Hola,</p>
        <p>Gracias por registrarte. Para comenzar a utilizar la plataforma, por favor verifica tu dirección de correo electrónico haciendo clic en el siguiente enlace:</p>
        <p style="margin: 30px 0;">
            <a href="{verify_url}" style="background-color: #1A6BB5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Verificar mi correo</a>
        </p>
        <p>O copia y pega esta URL en tu navegador:</p>
        <p><a href="{verify_url}">{verify_url}</a></p>
        <p>Si no creaste esta cuenta, ignora este mensaje.</p>
        <hr style="border: 0; border-top: 1px solid #eaeaea; margin: 30px 0;" />
        <p style="font-size: 12px; color: #888;">El equipo de CostBase.</p>
      </body>
    </html>
    """
    
    return send_email(email_to, subject, html_content)
