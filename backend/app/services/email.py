import resend
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

# Initialize Resend
if settings.RESEND_API_KEY:
    resend.api_key = settings.RESEND_API_KEY

def get_base_html_template(title: str, content: str, logo_url: str = None) -> str:
    """
    Generate a basic HTML email template with dynamic logo and content.
    """
    default_logo = "https://res.cloudinary.com/dvz0zvpof/image/upload/v1714856012/arko360_logo.png"
    logo = logo_url if logo_url else default_logo
    
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f7f6; margin: 0; padding: 0; }}
            .container {{ max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }}
            .header {{ background-color: #ffffff; padding: 20px; text-align: center; border-bottom: 1px solid #eeeeee; }}
            .header img {{ max-height: 50px; }}
            .content {{ padding: 30px; color: #333333; line-height: 1.6; }}
            .footer {{ background-color: #f9f9f9; padding: 15px; text-align: center; font-size: 12px; color: #888888; border-top: 1px solid #eeeeee; }}
            .button {{ display: inline-block; padding: 12px 24px; background-color: #2563eb; color: #ffffff !important; text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 20px; }}
            h1 {{ color: #1e293b; font-size: 24px; margin-top: 0; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <img src="{logo}" alt="Logo" />
            </div>
            <div class="content">
                <h1>{title}</h1>
                {content}
            </div>
            <div class="footer">
                &copy; 2026 Arko360. Todos los derechos reservados.
            </div>
        </div>
    </body>
    </html>
    """

def send_contact_notification(
    doctor_email: str,
    doctor_name: str,
    patient_name: str,
    patient_email: str,
    patient_phone: str,
    message: str,
    logo_url: str = None
) -> bool:
    """
    Sends an email to the admin/doctor when a user submits the contact form.
    """
    if not settings.RESEND_API_KEY:
        logger.warning("RESEND_API_KEY is not set. Skipping email send.")
        return False
        
    try:
        title = "Nuevo Mensaje de Contacto"
        content = f"""
        <p>Hola <strong>{doctor_name}</strong>,</p>
        <p>Has recibido un nuevo mensaje a través de tu sitio web de Arko360.</p>
        
        <div style="background-color: #f8fafc; padding: 15px; border-left: 4px solid #2563eb; margin: 20px 0;">
            <p style="margin-top: 0;"><strong>Nombre:</strong> {patient_name}</p>
            <p><strong>Email:</strong> {patient_email}</p>
            <p><strong>Teléfono:</strong> {patient_phone}</p>
            <p style="margin-bottom: 0;"><strong>Mensaje:</strong><br/>{message}</p>
        </div>
        
        <p>Puedes responder a este correo directamente para comunicarte con {patient_name}.</p>
        """
        
        html_body = get_base_html_template(title, content, logo_url)
        
        response = resend.Emails.send({
            "from": settings.RESEND_FROM_EMAIL,
            "to": [doctor_email],
            "reply_to": patient_email,
            "subject": f"Nuevo mensaje de {patient_name} - Arko360",
            "html": html_body
        })
        logger.info(f"Contact email sent successfully: {response}")
        return True
    except Exception as e:
        logger.error(f"Error sending contact email via Resend: {e}")
        return False


def send_reset_password_email(
    user_email: str,
    user_name: str,
    reset_link: str,
    logo_url: str = None
) -> bool:
    """
    Sends a password reset link to the user.
    """
    if not settings.RESEND_API_KEY:
        logger.warning("RESEND_API_KEY is not set. Skipping reset email.")
        return False
        
    try:
        title = "Recuperación de Contraseña"
        content = f"""
        <p>Hola <strong>{user_name}</strong>,</p>
        <p>Hemos recibido una solicitud para restablecer la contraseña de tu cuenta en Arko360.</p>
        <p>Haz clic en el siguiente botón para crear una nueva contraseña:</p>
        
        <div style="text-align: center; margin: 30px 0;">
            <a href="{reset_link}" class="button">Restablecer mi Contraseña</a>
        </div>
        
        <p>Si no solicitaste este cambio, puedes ignorar este correo y tu contraseña seguirá siendo la misma.</p>
        <p><em>Este enlace expirará en 24 horas por razones de seguridad.</em></p>
        """
        
        html_body = get_base_html_template(title, content, logo_url)
        
        response = resend.Emails.send({
            "from": settings.RESEND_FROM_EMAIL,
            "to": [user_email],
            "subject": "Recuperación de Contraseña - Arko360",
            "html": html_body
        })
        logger.info(f"Reset password email sent successfully: {response}")
        return True
    except Exception as e:
        logger.error(f"Error sending reset password email via Resend: {e}")
        return False
