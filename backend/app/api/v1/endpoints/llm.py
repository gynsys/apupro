"""
Controlador de endpoints para la gestión segura de proveedores y llaves de IA.
Permite registrar, listar (enmascaradas), actualizar, eliminar y probar la conexión
de API keys de Google Gemini, OpenAI, Groq, Anthropic y servicios asociados.
"""
import time
import requests
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.logging import logger
from app.db.base import get_db
from app.api.v1.endpoints.arko import get_current_arko_admin
from app.db.models.arko import ArkoAdmin
from app.db.models.llm_provider import LLMProvider
from app.schemas.llm import (
    LLMProviderCreate,
    LLMProviderUpdate,
    LLMProviderResponse,
    LLMProviderTestResult
)
from app.crud.llm import (
    get_all_providers,
    get_provider_by_id,
    create_provider,
    update_provider,
    delete_provider,
    encrypt_api_key,
    decrypt_api_key
)
from app.services.llm_router import invalidate_llm_cache

router = APIRouter()


def _mask_key(plain_key: str) -> str:
    """Retorna una versión enmascarada de la clave mostrando únicamente los últimos 4 caracteres."""
    if not plain_key:
        return "********"
    if len(plain_key) <= 4:
        return "****"
    return f"****{plain_key[-4:]}"


def _build_response_schema(provider: LLMProvider) -> LLMProviderResponse:
    """Construye el esquema seguro LLMProviderResponse sin exponer la clave encriptada cruda."""
    plain_key = ""
    try:
        plain_key = decrypt_api_key(provider.api_key_enc)
    except Exception as e:
        logger.error(f"Error descifrando clave para provider {provider.id}: {e}", exc_info=True)
        plain_key = ""

    return LLMProviderResponse(
        id=provider.id,
        provider_key=provider.provider_key,
        display_name=provider.display_name,
        model_name=provider.model_name,
        base_url=provider.base_url,
        is_active=provider.is_active,
        priority=provider.priority,
        use_case=provider.use_case,
        extra_params=provider.extra_params,
        api_key_masked=_mask_key(plain_key),
        created_at=provider.created_at,
        updated_at=provider.updated_at
    )


@router.get("/keys", response_model=List[LLMProviderResponse])
def list_ai_keys(
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_arko_admin)
) -> List[LLMProviderResponse]:
    """Lista todos los proveedores de IA configurados con sus claves enmascaradas."""
    try:
        providers = get_all_providers(db)
        return [_build_response_schema(p) for p in providers]
    except Exception as e:
        logger.error(f"Error listando proveedores LLM: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al listar llaves de IA: {str(e)}"
        )


@router.post("/keys", response_model=LLMProviderResponse, status_code=status.HTTP_201_CREATED)
def create_ai_key(
    payload: LLMProviderCreate,
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_arko_admin)
) -> LLMProviderResponse:
    """Registra una nueva API Key de IA, cifrándola con Fernet antes de guardarla en base de datos."""
    if not payload.api_key or not payload.api_key.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La API key no puede estar vacía."
        )

    try:
        api_key_enc = encrypt_api_key(payload.api_key.strip())
        provider_data = {
            "provider_key": payload.provider_key.lower().strip(),
            "display_name": payload.display_name.strip(),
            "model_name": payload.model_name.strip(),
            "base_url": payload.base_url.strip() if payload.base_url else None,
            "api_key_enc": api_key_enc,
            "is_active": payload.is_active,
            "priority": payload.priority,
            "use_case": payload.use_case or "all",
            "extra_params": payload.extra_params
        }
        new_provider = create_provider(db, provider_data)
        invalidate_llm_cache()
        logger.info(f"Admin {current_user.email} registró proveedor de IA '{new_provider.display_name}' (ID: {new_provider.id})")
        return _build_response_schema(new_provider)
    except Exception as e:
        logger.error(f"Error registrando proveedor LLM: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al guardar llave de IA: {str(e)}"
        )


@router.put("/keys/{provider_id}", response_model=LLMProviderResponse)
def update_ai_key(
    provider_id: int,
    payload: LLMProviderUpdate,
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_arko_admin)
) -> LLMProviderResponse:
    """Actualiza la configuración o renueva la API Key de un proveedor de IA existente."""
    provider = get_provider_by_id(db, provider_id)
    if not provider:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Proveedor con ID {provider_id} no encontrado."
        )

    try:
        update_data: Dict[str, Any] = {}
        if payload.provider_key is not None:
            update_data["provider_key"] = payload.provider_key.lower().strip()
        if payload.display_name is not None:
            update_data["display_name"] = payload.display_name.strip()
        if payload.model_name is not None:
            update_data["model_name"] = payload.model_name.strip()
        if payload.base_url is not None:
            update_data["base_url"] = payload.base_url.strip() if payload.base_url else None
        if payload.is_active is not None:
            update_data["is_active"] = payload.is_active
        if payload.priority is not None:
            update_data["priority"] = payload.priority
        if payload.use_case is not None:
            update_data["use_case"] = payload.use_case
        if payload.extra_params is not None:
            update_data["extra_params"] = payload.extra_params
        if payload.api_key and payload.api_key.strip():
            update_data["api_key_enc"] = encrypt_api_key(payload.api_key.strip())

        updated_provider = update_provider(db, provider_id, update_data)
        invalidate_llm_cache()
        logger.info(f"Admin {current_user.email} actualizó proveedor de IA ID {provider_id}")
        return _build_response_schema(updated_provider)
    except Exception as e:
        logger.error(f"Error actualizando proveedor LLM ID {provider_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al actualizar proveedor de IA: {str(e)}"
        )


