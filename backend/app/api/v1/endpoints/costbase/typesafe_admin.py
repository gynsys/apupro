from typing import Any, Dict
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.logging import logger
from app.db.base import get_db
from app.api.v1.endpoints.arko import get_current_arko_admin
from app.db.models.arko import ArkoAdmin
from app.db.models.llm_provider import LLMProvider
from app.crud.llm import encrypt_api_key, decrypt_api_key
from app.services.typesafe_service import test_typesafe_connection
from app.api.v1.endpoints.costbase.common import get_active_typesafe_key

router = APIRouter()


@router.get("/admin/typesafe/status")
def get_typesafe_status(
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_arko_admin)
) -> Dict[str, Any]:
    """Obtiene el estado de la integración con TypeSafe AI (Jev) para el SuperAdmin."""
    if not current_user:
        raise HTTPException(status_code=401, detail="No autenticado")

    provider = db.query(LLMProvider).filter(LLMProvider.provider_key == "typesafe").first()
    if not provider:
        return {
            "configured": False,
            "is_active": False,
            "model_name": "jev-latest",
            "masked_key": ""
        }

    plain_key = ""
    try:
        if provider.api_key_enc:
            plain_key = decrypt_api_key(provider.api_key_enc)
    except Exception as e:
        logger.error(f"Error descifrando TypeSafe key: {e}", exc_info=True)

    masked = f"****{plain_key[-4:]}" if len(plain_key) > 4 else ("****" if plain_key else "")
    return {
        "configured": bool(plain_key),
        "is_active": bool(provider.is_active),
        "model_name": provider.model_name or "jev-latest",
        "masked_key": masked
    }


@router.post("/admin/typesafe/test")
def test_typesafe_endpoint(
    payload: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_arko_admin)
) -> Dict[str, Any]:
    """Prueba la conexión directa con TypeSafe AI (Jev)."""
    if not current_user:
        raise HTTPException(status_code=401, detail="No autenticado")

    api_key = payload.get("api_key")
    if not api_key:
        api_key = get_active_typesafe_key(db)
        if not api_key:
            provider = db.query(LLMProvider).filter(LLMProvider.provider_key == "typesafe").first()
            if provider and provider.api_key_enc:
                try:
                    api_key = decrypt_api_key(provider.api_key_enc)
                except Exception as e:
                    logger.error(f"Error descifrando clave TypeSafe: {e}", exc_info=True)

    if not api_key:
        raise HTTPException(status_code=400, detail="No se proporcionó API key para la prueba.")

    success, latency, msg = test_typesafe_connection(api_key, payload.get("model_name", "jev-latest"))
    return {
        "success": success,
        "latency_ms": latency,
        "message": msg
    }


@router.post("/admin/typesafe/save")
def save_typesafe_config(
    payload: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_arko_admin)
) -> Dict[str, Any]:
    """Guarda o actualiza la configuración y switch de TypeSafe AI en la base de datos."""
    if not current_user:
        raise HTTPException(status_code=401, detail="No autenticado")

    raw_key = (payload.get("api_key") or "").strip()
    is_active = bool(payload.get("is_active", True))
    model_name = (payload.get("model_name") or "jev-latest").strip()

    provider = db.query(LLMProvider).filter(LLMProvider.provider_key == "typesafe").first()
    if not provider:
        if not raw_key:
            raise HTTPException(status_code=400, detail="Debes proporcionar una API key de TypeSafe AI.")
        provider = LLMProvider(
            provider_key="typesafe",
            display_name="TypeSafe AI (Jev System One)",
            model_name=model_name,
            api_key_enc=encrypt_api_key(raw_key),
            is_active=is_active,
            priority=10,
            use_case="all"
        )
        db.add(provider)
    else:
        if raw_key:
            provider.api_key_enc = encrypt_api_key(raw_key)
        provider.is_active = is_active
        provider.model_name = model_name

    db.commit()
    db.refresh(provider)
    return {
        "success": True,
        "is_active": provider.is_active,
        "model_name": provider.model_name,
        "message": "Configuración de TypeSafe AI guardada correctamente."
    }
