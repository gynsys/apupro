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

import google.generativeai as genai  # kept for now, SDK updated via requirements
try:
    from google import genai as genai_new
    from google.genai import types as genai_types
    GENAI_NEW = True
except ImportError:
    GENAI_NEW = False
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

def _call_gemini(provider: LLMProvider, prompt: str, expect_json: bool, system_prompt: Optional[str] = None) -> str:
    """Call Google Gemini using the new google.genai SDK."""
    api_key = decrypt_api_key(provider.api_key_enc)
    model_name = provider.model_name

    system_instruction = (
        system_prompt if system_prompt else (
            "Eres un ingeniero civil experto. Responde SIEMPRE en JSON válido cuando se te pida. "
            "NUNCA alucines. RESPONDE SIEMPRE EN ESPAÑOL."
            if expect_json else
            "Eres un experto en arquitectura e ingeniería. RESPONDE SIEMPRE EN ESPAÑOL."
        )
    )

    # Prefer new SDK (supports AQ. key format)
    if GENAI_NEW:
        client = genai_new.Client(api_key=api_key)
        config = genai_types.GenerateContentConfig(
            system_instruction=system_instruction,
            response_mime_type="application/json" if expect_json else "text/plain"
        )
        for attempt in range(1, 4):
            try:
                response = client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                    config=config
                )
                if not response or not response.text:
                    raise ValueError("Gemini returned empty or blocked response.")
                return response.text.strip()
            except Exception as e:
                err_msg = str(e)
                if ("503" in err_msg or "UNAVAILABLE" in err_msg or "429" in err_msg) and attempt < 3:
                    sleep_time = attempt * 3
                    logger.warning(f"[LLM] Gemini transitorio (intento {attempt}/3). Reintentando en {sleep_time}s...")
                    time.sleep(sleep_time)
                else:
                    raise
        raise ValueError("Gemini falló tras 3 intentos por congestión del proveedor.")
    else:
        # Fallback to old SDK
        genai.configure(api_key=api_key)
        gen_config_kwargs = {}
        if expect_json:
            gen_config_kwargs["response_mime_type"] = "application/json"
        model = genai.GenerativeModel(
            model_name,
            system_instruction=system_instruction,
            generation_config=genai.GenerationConfig(**gen_config_kwargs) if gen_config_kwargs else None,
        )
        response = model.generate_content(prompt)
        if not response or not hasattr(response, "text") or not response.text:
            raise ValueError("Gemini returned empty or blocked response.")
        return response.text.strip()


def _call_openai_compatible(provider: LLMProvider, prompt: str, expect_json: bool, system_prompt: Optional[str] = None) -> str:
    """
    Call any OpenAI-compatible API (Groq, OpenAI, DeepSeek, Mistral, Ollama, etc.).
    Uses base_url from the provider record.
    """
    api_key = decrypt_api_key(provider.api_key_enc)
    base_url = (provider.base_url or "https://api.openai.com/v1").rstrip("/")
    url = f"{base_url}/chat/completions"

    extra = provider.extra_params or {}
    # extra_params puede llegar como string JSON desde la BD en lugar de dict
    if isinstance(extra, str):
        try:
            extra = json.loads(extra)
        except (json.JSONDecodeError, TypeError):
            extra = {}
    key = provider.provider_key.lower()

    if system_prompt:
        system_content = system_prompt
    elif expect_json:
        system_content = (
            "Eres un Ingeniero Civil especialista en Análisis de Precios Unitarios (APU) venezolano. "
            "Responde ÚNICAMENTE con JSON válido y completo, sin texto extra ni bloques markdown. "
            "NUNCA truncues la respuesta. RESPONDE SIEMPRE EN ESPAÑOL."
        )
    else:
        system_content = "Eres un experto en ingeniería civil y construcción. Responde en español."

    # APU JSON requiere ~3000-4000 tokens de salida; default 8192 para no truncar
    default_max_tokens = 8192 if key == "deepseek" else 4096
    # DeepSeek puede tardar más con prompts largos de APU
    timeout_secs = 90 if key == "deepseek" else 60

    payload: dict = {
        "model": provider.model_name,
        "messages": [
            {"role": "system", "content": system_content},
            {"role": "user", "content": prompt},
        ],
        "temperature": extra.get("temperature", 0.3),
        "max_tokens": extra.get("max_tokens", default_max_tokens),
    }

    # DeepSeek v3 y OpenAI soportan response_format json_object; evita JSON truncado o con markdown
    if expect_json and key in ("openai", "deepseek"):
        payload["response_format"] = {"type": "json_object"}

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    response = requests.post(url, headers=headers, json=payload, timeout=timeout_secs)
    response.raise_for_status()
    return response.json()["choices"][0]["message"]["content"]


