import smtplib
import os
import time
from datetime import datetime, timezone
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
from typing import Optional, List, Union, Dict, Any, Tuple
import requests
from app.core.config import settings
from app.core.logging import logger

# Telemetría en memoria para observabilidad y monitoreo 24/7 del servicio de correos
EMAIL_TELEMETRY: Dict[str, Any] = {
    "status": "healthy",
    "active_provider": "simulation",
    "total_sent": 0,
    "total_errors": 0,
    "last_delivery": None,
    "last_error": None,
    "recent_history": [],
}


def _record_delivery_attempt(
    recipient: str,
    subject: str,
    status: str,
    provider: str,
    error_detail: Optional[str] = None,
    solution_hint: Optional[str] = None,
    latency_ms: float = 0.0,
) -> None:
    now_iso = datetime.now(timezone.utc).isoformat()
    record: Dict[str, Any] = {
        "timestamp": now_iso,
        "recipient": recipient,
        "subject": subject,
        "status": status,
        "provider": provider,
        "error_detail": error_detail,
        "solution_hint": solution_hint,
        "latency_ms": latency_ms,
    }
    EMAIL_TELEMETRY["last_delivery"] = record
    if status == "error":
        EMAIL_TELEMETRY["total_errors"] = EMAIL_TELEMETRY.get("total_errors", 0) + 1
        EMAIL_TELEMETRY["status"] = "error"
        EMAIL_TELEMETRY["last_error"] = record
    elif status == "simulated":
        EMAIL_TELEMETRY["status"] = "simulated"
    else:
        EMAIL_TELEMETRY["total_sent"] = EMAIL_TELEMETRY.get("total_sent", 0) + 1
        if EMAIL_TELEMETRY["status"] != "error":
            EMAIL_TELEMETRY["status"] = "healthy"

    history = EMAIL_TELEMETRY.setdefault("recent_history", [])
    history.append(record)
    if len(history) > 15:
        EMAIL_TELEMETRY["recent_history"] = history[-15:]


def _send_resend(
    to_email: Union[str, List[str]],
    subject: str,
    html_content: str,
    attachments: Optional[List[dict]] = None
) -> Tuple[bool, Optional[str], Optional[str], Optional[int]]:
    """
    Envía correo vía API HTTP de Resend.
    Retorna: (éxito: bool, error_detail: Optional[str], solution_hint: Optional[str], http_code: Optional[int])
    """
    recipient_list = [to_email] if isinstance(to_email, str) else to_email
    headers = {
        "Authorization": f"Bearer {settings.RESEND_API_KEY}",
        "Content-Type": "application/json"
    }
    data: Dict[str, Any] = {
        "from": settings.RESEND_FROM_EMAIL,
        "to": recipient_list,
        "subject": subject,
        "html": html_content
    }
    if attachments:
        data["attachments"] = attachments

    try:
        response = requests.post("https://api.resend.com/emails", json=data, headers=headers, timeout=12)
        if response.status_code >= 400:
            err_text = response.text
            err_msg = err_text
            try:
                err_json = response.json()
                if isinstance(err_json, dict) and "message" in err_json:
                    err_msg = err_json["message"]
            except Exception:
                err_msg = err_text

            solution_hint: Optional[str] = None
            if response.status_code == 403:
                solution_hint = (
                    "El dominio remitente no está verificado en Resend o estás usando una clave de pruebas. "
                    "Para probar, verifica tu dominio en resend.com/domains o usa el remitente de pruebas oficial."
                )
            elif response.status_code == 401:
                solution_hint = "La API Key de Resend es inválida o expiró. Genera una nueva en resend.com/api-keys."
            elif response.status_code == 422:
                solution_hint = f"Parámetros de envío inválidos en Resend: {err_msg}"
            else:
                solution_hint = f"Resend rechazó la solicitud con código {response.status_code}."

            logger.error(f"[EMAIL] Resend rechazó el correo a {to_email}. HTTP {response.status_code}: {err_msg}")
            return False, f"Resend HTTP {response.status_code}: {err_msg}", solution_hint, response.status_code

        res_json = response.json() if response.content else {}
        logger.info(f"[EMAIL] Correo enviado exitosamente a {to_email} vía Resend. ID: {res_json.get('id', 'N/A')}")
        return True, None, None, response.status_code
    except Exception as exc:
        logger.error(f"[EMAIL] Error de conexión con Resend enviando a {to_email}: {exc}", exc_info=True)
        return False, f"Error de conexión con Resend: {str(exc)}", "Verifique la conectividad de red con api.resend.com.", None


