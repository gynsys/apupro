import redis
import json
import os
from typing import Optional, Dict, Any
from app.core.config import settings
from app.core.logging import logger

class RedisCacheService:
    """Servicio para manejar caché de Redis para registros pendientes de verificación."""
    
    def __init__(self):
        self.redis_client = None
        self._connect()
    
    def _connect(self):
        """Establece conexión con Redis."""
        try:
            self.redis_client = redis.from_url(
                settings.REDIS_URL,
                decode_responses=True,
                socket_connect_timeout=5
            )
            # Test connection
            self.redis_client.ping()
            logger.info("Redis conectado exitosamente")
        except Exception as e:
            logger.warning(f"No se pudo conectar a Redis: {e}")
            self.redis_client = None
    
    def store_pending_registration(self, email: str, registration_data: Dict[str, Any], expiry_seconds: int = 900) -> bool:
        """
        Almacena datos de registro pendiente en Redis con expiración.
        
        Args:
            email: Email del usuario (clave)
            registration_data: Datos del registro (password, full_name, etc.)
            expiry_seconds: Tiempo de expiración en segundos (default: 15 min)
        
        Returns:
            bool: True si se almacenó correctamente
        """
        if not self.redis_client:
            return False
        
        try:
            key = f"pending_registration:{email}"
            value = json.dumps(registration_data)
            self.redis_client.setex(key, expiry_seconds, value)
            return True
        except Exception as e:
            print(f"Error almacenando registro pendiente: {e}")
            return False
    
    def get_pending_registration(self, email: str) -> Optional[Dict[str, Any]]:
        """
        Recupera datos de registro pendiente por email.
        
        Args:
            email: Email del usuario
        
        Returns:
            Dict con datos del registro o None si no existe/expiró
        """
        if not self.redis_client:
            return None
        
        try:
            key = f"pending_registration:{email}"
            value = self.redis_client.get(key)
            if value:
                return json.loads(value)
            return None
        except Exception as e:
            print(f"Error recuperando registro pendiente: {e}")
            return None
    
    def delete_pending_registration(self, email: str) -> bool:
        """
        Elimina datos de registro pendiente (después de verificación exitosa).
        
        Args:
            email: Email del usuario
        
        Returns:
            bool: True si se eliminó correctamente
        """
        if not self.redis_client:
            return False
        
        try:
            key = f"pending_registration:{email}"
            self.redis_client.delete(key)
            return True
        except Exception as e:
            print(f"Error eliminando registro pendiente: {e}")
            return False
    
    def store_verification_code(self, email: str, code: str, expiry_seconds: int = 900) -> bool:
        """
        Almacena código de verificación separadamente para validación.
        
        Args:
            email: Email del usuario
            code: Código de verificación de 6 dígitos
            expiry_seconds: Tiempo de expiración (default: 15 min)
        
        Returns:
            bool: True si se almacenó correctamente
        """
        if not self.redis_client:
            return False
        
        try:
            key = f"verification_code:{email}"
            self.redis_client.setex(key, expiry_seconds, code)
            return True
        except Exception as e:
            print(f"Error almacenando código de verificación: {e}")
            return False
    
    def verify_code(self, email: str, code: str) -> bool:
        """
        Verifica si el código proporcionado coincide con el almacenado.
        
        Args:
            email: Email del usuario
            code: Código a verificar
        
        Returns:
            bool: True si el código coincide
        """
        if not self.redis_client:
            return False
        
        try:
            key = f"verification_code:{email}"
            stored_code = self.redis_client.get(key)
            return stored_code == code
        except Exception as e:
            print(f"Error verificando código: {e}")
            return False
    
    def cleanup_expired_registrations(self) -> int:
        """
        Limpia registros expirados (Redis lo hace automáticamente con TTL,
        pero este método puede usarse para limpieza manual si es necesario).
        
        Returns:
            int: Número de claves eliminadas
        """
        # Redis maneja la expiración automáticamente con setex
        # Este método es principalmente para propósitos de monitoreo
        return 0

# Instancia global del servicio
redis_cache = RedisCacheService()