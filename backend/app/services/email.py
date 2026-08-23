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
