from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.base import get_db
from app.db.models.landing_site import LandingSite, LandingSiteStatus, LandingSitePost
from app.api.v1.endpoints.arko import get_current_arko_admin
from app.core.logging import logger
from pydantic import BaseModel, EmailStr
from fastapi.security import OAuth2PasswordRequestForm, OAuth2PasswordBearer
from app.core.security import verify_password, create_access_token
import jwt
from app.core.config import settings

router = APIRouter()

# Template configurations for different site types
TEMPLATE_CONFIGS = {
    "construccion": {
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
    },
    "medico": {
        "siteName": "Clínica Médica",
        "logoUrl": "/images/logo_medico.png",
        "primaryColor": "#0ea5e9",
        "secondaryColor": "#10b981",
        "branding": {
            "primaryColor": "#0ea5e9",
            "secondaryColor": "#10b981"
        },
        "global": {
            "phone": "+58 412 000 0000",
            "email": "contacto@clinica.com",
            "location": "Caracas, Venezuela",
            "whatsapp": "+58XXXXXXXXXX",
            "logo": "/images/logo_medico.png",
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
            "showPortfolio": False,
            "showProcess": True,
            "showTestimonials": True,
            "showBiblio": False,
            "showTools": False
        },
        "tools": {
            "showCieloRaso": False,
            "showMuroGravedad": False,
            "showDisenoMezclas": False,
            "showDrywall": False,
            "showElectrica": False,
            "showEscaleras": False,
            "showLosas": False,
            "showArko3D": False,
            "showCieloRasoVisible": False
        },
        "hero": {
            "badge": "Salud Integral",
            "titleLine1": "Cuidamos tu",
            "titleAccent": "Salud",
            "titleLine2": "con dedicación.",
            "subtitle": "Equipo médico especializado comprometido con tu bienestar. Atención personalizada con tecnología de vanguardia.",
            "ctaPrimary": "Agendar Cita",
            "ctaSecondary": "Nuestros Servicios"
        },
        "aboutUs": {
            "tag": "Sobre Nosotros",
            "title": "Más de 20 años de experiencia médica",
            "p1": "Nuestra clínica se ha consolidado como un referente en atención médica integral, combinando experiencia profesional con tecnología de última generación.",
            "p2": "Contamos con un equipo multidisciplinario de especialistas dedicados a brindar la mejor atención a cada paciente.",
            "imageUrl": "https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=800&q=80"
        },
        "services": {
            "tag": "Nuestros Servicios",
            "title": "Atención médica especializada",
            "subtitle": "Ofrecemos una amplia gama de servicios médicos para cubrir todas tus necesidades de salud.",
            "list": [
                {
                    "id": "srv-1",
                    "icon": "Stethoscope",
                    "title": "Medicina General",
                    "desc": "Consultas médicas generales, chequeos preventivos y seguimiento de enfermedades crónicas."
                },
                {
                    "id": "srv-2",
                    "icon": "Heart",
                    "title": "Cardiología",
                    "desc": "Evaluación cardiovascular, electrocardiogramas y monitoreo de presión arterial."
                },
                {
                    "id": "srv-3",
                    "icon": "Baby",
                    "title": "Pediatría",
                    "desc": "Atención especializada para niños desde recién nacidos hasta adolescentes."
                },
                {
                    "id": "srv-4",
                    "icon": "Activity",
                    "title": "Ginecología",
                    "desc": "Consultas ginecológicas, control prenatal y atención de la mujer."
                },
                {
                    "id": "srv-5",
                    "icon": "Syringe",
                    "title": "Vacunación",
                    "desc": "Programa completo de vacunación para niños y adultos."
                },
                {
                    "id": "srv-6",
                    "icon": "Microscope",
                    "title": "Laboratorio Clínico",
                    "desc": "Análisis clínicos completos con resultados rápidos y confiables."
                }
            ]
        },
        "portfolio": {
            "tag": "Portafolio",
            "title": "Nuestras Instalaciones",
            "subtitle": "Conoce nuestras instalaciones modernas equipadas con tecnología de vanguardia."
        },
        "process": {
            "tag": "Proceso de Atención",
            "title": "Tu salud en buenas manos",
            "subtitle": "Proceso de atención médica optimizado para brindarte el mejor servicio.",
            "steps": [
                {
                    "id": "prc-1",
                    "icon": "Calendar",
                    "title": "1. Agendar Cita",
                    "desc": "Reserva tu cita a través de nuestro sitio web, WhatsApp o teléfono."
                },
                {
                    "id": "prc-2",
                    "icon": "FileText",
                    "title": "2. Evaluación",
                    "desc": "Nuestros médicos realizan una evaluación completa de tu estado de salud."
                },
                {
                    "id": "prc-3",
                    "icon": "Clipboard",
                    "title": "3. Diagnóstico",
                    "desc": "Te proporcionamos un diagnóstico preciso y un plan de tratamiento personalizado."
                },
                {
                    "id": "prc-4",
                    "icon": "Pill",
                    "title": "4. Tratamiento",
                    "desc": "Implementamos el tratamiento con seguimiento constante y ajustes según sea necesario."
                },
                {
                    "id": "prc-5",
                    "icon": "CheckCircle",
                    "title": "5. Seguimiento",
                    "desc": "Monitoreamos tu evolución para garantizar los mejores resultados."
                }
            ]
        },
        "testimonials": {
            "tag": "Testimonios",
            "title": "Pacientes satisfechos",
            "subtitle": "La confianza de nuestros pacientes es nuestro mayor logro.",
            "list": [
                {
                    "id": "tst-1",
                    "text": "La atención médica recibida fue excepcional. El doctor fue muy atento y explicativo. Me sentí en buenas manos durante todo el proceso.",
                    "name": "Ana Martínez",
                    "role": "Paciente",
                    "avatar": "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&q=80",
                    "stars": 5
                },
                {
                    "id": "tst-2",
                    "text": "Excelente servicio desde la recepción hasta la consulta médica. Las instalaciones son modernas y limpias. Recomiendo esta clínica.",
                    "name": "Pedro Rodríguez",
                    "role": "Paciente",
                    "avatar": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&q=80",
                    "stars": 5
                },
                {
                    "id": "tst-3",
                    "text": "Llevo años viniendo a esta clínica y siempre recibo la mejor atención. El personal es amable y profesional.",
                    "name": "Carmen López",
                    "role": "Paciente",
                    "avatar": "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&q=80",
                    "stars": 5
                }
            ]
        }
    }
}

