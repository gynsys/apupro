"""
Main API router that aggregates all v1 endpoints.
"""
from fastapi import APIRouter

from app.blog import router as blog_router
# Arko 360 Endpoints
from app.api.v1.endpoints import arko

api_router = APIRouter()

# Include Arko360 endpoint routers
api_router.include_router(blog_router.router, prefix="/blog", tags=["blog"])
api_router.include_router(arko.router, prefix="/arko", tags=["arko360"])
