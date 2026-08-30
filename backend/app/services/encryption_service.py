import json
import base64
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
import os
from datetime import datetime

class EncryptionService:
    """Servicio de encriptación para backups de presupuestos"""
    
    def __init__(self):
        self.salt = b'CostBaseSecureBackup2024'  # Salt fijo para consistencia
    
    def _generate_key(self, user_email: str) -> bytes:
        """Genera clave de encriptación basada en el email del usuario"""
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=self.salt,
            iterations=100000,
        )
        key = base64.urlsafe_b64encode(kdf.derive(user_email.encode()))
        return key
    
    def encrypt_backup(self, budget_data: dict, user_email: str) -> bytes:
        """Encripta los datos del presupuesto para backup"""
        # Convertir datos a JSON
        json_data = json.dumps(budget_data, ensure_ascii=False, indent=2)
        
        # Generar clave basada en email del usuario
        key = self._generate_key(user_email)
        
        # Encriptar usando Fernet (AES-128 en CBC mode)
        fernet = Fernet(key)
        encrypted_data = fernet.encrypt(json_data.encode('utf-8'))
        
        return encrypted_data
    
    def decrypt_backup(self, encrypted_data: bytes, user_email: str) -> dict:
        """Desencripta los datos del presupuesto"""
        try:
            # Generar clave basada en email del usuario
            key = self._generate_key(user_email)
            
            # Desencriptar
            fernet = Fernet(key)
            decrypted_data = fernet.decrypt(encrypted_data)
            
            # Convertir JSON a dict
            budget_data = json.loads(decrypted_data.decode('utf-8'))
            
            return budget_data
        except Exception as e:
            raise ValueError(f"Error desencriptando backup: {str(e)}")
    
    def validate_ownership(self, backup_data: dict, user_email: str) -> bool:
        """Valida que el backup pertenezca al usuario"""
        backup_owner = backup_data.get('metadata', {}).get('owner_email')
        return backup_owner == user_email
    
    def create_backup_package(self, budget: dict, items: list, user_email: str, user_id: str) -> dict:
        """Crea el paquete de backup completo"""
        return {
            "version": "1.0",
            "metadata": {
                "created_at": datetime.utcnow().isoformat(),
                "owner_email": user_email,
                "owner_id": user_id,
                "app_name": "CostBase",
                "app_version": "1.0"
            },
            "budget": budget,
            "items": items
        }

encryption_service = EncryptionService()