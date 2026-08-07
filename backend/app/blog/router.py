from typing import List, Annotated, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request, File, UploadFile, Form, BackgroundTasks
from sqlalchemy.orm import Session

from app.db.base import get_db
from app.db.models.arko import ArkoAdmin
from app.blog import crud, schemas
from app.blog.models import BlogPost
from app.api.v1.endpoints.arko import get_current_arko_admin as get_current_user
from app.services import ai_service

import os
import uuid
import shutil
from fastapi.responses import FileResponse
from pathlib import Path

router = APIRouter()

TEMP_DOWNLOAD_DIR = Path("/tmp/gynsys_downloads")
TEMP_DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)

@router.post("/download-proxy")
async def upload_for_download(
    file: UploadFile = File(...),
    current_user: ArkoAdmin = Depends(get_current_user)
):
    """
    Recibe un archivo generado en el cliente y lo guarda temporalmente 
    para permitir una descarga confiable en móviles vía GET.
    """
    file_id = str(uuid.uuid4())
    extension = "mp4" if "video" in file.content_type else "zip"
    file_path = TEMP_DOWNLOAD_DIR / f"{file_id}.{extension}"
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    return {"file_id": file_id, "extension": extension}

@router.get("/download/{file_id}")
async def download_proxied_file(file_id: str, ext: str = "mp4"):
    """
    Sirve un archivo guardado temporalmente con headers de descarga forzada.
    """
    file_path = TEMP_DOWNLOAD_DIR / f"{file_id}.{ext}"
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Archivo expirado o no encontrado")
        
    filename = f"gynsys_export_{file_id[:8]}.{ext}"
    return FileResponse(
        path=file_path,
        filename=filename,
        media_type="application/octet-stream"
    )

