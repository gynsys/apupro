import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
from typing import Optional, List, Union
import logging
import requests
from app.core.config import settings

logger = logging.getLogger(__name__)

def send_email(to_email: Union[str, List[str]], subject: str, html_content: str, attachments: Optional[List[dict]] = None) -> bool:
    if not settings.RESEND_API_KEY or not settings.RESEND_API_KEY.startswith("re_"):
        logger.warning(f"[EMAIL] SIMULACIÓN - RESEND_API_KEY no configurada o inválida. Para: {to_email} | Asunto: {subject}")
        return True
        
    try:
        recipient_list = [to_email] if isinstance(to_email, str) else to_email
        logger.info(f"[EMAIL] Enviando a {recipient_list} via Resend. From: {settings.RESEND_FROM_EMAIL}")
        headers = {
            "Authorization": f"Bearer {settings.RESEND_API_KEY}",
            "Content-Type": "application/json"
        }
        data = {
            "from": settings.RESEND_FROM_EMAIL,
            "to": recipient_list,
            "subject": subject,
            "html": html_content
        }
        if attachments:
            data["attachments"] = attachments
        
        response = requests.post("https://api.resend.com/emails", json=data, headers=headers, timeout=15)
        
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

def send_subscription_request_email(user_email: str, plan_name: str):
    """Envía un correo a soporte/admin notificando que un usuario quiere adquirir un plan"""
    support_email = "costbaseia@gmail.com"
    subject = f"🚀 Nueva solicitud de suscripción: {plan_name}"
    html_content = f"""
    <html>
      <body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
        <h2 style="color: #1A6BB5;">¡Nueva Solicitud de Plan Premium!</h2>
        <p>Un usuario ha alcanzado el límite de su cuenta demo y desea adquirir un plan pago.</p>
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <p style="margin: 0 0 10px 0;"><strong>Usuario (Email):</strong> {user_email}</p>
            <p style="margin: 0;"><strong>Plan de Interés:</strong> {plan_name}</p>
        </div>
        <p>Por favor, contacta a este usuario lo antes posible para gestionar el pago y activarle su nuevo plan desde el panel de administración.</p>
        <hr style="border: 0; border-top: 1px solid #eaeaea; margin: 30px 0;" />
        <p style="font-size: 12px; color: #888;">El equipo de CostBase.</p>
      </body>
    </html>
    """
    
    # Enviar correo al equipo de soporte
    return send_email(support_email, subject, html_content)