# Schemas for Landing Site
class LandingSiteCreate(BaseModel):
    email: EmailStr
    password: str
    nombre_cliente: str
    telefono: str | None = None
    especialidad: str | None = None
    slug: str
    custom_domain: str | None = None
    template_name: str = "construccion"
    logo_url: str | None = None
    ramo: str | None = None

class LandingSiteUpdate(BaseModel):
    nombre_cliente: str | None = None
    telefono: str | None = None
    especialidad: str | None = None
    custom_domain: str | None = None
    status: LandingSiteStatus | None = None

class LandingSiteResponse(BaseModel):
    id: int
    email: str
    nombre_cliente: str
    telefono: str | None
    especialidad: str | None
    slug: str
    custom_domain: str | None
    template_name: str
    status: LandingSiteStatus

    class Config:
        from_attributes = True

@router.post("/auth/login")
def login_landing_site(
    db: Session = Depends(get_db),
    form_data: OAuth2PasswordRequestForm = Depends()
) -> Any:
    """
    OAuth2 compatible token login, get an access token for future requests
    for Landing Site clients.
    """
    user = db.query(LandingSite).filter(LandingSite.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    
    if user.status != LandingSiteStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="Inactive user")

    access_token = create_access_token(
        data={"sub": user.email, "type": "landing_client", "slug": user.slug}
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/", response_model=List[LandingSiteResponse])
def read_landing_sites(
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    current_admin=Depends(get_current_arko_admin),
) -> Any:
    """
    Retrieve all landing sites (templates cloned).
    """
    sites = db.query(LandingSite).offset(skip).limit(limit).all()
    return sites

@router.post("/", response_model=LandingSiteResponse)
def create_landing_site(
    *,
    db: Session = Depends(get_db),
    site_in: LandingSiteCreate,
    current_admin=Depends(get_current_arko_admin),
) -> Any:
    """
    Clone a template and create a new Landing Site.
    """
    # Check if email exists
    if db.query(LandingSite).filter(LandingSite.email == site_in.email).first():
        logger.error(f"Email {site_in.email} already exists")
        raise HTTPException(
            status_code=400,
            detail="The site with this email already exists in the system.",
        )
    
    # Check if slug exists
    if db.query(LandingSite).filter(LandingSite.slug == site_in.slug).first():
        logger.error(f"Slug {site_in.slug} already exists")
        raise HTTPException(
            status_code=400,
            detail="The slug is already in use.",
        )

    # Note: password hashing should use pwd_context.hash
    # but for simplicity we rely on Arko's hash_password
    from app.core.security import hash_password
    
    # Get template configuration
    template_config = TEMPLATE_CONFIGS.get(site_in.template_name, TEMPLATE_CONFIGS["construccion"])
    
    # Customize config with client-specific information
    customized_config = template_config.copy()
    
    # Ensure nested dictionaries exist before modifying them if they don't in the template
    if "hero" not in customized_config: customized_config["hero"] = {}
    if "global" not in customized_config: customized_config["global"] = {}
    
    customized_config["siteName"] = site_in.nombre_cliente
    
    if site_in.especialidad:
        customized_config["hero"]["titleAccent"] = site_in.especialidad
        
    if site_in.ramo:
        customized_config["hero"]["badge"] = site_in.ramo
        
    if site_in.logo_url:
        customized_config["logoUrl"] = site_in.logo_url
        customized_config["global"]["logo"] = site_in.logo_url
        
    if site_in.telefono:
        customized_config["global"]["phone"] = site_in.telefono
    customized_config["global"]["email"] = site_in.email
    
    db_site = LandingSite(
        email=site_in.email,
        password_hash=hash_password(site_in.password),
        nombre_cliente=site_in.nombre_cliente,
        telefono=site_in.telefono,
        especialidad=site_in.especialidad,
        slug=site_in.slug,
        custom_domain=site_in.custom_domain,
        template_name=site_in.template_name,
        site_config=customized_config,
        status=LandingSiteStatus.ACTIVE,
    )
    
    db.add(db_site)
    db.commit()
    db.refresh(db_site)
    
    return db_site

@router.delete("/{site_id}", response_model=dict)
def delete_landing_site(
    *,
    db: Session = Depends(get_db),
    site_id: int,
    current_admin=Depends(get_current_arko_admin),
) -> Any:
    """
    Delete a landing site.
    """
    site = db.query(LandingSite).filter(LandingSite.id == site_id).first()
    if not site:
        logger.error(f"Landing site {site_id} not found")
        raise HTTPException(status_code=404, detail="Landing site not found")
        
    db.delete(site)
    db.commit()
    return {"message": "Landing site deleted successfully"}

@router.get("/config/{slug}", response_model=dict)
def get_landing_site_config(
    *,
    db: Session = Depends(get_db),
    slug: str,
) -> Any:
    """
    Get site configuration for a cloned landing site by slug.
    This endpoint is used by the frontend to load the correct configuration for each cloned site.
    """
    site = db.query(LandingSite).filter(LandingSite.slug == slug).first()
    if not site:
        logger.error(f"Landing site with slug {slug} not found")
        raise HTTPException(status_code=404, detail="Landing site not found")
    
    # Return the site_config if it exists, otherwise return default construction template
    if site.site_config:
        return site.site_config
    else:
        # Fallback to default construction template if site_config is not set
        return TEMPLATE_CONFIGS.get(site.template_name, TEMPLATE_CONFIGS["construccion"])

# --- Dependencia Landing Client ---
oauth2_scheme_landing = OAuth2PasswordBearer(tokenUrl="/api/v1/arko/landing_sites/auth/login")

def get_current_landing_client(
    token: str = Depends(oauth2_scheme_landing),
    db: Session = Depends(get_db)
):
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        email: str = payload.get("sub")
        token_type: str = payload.get("type")
        slug: str = payload.get("slug")
        if email is None or token_type != "landing_client" or slug is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Could not validate credentials")
    
    user = db.query(LandingSite).filter(LandingSite.email == email, LandingSite.slug == slug).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    if user.status != LandingSiteStatus.ACTIVE:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Inactive user")
    return user

# --- Endpoints Privados para Clientes de Sitios Clonados ---

@router.get("/me/config")
def get_my_config(current_user: LandingSite = Depends(get_current_landing_client)) -> Any:
    """Get the current landing site's configuration"""
    if current_user.site_config:
        # Include slug in the response
        config_with_slug = dict(current_user.site_config)
        config_with_slug["slug"] = current_user.slug
        return config_with_slug
    
    default_config = TEMPLATE_CONFIGS.get(current_user.template_name, TEMPLATE_CONFIGS["construccion"]).copy()
    default_config["slug"] = current_user.slug
    return default_config

@router.put("/me/config")
def update_my_config(config_in: dict, db: Session = Depends(get_db), current_user: LandingSite = Depends(get_current_landing_client)) -> Any:
    """Update the current landing site's configuration"""
    current_user.site_config = config_in
    db.commit()
    db.refresh(current_user)
    
    config_with_slug = dict(current_user.site_config)
    config_with_slug["slug"] = current_user.slug
    return config_with_slug

# --- Blog Endpoints para Clientes de Sitios Clonados ---
from typing import Optional

class LandingSitePostCreate(BaseModel):
    title: str
    slug: str
    excerpt: Optional[str] = None
    content: Optional[str] = None
    image_url: Optional[str] = None
    category: Optional[str] = None
    status: str = "draft"

class LandingSitePostResponse(BaseModel):
    id: int
    landing_site_id: int
    title: str
    slug: str
    excerpt: Optional[str] = None
    content: Optional[str] = None
    image_url: Optional[str] = None
    category: Optional[str] = None
    author: Optional[str] = None
    status: str
    class Config:
        from_attributes = True

@router.get("/me/posts", response_model=List[LandingSitePostResponse])
def get_my_posts(
    skip: int = 0, limit: int = 100,
    db: Session = Depends(get_db),
    current_user: LandingSite = Depends(get_current_landing_client)
) -> Any:
    posts = db.query(LandingSitePost).filter(LandingSitePost.landing_site_id == current_user.id).order_by(LandingSitePost.created_at.desc()).offset(skip).limit(limit).all()
    return posts

@router.post("/me/posts", response_model=LandingSitePostResponse)
def create_my_post(
    post_in: LandingSitePostCreate,
    db: Session = Depends(get_db),
    current_user: LandingSite = Depends(get_current_landing_client)
) -> Any:
    existing = db.query(LandingSitePost).filter(LandingSitePost.landing_site_id == current_user.id, LandingSitePost.slug == post_in.slug).first()
    if existing:
        raise HTTPException(status_code=400, detail="Slug already exists")
    
    post = LandingSitePost(
        **post_in.dict(),
        landing_site_id=current_user.id,
        author=current_user.nombre_cliente
    )
    db.add(post)
    db.commit()
    db.refresh(post)
    return post

@router.put("/me/posts/{post_id}", response_model=LandingSitePostResponse)
def update_my_post(
    post_id: int,
    post_in: LandingSitePostCreate,
    db: Session = Depends(get_db),
    current_user: LandingSite = Depends(get_current_landing_client)
) -> Any:
    post = db.query(LandingSitePost).filter(LandingSitePost.id == post_id, LandingSitePost.landing_site_id == current_user.id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    for key, value in post_in.dict().items():
        setattr(post, key, value)
    
    db.commit()
    db.refresh(post)
    return post

@router.delete("/me/posts/{post_id}")
def delete_my_post(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: LandingSite = Depends(get_current_landing_client)
) -> Any:
    post = db.query(LandingSitePost).filter(LandingSitePost.id == post_id, LandingSitePost.landing_site_id == current_user.id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    db.delete(post)
    db.commit()
    return {"ok": True}

from fastapi import File, UploadFile
from pathlib import Path
import shutil
from datetime import datetime

UPLOAD_DIR = Path(settings.UPLOAD_DIR).resolve()
LANDING_DIR = UPLOAD_DIR / "landings"
LANDING_DIR.mkdir(parents=True, exist_ok=True)

@router.post("/me/upload", status_code=status.HTTP_200_OK)
async def upload_my_image(
    file: UploadFile = File(...),
    current_user: LandingSite = Depends(get_current_landing_client)
) -> Any:
    try:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        file_extension = Path(file.filename).suffix
        filename = f"landing_{current_user.id}_{timestamp}{file_extension}"
        
        # Guardar en una carpeta específica para cada landing site
        site_dir = LANDING_DIR / str(current_user.id)
        site_dir.mkdir(parents=True, exist_ok=True)
        file_path = site_dir / filename
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # Get relative path for URL
        relative_path = file_path.relative_to(UPLOAD_DIR)
        url_path = f"/uploads/{relative_path.as_posix()}"
        
        return {"message": "Image uploaded successfully", "image_url": url_path}
    except Exception as e:
        logger.error(f"Error uploading landing image: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error uploading image")