def _send_smtp(
    to_email: Union[str, List[str]],
    subject: str,
    html_content: str,
    attachments: Optional[List[dict]] = None
) -> Tuple[bool, Optional[str], Optional[str]]:
    """
    Envía correo vía protocolo SMTP estándar.
    Retorna: (éxito: bool, error_detail: Optional[str], solution_hint: Optional[str])
    """
    recipients = [to_email] if isinstance(to_email, str) else to_email
    sender = settings.EMAILS_FROM_EMAIL or settings.SMTP_USER or "info@costbase.net"

    msg = MIMEMultipart("alternative")
    msg["From"] = f"{settings.EMAILS_FROM_NAME} <{sender}>"
    msg["To"] = ", ".join(recipients)
    msg["Subject"] = subject
    msg.attach(MIMEText(html_content, "html", "utf-8"))

    if attachments:
        for att in attachments:
            content = att.get("content")
            filename = att.get("filename", "attachment")
            if content:
                part = MIMEBase("application", "octet-stream")
                part.set_payload(content)
                encoders.encode_base64(part)
                part.add_header("Content-Disposition", f'attachment; filename="{filename}"')
                msg.attach(part)

    try:
        host = settings.SMTP_HOST or "smtp.gmail.com"
        port = settings.SMTP_PORT or 587
        with smtplib.SMTP(host, port, timeout=15) as server:
            if settings.SMTP_TLS:
                server.starttls()
            if settings.SMTP_USER and settings.SMTP_PASSWORD:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(sender, recipients, msg.as_string())
        logger.info(f"[EMAIL] Correo enviado exitosamente a {recipients} vía SMTP ({host}:{port})")
        return True, None, None
    except smtplib.SMTPAuthenticationError as auth_err:
        err_msg = f"Fallo de autenticación SMTP ({settings.SMTP_USER}): {auth_err}"
        logger.error(f"[EMAIL] {err_msg}", exc_info=True)
        return False, err_msg, "Las credenciales SMTP (usuario o contraseña de aplicación) no fueron aceptadas por el servidor."
    except Exception as exc:
        err_msg = f"Error SMTP ({settings.SMTP_HOST}): {str(exc)}"
        logger.error(f"[EMAIL] {err_msg}", exc_info=True)
        return False, err_msg, "Verifique el host SMTP, el puerto (587) y que el firewall permita conexiones salientes."


def send_email(to_email: Union[str, List[str]], subject: str, html_content: str, attachments: Optional[List[dict]] = None) -> bool:
    if not to_email:
        raise ValueError("to_email no puede estar vacío")
    if not subject:
        raise ValueError("subject no puede estar vacío")

    t0 = time.time()
    recipient_str = ", ".join(to_email) if isinstance(to_email, list) else str(to_email)

    resend_configured = bool(
        settings.RESEND_API_KEY
        and settings.RESEND_API_KEY.startswith("re_")
        and settings.RESEND_API_KEY != "your_resend_api_key_here"
    )
    smtp_configured = bool(
        settings.SMTP_HOST
        and settings.SMTP_USER
        and settings.SMTP_PASSWORD
    )

    # 1. Intentar con Resend si está configurado
    if resend_configured:
        EMAIL_TELEMETRY["active_provider"] = "resend"
        success, error_detail, solution_hint, _ = _send_resend(to_email, subject, html_content, attachments)
        latency = round((time.time() - t0) * 1000, 2)
        if success:
            _record_delivery_attempt(recipient_str, subject, "success", "resend", latency_ms=latency)
            return True

        # Fallback automático a SMTP si Resend falló y SMTP está configurado
        if smtp_configured:
            logger.warning(f"[EMAIL] Resend falló, ejecutando fallback inmediato a SMTP para {recipient_str}")
            s_ok, s_err, s_hint = _send_smtp(to_email, subject, html_content, attachments)
            latency = round((time.time() - t0) * 1000, 2)
            if s_ok:
                _record_delivery_attempt(recipient_str, subject, "success", "smtp_fallback", latency_ms=latency)
                return True
            error_detail = f"{error_detail} | Fallback SMTP también falló: {s_err}"

        _record_delivery_attempt(recipient_str, subject, "error", "resend", error_detail=error_detail, solution_hint=solution_hint, latency_ms=latency)
        return False

    # 2. Intentar con SMTP si está configurado
    if smtp_configured:
        EMAIL_TELEMETRY["active_provider"] = "smtp"
        success, error_detail, solution_hint = _send_smtp(to_email, subject, html_content, attachments)
        latency = round((time.time() - t0) * 1000, 2)
        if success:
            _record_delivery_attempt(recipient_str, subject, "success", "smtp", latency_ms=latency)
            return True

        _record_delivery_attempt(recipient_str, subject, "error", "smtp", error_detail=error_detail, solution_hint=solution_hint, latency_ms=latency)
        return False

    # 3. Ningún proveedor activo: Modo Simulación
    EMAIL_TELEMETRY["active_provider"] = "simulation"
    latency = round((time.time() - t0) * 1000, 2)
    err_detail = "RESEND_API_KEY no configurada o es placeholder ('your_resend_api_key_here') y SMTP_PASSWORD no configurado en backend/.env."
    sol_hint = "Defina RESEND_API_KEY con una clave válida de Resend (re_...) o configure SMTP_PASSWORD en el archivo de entorno."
    logger.warning(f"[EMAIL] SIMULACIÓN - {err_detail} Para: {recipient_str} | Asunto: {subject}")
    _record_delivery_attempt(recipient_str, subject, "simulated", "simulation", error_detail=err_detail, solution_hint=sol_hint, latency_ms=latency)
    return True


