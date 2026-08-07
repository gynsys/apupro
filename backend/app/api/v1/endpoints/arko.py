from fastapi import APIRouter, Depends, HTTPException, Query, status, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional, Any, Generator
from pydantic import BaseModel
from datetime import datetime
from fastapi.security import OAuth2PasswordRequestForm
from passlib.context import CryptContext
from pathlib import Path
import shutil
import logging

from app.core.logging import logger
from app.db.arko_base import ArkoSessionLocal
from contextlib import contextmanager
from app.db.models.arko import ArkoPost, ArkoProject, ArkoAdmin
from app.core.security import create_access_token
from app.core.config import settings

@contextmanager
def get_db_session() -> Generator[Session, None, None]:
    db = ArkoSessionLocal()
    try:
        yield db
    finally:
        db.close()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

router = APIRouter()

# --- Pydantic Schemas ---

class ArkoPostBase(BaseModel):
    title: str
    slug: str
    excerpt: Optional[str] = None
    content: Optional[str] = None
    image_url: Optional[str] = None
    category: Optional[str] = None
    author: Optional[str] = None
    status: Optional[str] = "published"
    seo_config: Optional[Any] = None

class ArkoPostCreate(ArkoPostBase):
    pass

class ArkoPostResponse(ArkoPostBase):
    id: int
    published_at: datetime
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# --- Endpoints Públicos (Para la Landing) ---

@router.get("/posts", response_model=List[ArkoPostResponse])
def get_public_posts(
    skip: int = 0,
    limit: int = 10,
    category: Optional[str] = None
):
    try:
        with get_db_session() as db:
            query = db.query(ArkoPost).filter(ArkoPost.status == "published")
            if category:
                query = query.filter(ArkoPost.category == category)
            
            posts = query.order_by(ArkoPost.published_at.desc()).offset(skip).limit(limit).all()
            return posts
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error fetching Arko posts: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/posts/{slug}", response_model=ArkoPostResponse)
def get_public_post(slug: str):
    try:
        with get_db_session() as db:
            post = db.query(ArkoPost).filter(ArkoPost.slug == slug, ArkoPost.status == "published").first()
            if not post:
                raise HTTPException(status_code=404, detail="Post not found")
            return post
    except HTTPException:
        raise
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error fetching Arko post {slug}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")

        raise HTTPException(status_code=500, detail="Internal server error")

# --- Autenticación Arko ---

@router.post("/auth/login")
def login_arko_admin(form_data: OAuth2PasswordRequestForm = Depends()):
    try:
        with get_db_session() as db:
            user = db.query(ArkoAdmin).filter(ArkoAdmin.email == form_data.username).first()
            if not user or not verify_password(form_data.password, user.hashed_password):
                raise HTTPException(status_code=400, detail="Incorrect email or password")
            if not user.is_active:
                raise HTTPException(status_code=400, detail="Inactive user")
            
            access_token = create_access_token(
                data={"sub": user.email, "type": "arko_admin"}
            )
            return {"access_token": access_token, "token_type": "bearer"}
    except HTTPException:
        raise
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error in Arko login: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")

# --- Dependencia Arko ---
from fastapi.security import OAuth2PasswordBearer
import jwt

oauth2_scheme_arko = OAuth2PasswordBearer(tokenUrl="/api/v1/arko/auth/login")

def get_current_arko_admin(token: str = Depends(oauth2_scheme_arko)):
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        email: str = payload.get("sub")
        token_type: str = payload.get("type")
        if email is None or token_type != "arko_admin":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Could not validate credentials")
    
    with get_db_session() as db:
        user = db.query(ArkoAdmin).filter(ArkoAdmin.email == email).first()
        if user is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
        return user

# --- Endpoints Privados (Para el Dashboard Arko) ---

@router.get("/admin/posts", response_model=List[ArkoPostResponse])
def get_admin_posts(
    skip: int = 0,
    limit: int = 50,
    current_admin = Depends(get_current_arko_admin)
):
    try:
        with get_db_session() as db:
            posts = db.query(ArkoPost).order_by(ArkoPost.created_at.desc()).offset(skip).limit(limit).all()
            return posts
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error fetching admin Arko posts: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/admin/posts", response_model=ArkoPostResponse, status_code=status.HTTP_201_CREATED)
def create_post(
    post_in: ArkoPostCreate,
    current_admin = Depends(get_current_arko_admin)
):
    try:
        with get_db_session() as db:
            existing = db.query(ArkoPost).filter(ArkoPost.slug == post_in.slug).first()
            if existing:
                raise HTTPException(status_code=400, detail="Slug already exists")
            
            post = ArkoPost(
                **post_in.dict(),
                author=post_in.author or current_admin.full_name
            )
            db.add(post)
            db.commit()
            db.refresh(post)
            return post
    except HTTPException:
        raise
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error creating Arko post: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")

