from cryptography.fernet import Fernet
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

try:
    key = settings.ENCRYPTION_KEY
    if isinstance(key, str):
        key = key.encode('utf-8')
    cipher_suite = Fernet(key)
except Exception as e:
    logger.error(f"Error initializing encryption: {e}")
    cipher_suite = None

def decrypt_text(text: str) -> str:
    """
    Decrypts text if it is encrypted. Returns original text if decryption fails.
    """
    if not text or not cipher_suite:
        return text
    
    try:
        # Fernet tokens are url-safe base64 strings.
        # If text doesn't look like one, it might not be encrypted.
        # But let's just try to decrypt.
        decrypted_bytes = cipher_suite.decrypt(text.encode('utf-8'))
        return decrypted_bytes.decode('utf-8')
    except Exception:
        # Not encrypted or wrong key
        return text

def encrypt_text(text: str) -> str:
    """
    Encrypts text.
    """
    if not text or not cipher_suite:
        return text
        
    try:
        encrypted_bytes = cipher_suite.encrypt(text.encode('utf-8'))
        return encrypted_bytes.decode('utf-8')
    except Exception as e:
        logger.error(f"Encryption error: {e}")
        return text
