from typing import Optional, List, Any
from datetime import datetime
from pydantic import BaseModel

class BlogPostBase(BaseModel):
    title: str
    content: str
    summary: Optional[str] = None
    cover_image: Optional[str] = None
    is_published: bool = False
    published_at: Optional[datetime] = None
    
    # Mega Menu Fields
    is_in_menu: Optional[bool] = False
    menu_weight: Optional[int] = 0
    menu_icon: Optional[str] = None

class BlogPostCreate(BlogPostBase):
    seo_config: Optional['BlogPostSEOCreate'] = None

class BlogPostUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    summary: Optional[str] = None
    cover_image: Optional[str] = None
    is_published: Optional[bool] = None
    published_at: Optional[datetime] = None
    
    # Mega Menu Fields
    is_in_menu: Optional[bool] = None
    menu_weight: Optional[int] = None
    menu_icon: Optional[str] = None
    
    seo_config: Optional['BlogPostSEOUpdate'] = None
    
    pregenerated_reel: Optional[Any] = None
    pregenerated_carousel: Optional[Any] = None


class BlogPostListResponse(BaseModel):
    id: int
    title: str
    slug: str
    summary: Optional[str] = None
    cover_image: Optional[str] = None
    is_published: bool = False
    published_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    admin_id: int
    is_service_content: bool = False

    class Config:
        from_attributes = True

class BlogPostResponse(BlogPostBase):
    id: int
    slug: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    admin_id: int
    is_service_content: bool = False
    
    pregenerated_reel: Optional[Any] = None
    pregenerated_carousel: Optional[Any] = None
    
    seo_config: Optional['BlogPostSEOResponse'] = None

    class Config:
        from_attributes = True

# Forward references updates


class MegaMenuItem(BaseModel):
    title: str
    slug: str
    menu_weight: int
    menu_icon: Optional[str] = None
    
    class Config:
        from_attributes = True

class CommentBase(BaseModel):
    author_name: str
    content: str

class CommentCreate(CommentBase):
    pass

class CommentResponse(CommentBase):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True


# SEO Schemas
class BlogPostSEOBase(BaseModel):
    meta_title: Optional[str] = None
    meta_description: Optional[str] = None
    focus_keyword: Optional[str] = None
    canonical_url: Optional[str] = None
    schema_type: Optional[str] = "Article"
    robots_index: Optional[bool] = True
    robots_follow: Optional[bool] = True
    social_title: Optional[str] = None
    social_description: Optional[str] = None
    social_image: Optional[str] = None
    seo_score: Optional[int] = 0

class BlogPostSEOCreate(BlogPostSEOBase):
    pass

class BlogPostSEOUpdate(BlogPostSEOBase):
    pass

class BlogPostSEOResponse(BlogPostSEOBase):
    id: int
    post_id: int
    last_validation: Optional[datetime] = None
    
    class Config:
        from_attributes = True

# AI Generation Schemas
class AIGenerationRequest(BaseModel):
    topic: Optional[str] = None
    tone: str
    target_audience: str
    max_words: int = 500

class AIGenerationResponse(BaseModel):
    title: str
    summary: str
    generated_content: str

class GenerateSocialRequest(BaseModel):
    instructions: Optional[str] = None
    existing_content: Optional[dict] = None

class SocialContentFromContentRequest(BaseModel):
    title: str
    content: str
    gen_type: str # 'video' or 'carousel'
    instructions: Optional[str] = None
    existing_content: Optional[dict] = None

class SocialContentScene(BaseModel):
    time: str
    text: str
    audio: str

class SocialContentSlide(BaseModel):
    title: str
    content: str

class SocialContentStructure(BaseModel):
    problem: str
    solution: str
    visual_guide: str

class VideoSlide(BaseModel):
    text: str

class SocialContentResponse(BaseModel):
    type: str # 'video', 'carousel'
    hook: Optional[str] = None
    hooks: Optional[List[str]] = None 
    scenes: Optional[List[SocialContentScene]] = None
    structure: Optional[SocialContentStructure] = None 
    caption: Optional[str] = None 
    cta: Optional[str] = None
    slides: Optional[List[SocialContentSlide]] = None
    video_slides: Optional[List[VideoSlide]] = None # New: for Reel Video
    music_suggestion: Optional[str] = None # New: for music player
    duration_per_slide: Optional[int] = 3
    total_duration: Optional[int] = 20
    image_prompts: Optional[List[str]] = None

# Social Carousel Schemas
class SocialCarouselBase(BaseModel):

    name: str
    content: Any
    design: Any
    global_settings: Any
    elements: Any

class SocialCarouselCreate(SocialCarouselBase):
    pass

class SocialCarouselResponse(SocialCarouselBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    admin_id: int

    class Config:
        from_attributes = True

class SocialCarouselListResponse(BaseModel):
    id: int
    name: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    admin_id: int

    class Config:
        from_attributes = True

# Social Audio Schemas
class SocialAudioBase(BaseModel):
    name: str
    url: str

class SocialAudioCreate(SocialAudioBase):
    pass

class SocialAudioResponse(SocialAudioBase):
    id: int
    created_at: datetime
    admin_id: int

    class Config:
        from_attributes = True

# Validating models after all definitions are complete
BlogPostCreate.model_rebuild()
BlogPostUpdate.model_rebuild()
BlogPostResponse.model_rebuild()