@router.put("/admin/posts/{post_id}", response_model=ArkoPostResponse)
def update_post(
    post_id: int,
    post_in: ArkoPostCreate,
    current_admin = Depends(get_current_arko_admin)
):
    try:
        with get_db_session() as db:
            post = db.query(ArkoPost).filter(ArkoPost.id == post_id).first()
            if not post:
                raise HTTPException(status_code=404, detail="Post not found")
            
            # Check slug collision
            if post.slug != post_in.slug:
                existing = db.query(ArkoPost).filter(ArkoPost.slug == post_in.slug).first()
                if existing:
                    raise HTTPException(status_code=400, detail="Slug already exists")

            for field, value in post_in.dict(exclude_unset=True).items():
                setattr(post, field, value)
            
            db.commit()
            db.refresh(post)
            return post
    except HTTPException:
        raise
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error updating Arko post: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")

@router.delete("/admin/posts/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_post(
    post_id: int,
    current_admin = Depends(get_current_arko_admin)
):
    try:
        with get_db_session() as db:
            post = db.query(ArkoPost).filter(ArkoPost.id == post_id).first()
            if not post:
                raise HTTPException(status_code=404, detail="Post not found")
            
            db.delete(post)
            db.commit()
            return None
    except HTTPException:
        raise
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error deleting Arko post: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")

# --- Site Configuration Defaults & Helpers ---

