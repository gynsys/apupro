"""
Unified LLM Router for GynSys.

Dispatches AI prompts to the configured LLM providers in priority order,
with automatic fallback and an in-memory cache to minimize DB round-trips.

Public API:
    call_llm_text(prompt, use_case)  -> str
    call_llm_json(prompt, use_case)  -> dict
    invalidate_llm_cache()           -> None
"""
import json
import re
import time
import logging
from typing import List, Optional
from datetime import datetime, timedelta

import google.generativeai as genai
import requests

from app.db.base import SessionLocal
from app.db.models.llm_provider import LLMProvider
from app.crud.llm import decrypt_api_key

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# In-memory cache
# ---------------------------------------------------------------------------

_cache: Optional[List[LLMProvider]] = None
_cache_use_case: Optional[str] = None
_cache_expiry: Optional[datetime] = None
_CACHE_TTL_MINUTES = 5


def _load_providers(use_case: str = "all") -> List[LLMProvider]:
    """
    Load active providers from DB ordered by priority.
    Uses an in-memory cache (TTL = 5 min) to avoid hitting DB on every inference call.
    """
    global _cache, _cache_use_case, _cache_expiry

    now = datetime.utcnow()
    if (
        _cache is not None
        and _cache_use_case == use_case
        and _cache_expiry is not None
        and now < _cache_expiry
    ):
        return _cache

    db = SessionLocal()
    try:
        from app.crud.llm import get_active_providers_for_use_case
        providers = get_active_providers_for_use_case(db, use_case)
        _cache = providers
        _cache_use_case = use_case
        _cache_expiry = now + timedelta(minutes=_CACHE_TTL_MINUTES)
        logger.info(f"[LLM] Cache refreshed: {len(providers)} providers for use_case='{use_case}'")
        return providers
    finally:
        db.close()


def invalidate_llm_cache() -> None:
    """Call this after any CRUD operation on llm_providers to force cache refresh."""
    global _cache, _cache_use_case, _cache_expiry
    _cache = None
    _cache_use_case = None
    _cache_expiry = None
    logger.info("[LLM] Cache invalidated.")


# ---------------------------------------------------------------------------
# Provider-specific dispatch functions
# ---------------------------------------------------------------------------

def _call_gemini(provider: LLMProvider, prompt: str, expect_json: bool) -> str:
    """Call Google Gemini using the google-generativeai SDK."""
    api_key = decrypt_api_key(provider.api_key_enc)
    genai.configure(api_key=api_key)

    extra = provider.extra_params or {}
    gen_config_kwargs = {}
    if expect_json:
        gen_config_kwargs["response_mime_type"] = "application/json"

    system_instruction = (
        "Eres un ingeniero civil experto y creador de contenido arquitectónico. "
        "Debes responder SIEMPRE en formato JSON cuando se te pida. "
        "IMPORTANTE: NUNCA alucines información y RESPONDE SIEMPRE 100% EN ESPAÑOL."
    ) if expect_json else (
        "Eres un experto en redacción sobre arquitectura e ingeniería. "
        "IMPORTANTE: NUNCA alucines información y RESPONDE SIEMPRE 100% EN ESPAÑOL."
    )

    model = genai.GenerativeModel(
        provider.model_name,
        system_instruction=system_instruction,
        generation_config=genai.GenerationConfig(**gen_config_kwargs) if gen_config_kwargs else None,
    )
    response = model.generate_content(prompt)

    if not response or not hasattr(response, "text") or not response.text:
        raise ValueError("Gemini returned empty or blocked response.")
    return response.text.strip()


