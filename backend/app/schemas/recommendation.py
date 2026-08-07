from typing import Optional, List
from pydantic import BaseModel

# --- CATEGORIES ---

class CategoryBase(BaseModel):
    name: str

class CategoryCreate(CategoryBase):
    pass

class Category(CategoryBase):
    id: int
    tenant_id: int

    class Config:
        orm_mode = True

# --- RECOMMENDATIONS (ITEMS) ---

class RecommendationBase(BaseModel):
    title: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    category_id: Optional[int] = None
    action_type: str = "LINK" # LINK, PAYPAL
    action_url: Optional[str] = None
    price: Optional[str] = None
    is_active: bool = True

class RecommendationCreate(RecommendationBase):
    pass

class RecommendationUpdate(RecommendationBase):
    title: Optional[str] = None
    action_type: Optional[str] = None
    is_active: Optional[bool] = None

class Recommendation(RecommendationBase):
    id: int
    tenant_id: int

    class Config:
        orm_mode = True