DEFAULT_SITE_CONFIG = {
    "siteName": "Ingeniería Arko 360",
    "logoUrl": "/images/logo_aeko360.png",
    "primaryColor": "#0a4275",
    "secondaryColor": "#27ae60",
    "branding": {
        "primaryColor": "#0a4275",
        "secondaryColor": "#27ae60"
    },
    "global": {
        "phone": "+58 412 000 0000",
        "email": "proyectos@arko360.com",
        "location": "Caracas, Venezuela",
        "whatsapp": "+58XXXXXXXXXX",
        "logo": "/images/logo_aeko360.png",
        "social": {
            "instagram": "#",
            "facebook": "#",
            "linkedin": "#",
            "twitter": "#"
        }
    },
    "sections": {
        "showAbout": True,
        "showServices": True,
        "showPortfolio": True,
        "showProcess": True,
        "showTestimonials": True,
        "showBiblio": True,
        "showTools": True
    },
    "tools": {
        "showCieloRaso": True,
        "showMuroGravedad": True,
        "showDisenoMezclas": True,
        "showDrywall": True,
        "showElectrica": True,
        "showEscaleras": True,
        "showLosas": True,
        "showArko3D": True,
        "showCieloRasoVisible": True
    },
    "hero": {
        "badge": "Ingeniería & Arquitectura",
        "titleLine1": "Construimos el",
        "titleAccent": "Futuro",
        "titleLine2": "con precisión.",
        "subtitle": "Expertos en proyectos residenciales, comerciales y cálculos estructurales. Llevamos tu visión de los planos a la realidad con estándares internacionales de calidad.",
        "ctaPrimary": "Cotizar Proyecto",
        "ctaSecondary": "Ver Portafolio"
    },
    "aboutUs": {
        "tag": "Sobre Nosotros",
        "title": "Construyendo sueños desde hace 15 años",
        "p1": "Ingeniería Arko 360 nació con una visión clara: ofrecer soluciones constructivas de la más alta calidad, combinando innovación tecnológica con la experiencia artesanal de nuestros técnicos.",
        "p2": "Hemos ejecutado más de 200 proyectos en todo el país, desde viviendas unifamiliares hasta complejos comerciales, siempre manteniendo nuestro compromiso con la excelencia y la satisfacción del cliente.",
        "imageUrl": "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=800&q=80"
    },
    "services": {
        "tag": "Nuestros Servicios",
        "title": "Soluciones integrales para cada desafío",
        "subtitle": "Cubrimos todo el ciclo de vida del proyecto, desde la conceptualización hasta la entrega llave en mano.",
        "list": [
            {
                "id": "srv-1",
                "icon": "Building2",
                "title": "Construcción Residencial",
                "desc": "Desarrollo de viviendas unifamiliares, conjuntos cerrados y torres de apartamentos con los más altos estándares."
            },
            {
                "id": "srv-2",
                "icon": "Hammer",
                "title": "Remodelaciones",
                "desc": "Renovación integral de espacios comerciales y residenciales. Modernización de oficinas y locales."
            },
            {
                "id": "srv-3",
                "icon": "Ruler",
                "title": "Diseño Arquitectónico",
                "desc": "Creación de planos, renders 3D y diseño de interiores adaptados a las necesidades y presupuesto del cliente."
            },
            {
                "id": "srv-4",
                "icon": "HardHat",
                "title": "Gestión de Proyectos",
                "desc": "Supervisión de obra, control de calidad, manejo de presupuesto y coordinación de contratistas."
            },
            {
                "id": "srv-5",
                "icon": "Wrench",
                "title": "Mantenimiento Industrial",
                "desc": "Servicios preventivos y correctivos para instalaciones industriales, fábricas y galpones."
            },
            {
                "id": "srv-6",
                "icon": "PenTool",
                "title": "Cálculo Estructural",
                "desc": "Análisis sísmico, diseño de fundaciones y estructuras de concreto armado y metálicas."
            }
        ]
    },
    "portfolio": {
        "tag": "Portafolio",
        "title": "Proyectos que hablan por sí solos",
        "subtitle": "Cada obra es un compromiso con la excelencia. Descubre algunos de nuestros proyectos más destacados a lo largo de Venezuela."
    },
    "process": {
        "tag": "Metodología de Trabajo",
        "title": "Nuestro proceso paso a paso",
        "subtitle": "Hemos perfeccionado nuestro método de trabajo para garantizar resultados predecibles, entregas a tiempo y sin sorpresas en el presupuesto.",
        "steps": [
            {
                "id": "prc-1",
                "icon": "Settings",
                "title": "1. Consulta Inicial",
                "desc": "Nos reunimos para entender tu visión, necesidades y presupuesto. Evaluamos el espacio y discutimos las posibilidades."
            },
            {
                "id": "prc-2",
                "icon": "PencilRuler",
                "title": "2. Diseño y Planificación",
                "desc": "Nuestros arquitectos crean propuestas de diseño, planos y renders 3D para que visualices el resultado final."
            },
            {
                "id": "prc-3",
                "icon": "FileSignature",
                "title": "3. Presupuesto y Contrato",
                "desc": "Presentamos un presupuesto detallado y transparente. Una vez aprobado, firmamos el contrato y establecemos el cronograma."
            },
            {
                "id": "prc-4",
                "icon": "HardHat",
                "title": "4. Ejecución de Obra",
                "desc": "Nuestro equipo comienza la construcción o remodelación, con supervisión constante y reportes de avance regulares."
            },
            {
                "id": "prc-5",
                "icon": "Key",
                "title": "5. Entrega Final",
                "desc": "Realizamos una inspección detallada contigo, entregamos garantías y te damos las llaves de tu nuevo espacio."
            }
        ]
    },
    "testimonials": {
        "tag": "Testimonios",
        "title": "Lo que dicen nuestros clientes",
        "subtitle": "La satisfacción de nuestros clientes es el mejor indicador de nuestro trabajo.",
        "list": [
            {
                "id": "tst-1",
                "text": "Arko 360 superó todas mis expectativas. Construyeron mi casa en el tiempo acordado y con una calidad impresionante. El equipo es profesional, ordenado y siempre dispuesto a resolver cualquier inquietud.",
                "name": "Carlos Mendoza",
                "role": "Propietario — Residencia Las Acacias",
                "avatar": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80",
                "stars": 5
            },
            {
                "id": "tst-2",
                "text": "La remodelación de nuestras oficinas fue un proceso sorprendentemente fluido. Cumplieron con el presupuesto, el tiempo y lo más importante: el resultado es extraordinario. Nuestros empleados y clientes quedaron encantados.",
                "name": "María González",
                "role": "Directora General — Grupo Comercial MG",
                "avatar": "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=200&q=80",
                "stars": 5
            },
            {
                "id": "tst-3",
                "text": "Llevamos 3 proyectos con Arko 360 y no pensamos cambiar de empresa constructora. Su transparencia, comunicación constante y nivel de acabados los hacen únicos en el mercado venezolano.",
                "name": "Roberto Herrera",
                "role": "Desarrollador Inmobiliario",
                "avatar": "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&q=80",
                "stars": 5
            }
        ]
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
