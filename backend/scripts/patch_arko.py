import sys
import re

file_path = r"c:\Users\pablo\Documents\apupro_platform\backend\app\api\v1\endpoints\arko.py"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Update login_arko_admin to check is_email_verified
login_old = """            if not user.is_active:
                raise HTTPException(status_code=400, detail="Inactive user")"""
login_new = """            if not user.is_active:
                raise HTTPException(status_code=400, detail="Inactive user")
            if not getattr(user, "is_email_verified", True):
                raise HTTPException(status_code=403, detail="Email not verified")"""
content = content.replace(login_old, login_new)

# 2. Insert the new auth endpoints
new_endpoints = """
from app.services.email import send_reset_password_email, send_verification_email

class RegisterRequest(BaseModel):
    email: str
    password: str
    full_name: str = ""

@router.post("/auth/register")
def register_arko_admin(data: RegisterRequest):
    try:
        with get_db_session() as db:
            user = db.query(ArkoAdmin).filter(ArkoAdmin.email == data.email).first()
            if user:
                raise HTTPException(status_code=400, detail="Email already registered")
            
            new_user = ArkoAdmin(
                email=data.email,
                hashed_password=get_password_hash(data.password),
                full_name=data.full_name,
                is_active=True,
                is_email_verified=False
            )
            db.add(new_user)
            db.commit()
            
            # Crear token de verificacion
            token = create_access_token(
                data={"sub": new_user.email, "type": "verify_email"},
                expires_delta=timedelta(hours=24)
            )
            send_verification_email(new_user.email, token)
            
            return {"message": "User registered successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error registering user: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")

class ForgotPasswordRequest(BaseModel):
    email: str

@router.post("/auth/forgot-password")
def forgot_password(data: ForgotPasswordRequest):
    try:
        with get_db_session() as db:
            user = db.query(ArkoAdmin).filter(ArkoAdmin.email == data.email).first()
            if not user:
                # No revelar que el usuario no existe por seguridad, retornar OK silenciosamente
                return {"message": "Si tu correo estÃ¡ registrado, recibirÃ¡s un enlace de recuperaciÃ³n."}
            
            # Token vÃ¡lido por 1 hora
            token = create_access_token(
                data={"sub": user.email, "type": "reset_password"},
                expires_delta=timedelta(hours=1)
            )
            send_reset_password_email(user.email, token)
            
            return {"message": "Si tu correo estÃ¡ registrado, recibirÃ¡s un enlace de recuperaciÃ³n."}
    except Exception as e:
        logger.error(f"Error in forgot password: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

@router.post("/auth/reset-password")
def reset_password(data: ResetPasswordRequest):
    try:
        import jwt
        from app.core.config import settings
        
        payload = jwt.decode(data.token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        email: str = payload.get("sub")
        token_type: str = payload.get("type")
        
        if email is None or token_type != "reset_password":
            raise HTTPException(status_code=400, detail="Token invÃ¡lido o expirado")
            
        with get_db_session() as db:
            user = db.query(ArkoAdmin).filter(ArkoAdmin.email == email).first()
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
                
            user.hashed_password = get_password_hash(data.new_password)
            db.commit()
            return {"message": "ContraseÃ±a actualizada exitosamente"}
            
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=400, detail="El enlace ha expirado")
    except jwt.JWTError:
        raise HTTPException(status_code=400, detail="Token invÃ¡lido")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error resetting password: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")

class VerifyEmailRequest(BaseModel):
    token: str

@router.post("/auth/verify-email")
def verify_email(data: VerifyEmailRequest):
    try:
        import jwt
        from app.core.config import settings
        
        payload = jwt.decode(data.token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        email: str = payload.get("sub")
        token_type: str = payload.get("type")
        
        if email is None or token_type != "verify_email":
            raise HTTPException(status_code=400, detail="Token invÃ¡lido")
            
        with get_db_session() as db:
            user = db.query(ArkoAdmin).filter(ArkoAdmin.email == email).first()
            if not user:
                raise HTTPException(status_code=404, detail="Usuario no encontrado")
                
            user.is_email_verified = True
            db.commit()
            return {"message": "Correo verificado exitosamente"}
            
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=400, detail="El enlace ha expirado")
    except jwt.JWTError:
        raise HTTPException(status_code=400, detail="Token invÃ¡lido")
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
        with get_db_session() as db:
            user = db.query(ArkoAdmin).filter(ArkoAdmin.email == data.email).first()
            if not user:
                return {"message": "Si tu correo estÃ¡ registrado, recibirÃ¡s un nuevo enlace."}
                
            if getattr(user, "is_email_verified", False):
                return {"message": "El correo ya estÃ¡ verificado."}
            
            token = create_access_token(
                data={"sub": user.email, "type": "verify_email"},
                expires_delta=timedelta(hours=24)
            )
            send_verification_email(user.email, token)
            
            return {"message": "Enlace reenviado exitosamente."}
    except Exception as e:
        logger.error(f"Error resending verification: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")

class GoogleLoginRequest"""

content = content.replace("class GoogleLoginRequest", new_endpoints)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Patch aplicado exitosamente.")
