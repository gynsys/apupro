"""
LLMProvider model - represents dynamically configurable AI/LLM providers.
API keys are stored encrypted using Fernet (app.core.config.settings.ENCRYPTION_KEY).
"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from app.db.base import Base


class LLMProvider(Base):
    """
    Represents a configured AI/LLM provider (Gemini, Groq, OpenAI, etc.).
    Priority controls fallback order: 1 = primary, 2 = first fallback, etc.
    """
    __tablename__ = "llm_providers"

    id = Column(Integer, primary_key=True, index=True)

    # Provider identity
    provider_key = Column(String, nullable=False)
    # Values: 'gemini' | 'groq' | 'openai' | 'anthropic' | 'custom'

    display_name = Column(String, nullable=False)
    # Human-readable name shown in admin UI, e.g. "Google Gemini Flash 2.0"

    # Credentials (API key stored encrypted via Fernet)
    api_key_enc = Column(Text, nullable=False)
    # Always store encrypted. Decrypt at call time via llm_router.py

    model_name = Column(String, nullable=False)
    # e.g. 'gemini-flash-latest', 'llama-3.3-70b-versatile', 'gpt-4o-mini'

    base_url = Column(String, nullable=True)
    # Required for OpenAI-compatible providers (Groq, Mistral, Ollama, etc.)
    # e.g. 'https://api.groq.com/openai/v1'

    # State
    is_active = Column(Boolean, default=True, nullable=False)
    priority = Column(Integer, default=1, nullable=False)
    # 1 = primary provider, 2 = first fallback, etc.

    use_case = Column(String, default="all", nullable=False)
    # 'all' | 'blog' | 'social' — filters which service uses this provider

    extra_params = Column(JSONB, nullable=True)
    # Optional overrides: {"temperature": 0.7, "max_tokens": 2048}

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
