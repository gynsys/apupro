"""
Pydantic schemas for LLM Provider admin management.
API keys are never returned in full — only masked (****XXXX).
"""
import json
from datetime import datetime
from typing import Any, Dict, Optional
from pydantic import BaseModel, Field, field_validator


class LLMProviderBase(BaseModel):
    provider_key: str = Field(..., description="'gemini' | 'groq' | 'openai' | 'anthropic' | 'custom'")
    display_name: str = Field(..., description="Human-readable name shown in admin UI")
    model_name: str = Field(..., description="Model identifier, e.g. 'gemini-flash-latest'")
    base_url: Optional[str] = Field(None, description="Required for OpenAI-compatible providers")
    is_active: bool = Field(True)
    priority: int = Field(1, ge=1, description="1=primary, 2=first fallback, etc.")
    use_case: str = Field("all", description="'all' | 'blog' | 'social'")
    extra_params: Optional[Dict[str, Any]] = Field(None, description="Optional overrides: temperature, max_tokens, etc.")

    @field_validator("extra_params", mode="before")
    @classmethod
    def parse_extra_params(cls, v: Any) -> Optional[Dict[str, Any]]:
        """Acepta dict, None, o JSON string ('{...}') parseándolo automáticamente."""
        if v is None or v == "":
            return None
        if isinstance(v, dict):
            return v
        if isinstance(v, str):
            try:
                parsed = json.loads(v)
                if isinstance(parsed, dict):
                    return parsed
            except Exception:
                return None
        return None

    @field_validator("priority", mode="before")
    @classmethod
    def parse_priority(cls, v: Any) -> int:
        """Asegura que prioridad sea al menos 1 aun si la BD tiene 0 o None."""
        if v is None:
            return 1
        try:
            val = int(v)
            return val if val >= 1 else 1
        except Exception:
            return 1


class LLMProviderCreate(LLMProviderBase):
    api_key: str = Field(..., min_length=1, description="Plain API key — will be encrypted before storing")


class LLMProviderUpdate(LLMProviderBase):
    provider_key: Optional[str] = None
    display_name: Optional[str] = None
    model_name: Optional[str] = None
    api_key: Optional[str] = Field(None, description="If omitted or empty, existing key is preserved")
    is_active: Optional[bool] = None
    priority: Optional[int] = None
    use_case: Optional[str] = None


class LLMProviderResponse(LLMProviderBase):
    """
    Safe response schema — api_key_masked shows only last 4 chars.
    The raw api_key_enc field is never included.
    """
    id: int
    api_key_masked: str = Field(..., description="Masked API key, e.g. '****4F2A'")
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class LLMProviderTestResult(BaseModel):
    success: bool
    latency_ms: Optional[int] = None
    response_preview: Optional[str] = None
    error: Optional[str] = None