def _call_openai_compatible(provider: LLMProvider, prompt: str, expect_json: bool) -> str:
    """
    Call any OpenAI-compatible API (Groq, OpenAI, Mistral, Ollama, etc.).
    Uses base_url from the provider record.
    """
    api_key = decrypt_api_key(provider.api_key_enc)
    base_url = (provider.base_url or "https://api.openai.com/v1").rstrip("/")
    url = f"{base_url}/chat/completions"

    extra = provider.extra_params or {}
    payload: dict = {
        "model": provider.model_name,
        "messages": [
            {
                "role": "system",
                "content": (
                    "Eres un experto en diseño estructural y contenido arquitectónico para redes sociales. "
                    "Debes responder SIEMPRE en formato JSON cuando se te pida."
                    if expect_json
                    else "Eres un experto en redacción sobre arquitectura e ingeniería."
                ),
            },
            {"role": "user", "content": prompt},
        ],
        "temperature": extra.get("temperature", 0.7),
        "max_tokens": extra.get("max_tokens", 2048),
    }
    if expect_json:
        payload["response_format"] = {"type": "json_object"}

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    response = requests.post(url, headers=headers, json=payload, timeout=30)
    response.raise_for_status()
    return response.json()["choices"][0]["message"]["content"]


def _dispatch(provider: LLMProvider, prompt: str, expect_json: bool) -> str:
    """Route to the correct backend function based on provider_key."""
    key = provider.provider_key.lower()
    if key == "gemini":
        return _call_gemini(provider, prompt, expect_json)
    elif key in ("groq", "openai", "custom", "mistral", "ollama"):
        return _call_openai_compatible(provider, prompt, expect_json)
    else:
        raise ValueError(f"Unknown provider_key: '{key}'. Supported: gemini, groq, openai, custom.")


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def call_llm_text(prompt: str, use_case: str = "all") -> str:
    """
    Generate free-text using the configured LLM providers in priority order.
    Raises ValueError if all providers fail.
    """
    providers = _load_providers(use_case)
    if not providers:
        raise ValueError("No active LLM providers configured. Set them at /admin/llm-providers.")

    last_error: Optional[Exception] = None
    for provider in providers:
        try:
            logger.info(f"[LLM] Trying '{provider.display_name}' (priority={provider.priority})...")
            result = _dispatch(provider, prompt, expect_json=False)
            logger.info(f"[LLM] '{provider.display_name}' succeeded.")
            return result
        except Exception as e:
            logger.warning(f"[LLM] '{provider.display_name}' failed: {e}")
            last_error = e

    raise ValueError(
        f"All LLM providers failed. Last error: {last_error}. "
        "Check /admin/llm-providers or verify API key quotas."
    )


def call_llm_json(prompt: str, use_case: str = "all") -> dict:
    """
    Generate and parse JSON using the configured LLM providers in priority order.
    Raises ValueError if all providers fail or no valid JSON is returned.
    """
    providers = _load_providers(use_case)
    if not providers:
        raise ValueError("No active LLM providers configured. Set them at /admin/llm-providers.")

    last_error: Optional[Exception] = None
    for provider in providers:
        try:
            logger.info(f"[LLM] Trying '{provider.display_name}' (priority={provider.priority})...")
            raw = _dispatch(provider, prompt, expect_json=True)

            # Attempt direct JSON parse
            try:
                data = json.loads(raw)
                logger.info(f"[LLM] '{provider.display_name}' succeeded (direct JSON).")
                return data
            except json.JSONDecodeError:
                pass

            # Fallback: extract JSON block from text
            json_match = re.search(r"(\{.*\})", raw, re.DOTALL)
            if json_match:
                data = json.loads(json_match.group(1))
                logger.info(f"[LLM] '{provider.display_name}' succeeded (extracted JSON).")
                return data

            raise ValueError("Response was not valid JSON.")

        except Exception as e:
            logger.warning(f"[LLM] '{provider.display_name}' failed: {e}")
            last_error = e

    raise ValueError(
        f"All LLM providers failed. Last error: {last_error}. "
        "Check /admin/llm-providers or verify API key quotas."
    )


def test_provider(provider: LLMProvider) -> dict:
    """
    Make a minimal real API call to verify the provider works.
    Returns latency in ms and a short response preview.
    """
    prompt = "Di exactamente: 'GynSys OK' y nada más."
    start = time.time()
    try:
        result = _dispatch(provider, prompt, expect_json=False)
        latency_ms = int((time.time() - start) * 1000)
        preview = result[:80] if result else "(respuesta vacía)"
        return {"success": True, "latency_ms": latency_ms, "response_preview": preview, "error": None}
    except Exception as e:
        return {"success": False, "latency_ms": None, "response_preview": None, "error": str(e)}