def _dispatch(provider: LLMProvider, prompt: str, expect_json: bool, system_prompt: Optional[str] = None) -> str:
    """Route to the correct backend function based on provider_key."""
    key = provider.provider_key.lower()
    if key == "gemini":
        return _call_gemini(provider, prompt, expect_json, system_prompt=system_prompt)
    elif key in ("groq", "openai", "custom", "mistral", "ollama", "deepseek"):
        return _call_openai_compatible(provider, prompt, expect_json, system_prompt=system_prompt)
    else:
        raise ValueError(f"Unknown provider_key: '{key}'. Supported: gemini, groq, openai, custom, deepseek.")


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def call_llm_text(prompt: str, use_case: str = "all", system_prompt: Optional[str] = None) -> str:
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
            result = _dispatch(provider, prompt, expect_json=False, system_prompt=system_prompt)
            logger.info(f"[LLM] '{provider.display_name}' succeeded.")
            return result
        except Exception as e:
            logger.warning(f"[LLM] '{provider.display_name}' failed: {e}")
            last_error = e

    raise ValueError(
        f"All LLM providers failed. Last error: {last_error}. "
        "Check /admin/llm-providers or verify API key quotas."
    )


def call_llm_json(prompt: str, use_case: str = "all", system_prompt: Optional[str] = None) -> dict:
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
            raw = _dispatch(provider, prompt, expect_json=True, system_prompt=system_prompt)

            # Strip possible markdown code fences (```json ... ``` or ``` ... ```)
            cleaned = re.sub(r"^```(?:json)?\s*", "", raw.strip(), flags=re.IGNORECASE)
            cleaned = re.sub(r"\s*```$", "", cleaned.strip())

            # Attempt direct JSON parse on cleaned text
            try:
                data = json.loads(cleaned)
                # Guardia: si el JSON parseó como string (double-encoded), intentar de nuevo
                if isinstance(data, str):
                    logger.debug(f"[LLM] '{provider.display_name}' returned double-encoded JSON, re-parsing...")
                    data = json.loads(data)
                if isinstance(data, (dict, list)):
                    logger.info(f"[LLM] '{provider.display_name}' succeeded (direct JSON).")
                    return data
                raise ValueError(f"JSON parsed to unexpected type: {type(data).__name__}")
            except (json.JSONDecodeError, ValueError) as parse_err:
                logger.debug(f"[LLM] Direct JSON parse failed for '{provider.display_name}': {parse_err}, attempting regex extraction.")

            # Fallback 1: extract JSON object {...}
            json_obj_match = re.search(r"(\{.*\})", cleaned, re.DOTALL)
            if json_obj_match:
                try:
                    data = json.loads(json_obj_match.group(1))
                    if isinstance(data, str):
                        data = json.loads(data)
                    if isinstance(data, (dict, list)):
                        logger.info(f"[LLM] '{provider.display_name}' succeeded (extracted JSON object).")
                        return data
                except json.JSONDecodeError:
                    logger.debug("Failed parsing regex-extracted JSON object.")

            # Fallback 2: extract JSON array [...]
            json_arr_match = re.search(r"(\[.*\])", cleaned, re.DOTALL)
            if json_arr_match:
                try:
                    data = json.loads(json_arr_match.group(1))
                    if isinstance(data, (dict, list)):
                        logger.info(f"[LLM] '{provider.display_name}' succeeded (extracted JSON array).")
                        return data
                except json.JSONDecodeError:
                    logger.debug("Failed parsing regex-extracted JSON array.")

            raise ValueError("Response was not valid JSON dict/list.")


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
