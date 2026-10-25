"""OCR de imágenes y PDFs escaneados con proveedores multimodales.

Orden de intento:
1. DeepSeek (`deepseek-flash`), que acepta imágenes.
2. Gemini Vision como respaldo.

Si un proveedor agota cuota, se prueba el siguiente.
"""
import base64
import io
import logging
from typing import List

from PIL import Image
from sqlalchemy.orm import Session

from app.crud.llm import decrypt_api_key
from app.db.models.llm_provider import LLMProvider
from .errors import OCRError

logger = logging.getLogger(__name__)

_OCR_PROMPT = (
    "Extrae TODO el texto visible en estas imágenes, respetando el orden de lectura "
    "y manteniendo una fila de la tabla por línea. No resumas y no inventes contenido. "
    "Si una palabra manuscrita es dudosa, transcribe el término técnico de construcción "
    "más probable en español (por ejemplo: demolición, remoción, suministro, colocación). "
    "Devuelve únicamente el texto plano."
)

_MAX_IMAGES_PER_CALL = 5
_DEEPSEEK_VISION_MODEL = "deepseek-flash"


def _load_vision_providers(db: Session) -> List[LLMProvider]:
    providers = (
        db.query(LLMProvider)
        .filter(
            LLMProvider.provider_key.in_(["deepseek", "gemini"]),
            LLMProvider.is_active == True,  # noqa: E712
        )
        .order_by(LLMProvider.priority.asc())
        .all()
    )
    if not providers:
        raise OCRError(
            "No hay un proveedor de visión activo. Configura DeepSeek o Gemini "
            "en /admin/llm-providers para poder leer imágenes y PDFs escaneados."
        )
    return providers


def _is_quota_error(error: Exception) -> bool:
    text = str(error).lower()
    return "429" in text or "quota" in text or "rate limit" in text


def _image_data_url(image: Image.Image) -> str:
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", quality=88)
    encoded = base64.b64encode(buffer.getvalue()).decode("utf-8")
    return f"data:image/jpeg;base64,{encoded}"


def _ocr_deepseek_batch(provider: LLMProvider, batch: List[Image.Image]) -> str:
    import requests

    api_key = decrypt_api_key(provider.api_key_enc)
    base_url = (provider.base_url or "https://api.deepseek.com/v1").rstrip("/")
    url = f"{base_url}/chat/completions"

    content = [{"type": "text", "text": _OCR_PROMPT}]
    for image in batch:
        content.append({
            "type": "image_url",
            "image_url": {"url": _image_data_url(image)},
        })

    response = requests.post(
        url,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": _DEEPSEEK_VISION_MODEL,
            "messages": [{"role": "user", "content": content}],
            "thinking": {"type": "disabled"},
            "temperature": 0.0,
            "max_tokens": 4096,
        },
        timeout=120,
    )
    response.raise_for_status()
    data = response.json()
    choices = data.get("choices") or []
    if not choices:
        raise ValueError(f"DeepSeek devolvió una respuesta inesperada: {str(data)[:200]}")
    text = choices[0].get("message", {}).get("content") or ""
    return str(text).strip()


def _ocr_gemini_batch(genai, provider: LLMProvider, batch: List[Image.Image]) -> str:
    genai.configure(api_key=decrypt_api_key(provider.api_key_enc))
    model = genai.GenerativeModel(provider.model_name)
    response = model.generate_content([*batch, _OCR_PROMPT])
    text = getattr(response, "text", None)
    return str(text).strip() if text else ""


def ocr_images(images: List[Image.Image], db: Session) -> str:
    """Aplica OCR multimodal a una lista de imágenes y devuelve el texto concatenado."""
    if not images:
        raise OCRError("No se recibieron imágenes para procesar con OCR.")

    try:
        import google.generativeai as genai
    except ImportError:
        genai = None

    providers = _load_vision_providers(db)
    parts: List[str] = []
    quota_failures = 0

    for start in range(0, len(images), _MAX_IMAGES_PER_CALL):
        batch = images[start:start + _MAX_IMAGES_PER_CALL]
        batch_text = ""
        last_error = None

        for provider in providers:
            key = (provider.provider_key or "").lower()
            if key == "gemini" and genai is None:
                continue

            try:
                if key == "deepseek":
                    batch_text = _ocr_deepseek_batch(provider, batch)
                elif key == "gemini":
                    batch_text = _ocr_gemini_batch(genai, provider, batch)
                else:
                    continue

                if batch_text:
                    break
            except Exception as exc:  # noqa: PERF203
                last_error = exc
                if _is_quota_error(exc):
                    quota_failures += 1
                logger.warning(
                    "Fallo OCR con proveedor %s (%s): %s",
                    provider.provider_key,
                    provider.model_name,
                    exc,
                )

        if not batch_text:
            if last_error and _is_quota_error(last_error) and quota_failures:
                raise OCRError(
                    "El OCR no tiene cuota disponible en este momento. "
                    "Intenta de nuevo en un minuto o configura otro proveedor de visión."
                ) from last_error
            if last_error:
                raise OCRError(f"El OCR con IA falló: {last_error}") from last_error
            logger.warning("Los proveedores devolvieron una respuesta vacía en OCR (lote %s).", start)
            continue

        parts.append(batch_text)

    result = "\n".join(parts).strip()
    if not result:
        raise OCRError("El OCR no pudo extraer texto del documento. Verifica la calidad de la imagen.")
    return result
