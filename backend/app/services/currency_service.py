import requests
import logging
import threading
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

# Cache en memoria SOLO para uso de emergencia si fallan las APIs
_RATE_CACHE = None
_CACHE_TIME = None
_LAST_ALERT_TIME = None

# Bloqueo (Lock) para evitar race conditions al enviar correos
_alert_lock = threading.Lock()

def _alert_superadmin(reason: str, critical: bool = False):
    """
    Envía un correo al superadmin alertando sobre el fallo de las APIs de moneda.
    Máximo 1 vez por hora gracias a un Thread Lock atómico.
    """
    global _LAST_ALERT_TIME
    
    with _alert_lock:
        if _LAST_ALERT_TIME and datetime.now() - _LAST_ALERT_TIME < timedelta(hours=1):
            return  # Evitar spam de correos si hay muchas solicitudes concurrentes fallidas
            
        try:
            from app.services.email import send_email
            admin_email = "costbaseia@gmail.com"
            
            nivel_str = "CRÍTICO (Sin caché)" if critical else "ADVERTENCIA (Usando caché)"
            color = "#dc2626" if critical else "#ca8a04"  # Rojo o Amarillo/Naranja
            
            html = f"""
            <div style="font-family: sans-serif; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
                <h2 style='color: {color};'>⚠️ Alerta de Sistema - CostBase</h2>
                <p><strong>Nivel de Alerta:</strong> {nivel_str}</p>
                <p>Las APIs de consulta de tasa BCV han fallado al procesar una solicitud.</p>
                <div style="background-color: #f3f4f6; padding: 10px; border-radius: 4px; margin: 15px 0;">
                    <strong>Detalle del Error:</strong><br/>
                    <code style="display: block; margin-top: 5px;">{reason}</code>
                </div>
                <p><strong>Hora del fallo:</strong> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
            </div>
            """
            subject = f"⚠️ ALERTA {nivel_str}: APIs de Dólar Caídas"
            send_email(admin_email, subject, html)
            
            # Actualizamos atómicamente la variable de tiempo
            _LAST_ALERT_TIME = datetime.now()
        except Exception as e:
            logger.error(f"No se pudo enviar alerta al superadmin: {e}")

def get_bcv_rate() -> float:
    """
    Obtiene la tasa oficial del BCV en tiempo real.
    SIEMPRE consulta las APIs primero. Si fallan, recurre a caché o fallback fijo.
    """
    global _RATE_CACHE, _CACHE_TIME
    
    error_details = []

    # Intento 1: DolarApi
    try:
        response = requests.get("https://ve.dolarapi.com/v1/dolares", timeout=5)
        if response.status_code == 200:
            data = response.json()
            encontrado = False
            for item in data:
                if item.get("fuente") == "oficial" or item.get("nombre", "").upper() == "BCV":
                    encontrado = True
                    rate = float(item.get("promedio", 0))
                    if rate > 0:
                        _RATE_CACHE = rate
                        _CACHE_TIME = datetime.now()
                        return rate
            if not encontrado:
                error_details.append("DolarApi: Formato JSON no esperado, no se encontró BCV.")
        elif response.status_code == 429:
            error_details.append("DolarApi: 429 Límite de peticiones alcanzado.")
        else:
            error_details.append(f"DolarApi Status: {response.status_code}")
    except ValueError:
        error_details.append("DolarApi: Respuesta no es un JSON válido.")
        logger.warning("DolarApi devolvió contenido que no es JSON.")
    except Exception as e:
        error_details.append(f"DolarApi Exception: {type(e).__name__}")
        logger.warning(f"Error consultando DolarApi: {e}")

    # Intento 2: CotizaVe (Respaldo)
    try:
        headers = {"X-API-Key": "ctz_live_67bV8npPYgRPxKyxNqPi6T5qIfGHTWC7e4pb2T"}
        response = requests.get("https://api.cotizave.com/v1/fx/rates", headers=headers, timeout=5)
        if response.status_code == 200:
            data = response.json()
            bcv_rate = None
            
            # Intento de extracción robusto
            if isinstance(data, dict):
                if "index" in data and isinstance(data["index"], dict) and "components" in data["index"]:
                    bcv_rate = data["index"]["components"].get("bcv")
                
                if not bcv_rate and "rates" in data and isinstance(data["rates"], list):
                    for rate_item in data["rates"]:
                        if isinstance(rate_item, dict) and rate_item.get("market") in ["reference", "bcv"] or rate_item.get("type") == "reference":
                            bcv_rate = rate_item.get("mid")
                            break
                            
            if bcv_rate is not None:
                val = float(bcv_rate)
                if val > 0:
                    _RATE_CACHE = val
                    _CACHE_TIME = datetime.now()
                    return val
            error_details.append("CotizaVe: Estructura JSON no esperada, campo 'bcv' o 'reference' no encontrado.")
        elif response.status_code == 429:
            error_details.append("CotizaVe: 429 Límite de peticiones alcanzado (Revisa cuota de 1500 req).")
        else:
            error_details.append(f"CotizaVe Status: {response.status_code}")
    except ValueError:
        error_details.append("CotizaVe: Respuesta no es un JSON válido.")
        logger.warning("CotizaVe devolvió contenido que no es JSON.")
    except Exception as e:
        error_details.append(f"CotizaVe Exception: {type(e).__name__}")
        logger.warning(f"Error consultando CotizaVe: {e}")

    # Consolidar errores
    error_reason = " | ".join(error_details)

    # Fallback 3: Último valor conocido en caché de memoria (Emergencia)
    if _RATE_CACHE is not None:
        cache_age_hours = (datetime.now() - _CACHE_TIME).total_seconds() / 3600 if _CACHE_TIME else 0
        logger.warning(f"Usando tasa BCV en caché (Antigüedad: {cache_age_hours:.1f}h). Errores: {error_reason}")
        
        # Enviar alerta pero marcarla como advertencia (no crítica)
        reason_with_cache = f"{error_reason}<br/><br/><i>Nota: El sistema operó con éxito usando un caché de {cache_age_hours:.1f} horas de antigüedad.</i>"
        _alert_superadmin(reason_with_cache, critical=False)
        return _RATE_CACHE

    # Fallback 4 de emergencia final
    _alert_superadmin(error_reason, critical=True)
    fallback_value = 36.65
    logger.error(f"Fallo CRÍTICO de APIs de dólar. Sin caché. Retornando valor de emergencia fijo: {fallback_value}")
    return fallback_value
