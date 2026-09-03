import requests
import logging
import threading
import time
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

# Cache en memoria SOLO para uso de emergencia si fallan las APIs
_RATE_CACHE = None
_CACHE_TIME = None
_LAST_ALERT_TIME = None

# Bloqueos (Locks) para evitar race conditions
_alert_lock = threading.Lock()
_cache_lock = threading.Lock()

def _update_cache(rate: float):
    """Actualiza la caché de forma segura entre hilos."""
    global _RATE_CACHE, _CACHE_TIME
    with _cache_lock:
        _RATE_CACHE = rate
        _CACHE_TIME = datetime.now()

def _get_from_cache():
    """Lee la caché de forma segura."""
    with _cache_lock:
        return _RATE_CACHE, _CACHE_TIME

def _alert_superadmin(reason: str, critical: bool = False):
    """
    Envía un correo al superadmin alertando sobre el fallo de las APIs de moneda.
    Máximo 1 vez por hora gracias a un Thread Lock atómico.
    """
    global _LAST_ALERT_TIME
    
    with _alert_lock:
        if _LAST_ALERT_TIME and datetime.now() - _LAST_ALERT_TIME < timedelta(hours=1):
            return  # Evitar spam de correos
            
        try:
            from app.services.email import send_email
            admin_email = "costbaseia@gmail.com"
            
            nivel_str = "CRÍTICO (Sin caché)" if critical else "ADVERTENCIA (Usando caché antigua)"
            color = "#dc2626" if critical else "#ca8a04"
            
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
            subject = f"⚠️ ALERTA {nivel_str}: APIs de Dólar"
            send_email(admin_email, subject, html)
            _LAST_ALERT_TIME = datetime.now()
        except Exception as e:
            # Fallback de envío de correo
            logger.critical(f"ALERTA CRÍTICA: Fallo de APIs de dólar. Error original: {reason}")
            logger.critical(f"Además, no se pudo enviar el correo de alerta al superadmin: {e}")

def get_bcv_rate() -> float:
    """
    Obtiene la tasa oficial del BCV en tiempo real.
    SIEMPRE consulta las APIs primero. Si fallan, recurre a caché o fallback fijo.
    """
    from app.core.config import settings
    
    error_details = []

    # Intento 1: DolarApi
    for intento in range(2):
        try:
            response = requests.get("https://ve.dolarapi.com/v1/dolares", timeout=5)
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    encontrado = False
                    for item in data:
                        if isinstance(item, dict) and (item.get("fuente") == "oficial" or item.get("nombre", "").upper() == "BCV"):
                            encontrado = True
                            rate = float(item.get("promedio", 0))
                            if rate > 0:
                                logger.info(f"Tasa BCV obtenida exitosamente desde DolarApi: {rate}")
                                _update_cache(rate)
                                return rate
                    if not encontrado:
                        error_details.append("DolarApi: Formato JSON no esperado, no se encontró BCV.")
                        break # No reintentar si el formato está mal
                else:
                    error_details.append("DolarApi: Se esperaba una lista JSON.")
                    break
            elif response.status_code == 429:
                if intento == 0:
                    time.sleep(2)
                    continue
                error_details.append("DolarApi: 429 Límite de peticiones alcanzado tras reintento.")
            else:
                error_details.append(f"DolarApi Status: {response.status_code}")
                break
        except ValueError:
            error_details.append("DolarApi: Respuesta no es un JSON válido.")
            break
        except Exception as e:
            error_details.append(f"DolarApi Exception: {type(e).__name__}")
            break

    # Intento 2: CotizaVe (Respaldo)
    for intento in range(2):
        try:
            headers = {"X-API-Key": "ctz_live_67bV8npPYgRPxKyxNqPi6T5qIfGHTWC7e4pb2T"}
            response = requests.get("https://api.cotizave.com/v1/fx/rates", headers=headers, timeout=5)
            if response.status_code == 200:
                data = response.json()
                bcv_rate = None
                
                if isinstance(data, dict):
                    if "index" in data and isinstance(data["index"], dict) and "components" in data["index"]:
                        bcv_rate = data["index"]["components"].get("bcv")
                    
                    if not bcv_rate and "rates" in data and isinstance(data["rates"], list):
                        for rate_item in data["rates"]:
                            if isinstance(rate_item, dict) and (rate_item.get("market") in ["reference", "bcv"] or rate_item.get("type") == "reference"):
                                bcv_rate = rate_item.get("mid")
                                break
                                
                if bcv_rate is not None:
                    val = float(bcv_rate)
                    if val > 0:
                        logger.info(f"Tasa BCV obtenida exitosamente desde CotizaVe: {val}")
                        _update_cache(val)
                        return val
                error_details.append("CotizaVe: Estructura JSON no esperada o campo no encontrado.")
                break
            elif response.status_code == 429:
                if intento == 0:
                    time.sleep(2)
                    continue
                error_details.append("CotizaVe: 429 Límite de peticiones alcanzado (Revisa cuota).")
            else:
                error_details.append(f"CotizaVe Status: {response.status_code}")
                break
        except ValueError:
            error_details.append("CotizaVe: Respuesta no es un JSON válido.")
            break
        except Exception as e:
            error_details.append(f"CotizaVe Exception: {type(e).__name__}")
            break

    error_reason = " | ".join(error_details)
    cached_rate, cache_time = _get_from_cache()

    # Fallback 3: Caché
    if cached_rate is not None:
        cache_age_minutes = (datetime.now() - cache_time).total_seconds() / 60 if cache_time else 0
        logger.warning(f"Usando tasa BCV en caché (Antigüedad: {cache_age_minutes:.1f} min). Errores: {error_reason}")
        
        # Solo alertar si la caché es antigua (> 30 min)
        if cache_age_minutes > 30:
            reason_with_cache = f"{error_reason}<br/><br/><i>El sistema operó usando una caché de {cache_age_minutes:.1f} minutos de antigüedad.</i>"
            _alert_superadmin(reason_with_cache, critical=False)
            
        return cached_rate

    # Fallback 4: Emergencia
    _alert_superadmin(error_reason, critical=True)
    fallback_value = getattr(settings, "BCV_FALLBACK_RATE", 36.65)
    logger.critical(f"Fallo CRÍTICO de APIs de dólar. Sin caché. Retornando valor de emergencia fijo: {fallback_value}")
    return fallback_value
