"""
CRUD operations for LLM Providers.
Handles encryption/decryption of API keys using Fernet symmetric encryption.
"""
import logging
from typing import List

from cryptography.fernet import Fernet
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models.llm_provider import LLMProvider

logger = logging.getLogger(__name__)

# ────────────────────────────────────────────────────────────────────────────
# Encryption helpers
# ────────────────────────────────────────────────────────────────────────────

def _get_fernet() -> Fernet:
    """Return a Fernet instance initialized with the configured ENCRYPTION_KEY."""
    key = settings.ENCRYPTION_KEY
    if isinstance(key, str):
        key = key.encode()
    return Fernet(key)


def encrypt_api_key(plain_key: str) -> str:
    """
    Encrypt a plaintext API key using Fernet symmetric encryption.
    Returns a base64-encoded token string safe for DB storage.
    """
    if not plain_key:
        raise ValueError("API key must not be empty.")
    f = _get_fernet()
    return f.encrypt(plain_key.encode()).decode()


def decrypt_api_key(encrypted_key: str) -> str:
    """
    Decrypt a Fernet-encrypted API key back to its plaintext form.
    Raises cryptography.fernet.InvalidToken if the key or ciphertext is invalid.
    """
    if not encrypted_key:
        raise ValueError("Encrypted API key must not be empty.")
    f = _get_fernet()
    return f.decrypt(encrypted_key.encode()).decode()


# ────────────────────────────────────────────────────────────────────────────
# Database CRUD
# ────────────────────────────────────────────────────────────────────────────

def get_active_providers_for_use_case(db: Session, use_case: str = "all") -> List[LLMProvider]:
    """
    Return all active LLM providers that match the given use_case,
    ordered by priority ascending (1 = primary, 2 = first fallback, etc.).

    A provider with use_case='all' is considered valid for every use_case.
    """
    providers = (
        db.query(LLMProvider)
        .filter(
            LLMProvider.is_active == True,  # noqa: E712
            LLMProvider.use_case.in_([use_case, "all"]),
        )
        .order_by(LLMProvider.priority.asc())
        .all()
    )
    return providers


def get_all_providers(db: Session) -> List[LLMProvider]:
    """Return all LLM providers ordered by priority."""
    return db.query(LLMProvider).order_by(LLMProvider.priority.asc()).all()


def get_provider_by_id(db: Session, provider_id: int) -> LLMProvider:
    """Return a single provider by ID, or None if not found."""
    return db.query(LLMProvider).filter(LLMProvider.id == provider_id).first()


def create_provider(db: Session, provider_data: dict) -> LLMProvider:
    """
    Create a new LLM provider record.
    The api_key_enc field must already be encrypted before calling this function.
    """
    provider = LLMProvider(**provider_data)
    db.add(provider)
    db.commit()
    db.refresh(provider)
    return provider


def update_provider(db: Session, provider_id: int, update_data: dict) -> LLMProvider:
    """Update an existing LLM provider record by ID."""
    provider = get_provider_by_id(db, provider_id)
    if not provider:
        raise ValueError(f"LLMProvider with id={provider_id} not found.")
    for key, value in update_data.items():
        setattr(provider, key, value)
    db.commit()
    db.refresh(provider)
    return provider


def delete_provider(db: Session, provider_id: int) -> None:
    """Delete an LLM provider record by ID."""
    provider = get_provider_by_id(db, provider_id)
    if not provider:
        raise ValueError(f"LLMProvider with id={provider_id} not found.")
    db.delete(provider)
    db.commit()
