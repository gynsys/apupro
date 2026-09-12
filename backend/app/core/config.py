"""
Configuration module for GynSys Backend.
Uses Pydantic BaseSettings to load environment variables.
"""

from typing import Optional, List, Union
import os
import secrets
import logging
from pydantic_settings import BaseSettings
from pydantic import AnyHttpUrl, field_validator

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Environment
    ENVIRONMENT: str = "development"
    DEBUG: bool = False

    @field_validator("DEBUG", mode="before")
    @classmethod
    def validate_debug_flag(cls, v: Union[bool, str, int]) -> bool:
        """Enforce DEBUG=False in production to prevent leaking sensitive tracebacks."""
        if isinstance(v, str):
            v_bool = v.strip().lower() in ("true", "1", "yes", "on")
        else:
            v_bool = bool(v)

        env = os.getenv("ENVIRONMENT", "development")
        if env == "production" and v_bool:
            logger.warning("⚠️ DEBUG mode requested but forced to False because ENVIRONMENT is production.")
            return False
        return v_bool

    # Database
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/apupro_db"

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def validate_database_url(cls, v: str) -> str:
        """Validate DATABASE_URL and prevent hardcoded insecure credentials in production."""
        if not v:
            raise ValueError("DATABASE_URL must be configured.")
        env = os.getenv("ENVIRONMENT", "development")
        if env == "production":
            insecure_patterns = ["gyn13409534", "apupro_password", "postgres:postgres@", "localhost", "127.0.0.1"]
            for pattern in insecure_patterns:
                if pattern in v:
                    raise ValueError(
                        f"Insecure DATABASE_URL detected for production (contains '{pattern}'). "
                        "Configure a secure DATABASE_URL in .env"
                    )
        return v

    # JWT Security — Validated at startup (see validator below)
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours (1 day)

    @field_validator("SECRET_KEY", mode="before")
    @classmethod
    def validate_secret_key(cls, v: str) -> str:
        """Prevent production deployments with default/empty SECRET_KEY."""
        insecure_keys = ["", "your-secret-key-change-in-production", "your_secret_key_here"]
        if not v or v in insecure_keys:
            env = os.getenv("ENVIRONMENT", "development")
            if env == "production":
                raise ValueError(
                    "SECRET_KEY must be explicitly set in production. "
                    "Generate one with: python -c \"import secrets; print(secrets.token_urlsafe(64))\""
                )
            logger.warning(
                "⚠️ Using auto-generated SECRET_KEY in development. Set it explicitly via .env for consistency."
            )
            return secrets.token_urlsafe(64)
        return v
    
    # URLs
    FRONTEND_URL: str = "https://www.costbase.net"
    BACKEND_URL: str = "https://costbase.net"

    # Resend Email Configuration
    RESEND_API_KEY: Optional[str] = None
    RESEND_FROM_EMAIL: str = "CostBase <info@costbase.net>"

    # Google OAuth
    GOOGLE_CLIENT_ID: Optional[str] = None
    GOOGLE_CLIENT_SECRET: Optional[str] = None
    GOOGLE_REDIRECT_URI: Optional[str] = None
    
    # OAuth Security - Email Whitelist
    ALLOWED_OAUTH_EMAILS: str = ""  # Comma-separated list of allowed emails
    ALLOWED_OAUTH_DOMAINS: str = ""  # Comma-separated list of allowed domains (e.g., "@gynsys.com")
    
    @property
    def oauth_allowed_emails(self) -> List[str]:
        """Parse comma-separated emails into list."""
        if not self.ALLOWED_OAUTH_EMAILS:
            return []
        return [email.strip() for email in self.ALLOWED_OAUTH_EMAILS.split(",") if email.strip()]
    
    @property
    def oauth_allowed_domains(self) -> List[str]:
        """Parse comma-separated domains into list."""
        if not self.ALLOWED_OAUTH_DOMAINS:
            return []
        return [domain.strip() for domain in self.ALLOWED_OAUTH_DOMAINS.split(",") if domain.strip()]

    # CORS
    CORS_ORIGINS: Union[str, List[str]] = [
        "https://arko360.net",
        "https://www.arko360.net",
        "https://admin.arko360.net",
        "https://superadmin.arko360.net",
        "https://api.arko360.net",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://localhost:5174", 
        "http://127.0.0.1:5174"
    ]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        origins = v
        if isinstance(v, str):
            # Permite formato JSON o CSV
            if v.startswith("["):
                import json
                origins = json.loads(v)
            else:
                origins = [i.strip() for i in v.split(",")]
        
        # Enforce Production Domains (Safety Net against outdated .env)
        required_origins = [
            "https://arko360.net",
            "https://www.arko360.net",
            "https://admin.arko360.net",
            "https://superadmin.arko360.net",
            "https://api.arko360.net",
            
            "https://costbase.net",
            "https://www.costbase.net",
           
            "http://localhost",
            "capacitor://localhost"
        ]
        
        env = os.getenv("ENVIRONMENT", "development")
        if isinstance(origins, list):
            # Clean origins: no trailing slashes, no spaces
            origins = [o.strip().rstrip("/") for o in origins if o.strip()]
            for domain in required_origins:
                clean_domain = domain.strip().rstrip("/")
                if clean_domain not in origins:
                    origins.append(clean_domain)
            
            # Restringir CORS en producción: eliminar localhost y 127.0.0.1 de navegadores
            if env == "production":
                origins = [
                    o for o in origins
                    if not (
                        o.startswith("http://localhost") or
                        o.startswith("http://127.0.0.1") or
                        ":5173" in o or
                        ":5174" in o or
                        ":3000" in o
                    ) or o == "capacitor://localhost"
                ]
            return origins
            
        return v

    # Debug flag (read from .env; useful for local development)
    DEBUG: bool = False

    # Cookie Security Settings
    COOKIE_SECURE: bool = True  # HTTPS only in production
    COOKIE_HTTPONLY: bool = True  # Prevent JavaScript access
    COOKIE_SAMESITE: str = "lax"  # CSRF protection

    @field_validator("COOKIE_SECURE", mode="before")
    @classmethod
    def set_cookie_secure_based_on_env(cls, v: bool) -> bool:
        """In development, allow insecure cookies (HTTP)"""
        env = os.getenv("ENVIRONMENT", "development")
        if env == "development":
            return False
        return v

    # Celery & Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/0"

    # File Upload
    UPLOAD_DIR: str = "./uploads"
    MAX_UPLOAD_SIZE: int = 5 * 1024 * 1024  # 5MB

    # Data Encryption
    ENCRYPTION_KEY: str = "r4Pn0YDQH7obBlPFuPHzWj_hEWLotrVUHonpkba_fn8="

    @field_validator("ENCRYPTION_KEY", mode="before")
    @classmethod
    def validate_encryption_key(cls, v: str) -> str:
        """Validate ENCRYPTION_KEY and ensure production safety."""
        env = os.getenv("ENVIRONMENT", "development")
        if not v:
            if env == "production":
                raise ValueError("ENCRYPTION_KEY must be explicitly set in production via .env")
            return "r4Pn0YDQH7obBlPFuPHzWj_hEWLotrVUHonpkba_fn8="
        return v

    # Email
    SMTP_TLS: bool = True
    SMTP_PORT: int = 587
    SMTP_HOST: str | None = "smtp.gmail.com"
    SMTP_USER: str | None = "multitenant.app@gmail.com"
    SMTP_PASSWORD: str | None = None
    
    # Force verified domain sender
    EMAILS_FROM_EMAIL: str | None = "info@costbase.net" 
    EMAILS_FROM_NAME: str = "CostBase Notificaciones"
    
    # MinIO / S3
    MINIO_ENDPOINT: str = "minio:9000" # Internal Docker URL
    MINIO_PUBLIC_ENDPOINT: str = "http://localhost:9000" # URL accessible from Browser
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin"

    @field_validator("MINIO_SECRET_KEY", mode="before")
    @classmethod
    def validate_minio_secret(cls, v: str) -> str:
        env = os.getenv("ENVIRONMENT", "development")
        if env == "production" and v == "minioadmin":
            logger.warning("⚠️ MINIO_SECRET_KEY is using default 'minioadmin' in production. Change it via .env.")
        return v

    MINIO_BUCKET: str = "gynsys-media"

    # VAPID (Web Push)
    VAPID_PRIVATE_KEY: Optional[str] = None
    VAPID_PUBLIC_KEY: Optional[str] = None
    VAPID_CLAIM_EMAIL: str = "admin@gynsys.com"
    ADMIN_EMAIL: str = os.getenv("ADMIN_EMAIL", "dramarielh@gmail.com")
    
    # Firebase (Native Push)
    FIREBASE_SERVICE_ACCOUNT_PATH: Optional[str] = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH")

    # Google Gemini AI
    GEMINI_API_KEY: Optional[str] = os.getenv("GEMINI_API_KEY")

    # Groq AI (Fallback)
    GROQ_API_KEY: Optional[str] = os.getenv("GROQ_API_KEY")

    # Notificaciones — Modo Debug
    # Cuando True: bypasea la guardia de "1 notificación por tipo por día"
    # Permite re-enviar la misma notificación múltiples veces para pruebas.
    # NUNCA activar en producción real con usuarios reales.
    NOTIFICATIONS_DEBUG_MODE: bool = False

    # Monitoreo Externo / Heartbeat (Healthchecks.io)
    HEALTHCHECKS_PING_URL: Optional[str] = None

    class Config:
        render_env = "/etc/secrets/.env"
        if os.path.exists(render_env):
            env_file = render_env
        else:
            env_file = ".env"
            
        env_file_encoding = "utf-8"
        case_sensitive = True
        extra = "ignore"


# Global settings instance
settings = Settings()