def test_verification_delivery(target_email: str) -> Dict[str, Any]:
    """
    Envía un código de prueba y realiza diagnóstico en vivo del transporte de correo.
    Retorna métricas detalladas para el superadministrador.
    """
    if not target_email or "@" not in target_email:
        raise ValueError("Dirección de correo electrónico inválida para la prueba")

    test_code = "998877"
    subject = "Prueba de Diagnóstico: Código de Verificación CostBase"
    html_content = f"""
    <html>
      <body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
        <h2 style="color: #1A6BB5;">Prueba de Diagnóstico del Sistema</h2>
        <p>Este es un correo de prueba emitido por el Super Administrador para validar la entrega de códigos de verificación.</p>
        <p>Tu código de prueba es:</p>
        <p style="margin: 30px 0; font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #1A6BB5;">
            {test_code}
        </p>
        <p>Si recibes este mensaje, el sistema de transporte de correos está 100% operativo.</p>
        <hr style="border: 0; border-top: 1px solid #eaeaea; margin: 30px 0;" />
        <p style="font-size: 12px; color: #888;">CostBase Platform Diagnostics.</p>
      </body>
    </html>
    """

    t0 = time.time()
    resend_configured = bool(
        settings.RESEND_API_KEY
        and settings.RESEND_API_KEY.startswith("re_")
        and settings.RESEND_API_KEY != "your_resend_api_key_here"
    )
    smtp_configured = bool(
        settings.SMTP_HOST
        and settings.SMTP_USER
        and settings.SMTP_PASSWORD
    )

    if resend_configured:
        ok, err_detail, sol_hint, code = _send_resend(target_email, subject, html_content)
        latency = round((time.time() - t0) * 1000, 2)
        if ok:
            _record_delivery_attempt(target_email, subject, "success", "resend", latency_ms=latency)
            return {
                "success": True,
                "provider": "resend",
                "status_code": code,
                "latency_ms": latency,
                "message": f"Correo de prueba enviado exitosamente a {target_email} vía Resend en {latency} ms."
            }
        else:
            _record_delivery_attempt(target_email, subject, "error", "resend", error_detail=err_detail, solution_hint=sol_hint, latency_ms=latency)
            return {
                "success": False,
                "provider": "resend",
                "status_code": code,
                "latency_ms": latency,
                "message": f"Fallo al enviar correo vía Resend: {err_detail}",
                "error_detail": err_detail,
                "solution_hint": sol_hint
            }
    elif smtp_configured:
        ok, err_detail, sol_hint = _send_smtp(target_email, subject, html_content)
        latency = round((time.time() - t0) * 1000, 2)
        if ok:
            _record_delivery_attempt(target_email, subject, "success", "smtp", latency_ms=latency)
            return {
                "success": True,
                "provider": "smtp",
                "latency_ms": latency,
                "message": f"Correo de prueba enviado exitosamente a {target_email} vía SMTP en {latency} ms."
            }
        else:
            _record_delivery_attempt(target_email, subject, "error", "smtp", error_detail=err_detail, solution_hint=sol_hint, latency_ms=latency)
            return {
                "success": False,
                "provider": "smtp",
                "latency_ms": latency,
                "message": f"Fallo al enviar correo vía SMTP: {err_detail}",
                "error_detail": err_detail,
                "solution_hint": sol_hint
            }
    else:
        latency = round((time.time() - t0) * 1000, 2)
        err_msg = "No hay ningún proveedor real configurado (RESEND_API_KEY o credenciales SMTP). El sistema está en modo simulación."
        sol_hint = "Configure una API Key válida de Resend en backend/.env (RESEND_API_KEY=re_...) o credenciales SMTP en config.py."
        _record_delivery_attempt(target_email, subject, "simulated", "simulation", error_detail=err_msg, solution_hint=sol_hint, latency_ms=latency)
        return {
            "success": False,
            "provider": "simulation",
            "latency_ms": latency,
            "message": err_msg,
            "error_detail": err_msg,
            "solution_hint": sol_hint
        }


