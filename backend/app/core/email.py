import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List, Optional
from pydantic import EmailStr
import anyio
import resend
from app.core.config import settings

logger = logging.getLogger(__name__)

# Configurar Resend si la API Key está presente
if settings.RESEND_API_KEY:
    resend.api_key = settings.RESEND_API_KEY

def _send_email_sync(
    email_to: EmailStr,
    subject: str,
    html_content: str,
    attachments: Optional[List[dict]] = None,
) -> bool:
    """
    Blocking SMTP operations run in a thread.
    """
    try:
        message = MIMEMultipart("alternative")
        message["Subject"] = subject
        message["From"] = f"{settings.EMAILS_FROM_NAME} <{settings.EMAILS_FROM_EMAIL}>"
        message["To"] = email_to

        part = MIMEText(html_content, "html")
        message.attach(part)

        if attachments:
            from email.mime.application import MIMEApplication
            for attachment in attachments:
                if attachment.get('content'):
                    part = MIMEApplication(
                        attachment['content'],
                        Name=attachment.get('filename', 'attachment')
                    )
                    part['Content-Disposition'] = f'attachment; filename="{attachment.get("filename", "attachment")}"'
                    message.attach(part)

        # Connect to SMTP server
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(
                settings.EMAILS_FROM_EMAIL,
                email_to,
                message.as_string()
            )
            
        logger.info(f"Email sent successfully to {email_to}")
        return True
    except Exception as e:
        logger.error(f"Failed to send email to {email_to} via SMTP: {e}")
        return False

def _send_email_resend_sync(
    email_to: EmailStr,
    subject: str,
    html_content: str,
    attachments: Optional[List[dict]] = None,
) -> bool:
    """
    Send email using Resend API.
    """
    try:
        if not settings.RESEND_API_KEY:
            logger.error("RESEND_API_KEY not configured")
            return False

        # Format attachments for Resend
        resend_attachments = []
        if attachments:
            import base64
            for attachment in attachments:
                if attachment.get('content'):
                    resend_attachments.append({
                        "filename": attachment.get('filename', 'attachment'),
                        "content": base64.b64encode(attachment['content']).decode('utf-8')
                    })

        params = {
            "from": f"{settings.EMAILS_FROM_NAME} <{settings.EMAILS_FROM_EMAIL}>",
            "to": [email_to],
            "subject": subject,
            "html": html_content,
        }
        
        if resend_attachments:
            params["attachments"] = resend_attachments

        resend.Emails.send(params)
        logger.info(f"Email sent successfully to {email_to} via Resend")
        return True
    except Exception as e:
        logger.error(f"Failed to send email to {email_to} via Resend: {e}")
        return False

async def send_email(
    email_to: EmailStr,
    subject: str = "",
    html_content: str = "",
    attachments: Optional[List[dict]] = None,
) -> bool:
    """
    Send an email. 
    Prioritizes Resend API if RESEND_API_KEY is configured.
    Falls back to SMTP if API key is missing.
    """
    if settings.RESEND_API_KEY:
        return await anyio.to_thread.run_sync(
            _send_email_resend_sync, email_to, subject, html_content, attachments
        )
    
    # Fallback/Default to SMTP
    return await anyio.to_thread.run_sync(
        _send_email_sync, email_to, subject, html_content, attachments
    )

async def send_welcome_email(email_to: EmailStr, name: str, doctor_name: str = "su doctora") -> bool:
    subject = "A Mi Ciclo"
    try:
        with open("app/templates/welcome_email.html", "r", encoding="utf-8") as f:
            template = f.read()
        
        html_content = template.replace("{{name}}", name).replace("{{doctor_name}}", doctor_name)
        return await send_email(email_to, subject, html_content)
    except FileNotFoundError:
        # Fallback template if file missing
        html_content = f"<h1>Hola {name}!</h1><p>Bienvenida a A Mi Ciclo. Atentamente, Dra. {doctor_name}.</p>"
        return await send_email(email_to, subject, html_content)
