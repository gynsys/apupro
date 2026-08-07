from sqlalchemy.types import TypeDecorator, String, Text
from cryptography.fernet import Fernet
from app.core.config import settings

class EncryptedType(TypeDecorator):
    """
    SQLAlchemy TypeDecorator that encrypts data before saving to DB
    and decrypts it when loading.
    """
    impl = Text
    cache_ok = True

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.key = settings.ENCRYPTION_KEY.encode() if settings.ENCRYPTION_KEY else Fernet.generate_key()
        self.fernet = Fernet(self.key)

    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        if isinstance(value, str):
            value = value.encode()
        return self.fernet.encrypt(value).decode('utf-8')

    def process_result_value(self, value, dialect):
        if value is None:
            return value
        try:
            return self.fernet.decrypt(value.encode()).decode('utf-8')
        except Exception:
            # If decryption fails (e.g. data was not encrypted), return raw value
            # This helps during migration phase
            return value

class EncryptedString(EncryptedType):
    impl = String

class EncryptedText(EncryptedType):
    impl = Text