@router.get("/keys/{provider_id}/reveal")
def reveal_ai_key(
    provider_id: int,
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_arko_admin)
) -> Dict[str, Any]:
    """Retorna la API Key desencriptada exclusivamente para administradores autenticados."""
    provider = get_provider_by_id(db, provider_id)
    if not provider:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Proveedor con ID {provider_id} no encontrado."
        )

    try:
        plain_key = decrypt_api_key(provider.api_key_enc)
        return {"id": provider_id, "api_key": plain_key}
    except Exception as e:
        logger.error(f"Error descifrando clave de proveedor {provider_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al descifrar la clave: {str(e)}"
        )


@router.delete("/keys/{provider_id}")
def delete_ai_key(
    provider_id: int,
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_arko_admin)
) -> Dict[str, Any]:
    """Elimina la configuración y credenciales de un proveedor de IA."""
    provider = get_provider_by_id(db, provider_id)
    if not provider:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Proveedor con ID {provider_id} no encontrado."
        )

    try:
        delete_provider(db, provider_id)
        invalidate_llm_cache()
        logger.info(f"Admin {current_user.email} eliminó proveedor de IA ID {provider_id}")
        return {"status": "deleted", "id": provider_id, "message": "Proveedor eliminado exitosamente"}
    except Exception as e:
        logger.error(f"Error eliminando proveedor LLM ID {provider_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al eliminar proveedor de IA: {str(e)}"
        )


@router.post("/keys/{provider_id}/test", response_model=LLMProviderTestResult)
def test_ai_key(
    provider_id: int,
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_arko_admin)
) -> LLMProviderTestResult:
    """Realiza un ping en vivo contra la API del proveedor para validar que la clave sea válida y medir latencia."""
    provider = get_provider_by_id(db, provider_id)
    if not provider:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Proveedor con ID {provider_id} no encontrado."
        )

    start_time = time.time()
    try:
        plain_key = decrypt_api_key(provider.api_key_enc)
        key_type = provider.provider_key.lower().strip()

        if key_type == "gemini":
            try:
                import google.generativeai as genai
                genai.configure(api_key=plain_key)
                model = genai.GenerativeModel(provider.model_name or "gemini-2.0-flash")
                resp = model.generate_content("Responde solo la palabra 'OK'")
                latency = int((time.time() - start_time) * 1000)
                preview = resp.text.strip() if hasattr(resp, "text") else "OK"
                return LLMProviderTestResult(
                    success=True,
                    latency_ms=latency,
                    response_preview=preview[:100]
                )
            except Exception as gem_err:
                latency = int((time.time() - start_time) * 1000)
                return LLMProviderTestResult(
                    success=False,
                    latency_ms=latency,
                    error=f"Error de conexión con Google Gemini: {str(gem_err)}"
                )

        elif key_type in ["openai", "groq", "deepseek", "custom"]:
            base_url = provider.base_url
            if not base_url:
                if key_type == "openai":
                    base_url = "https://api.openai.com/v1"
                elif key_type == "groq":
                    base_url = "https://api.groq.com/openai/v1"
                elif key_type == "deepseek":
                    base_url = "https://api.deepseek.com"
                else:
                    base_url = "https://api.openai.com/v1"

            clean_base = base_url.rstrip("/")
            test_url = f"{clean_base}/models"
            resp = requests.get(
                test_url,
                headers={"Authorization": f"Bearer {plain_key}"},
                timeout=10
            )
            latency = int((time.time() - start_time) * 1000)
            if resp.status_code == 200:
                return LLMProviderTestResult(
                    success=True,
                    latency_ms=latency,
                    response_preview=f"Conexión exitosa con {key_type.upper()}."
                )
            else:
                return LLMProviderTestResult(
                    success=False,
                    latency_ms=latency,
                    error=f"HTTP {resp.status_code}: {resp.text[:120]}"
                )

        elif key_type == "anthropic":
            test_url = "https://api.anthropic.com/v1/messages"
            headers = {
                "x-api-key": plain_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json"
            }
            body = {
                "model": provider.model_name or "claude-3-haiku-20240307",
                "max_tokens": 10,
                "messages": [{"role": "user", "content": "ping"}]
            }
            resp = requests.post(test_url, json=body, headers=headers, timeout=10)
            latency = int((time.time() - start_time) * 1000)
            if resp.status_code == 200:
                return LLMProviderTestResult(
                    success=True,
                    latency_ms=latency,
                    response_preview="Conexión exitosa con Anthropic Claude."
                )
            else:
                return LLMProviderTestResult(
                    success=False,
                    latency_ms=latency,
                    error=f"HTTP {resp.status_code}: {resp.text[:120]}"
                )

        else:
            latency = int((time.time() - start_time) * 1000)
            return LLMProviderTestResult(
                success=True,
                latency_ms=latency,
                response_preview=f"Proveedor '{key_type}' guardado y clave desencriptada correctamente."
            )

    except Exception as exc:
        latency = int((time.time() - start_time) * 1000)
        logger.error(f"Error probando conexión de proveedor ID {provider_id}: {exc}", exc_info=True)
        return LLMProviderTestResult(
            success=False,
            latency_ms=latency,
            error=str(exc)
        )