def get_verification_service_health() -> Dict[str, Any]:
    """
    Retorna estado de salud y telemetría del sistema de entrega de códigos de verificación.
    """
    resend_configured = bool(
        settings.RESEND_API_KEY
        and settings.RESEND_API_KEY.startswith("re_")
        and settings.RESEND_API_KEY != "your_resend_api_key_here"
    )
    smtp_configured = bool(
        settings.SMTP_HOST
        and settings.SMTP_USER
        and settings.SMTP_PASSWORD
    )

    if resend_configured:
        active_provider = "resend"
    elif smtp_configured:
        active_provider = "smtp"
    else:
        active_provider = "simulation"

    last_error = EMAIL_TELEMETRY.get("last_error")
    last_delivery = EMAIL_TELEMETRY.get("last_delivery")

    if last_error and (last_delivery is None or last_delivery.get("status") == "error"):
        calc_status = "error"
    elif not resend_configured and not smtp_configured:
        calc_status = "simulated"
    else:
        calc_status = "healthy"

    return {
        "status": calc_status,
        "active_provider": active_provider,
        "resend_configured": resend_configured,
        "resend_from_email": settings.RESEND_FROM_EMAIL,
        "smtp_configured": smtp_configured,
        "smtp_host": settings.SMTP_HOST,
        "smtp_port": settings.SMTP_PORT,
        "smtp_user": settings.SMTP_USER,
        "total_sent": EMAIL_TELEMETRY.get("total_sent", 0),
        "total_errors": EMAIL_TELEMETRY.get("total_errors", 0),
        "last_delivery": last_delivery,
        "last_error": last_error,
        "recent_history": EMAIL_TELEMETRY.get("recent_history", [])[-10:],
    }


def reset_email_telemetry_errors() -> None:
    """Restablece el estado de error de la telemetría tras una auto-reparación exitosa."""
    EMAIL_TELEMETRY["last_error"] = None
    EMAIL_TELEMETRY["status"] = "healthy"


def send_reset_password_email(email_to: str, code: str) -> bool:
    if not email_to:
        raise ValueError("email_to no puede estar vacío")
    if not code:
        raise ValueError("code no puede estar vacío")

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


def send_verification_email(email_to: str, code: str) -> bool:
    if not email_to:
        raise ValueError("email_to no puede estar vacío")
    if not code:
        raise ValueError("code no puede estar vacío")

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


