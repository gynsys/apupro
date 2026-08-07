"""
Pydantic schemas for LLM Provider admin management.
API keys are never returned in full — only masked (****XXXX).
"""
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime


class LLMProviderBase(BaseModel):
    provider_key: str = Field(..., description="'gemini' | 'groq' | 'openai' | 'anthropic' | 'custom'")
    display_name: str = Field(..., description="Human-readable name shown in admin UI")
    model_name: str = Field(..., description="Model identifier, e.g. 'gemini-flash-latest'")
    base_url: Optional[str] = Field(None, description="Required for OpenAI-compatible providers")
    is_active: bool = Field(True)
    priority: int = Field(1, ge=1, description="1=primary, 2=first fallback, etc.")
    use_case: str = Field("all", description="'all' | 'blog' | 'social'")
    extra_params: Optional[Dict[str, Any]] = Field(None, description="Optional overrides: temperature, max_tokens, etc.")


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
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class LLMProviderTestResult(BaseModel):
    success: bool
    latency_ms: Optional[int] = None
    response_preview: Optional[str] = None
    error: Optional[str] = None
