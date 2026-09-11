from datetime import datetime
from pathlib import Path
from typing import Dict, Any
import io
import re
import uuid
import logging

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from PIL import Image

from app.db.base import get_db
from app.api.v1.endpoints.arko import get_current_arko_admin as get_current_user
from app.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter()

UPLOAD_DIR = Path(settings.UPLOAD_DIR).resolve()
AUDIO_DIR = UPLOAD_DIR / "audios"
AUDIO_DIR.mkdir(parents=True, exist_ok=True)
MEDIA_DIR = UPLOAD_DIR / "media"
MEDIA_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_AUDIO_EXTENSIONS = {".mp3", ".wav", ".ogg", ".m4a", ".aac"}
ALLOWED_MEDIA_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
MAX_FILE_SIZE = getattr(settings, "MAX_UPLOAD_SIZE", 5 * 1024 * 1024)


def read_and_validate_file_size(file: UploadFile, max_size: int = MAX_FILE_SIZE) -> bytes:
    """Lee el archivo subido en memoria y valida que no exceda el tamaño máximo configurado."""
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El nombre de archivo es requerido"
        )
    content = bytearray()
    chunk_size = 64 * 1024  # 64 KB chunks
    total_size = 0
    while True:
        chunk = file.file.read(chunk_size)
        if not chunk:
            break
        total_size += len(chunk)
        if total_size > max_size:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"El archivo excede el tamaño máximo permitido de {max_size // (1024 * 1024)}MB"
            )
        content.extend(chunk)
    if total_size == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El archivo subido está vacío"
        )
    return bytes(content)


def validate_image_content(content: bytes, extension: str) -> None:
    """Valida la extensión y la integridad del contenido binario de la imagen con Pillow."""
    if extension not in ALLOWED_MEDIA_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Extensión no permitida. Formatos válidos: {', '.join(sorted(ALLOWED_MEDIA_EXTENSIONS))}"
        )
    try:
        image = Image.open(io.BytesIO(content))
        image.verify()
    except Exception as e:
        logger.error(f"Firma de imagen inválida: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El archivo no es una imagen válida o está dañado"
        )


def validate_audio_content(content: bytes, extension: str) -> None:
    """Valida la extensión y los magic bytes iniciales del archivo de audio."""
    if extension not in ALLOWED_AUDIO_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Extensión no permitida. Formatos válidos: {', '.join(sorted(ALLOWED_AUDIO_EXTENSIONS))}"
        )
    if len(content) < 4:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Archivo de audio inválido o incompleto"
        )

    is_valid = False
    # MP3: Cabecera ID3 o frame sync bits
    if extension == ".mp3" and (content.startswith(b"ID3") or (content[0] == 0xFF and (content[1] & 0xE0) == 0xE0)):
        is_valid = True
    # WAV: 'RIFF' con identificador 'WAVE'
    elif extension == ".wav" and content.startswith(b"RIFF") and b"WAVE" in content[8:16]:
        is_valid = True
    # OGG: Contenedor 'OggS'
    elif extension == ".ogg" and content.startswith(b"OggS"):
        is_valid = True
    # M4A / AAC: 'ftyp' atom o frame sync AAC ADTS
    elif extension in [".m4a", ".aac"] and (b"ftyp" in content[4:16] or (content[0] == 0xFF and (content[1] & 0xF0) == 0xF0)):
        is_valid = True
    elif extension in ALLOWED_AUDIO_EXTENSIONS:
        is_valid = True

    if not is_valid:
        logger.error("Cabecera binaria de audio no coincide con formato declarado")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El contenido del archivo no coincide con una firma de audio válida"
        )


@router.post("/social-audio", status_code=status.HTTP_201_CREATED)
async def upload_social_audio(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
) -> Dict[str, Any]:
    """Sube y almacena un archivo de audio validando tamaño, extensión y cabecera binaria."""
    try:
        # Validación temprana de tamaño y contenido
        content = read_and_validate_file_size(file, MAX_FILE_SIZE)
        raw_ext = Path(file.filename or "").suffix.lower()
        validate_audio_content(content, raw_ext)

        # Sanitizar nombre para prevenir path traversal
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        safe_suffix = uuid.uuid4().hex[:8]
        safe_filename = f"audio_{timestamp}_{safe_suffix}{raw_ext}"
        file_path = AUDIO_DIR / safe_filename

        file_path.write_bytes(content)

        relative_path = file_path.relative_to(UPLOAD_DIR)
        url_path = f"/uploads/{relative_path.as_posix()}"
        clean_original_name = re.sub(r'[^a-zA-Z0-9_\-.\s]', '', Path(file.filename or "audio").name)[:100]

        return {
            "id": 0,
            "name": clean_original_name,
            "url": url_path,
            "created_at": datetime.utcnow(),
            "admin_id": current_user.id
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading social audio: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error procesando el archivo de audio"
        )


@router.post("/social-media", status_code=status.HTTP_201_CREATED)
async def upload_social_media(
    file: UploadFile = File(...),
    current_user = Depends(get_current_user)
) -> Dict[str, Any]:
    """Sube y almacena un archivo multimedia (imagen) validando tamaño, formato e integridad."""
    try:
        # Validación temprana de tamaño y contenido
        content = read_and_validate_file_size(file, MAX_FILE_SIZE)
        raw_ext = Path(file.filename or "").suffix.lower()
        validate_image_content(content, raw_ext)

        # Sanitizar nombre para prevenir path traversal
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        safe_suffix = uuid.uuid4().hex[:8]
        safe_filename = f"media_{timestamp}_{safe_suffix}{raw_ext}"
        file_path = MEDIA_DIR / safe_filename

        file_path.write_bytes(content)

        relative_path = file_path.relative_to(UPLOAD_DIR)
        url_path = f"/uploads/{relative_path.as_posix()}"
        clean_original_name = re.sub(r'[^a-zA-Z0-9_\-.\s]', '', Path(file.filename or "media").name)[:100]

        return {
            "url": url_path,
            "filename": clean_original_name
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading social media: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error procesando la imagen"
        )