def send_backup_email(to_email: str, budget_name: str, backup_file_path: str, backup_filename: str) -> bool:
    """Envía un correo con el archivo de backup adjunto"""
    if not to_email:
        raise ValueError("to_email no puede estar vacío")
    if not backup_file_path:
        raise ValueError("backup_file_path no puede estar vacío")

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

    resend_configured = bool(
        settings.RESEND_API_KEY
        and settings.RESEND_API_KEY.startswith("re_")
        and settings.RESEND_API_KEY != "your_resend_api_key_here"
    )

    if not resend_configured and not (settings.SMTP_HOST and settings.SMTP_USER and settings.SMTP_PASSWORD):
        logger.warning("SIMULACIÓN DE CORREO CON ADJUNTO (Sin RESEND_API_KEY ni SMTP configurados)")
        logger.warning(f"Para: {to_email} | Asunto: {subject} | Archivo: {backup_filename}")
        return True

    try:
        msg = MIMEMultipart()
        msg['From'] = settings.RESEND_FROM_EMAIL
        msg['To'] = to_email
        msg['Subject'] = subject
        msg.attach(MIMEText(html_content, 'html'))

        with open(backup_file_path, 'rb') as attachment:
            part = MIMEBase('application', 'octet-stream')
            part.set_payload(attachment.read())
            encoders.encode_base64(part)
            part.add_header('Content-Disposition', f'attachment; filename= {backup_filename}')
            msg.attach(part)

        if settings.SMTP_HOST and settings.SMTP_USER and settings.SMTP_PASSWORD:
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT or 587) as server:
                if settings.SMTP_TLS:
                    server.starttls()
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.send_message(msg)
            logger.info(f"Correo con backup enviado exitosamente a {to_email} vía SMTP")
            return True
        else:
            # Si no hay credenciales SMTP pero hay Resend, enviar sin adjunto pesado o registrar
            logger.warning("SMTP no configurado para adjuntos binarios. Enviando notificación estándar.")
            return send_email(to_email, subject, html_content)
    except Exception as e:
        logger.error(f"Error al enviar correo con backup a {to_email}: {str(e)}", exc_info=True)
        return False


def send_subscription_request_email(user_email: str, plan_name: str) -> bool:
    """Envía un correo a los superadministradores notificando que un usuario quiere adquirir un plan"""
    if not user_email:
        raise ValueError("user_email no puede estar vacío")
    if not plan_name:
        raise ValueError("plan_name no puede estar vacío")

    recipients: List[str] = ["admin@arko360.net"]
    if settings.ADMIN_EMAIL and settings.ADMIN_EMAIL not in recipients:
        recipients.append(settings.ADMIN_EMAIL)
    if "costbaseia@gmail.com" not in recipients:
        recipients.append("costbaseia@gmail.com")

    subject = f"🚀 Nueva solicitud de suscripción: {plan_name}"
    html_content = f"""
    <html>
      <body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
        <h2 style="color: #1A6BB5;">¡Nueva Solicitud de Plan Premium!</h2>
        <p>Un usuario ha solicitado adquirir un plan en CostBase.</p>
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <p style="margin: 0 0 10px 0;"><strong>Usuario (Email):</strong> {user_email}</p>
            <p style="margin: 0;"><strong>Plan Solicitado:</strong> {plan_name}</p>
        </div>
        <p>Por favor, contacta a este usuario lo antes posible para gestionar el pago y activarle su nuevo plan desde el panel de administración.</p>
        <hr style="border: 0; border-top: 1px solid #eaeaea; margin: 30px 0;" />
        <p style="font-size: 12px; color: #888;">El equipo de CostBase.</p>
      </body>
    </html>
    """
    return send_email(recipients, subject, html_content)


def send_payment_instructions_email(user_email: str, plan_name: str) -> bool:
    """Envía un correo al usuario con las instrucciones de pago"""
    if not user_email:
        raise ValueError("user_email no puede estar vacío")
    if not plan_name:
        raise ValueError("plan_name no puede estar vacío")

    subject = f"Instrucciones para activar tu Plan {plan_name} en CostBase 🚀"
    bdv_logo = "https://costbase.net/images/bdv_logo.png"
    binance_logo = "https://cryptologos.cc/logos/tether-usdt-logo.png"

    prices = {
        "Básico": 9.99,
        "Profesional": 19.99,
        "Experto": 34.99
    }
    usd_price = prices.get(plan_name, 9.99)

    from app.services.currency_service import get_bcv_rate
    bcv_rate = get_bcv_rate()
    monto_bs = usd_price * bcv_rate

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
    return send_email(user_email, subject, html_content)


def send_plan_activated_email(user_email: str, plan_name: str, is_test_mode: bool = False) -> bool:
    if not user_email:
        raise ValueError("user_email no puede estar vacío")
    if not plan_name:
        raise ValueError("plan_name no puede estar vacío")

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
    freq_text = "actualización quincenal" if frequency == "quincenal" else "actualización mensual"

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
