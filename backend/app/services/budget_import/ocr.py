"""OCR de imágenes y PDFs escaneados usando el proveedor Gemini configurado."""
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
    "y manteniendo una fila de la tabla por línea. No resumas, no interpretes y no "
    "inventes contenido. Devuelve únicamente el texto plano."
)

_MAX_IMAGES_PER_CALL = 5


def _load_gemini_provider(db: Session) -> LLMProvider:
    provider = (
        db.query(LLMProvider)
        .filter(LLMProvider.provider_key == "gemini", LLMProvider.is_active == True)  # noqa: E712
        .order_by(LLMProvider.priority.asc())
        .first()
    )
    if not provider:
        raise OCRError(
            "No hay un proveedor de visión (Gemini) activo. Configúralo en /admin/llm-providers "
            "para poder leer imágenes y PDFs escaneados."
        )
    return provider


def ocr_images(images: List[Image.Image], db: Session) -> str:
    """Aplica OCR a una lista de imágenes y devuelve el texto concatenado."""
    if not images:
        raise OCRError("No se recibieron imágenes para procesar con OCR.")

    try:
        import google.generativeai as genai
    except ImportError as exc:  # pragma: no cover - depende del entorno
        raise OCRError("El SDK de Google Gemini no está instalado en el servidor.") from exc

    provider = _load_gemini_provider(db)
    try:
        genai.configure(api_key=decrypt_api_key(provider.api_key_enc))
    except Exception as exc:
        logger.error("No se pudo configurar Gemini para OCR: %s", exc, exc_info=True)
        raise OCRError("No se pudo configurar el proveedor de visión.") from exc

    model = genai.GenerativeModel(provider.model_name)
    parts: List[str] = []

    for start in range(0, len(images), _MAX_IMAGES_PER_CALL):
        batch = images[start:start + _MAX_IMAGES_PER_CALL]
        try:
            response = model.generate_content([*batch, _OCR_PROMPT])
            text = getattr(response, "text", None)
        except Exception as exc:
            logger.error("Fallo el OCR con Gemini: %s", exc, exc_info=True)
            raise OCRError(f"El OCR con IA falló: {exc}") from exc

        if not text or not str(text).strip():
            logger.warning("Gemini devolvió una respuesta vacía en OCR (lote %s).", start)
            continue
        parts.append(str(text).strip())

    result = "\n".join(parts).strip()
    if not result:
        raise OCRError("El OCR no pudo extraer texto del documento. Verifica la calidad de la imagen.")
    return result
