import re
from datetime import datetime, timedelta
from sqlalchemy.orm import Session, defer
from app.blog.models import BlogPost, Comment, BlogPostSEO, SocialCarousel
from app.blog.schemas import BlogPostCreate, BlogPostUpdate, CommentCreate, SocialCarouselCreate, SocialAudioCreate

def get_carousel(db: Session, carousel_id: int):
    return db.query(SocialCarousel).filter(SocialCarousel.id == carousel_id).first()

def get_carousels_by_ArkoAdmin(db: Session, admin_id: int, skip: int = 0, limit: int = 100):
    return db.query(SocialCarousel).options(defer(SocialCarousel.content)).filter(SocialCarousel.admin_id == admin_id).order_by(SocialCarousel.created_at.desc()).offset(skip).limit(limit).all()

def create_carousel(db: Session, carousel: SocialCarouselCreate, admin_id: int):
    db_carousel = SocialCarousel(
        **carousel.model_dump(),
        admin_id=admin_id
    )
    db.add(db_carousel)
    db.commit()
    db.refresh(db_carousel)
    return db_carousel

def update_carousel(db: Session, carousel_id: int, carousel: SocialCarouselCreate, admin_id: int):
    db_carousel = db.query(SocialCarousel).filter(SocialCarousel.id == carousel_id, SocialCarousel.admin_id == admin_id).first()
    if not db_carousel:
        return None
    
    update_data = carousel.model_dump()
    for key, value in update_data.items():
        setattr(db_carousel, key, value)
        
    db.add(db_carousel)
    db.commit()
    db.refresh(db_carousel)
    return db_carousel

def delete_carousel(db: Session, carousel_id: int, admin_id: int):
    db_carousel = db.query(SocialCarousel).filter(SocialCarousel.id == carousel_id, SocialCarousel.admin_id == admin_id).first()
    if db_carousel:
        db.delete(db_carousel)
        db.commit()
    return db_carousel

# Social Audio CRUD
def get_social_audios_by_ArkoAdmin(db: Session, admin_id: int):
    from app.blog.models import SocialAudio
    return db.query(SocialAudio).filter(SocialAudio.admin_id == admin_id).order_by(SocialAudio.created_at.desc()).all()

def create_social_audio(db: Session, audio: SocialAudioCreate, admin_id: int):
    from app.blog.models import SocialAudio
    db_audio = SocialAudio(
        **audio.model_dump(),
        admin_id=admin_id
    )
    db.add(db_audio)
    db.commit()
    db.refresh(db_audio)
    return db_audio

def delete_social_audio(db: Session, audio_id: int, admin_id: int):
    from app.blog.models import SocialAudio
    db_audio = db.query(SocialAudio).filter(SocialAudio.id == audio_id, SocialAudio.admin_id == admin_id).first()
    if db_audio:
        db.delete(db_audio)
        db.commit()
    return db_audio

def slugify(text: str) -> str:
    text = text.lower()
    text = re.sub(r'[^a-z0-9\s-]', '', text)
    text = re.sub(r'[\s-]+', '-', text)
    return text.strip('-')

def get_post(db: Session, post_id: int):
    return db.query(BlogPost).filter(BlogPost.id == post_id).first()

def get_post_by_slug(db: Session, slug: str):
    return db.query(BlogPost).filter(BlogPost.slug == slug).first()

def get_posts_by_ArkoAdmin(db: Session, admin_id: int, skip: int = 0, limit: int = 100):
    return db.query(BlogPost).filter(BlogPost.admin_id == admin_id).offset(skip).limit(limit).all()

def get_published_posts_by_ArkoAdmin(db: Session, admin_id: int, skip: int = 0, limit: int = 100):
    return db.query(BlogPost).filter(BlogPost.admin_id == admin_id, BlogPost.is_published == True).order_by(BlogPost.created_at.desc()).offset(skip).limit(limit).all()

def create_post(db: Session, post: BlogPostCreate, admin_id: int):
    slug = slugify(post.title)
    # Ensure unique slug
    counter = 1
    original_slug = slug
    while db.query(BlogPost).filter(BlogPost.slug == slug).first():
        slug = f"{original_slug}-{counter}"
        counter += 1
        
    seo_data = None
    if post.seo_config:
        seo_data = post.seo_config.model_dump()
        # Remove seo_config from post data before creating BlogPost
        post_data = post.model_dump()
        del post_data['seo_config']
    else:
        post_data = post.model_dump()

    db_post = BlogPost(
        **post_data,
        slug=slug,
        admin_id=admin_id
    )
    db.add(db_post)
    db.commit()
    db.refresh(db_post)
    
    # Create SEO config if provided
    if seo_data:
        db_seo = BlogPostSEO(
            **seo_data,
            post_id=db_post.id
        )
        db.add(db_seo)
        db.commit()
        db.refresh(db_post) # Refresh parent to load relationship
        
    return db_post

def update_post(db: Session, post_id: int, post: BlogPostUpdate):
    db_post = get_post(db, post_id)
    if not db_post:
        return None
    
    update_data = post.model_dump(exclude_unset=True)
    
    # Handle SEO config separately
    if 'seo_config' in update_data:
        seo_data = update_data.pop('seo_config')
        if seo_data:
            if db_post.seo_config:
                # Update existing SEO config
                for key, value in seo_data.items():
                    setattr(db_post.seo_config, key, value)
                db_post.seo_config.last_validation = datetime.utcnow()
            else:
                # Create new SEO config
                db_seo = BlogPostSEO(**seo_data, post_id=db_post.id, last_validation=datetime.utcnow())
                db.add(db_seo)
    
    for key, value in update_data.items():
        setattr(db_post, key, value)
        
    db.add(db_post)
    db.commit()
    db.refresh(db_post)
    return db_post

def delete_post(db: Session, post_id: int):
    db_post = get_post(db, post_id)
    if db_post:
        db.delete(db_post)
        db.commit()
    return db_post

def get_comments_by_post(db: Session, post_id: int, skip: int = 0, limit: int = 100):
    return db.query(Comment).filter(Comment.post_id == post_id).order_by(Comment.created_at.desc()).offset(skip).limit(limit).all()

def create_comment(db: Session, comment: CommentCreate, post_id: int, ip_address: str):
    db_comment = Comment(
        **comment.model_dump(),
        post_id=post_id,
        ip_address=ip_address
    )
    db.add(db_comment)
    db.commit()
    db.refresh(db_comment)
    return db_comment

def check_rate_limit(db: Session, ip_address: str, post_id: int):
    # Allow 1 comment per 5 minutes per IP for a specific post
    # Using func.now() for DB time consistency would be better but datetime.utcnow() is okay for simple check
    time_threshold = datetime.utcnow() - timedelta(minutes=5)
    count = db.query(Comment).filter(
        Comment.ip_address == ip_address,
        Comment.post_id == post_id,
        Comment.created_at >= time_threshold
    ).count()
    return count > 0

