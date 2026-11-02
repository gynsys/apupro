import redis
import json
import os
import time
import threading
from typing import Optional, Dict, Any, List
from app.core.config import settings
from app.core.logging import logger

class RedisCacheService:
    """
    Servicio para manejar caché de registros pendientes y códigos de verificación.
    Incluye fallback thread-safe en memoria si Redis no está disponible o falla.
    """
    
    def __init__(self) -> None:
        self.redis_client: Optional[redis.Redis] = None
        self._memory_cache: Dict[str, Dict[str, Any]] = {}
        self._lock = threading.Lock()
        self._connect()
    
    def _connect(self) -> None:
        """Establece conexión con Redis."""
        try:
            self.redis_client = redis.from_url(
                settings.REDIS_URL,
                decode_responses=True,
                socket_connect_timeout=3
            )
            self.redis_client.ping()
            logger.info("Redis conectado exitosamente")
        except Exception as e:
            logger.warning(f"No se pudo conectar a Redis ({e}). Se utilizará fallback en memoria.")
            self.redis_client = None

    def _get_client(self) -> Optional[redis.Redis]:
        """Obtiene el cliente Redis, reintentando la conexión si estaba inactivo."""
        if self.redis_client is None:
            self._connect()
        return self.redis_client

    def _set_memory(self, key: str, value: Any, expiry_seconds: int) -> None:
        with self._lock:
            self._memory_cache[key] = {
                "value": value,
                "expires_at": time.time() + expiry_seconds
            }

    def _get_memory(self, key: str) -> Optional[Any]:
        with self._lock:
            item = self._memory_cache.get(key)
            if not item:
                return None
            if time.time() > item["expires_at"]:
                self._memory_cache.pop(key, None)
                return None
            return item["value"]

    def _delete_memory(self, key: str) -> None:
        with self._lock:
            self._memory_cache.pop(key, None)

    def store_pending_registration(self, email: str, registration_data: Dict[str, Any], expiry_seconds: int = 900) -> bool:
        """
        Almacena datos de registro pendiente en memoria y Redis con expiración.
        """
        clean_email = email.strip().lower()
        key = f"pending_registration:{clean_email}"

        # 1. Almacenar siempre en fallback de memoria
        self._set_memory(key, registration_data, expiry_seconds)

        # 2. Intentar replicar en Redis si está disponible
        client = self._get_client()
        if client:
            try:
                value = json.dumps(registration_data)
                client.setex(key, expiry_seconds, value)
            except Exception as e:
                logger.warning(f"Redis no disponible al almacenar registro pendiente, usando memoria: {e}")
                self.redis_client = None

        return True

    def get_pending_registration(self, email: str) -> Optional[Dict[str, Any]]:
        """
        Recupera datos de registro pendiente por email.
        """
        clean_email = email.strip().lower()
        key = f"pending_registration:{clean_email}"

        # 1. Intentar desde Redis
        client = self._get_client()
        if client:
            try:
                value = client.get(key)
                if value:
                    return json.loads(value)
            except Exception as e:
                logger.warning(f"Error consultando Redis, buscando en memoria: {e}")
                self.redis_client = None

        # 2. Fallback a memoria
        mem_data = self._get_memory(key)
        if isinstance(mem_data, dict):
            return mem_data
        return None

    def delete_pending_registration(self, email: str) -> bool:
        """
        Elimina datos de registro pendiente tras verificación exitosa.
        """
        clean_email = email.strip().lower()
        key = f"pending_registration:{clean_email}"
        code_key = f"verification_code:{clean_email}"

        self._delete_memory(key)
        self._delete_memory(code_key)

        client = self._get_client()
        if client:
            try:
                client.delete(key, code_key)
            except Exception as e:
                logger.warning(f"Error eliminando de Redis: {e}")
                self.redis_client = None

        return True

    def store_verification_code(self, email: str, code: str, expiry_seconds: int = 900) -> bool:
        """
        Almacena código de verificación de 6 dígitos con expiración.
        """
        clean_email = email.strip().lower()
        key = f"verification_code:{clean_email}"

        # 1. Almacenar siempre en fallback de memoria
        self._set_memory(key, code.strip(), expiry_seconds)

        # 2. Replicar en Redis
        client = self._get_client()
        if client:
            try:
                client.setex(key, expiry_seconds, code.strip())
            except Exception as e:
                logger.warning(f"Redis no disponible al almacenar código, usando memoria: {e}")
                self.redis_client = None

        return True

    def verify_code(self, email: str, code: str) -> bool:
        """
        Verifica si el código proporcionado coincide con el almacenado.
        """
        clean_email = email.strip().lower()
        clean_code = code.strip()
        key = f"verification_code:{clean_email}"

        # 1. Probar en Redis
        client = self._get_client()
        if client:
            try:
                stored = client.get(key)
                if stored is not None:
                    return str(stored).strip() == clean_code
            except Exception as e:
                logger.warning(f"Error consultando código en Redis: {e}")
                self.redis_client = None

        # 2. Fallback en memoria
        mem_code = self._get_memory(key)
        if mem_code is not None:
            return str(mem_code).strip() == clean_code

        return False

    def get_verification_code(self, email: str) -> Optional[str]:
        """
        Recupera el código de verificación para un email dado.
        """
        clean_email = email.strip().lower()
        key = f"verification_code:{clean_email}"

        client = self._get_client()
        if client:
            try:
                stored = client.get(key)
                if stored is not None:
                    return str(stored).strip()
            except Exception:
                self.redis_client = None

        mem_code = self._get_memory(key)
        return str(mem_code).strip() if mem_code is not None else None

    def delete_verification_code(self, email: str) -> bool:
        """
        Elimina el código de verificación de un email dado.
        """
        clean_email = email.strip().lower()
        key = f"verification_code:{clean_email}"
        self._delete_memory(key)

        client = self._get_client()
        if client:
            try:
                client.delete(key)
            except Exception:
                self.redis_client = None

        return True

    def get_pending_verifications_summary(self) -> List[Dict[str, Any]]:
        """
        Recupera el listado de todos los registros pendientes de verificación (Redis + Memoria).
        """
        results_map: Dict[str, Dict[str, Any]] = {}

        # 1. De Redis si está disponible
        client = self._get_client()
        if client:
            try:
                keys = client.keys("verification_code:*")
                for k in keys:
                    k_str = k.decode('utf-8') if isinstance(k, bytes) else str(k)
                    email = k_str.replace("verification_code:", "").lower()
                    code = client.get(k)
                    ttl = client.ttl(k)
                    reg_data = self.get_pending_registration(email) or {}
                    results_map[email] = {
                        "email": email,
                        "code": code,
                        "ttl_seconds": max(ttl, 0),
                        "username": reg_data.get("username") or reg_data.get("full_name") or "",
                        "full_name": reg_data.get("full_name") or "",
                    }
            except Exception as e:
                logger.warning(f"Error leyendo resumen de Redis: {e}")

        # 2. De memoria
        now = time.time()
        with self._lock:
            for k, item in self._memory_cache.items():
                if k.startswith("verification_code:") and item["expires_at"] > now:
                    email = k.replace("verification_code:", "").lower()
                    if email not in results_map:
                        code = item["value"]
                        ttl = int(item["expires_at"] - now)
                        reg_key = f"pending_registration:{email}"
                        reg_item = self._memory_cache.get(reg_key)
                        reg_data = reg_item["value"] if (reg_item and reg_item["expires_at"] > now) else {}
                        results_map[email] = {
                            "email": email,
                            "code": code,
                            "ttl_seconds": max(ttl, 0),
                            "username": reg_data.get("username") or reg_data.get("full_name") or "",
                            "full_name": reg_data.get("full_name") or "",
                        }

        results = list(results_map.values())
        results.sort(key=lambda x: x["ttl_seconds"], reverse=True)
        return results

    def cleanup_expired_registrations(self) -> int:
        """
        Limpia claves expiradas en memoria.
        """
        now = time.time()
        expired_count = 0
        with self._lock:
            keys_to_del = [k for k, v in self._memory_cache.items() if v["expires_at"] <= now]
            for k in keys_to_del:
                self._memory_cache.pop(k, None)
                expired_count += 1
        return expired_count

# Instancia global del servicio
redis_cache = RedisCacheService()