def send_payment_instructions_email(user_email: str, plan_name: str):
    """Envía un correo al usuario con las instrucciones de pago"""
    subject = f"Instrucciones para activar tu Plan {plan_name} en CostBase 🚀"
    
    # URL of logos
    bdv_logo = "https://costbase.net/images/bdv_logo.png"
    binance_logo = "https://cryptologos.cc/logos/tether-usdt-logo.png"

    # Precios
    prices = {
        "Básico": 9.99,
        "Profesional": 19.99,
        "Experto": 34.99
    }
    usd_price = prices.get(plan_name, 9.99)
    
    # Obtener tasa BCV
    from app.services.currency_service import get_bcv_rate
    bcv_rate = get_bcv_rate()
    monto_bs = usd_price * bcv_rate
    
    # Formateo
    monto_bs_str = f"Bs. {monto_bs:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    monto_usd_str = f"${usd_price:,.2f}"

    html_content = f"""
    <html>
      <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #334155; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
            <h2 style="color: #1A6BB5; font-size: 24px; margin-bottom: 5px;">¡Excelente elección!</h2>
            <p style="font-size: 16px; color: #64748b; margin-top: 0;">Hemos recibido tu solicitud para el <strong>Plan {plan_name}</strong></p>
        </div>

        <p>Estás a un paso de desbloquear el poder de la Inteligencia Artificial y no tener límites en tus presupuestos.</p>
        <p>Para completar la activación de tu plan, por favor realiza el pago a través de cualquiera de los siguientes métodos:</p>

        <!-- PAGO MOVIL -->
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 25px 0;">
            <div style="display: flex; align-items: center; margin-bottom: 15px;">
                <img src="{bdv_logo}" alt="BDV" height="24" style="margin-right: 15px; width: auto;" />
                <h3 style="margin: 0; color: #0f172a; font-size: 18px;">Pago Móvil (Banco de Venezuela)</h3>
            </div>
            <p style="margin: 5px 0; font-family: monospace; font-size: 15px;"><strong>Banco:</strong> 0102 (Banco de Venezuela)</p>
            <p style="margin: 5px 0; font-family: monospace; font-size: 15px;"><strong>C.I:</strong> V13409534 📋</p>
            <p style="margin: 5px 0; font-family: monospace; font-size: 15px;"><strong>Teléfono:</strong> 04129972355 📋</p>
            <p style="margin: 10px 0 5px 0; font-family: monospace; font-size: 15px; color: #b91c1c;"><strong>Monto:</strong> {monto_bs_str} 📋 <span style="font-size: 12px; color: #64748b;">(Eqv. a {monto_usd_str} a tasa BCV)</span></p>
        </div>

        <!-- TRANSFERENCIA -->
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 25px 0;">
            <div style="display: flex; align-items: center; margin-bottom: 15px;">
                <img src="{bdv_logo}" alt="BDV" height="24" style="margin-right: 15px; width: auto;" />
                <h3 style="margin: 0; color: #0f172a; font-size: 18px;">Transferencia Bancaria</h3>
            </div>
            <p style="margin: 5px 0; font-family: monospace; font-size: 15px;"><strong>Banco:</strong> Banco de Venezuela</p>
            <p style="margin: 5px 0; font-family: monospace; font-size: 15px;"><strong>Cuenta:</strong> 01020278730000052456 📋</p>
            <p style="margin: 5px 0; font-family: monospace; font-size: 15px;"><strong>Titular:</strong> Pablo Emilio Milano Carrillo</p>
            <p style="margin: 5px 0; font-family: monospace; font-size: 15px;"><strong>C.I:</strong> V13409534 📋</p>
            <p style="margin: 10px 0 5px 0; font-family: monospace; font-size: 15px; color: #b91c1c;"><strong>Monto:</strong> {monto_bs_str} 📋 <span style="font-size: 12px; color: #64748b;">(Eqv. a {monto_usd_str} a tasa BCV)</span></p>
        </div>

        <!-- BINANCE -->
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 25px 0;">
            <div style="display: flex; align-items: center; margin-bottom: 15px;">
                <img src="{binance_logo}" alt="Binance" width="30" style="margin-right: 15px;" />
                <h3 style="margin: 0; color: #0f172a; font-size: 18px;">Binance (USDT)</h3>
            </div>
            <p style="margin: 5px 0; font-size: 15px;"><strong>Red:</strong> TRON (TRC20)</p>
            <p style="margin: 5px 0; font-family: monospace; font-size: 14px; word-break: break-all; background: #e2e8f0; padding: 8px; border-radius: 6px;">
                TLDu8tGVfmydYVTCqefgsxrhwQ8H2tMgGs 📋
            </p>
            <p style="margin: 10px 0 5px 0; font-family: monospace; font-size: 15px; color: #16a34a;"><strong>Monto:</strong> {monto_usd_str} USDT</p>
        </div>

        <h3 style="color: #0f172a;">📩 Siguiente Paso: Reportar Pago</h3>
        <p>Una vez realizado el pago, por favor <strong>reporta tu pago directamente en la plataforma</strong> (botón "Reportar Pago") adjuntando el número de referencia.</p>
        <p>Nuestro equipo verificará la transacción y activará los límites de tu <strong>Plan {plan_name}</strong> en tiempo récord.</p>
        
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 40px 0 20px 0;" />
        <p style="font-size: 13px; color: #94a3b8; text-align: center;">Gracias por confiar en el equipo de CostBase.</p>
      </body>
    </html>
    """
    
    # Enviar correo al usuario
    return send_email(user_email, subject, html_content)