@router.post("/generate", response_model=schemas.AIGenerationResponse)
async def generate_blog_ai(
    topic: Optional[str] = Form(None),
    tone: str = Form("Profesional"),
    target_audience: str = Form("Pacientes generales"),
    max_words: int = Form(500),
    pdf_file: Optional[UploadFile] = File(None),
    current_user: ArkoAdmin = Depends(get_current_user)
):
    """
    Genera contenido para el blog usando IA. Solo accesible para ArkoAdmines.
    Soporta opcionalmente un archivo PDF adjunto.
    """
    extracted_text = None
    if pdf_file:
        if not pdf_file.content_type == "application/pdf":
            raise HTTPException(status_code=400, detail="El archivo debe ser un PDF")
        
        try:
            import fitz
            content = await pdf_file.read()
            with fitz.open(stream=content, filetype="pdf") as doc:
                extracted_text = ""
                for i in range(min(5, len(doc))): # Leer hasta 5 páginas
                    extracted_text += doc[i].get_text()
                extracted_text = extracted_text[:8000] # Limitar a 8k caracteres
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Error procesando PDF subido: {e}")
            # No fallar aquí, intentar seguir sin el texto si es posible o avisar
            extracted_text = f"[Error leyendo PDF adjunto: {str(e)}]"

    try:
        from app.services import ai_service
        result = ai_service.generate_blog_content(
            topic=topic,
            tone=tone,
            target_audience=target_audience,
            max_words=max_words,
            source_text=extracted_text # Pasar el texto extraído directamente
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error en generación de IA: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error interno al generar contenido con IA.")

@router.post("/{post_id}/generate-social", response_model=schemas.SocialContentResponse)
def generate_social_ai(
    post_id: int,
    gen_type: str, # 'reel' or 'carousel'
    request_data: Optional[schemas.GenerateSocialRequest] = None,
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_user)
):
    """
    Generates social media content (Reel/Carousel) for a specific blog post.
    """
    post = db.query(BlogPost).filter(BlogPost.id == post_id, BlogPost.admin_id == current_user.id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post no encontrado")
        
    instructions = request_data.instructions if request_data else None
    existing_content = request_data.existing_content if request_data else None
        
    # Check pregenerated content (only if no custom instructions are requested)
    if not instructions:
        if gen_type in ['video', 'reel'] and post.pregenerated_reel:
            import logging
            logging.getLogger(__name__).info(f"Serving pregenerated Reel for post {post_id}")
            data = dict(post.pregenerated_reel)
            data['type'] = gen_type
            return schemas.SocialContentResponse(**data)
        elif gen_type == 'carousel' and post.pregenerated_carousel:
            import logging
            logging.getLogger(__name__).info(f"Serving pregenerated Carousel for post {post_id}")
            data = dict(post.pregenerated_carousel)
            data['type'] = gen_type
            return schemas.SocialContentResponse(**data)
        
    try:
        from app.services import social_service
        result = social_service.generate_social_content(
            post_title=post.title,
            post_content=post.content,
            generation_type=gen_type,
            special_instructions=instructions,
            existing_content=existing_content
        )
        
        # Inject the type for schema validation
        if isinstance(result, dict):
            result['type'] = gen_type
            
        return schemas.SocialContentResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        error_msg = str(e)
        logger.error(f"Error en generación social: {error_msg}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error en la generación social: {error_msg}"
        )

@router.post("/{post_id}/sync-social")
def sync_social_content(
    post_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_user)
) -> Any:
    """
    Manually triggers regeneration of pregenerated Reel and Carousel content.
    """
    post = db.query(BlogPost).filter(BlogPost.id == post_id, BlogPost.admin_id == current_user.id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post no encontrado")
        
    # Clear existing pregenerations
    post.pregenerated_reel = None
    post.pregenerated_carousel = None
    db.add(post)
    db.commit()
    
    from app.services import social_service
    background_tasks.add_task(social_service.pregenerate_social_content_async, post.id)
    return {"status": "success", "message": "Pregeneración social encolada con éxito"}

@router.post("/generate-social-from-content", response_model=schemas.SocialContentResponse)
def generate_social_from_content_ai(
    request_data: schemas.SocialContentFromContentRequest,
    current_user: ArkoAdmin = Depends(get_current_user)
):
    """
    Generates social media content (Video/Carousel) from arbitrary text content.
    Useful for converting saved carousels to videos.
    """
    try:
        from app.services import social_service
        result = social_service.generate_social_content(
            post_title=request_data.title,
            post_content=request_data.content,
            generation_type=request_data.gen_type,
            special_instructions=request_data.instructions,
            existing_content=request_data.existing_content
        )
        
        if isinstance(result, dict):
            result['type'] = request_data.gen_type
            
        return schemas.SocialContentResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error en generación social desde contenido: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error interno al generar contenido social.")

@router.get("/menu/mega/{ArkoAdmin_slug}", response_model=List[schemas.BlogPostResponse])
def get_mega_menu(
    ArkoAdmin_slug: str,
    db: Session = Depends(get_db)
):
    """
    Get lightweight menu items for the mega menu.
    """
    menu_items = db.query(BlogPost).filter(
        BlogPost.is_published == True,
        BlogPost.is_in_menu == True
    ).order_by(BlogPost.menu_weight.desc()).all()
    
    for item in menu_items:
        item.is_service_content = False
        
    return menu_items

@router.get("/public/{ArkoAdmin_slug}", response_model=List[schemas.BlogPostListResponse])
def get_public_posts(
    ArkoAdmin_slug: str,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """
    Get published blog posts for a specific ArkoAdmin (public).
    """
    # Arko360 is single-tenant, fetch all published posts
    posts = db.query(BlogPost).filter(
        BlogPost.is_published == True
    ).order_by(BlogPost.created_at.desc()).offset(skip).limit(limit).all()
    
    # Arko360 doesn't have a specific Service model right now, so we just return the posts
    for post in posts:
        post.is_service_content = False
            
    return posts

@router.get("/public/post/{slug}", response_model=schemas.BlogPostResponse)
def read_post_public(
    slug: str,
    db: Session = Depends(get_db)
):
    """
    Get a specific blog post by slug (public).
    """
    post = crud.get_post_by_slug(db, slug=slug)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if not post.is_published:
        raise HTTPException(status_code=404, detail="Post not found")
        
    # Check if this post is content for a service
    service_link = None
    if service_link:
        post.is_service_content = True
    else:
        post.is_service_content = False
        
    return post

@router.get("/my-posts", response_model=List[schemas.BlogPostResponse])
def read_my_posts(
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_user)
):
    """
    Get all blog posts for the current ArkoAdmin (CMS).
    """
    posts = crud.get_posts_by_ArkoAdmin(db, admin_id=current_user.id, skip=skip, limit=limit)
    return posts

# Social Carousel Endpoints
@router.post("/carousels", response_model=schemas.SocialCarouselResponse)
def create_social_carousel(
    carousel: schemas.SocialCarouselCreate,
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_user)
):
    """Save a new carousel project to the database."""
    return crud.create_carousel(db=db, carousel=carousel, admin_id=current_user.id)

@router.get("/carousels", response_model=List[schemas.SocialCarouselListResponse])
def get_my_carousels(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_user)
):
    """List all carousel projects for the current ArkoAdmin."""
    return crud.get_carousels_by_ArkoAdmin(db=db, admin_id=current_user.id, skip=skip, limit=limit)

@router.get("/carousels/{carousel_id}", response_model=schemas.SocialCarouselResponse)
def get_my_carousel(
    carousel_id: int,
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_user)
):
    """Get a specific carousel project with full content."""
    carousel = crud.get_carousel(db=db, carousel_id=carousel_id)
    if not carousel or carousel.admin_id != current_user.id:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")
    return carousel

