import os
import random
import re
import string
import shutil
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Optional, Any, Generator, Dict
from contextlib import contextmanager

from fastapi import APIRouter, Depends, HTTPException, Query, status, UploadFile, File, Response, Request, Cookie
from fastapi.security import OAuth2PasswordRequestForm, OAuth2PasswordBearer
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from sqlalchemy import or_, func
import jwt

from app.core.logging import logger
from app.db.arko_base import ArkoSessionLocal
from app.db.models.arko import ArkoAdmin
from app.core.security import (
    create_access_token,
    validate_password_strength,
    hash_password,
    verify_password,
)
from app.core.config import settings
from app.services.redis_cache_service import redis_cache
from app.services.email import send_verification_email, send_email, send_reset_password_email
from app.core.limiter import limiter
from app.core.html_sanitizer import sanitize_html

@contextmanager
def get_db_session() -> Generator[Session, None, None]:
    db = ArkoSessionLocal()
    try:
        yield db
    finally:
        db.close()

# Alias get_password_hash to centralized hash_password
get_password_hash = hash_password

router = APIRouter()

# --- Autenticación Arko ---

@router.post("/auth/login")
@limiter.limit("5/minute")
def login_arko_admin(request: Request, response: Response, form_data: OAuth2PasswordRequestForm = Depends()):
    try:
        with get_db_session() as db:
            identifier = (form_data.username or "").strip()
            if not identifier:
                raise HTTPException(status_code=400, detail="El correo o nombre de usuario es requerido")

            user = db.query(ArkoAdmin).filter(
                or_(
                    func.lower(ArkoAdmin.email) == identifier.lower(),
                    func.lower(ArkoAdmin.username) == identifier.lower(),
                    func.lower(ArkoAdmin.full_name) == identifier.lower()
                )
            ).first()
            if not user or not verify_password(form_data.password, user.hashed_password):
                raise HTTPException(status_code=400, detail="Credenciales incorrectas")
            if not user.is_active:
                raise HTTPException(status_code=400, detail="Usuario inactivo")
            if not getattr(user, "is_email_verified", True):
                raise HTTPException(status_code=403, detail="Email not verified")

            access_token = create_access_token(
                data={"sub": user.email, "type": "arko_admin"}
            )

            # Set httpOnly cookie for security
            response.set_cookie(
                key="arko_admin_token",
                value=access_token,
                httponly=settings.COOKIE_HTTPONLY,
                secure=settings.COOKIE_SECURE,
                samesite=settings.COOKIE_SAMESITE,
                max_age=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES).total_seconds()
            )

            return {"token_type": "bearer", "success": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in Arko login: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")


def generate_verification_code(length: int = 6) -> str:
    return ''.join(random.choices(string.digits, k=length))

class RegisterRequest(BaseModel):
    email: str
    password: str
    full_name: str = ""
    username: Optional[str] = None

@router.post("/auth/register")
def register_arko_admin(data: RegisterRequest) -> dict:
    try:
        validate_password_strength(data.password)
    except ValueError as val_err:
        raise HTTPException(status_code=400, detail=str(val_err))

    try:
        with get_db_session() as db:
            clean_email = data.email.strip().lower()
            clean_username = (data.username or data.full_name or "").strip()

            # Verificar si el email ya está registrado y verificado
            user = db.query(ArkoAdmin).filter(func.lower(ArkoAdmin.email) == clean_email).first()
            if user and getattr(user, "is_email_verified", False):
                raise HTTPException(status_code=400, detail="El correo electrónico ya está registrado")

            # Verificar si el nombre de usuario ya está registrado y verificado
            if clean_username:
                existing_by_username = db.query(ArkoAdmin).filter(
                    or_(
                        func.lower(ArkoAdmin.username) == clean_username.lower(),
                        func.lower(ArkoAdmin.full_name) == clean_username.lower()
                    )
                ).first()
                if existing_by_username and getattr(existing_by_username, "is_email_verified", False) and existing_by_username.email.lower() != clean_email:
                    raise HTTPException(status_code=400, detail="El nombre de usuario ya está registrado")
            
            # Generar código de verificación
            code = generate_verification_code()
            
            # Si existe un usuario no verificado con este correo, eliminarlo primero
            if user and not getattr(user, "is_email_verified", False):
                db.delete(user)
                db.commit()
            
            # Almacenar datos temporalmente en Redis (NO en base de datos)
            registration_data = {
                "email": clean_email,
                "hashed_password": get_password_hash(data.password),
                "full_name": data.full_name or clean_username,
                "username": clean_username or clean_email.split('@')[0]
            }
            
            # Guardar en Redis con expiración de 15 minutos
            if not redis_cache.store_pending_registration(clean_email, registration_data, expiry_seconds=900):
                raise HTTPException(status_code=500, detail="Error storing registration data")
            
            # Guardar código de verificación separadamente
            if not redis_cache.store_verification_code(clean_email, code, expiry_seconds=900):
                raise HTTPException(status_code=500, detail="Error storing verification code")
            
            # Enviar correo de verificación
            email_sent = send_verification_email(clean_email, code)
            
            if not email_sent:
                # El correo falló pero NO bloqueamos el registro.
                # El usuario puede usar "Reenviar código" desde la pantalla de verificación.
                logger.error(f"[REGISTER] Falló el envío del correo de verificación a {clean_email}. El registro continúa.")
            
            return {
                "message": "Registration initiated. Please check your email for verification code.",
                "email": clean_email,
                "requires_verification": True,
                "email_sent": email_sent
            }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error registering user: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")

class ForgotPasswordRequest(BaseModel):
    email: str

@router.post("/auth/forgot-password")
@limiter.limit("3/minute")
def forgot_password(request: Request, data: ForgotPasswordRequest):
    try:
        with get_db_session() as db:
            identifier = (data.email or "").strip().lower()
            user = db.query(ArkoAdmin).filter(
                or_(
                    func.lower(ArkoAdmin.email) == identifier,
                    func.lower(ArkoAdmin.username) == identifier,
                    func.lower(ArkoAdmin.full_name) == identifier
                )
            ).first()
            if not user:
                return {"message": "Si tu correo o usuario está registrado, recibirás un correo con tu código."}
            
            code = generate_verification_code()
            user.verification_code = code
            db.commit()
            
            send_reset_password_email(user.email, code)
            
            return {"message": "Si tu correo o usuario está registrado, recibirás un correo con tu código."}
    except Exception as e:
        logger.error(f"Error in forgot password: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")

class ResetPasswordRequest(BaseModel):
    email: str
    code: str
    new_password: str

@router.post("/auth/reset-password")
def reset_password(data: ResetPasswordRequest) -> dict:
    try:
        validate_password_strength(data.new_password)
    except ValueError as val_err:
        raise HTTPException(status_code=400, detail=str(val_err))

    try:
        with get_db_session() as db:
            identifier = (data.email or "").strip().lower()
            user = db.query(ArkoAdmin).filter(
                or_(
                    func.lower(ArkoAdmin.email) == identifier,
                    func.lower(ArkoAdmin.username) == identifier,
                    func.lower(ArkoAdmin.full_name) == identifier
                )
            ).first()
            if not user or user.verification_code != data.code:
                raise HTTPException(status_code=400, detail="Código inválido o expirado")
                
            user.hashed_password = get_password_hash(data.new_password)
            user.verification_code = None
            db.commit()
            return {"message": "Contraseña actualizada exitosamente"}
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error resetting password: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")

class VerifyEmailRequest(BaseModel):
    email: str
    code: str

@router.post("/auth/verify-email")
def verify_email(data: VerifyEmailRequest):
    try:
        clean_email = data.email.strip().lower()
        # Verificar código contra Redis
        if not redis_cache.verify_code(clean_email, data.code):
            raise HTTPException(status_code=400, detail="Código inválido o expirado")
        
        # Recuperar datos de registro pendiente
        registration_data = redis_cache.get_pending_registration(clean_email)
        if not registration_data:
            raise HTTPException(status_code=400, detail="Registro expirado. Por favor regístrate nuevamente.")
        
        # Verificar si el usuario ya existe en BD (por si acaso)
        with get_db_session() as db:
            existing_user = db.query(ArkoAdmin).filter(func.lower(ArkoAdmin.email) == clean_email).first()
            if existing_user:
                if getattr(existing_user, "is_email_verified", False):
                    raise HTTPException(status_code=400, detail="Email ya registrado y verificado")
                else:
                    # Eliminar usuario no verificado anterior
                    db.delete(existing_user)
                    db.commit()
            
            username_val = registration_data.get("username") or registration_data.get("full_name") or clean_email.split('@')[0]
            # Crear el usuario en la base de datos con email verificado
            new_user = ArkoAdmin(
                email=registration_data["email"],
                username=username_val,
                hashed_password=registration_data.get("hashed_password") or get_password_hash(registration_data.get("password", "")),
                full_name=registration_data.get("full_name") or username_val,
                is_active=True,
                is_email_verified=True,  # Ya verificado desde el inicio
                verification_code=None
            )
            db.add(new_user)
            db.commit()
            
            # Limpiar datos de Redis
            redis_cache.delete_pending_registration(clean_email)
            
            return {
                "message": "Correo verificado exitosamente. Usuario creado.",
                "email": new_user.email,
                "username": new_user.username,
                "is_email_verified": True
            }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error verifying email: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")

class ResendVerificationRequest(BaseModel):
    email: str

@router.post("/auth/resend-verification")
def resend_verification(data: ResendVerificationRequest):
    try:
        identifier = (data.email or "").strip().lower()
        target_email = identifier
        # Verificar si hay un registro pendiente en Redis
        registration_data = redis_cache.get_pending_registration(target_email)
        
        if not registration_data:
            # Verificar si se pasó el username en lugar del email
            with get_db_session() as db:
                user = db.query(ArkoAdmin).filter(
                    or_(
                        func.lower(ArkoAdmin.email) == identifier,
                        func.lower(ArkoAdmin.username) == identifier,
                        func.lower(ArkoAdmin.full_name) == identifier
                    )
                ).first()
                if user:
                    target_email = user.email.lower()
                    if getattr(user, "is_email_verified", False):
                        return {"message": "El correo ya está verificado."}
                else:
                    return {"message": "No hay registro pendiente. Por favor regístrate nuevamente."}
        
        # Generar nuevo código y actualizar en Redis
        code = generate_verification_code()
        if not redis_cache.store_verification_code(target_email, code, expiry_seconds=900):
            raise HTTPException(status_code=500, detail="Error storing new verification code")
        
        # Enviar nuevo correo
        email_sent = send_verification_email(target_email, code)
        if not email_sent:
            raise HTTPException(status_code=500, detail="No se pudo reenviar el correo. Verifica la configuración de Resend.")
            
        return {"message": "Nuevo código enviado. Por favor revisa tu correo."}
    except Exception as e:
        logger.error(f"Error resending verification: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")


class GoogleLoginRequest(BaseModel):
    token: str

@router.post("/auth/login/google")
@limiter.limit("10/minute")
def login_google(request: Request, login_data: GoogleLoginRequest, response: Response):
    try:
        from google.oauth2 import id_token
        import google.auth.transport.requests
        import requests

        if not settings.GOOGLE_CLIENT_ID:
            logger.error("GOOGLE_CLIENT_ID not configured")
            raise HTTPException(status_code=500, detail="Google OAuth no configurado")

        request_session = requests.Session()
        req = google.auth.transport.requests.Request(session=request_session)

        try:
            id_info = id_token.verify_oauth2_token(
                login_data.token, req, settings.GOOGLE_CLIENT_ID
            )
        except ValueError:
            # Maybe it's an access token instead of id_token (implicit flow)
            resp = request_session.get(
                "https://www.googleapis.com/oauth2/v3/userinfo",
                headers={"Authorization": f"Bearer {login_data.token}"}
            )
            if resp.status_code == 200:
                id_info = resp.json()
            else:
                raise HTTPException(status_code=400, detail="Token de Google inválido")

        email = id_info.get("email")
        if not email:
            raise HTTPException(status_code=400, detail="No se pudo obtener el email de Google")

        full_name = id_info.get("name") or id_info.get("given_name") or ""

        with get_db_session() as db:
            user = db.query(ArkoAdmin).filter(ArkoAdmin.email == email).first()
            if not user:
                # Registro automático
                import secrets
                import string
                alphabet = string.ascii_letters + string.digits
                temp_pwd = ''.join(secrets.choice(alphabet) for i in range(16))

                base_username = email.split('@')[0]
                user = ArkoAdmin(
                    email=email,
                    username=base_username,
                    hashed_password=get_password_hash(temp_pwd),
                    full_name=full_name,
                    is_active=True,
                    is_email_verified=True  # Google ya verificó el email
                )
                db.add(user)
                db.commit()
                db.refresh(user)
            elif not user.is_active:
                raise HTTPException(status_code=400, detail="Usuario inactivo")

            # Use same structure as normal login
            access_token = create_access_token(
                data={"sub": user.email, "type": "arko_admin"}
            )

            # Set httpOnly cookie for security
            response.set_cookie(
                key="arko_admin_token",
                value=access_token,
                httponly=settings.COOKIE_HTTPONLY,
                secure=settings.COOKIE_SECURE,
                samesite=settings.COOKIE_SAMESITE,
                max_age=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES).total_seconds()
            )

            return {"token_type": "bearer", "success": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in Google login: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/auth/logout")
def logout_arko_admin(response: Response):
    """Logout endpoint - clears the httpOnly cookie"""
    response.delete_cookie(
        key="arko_admin_token",
        httponly=settings.COOKIE_HTTPONLY,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE
    )
    return {"message": "Logged out successfully"}

# --- Dependencia Arko ---
oauth2_scheme_arko = OAuth2PasswordBearer(tokenUrl="/api/v1/arko/auth/login", auto_error=False)

def get_current_arko_admin(
    request: Request,
    bearer_token: Optional[str] = Depends(oauth2_scheme_arko),
    arko_admin_token: Optional[str] = Cookie(default=None),
) -> "ArkoAdmin":
    # Cookie takes priority (set by login endpoint); fallback to Authorization header
    token = arko_admin_token or bearer_token
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        email: str = payload.get("sub")
        token_type: str = payload.get("type")
        if email is None or token_type != "arko_admin":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Could not validate credentials")

    with get_db_session() as db:
        user = db.query(ArkoAdmin).filter(ArkoAdmin.email == email).first()
        if user is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
        return user


def get_optional_arko_admin(
    request: Request,
    bearer_token: Optional[str] = Depends(oauth2_scheme_arko),
    arko_admin_token: Optional[str] = Cookie(default=None),
) -> Optional["ArkoAdmin"]:
    token = arko_admin_token or bearer_token
    if not token:
        return None
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        email: str = payload.get("sub")
        token_type: str = payload.get("type")
        if email is None or token_type != "arko_admin":
            return None
        with get_db_session() as db:
            return db.query(ArkoAdmin).filter(ArkoAdmin.email == email).first()
    except Exception:
        return None

# --- Endpoints Privados (Para el Dashboard Arko) ---

@router.post("/auth/test-email")
def test_email_config(current_user: ArkoAdmin = Depends(get_current_arko_admin)) -> Dict[str, Any]:
    """Diagnóstico: prueba el envío de correo con Resend (solo superadmin)"""
    api_key = settings.RESEND_API_KEY or ""
    key_status = "configurada" if api_key.startswith("re_") else "no configurada o inválida"
    test_sent = send_email(
        to_email=current_user.email,
        subject="[TEST] Diagnóstico de correo CostBase",
        html_content="<p>Correo de prueba enviado correctamente.</p>"
    )
    return {
        "resend_api_key_status": key_status,
        "resend_from_email": settings.RESEND_FROM_EMAIL,
        "test_email_sent": test_sent,
        "sent_to": current_user.email
    }

# Schemas para /me
class CostosConfigSchema(BaseModel):
    porcentajeUtilidad: float = 10.0
    porcentajeAdministracion: float = 15.0
    iva: float = 16.0
    fcas: float = 417.0
    fcasSalarioBase: Optional[float] = 80.0
    fcasBonoCestaticket: Optional[float] = 174.0
    fcasMetodo: Optional[str] = "estandar"
    fcasBonoInFcas: Optional[bool] = False
    fcasLaborBonus: Optional[float] = 5.72
    fcasDiasRendimiento: Optional[float] = 56.0
    fcasCostoHcm: Optional[float] = 450.0
    fcasCostoTransporte: Optional[float] = 547.50
    fcasCostoEpp: Optional[float] = 290.0
    fcasSavedProfiles: Optional[Dict[str, Any]] = Field(default_factory=dict)

class CostosConfigUpdate(BaseModel):
    porcentajeUtilidad: Optional[float] = None
    porcentajeAdministracion: Optional[float] = None
    iva: Optional[float] = None
    fcas: Optional[float] = None
    fcasSalarioBase: Optional[float] = None
    fcasBonoCestaticket: Optional[float] = None
    fcasMetodo: Optional[str] = None
    fcasBonoInFcas: Optional[bool] = None
    fcasLaborBonus: Optional[float] = None
    fcasDiasRendimiento: Optional[float] = None
    fcasCostoHcm: Optional[float] = None
    fcasCostoTransporte: Optional[float] = None
    fcasCostoEpp: Optional[float] = None
    fcasSavedProfiles: Optional[Dict[str, Any]] = None

class ArkoMeUpdate(BaseModel):
    full_name: Optional[str] = None
    current_password: Optional[str] = None
    new_password: Optional[str] = None

class ArkoMeResponse(BaseModel):
    id: int
    email: str
    username: Optional[str] = None
    full_name: Optional[str] = None
    plan: str
    max_budgets: Optional[int] = None
    max_items_per_budget: Optional[int] = None
    has_ai_access: bool
    max_ai_apus: Optional[int] = 0
    ai_apus_generated: Optional[int] = 0
    costos_config: CostosConfigSchema
    is_superadmin: Optional[bool] = False

    class Config:
        from_attributes = True

COSTOS_DEFAULTS = CostosConfigSchema()

def _get_costos_config(user: ArkoAdmin) -> CostosConfigSchema:
    """Devuelve costos_config del usuario con fallback a site_config.costos y luego defaults."""
    if user.costos_config:
        return CostosConfigSchema(**{
            **COSTOS_DEFAULTS.model_dump(),
            **user.costos_config,
        })
    # Fallback a config global del admin
    if user.site_config and isinstance(user.site_config.get("costos"), dict):
        return CostosConfigSchema(**{
            **COSTOS_DEFAULTS.model_dump(),
            **user.site_config["costos"],
        })
    return COSTOS_DEFAULTS

@router.get("/me", response_model=ArkoMeResponse)
def get_current_admin_me(
    current_admin: ArkoAdmin = Depends(get_current_arko_admin),
) -> ArkoMeResponse:
    """Retorna datos completos del administrador autenticado, incluyendo costos_config e is_superadmin."""
    is_super = (
        current_admin.email == "admin@arko360.net"
        or current_admin.email == (settings.ADMIN_EMAIL or "")
        or bool(current_admin.site_config and current_admin.site_config.get("is_superadmin"))
    )
    return ArkoMeResponse(
        id=current_admin.id,
        email=current_admin.email,
        username=getattr(current_admin, "username", None) or current_admin.full_name or current_admin.email.split('@')[0],
        full_name=current_admin.full_name,
        plan=current_admin.plan or "free",
        max_budgets=current_admin.max_budgets,
        max_items_per_budget=current_admin.max_items_per_budget,
        has_ai_access=bool(current_admin.has_ai_access),
        max_ai_apus=current_admin.max_ai_apus or 0,
        ai_apus_generated=current_admin.ai_apus_generated or 0,
        costos_config=_get_costos_config(current_admin),
        is_superadmin=is_super,
    )

@router.put("/me", response_model=ArkoMeResponse)
def update_current_admin_me(
    profile_in: ArkoMeUpdate,
    current_admin: ArkoAdmin = Depends(get_current_arko_admin),
) -> ArkoMeResponse:
    """Actualiza datos del perfil del usuario (nombre de usuario y/o contraseña)."""
    with get_db_session() as db:
        user = db.query(ArkoAdmin).filter(ArkoAdmin.id == current_admin.id).first()
        if not user:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")

        if profile_in.full_name is not None:
            user.full_name = profile_in.full_name.strip()

        if profile_in.new_password:
            if not profile_in.current_password:
                raise HTTPException(status_code=400, detail="Debes ingresar tu contraseña actual para cambiarla.")
            if not verify_password(profile_in.current_password, user.hashed_password):
                raise HTTPException(status_code=400, detail="La contraseña actual es incorrecta.")
            try:
                validate_password_strength(profile_in.new_password)
            except ValueError as val_err:
                raise HTTPException(status_code=400, detail=str(val_err))
            user.hashed_password = get_password_hash(profile_in.new_password)

        db.commit()
        db.refresh(user)

        return ArkoMeResponse(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            plan=user.plan or "free",
            max_budgets=user.max_budgets,
            max_items_per_budget=user.max_items_per_budget,
            has_ai_access=bool(user.has_ai_access),
            max_ai_apus=user.max_ai_apus or 0,
            ai_apus_generated=user.ai_apus_generated or 0,
            costos_config=_get_costos_config(user),
        )

@router.put("/me/costos", response_model=CostosConfigSchema)
def update_current_admin_costos(
    costos_in: CostosConfigUpdate,
    current_admin: ArkoAdmin = Depends(get_current_arko_admin),
) -> CostosConfigSchema:
    """Actualiza la configuración de costos del administrador autenticado."""
    current = _get_costos_config(current_admin)
    updated = current.model_dump()
    patch = costos_in.model_dump(exclude_none=True)
    # Validar rangos
    for key, value in patch.items():
        if isinstance(value, (int, float)):
            if value < 0:
                raise HTTPException(
                    status_code=400,
                    detail=f"El valor de {key} no puede ser negativo.",
                )
            if key in ("porcentajeUtilidad", "porcentajeAdministracion", "iva") and value > 100:
                raise HTTPException(
                    status_code=400,
                    detail=f"El porcentaje {key} no puede superar 100%.",
                )
    updated.update(patch)
    with get_db_session() as db:
        user = db.query(ArkoAdmin).filter(ArkoAdmin.id == current_admin.id).first()
        if not user:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
        user.costos_config = dict(updated)
        flag_modified(user, "costos_config")
        db.commit()
    return CostosConfigSchema(**updated)

# --- Site Configuration Defaults & Helpers ---

DEFAULT_SITE_CONFIG = {
    "siteName": "APUPro Platform",
    "logoUrl": "/images/logo.png",
    "primaryColor": "#0a4275",
    "secondaryColor": "#27ae60",
    "branding": {
        "primaryColor": "#0a4275",
        "secondaryColor": "#27ae60"
    },
    "global": {
        "phone": "+58 412 000 0000",
        "email": "soporte@costbase.net",
        "location": "Venezuela",
        "logo": "/images/logo.png"
    },
    "costos": {
        "porcentajeUtilidad": 10,
        "porcentajeAdministracion": 8,
        "iva": 16,
        "fcas": 0
    }
}

def deep_merge(dict1: dict, dict2: dict) -> dict:
    """Recursively merge dict2 into dict1."""
    result = dict1.copy()
    for key, value in dict2.items():
        if key in result:
            if isinstance(result[key], dict) and isinstance(value, dict):
                result[key] = deep_merge(result[key], value)
            else:
                result[key] = value
        else:
            result[key] = value
    return result

# --- Site Configuration Endpoints ---

@router.get("/config", response_model=dict)
def get_site_config() -> dict:
    try:
        with get_db_session() as db:
            admin = db.query(ArkoAdmin).filter(ArkoAdmin.email == "admin@arko360.net").first()
            if not admin:
                admin = db.query(ArkoAdmin).first()
            
            saved_config = admin.site_config if admin and admin.site_config else {}
            # Mezclar recursivamente con los valores predeterminados
            return deep_merge(DEFAULT_SITE_CONFIG, saved_config)
    except Exception as e:
        logger.error(f"Error fetching Arko config: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")

@router.put("/admin/config", response_model=dict)
def update_site_config(
    config_data: dict,
    current_admin: ArkoAdmin = Depends(get_current_arko_admin)
) -> dict:
    try:
        with get_db_session() as db:
            admin = db.query(ArkoAdmin).filter(ArkoAdmin.id == current_admin.id).first()
            if not admin:
                raise HTTPException(status_code=404, detail="Admin not found")
            
            # Guardamos la nueva configuración en la base de datos
            admin.site_config = config_data
            db.commit()
            return {"status": "success", "config": admin.site_config}
    except Exception as e:
        logger.error(f"Error updating Arko config: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")

# --- File Uploads para Arko ---

UPLOAD_DIR = Path(settings.UPLOAD_DIR).resolve()
ARKO_DIR = UPLOAD_DIR / "arko"
ARKO_DIR.mkdir(parents=True, exist_ok=True)

@router.post("/admin/upload", status_code=status.HTTP_200_OK)
async def upload_arko_image(
    file: UploadFile = File(...),
    current_admin = Depends(get_current_arko_admin)
):
    try:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        file_extension = Path(file.filename).suffix
        filename = f"arko_{timestamp}{file_extension}"
        file_path = ARKO_DIR / filename
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # Get relative path for URL
        relative_path = file_path.relative_to(UPLOAD_DIR)
        url_path = f"/uploads/{relative_path.as_posix()}"
        
        return {"message": "Image uploaded successfully", "image_url": url_path}
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error uploading Arko image: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error uploading image")