def send_plan_activated_email(user_email: str, plan_name: str, is_test_mode: bool = False):
    subject = f"¡Tu Plan {plan_name} ha sido ACTIVADO exitosamente! 🎉"
    
    html_content = f"""
    <html>
      <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #334155; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
            <h2 style="color: #16a34a; font-size: 24px; margin-bottom: 5px;">¡Plan Activado!</h2>
            <p style="font-size: 16px; color: #64748b; margin-top: 0;">Tu cuenta ha sido actualizada al <strong>Plan {plan_name}</strong></p>
        </div>

        <p>¡Buenas noticias! Hemos verificado tu pago y tu cuenta ya cuenta con todos los límites desbloqueados.</p>
        
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 25px 0;">
            <h3 style="margin-top: 0; color: #0f172a; font-size: 18px;">¿Qué incluye tu plan?</h3>
            <ul style="margin: 0; padding-left: 20px; color: #334155;">
                <li style="margin-bottom: 8px;">Acceso sin límites al <strong>Generador de Partidas con Inteligencia Artificial</strong></li>
                <li style="margin-bottom: 8px;">Límites de Presupuestos y Partidas ampliados a nivel {plan_name}</li>
                <li style="margin-bottom: 8px;">Soporte prioritario</li>
            </ul>
        </div>
        
        <p>Inicia sesión en la plataforma para comenzar a disfrutar de todas estas herramientas.</p>
        
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 40px 0 20px 0;" />
        <p style="font-size: 13px; color: #94a3b8; text-align: center;">Gracias por confiar en el equipo de CostBase.</p>
      </body>
    </html>
    """
    
    try:
        return send_email(user_email, subject, html_content)
    except Exception as e:
        logger.error(f"No se pudo enviar correo de activacion de plan a {user_email}: {e}", exc_info=True)
        return False


def send_database_published_email(to_email: str, db_name: str, frequency: str, plan_name: str) -> bool:
    """Envía notificación por correo cuando se publica una nueva base de datos de precios."""
    if not to_email or not db_name:
        raise ValueError("to_email y db_name son obligatorios")

    subject = f"Nueva Base de Datos Disponible: {db_name} 📊"

    if frequency == "quincenal":
        freq_text = "actualización quincenal"
    else:
        freq_text = "actualización mensual"

    html_content = f"""
    <html>
      <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #334155; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
            <h2 style="color: #0284c7; font-size: 24px; margin-bottom: 5px;">¡Nueva Base de Datos Disponible!</h2>
            <p style="font-size: 16px; color: #64748b; margin-top: 0;">Tu {freq_text} de precios de insumos y materiales ya está activa</p>
        </div>

        <p>Hola,</p>
        <p>Te informamos que se ha publicado una nueva base de datos de costos en CostBase: <strong>{db_name}</strong>.</p>

        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 25px 0;">
            <h3 style="margin-top: 0; color: #0f172a; font-size: 18px;">Detalles de la Actualización</h3>
            <ul style="margin: 0; padding-left: 20px; color: #334155;">
                <li style="margin-bottom: 8px;"><strong>Base de datos:</strong> {db_name}</li>
                <li style="margin-bottom: 8px;"><strong>Ciclo:</strong> {freq_text.capitalize()} (Plan {plan_name})</li>
                <li style="margin-bottom: 8px;"><strong>Beneficio:</strong> Costos y análisis adaptados a las condiciones más recientes del mercado</li>
            </ul>
        </div>

        <p style="font-size: 14px; color: #64748b; margin-top: 20px;">Puedes seleccionarla directamente en el creador de presupuestos o consultar sus partidas en el módulo Cost360.</p>

        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 40px 0 20px 0;" />
        <p style="font-size: 13px; color: #94a3b8; text-align: center;">El equipo de CostBase.</p>
      </body>
    </html>
    """

    try:
        return send_email(to_email, subject, html_content)
    except Exception as e:
        logger.error(f"Error enviando correo de base publicada a {to_email}: {str(e)}", exc_info=True)
        return False