@router.get("/social-audios", response_model=List[schemas.SocialAudioResponse])
def get_my_social_audios(
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_user)
):
    """List all uploaded social audios for the current ArkoAdmin."""
    return crud.get_social_audios_by_ArkoAdmin(db=db, admin_id=current_user.id)

@router.delete("/social-audios/{audio_id}", response_model=schemas.SocialAudioResponse)
def delete_social_audio(
    audio_id: int,
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_user)
):
    """Delete an uploaded social audio."""
    result = crud.delete_social_audio(db=db, audio_id=audio_id, admin_id=current_user.id)
    if not result:
        raise HTTPException(status_code=404, detail="Audio not found")
    return result

@router.put("/carousels/{carousel_id}", response_model=schemas.SocialCarouselResponse)
def update_social_carousel(
    carousel_id: int,
    carousel: schemas.SocialCarouselCreate,
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_user)
):
    """Update an existing carousel project."""
    result = crud.update_carousel(db=db, carousel_id=carousel_id, carousel=carousel, admin_id=current_user.id)
    if not result:
        raise HTTPException(status_code=404, detail="Carousel not found")
    return result

@router.delete("/carousels/{carousel_id}", response_model=schemas.SocialCarouselResponse)
def delete_social_carousel(
    carousel_id: int,
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_user)
):
    """Delete a carousel project."""
    import logging
    logger = logging.getLogger(__name__)
    try:
        logger.info(f"Attempting to delete carousel {carousel_id} for ArkoAdmin {current_user.id}")
        result = crud.delete_carousel(db=db, carousel_id=carousel_id, admin_id=current_user.id)
        if not result:
            logger.warning(f"Carousel {carousel_id} not found for ArkoAdmin {current_user.id}")
            raise HTTPException(status_code=404, detail="Carousel not found")
        logger.info(f"Carousel {carousel_id} deleted successfully")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting carousel {carousel_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/", response_model=schemas.BlogPostResponse)
def create_post(
    post: schemas.BlogPostCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_user)
):
    """
    Create a new blog post.
    """
    db_post = crud.create_post(db=db, post=post, admin_id=current_user.id)
    
    # Trigger background social content pregeneration
    from app.services import social_service
    background_tasks.add_task(social_service.pregenerate_social_content_async, db_post.id)
    
    return db_post

@router.get("/{post_id}", response_model=schemas.BlogPostResponse)
def read_post(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_user)
):
    """
    Get a specific blog post by ID (CMS).
    """
    post = crud.get_post(db, post_id=post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if post.admin_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to view this post")
    return post

@router.put("/{post_id}", response_model=schemas.BlogPostResponse)
def update_post(
    post_id: int,
    post: schemas.BlogPostUpdate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_user)
):
    """
    Update a blog post.
    """
    db_post = crud.get_post(db, post_id=post_id)
    if not db_post:
        raise HTTPException(status_code=404, detail="Post not found")
    if db_post.admin_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to edit this post")
    
    updated_post = crud.update_post(db=db, post_id=post_id, post=post)
    
    # Trigger background social content pregeneration on update
    from app.services import social_service
    background_tasks.add_task(social_service.pregenerate_social_content_async, updated_post.id)
    
    return updated_post

@router.get("/comments/{post_slug}", response_model=List[schemas.CommentResponse])
def read_comments(
    post_slug: str,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """
    Get comments for a specific blog post (public).
    """
    post = crud.get_post_by_slug(db, slug=post_slug)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    comments = crud.get_comments_by_post(db, post_id=post.id, skip=skip, limit=limit)
    return comments

@router.post("/comments/{post_slug}", response_model=schemas.CommentResponse)
def create_comment(
    post_slug: str,
    comment: schemas.CommentCreate,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Create a new comment for a blog post (public).
    """
    post = crud.get_post_by_slug(db, slug=post_slug)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Rate limiting
    client_ip = request.client.host
    if crud.check_rate_limit(db, ip_address=client_ip, post_id=post.id):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Estás comentando muy rápido. Por favor espera unos minutos."
        )
        
    return crud.create_comment(db=db, comment=comment, post_id=post.id, ip_address=client_ip)

@router.delete("/{post_id}", response_model=schemas.BlogPostResponse)
def delete_post(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_user)
):
    """
    Delete a blog post.
    """
    db_post = crud.get_post(db, post_id=post_id)
    if not db_post:
        raise HTTPException(status_code=404, detail="Post not found")
    if db_post.admin_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this post")
    
    return crud.delete_post(db=db, post_id=post_id)





