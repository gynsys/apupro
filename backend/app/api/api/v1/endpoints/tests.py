from fastapi import APIRouter, Request, Depends
from app.core.config import settings
from typing import List, Union

router = APIRouter()

@router.get("/cors-check")
async def check_cors_config(request: Request):
    origin_header = request.headers.get("origin")
    referer_header = request.headers.get("referer")
    
    # Origins as they are in memory
    memory_origins = settings.CORS_ORIGINS
    
    # Origins as calculated for the middleware
    calculated_origins = [str(origin).rstrip("/") for origin in (memory_origins if isinstance(memory_origins, list) else [memory_origins])]
    
    return {
        "origin_header": origin_header,
        "referer_header": referer_header,
        "memory_origins": memory_origins,
        "calculated_origins": calculated_origins,
        "is_origin_allowed": origin_header in calculated_origins if origin_header else None,
        "app_debug": settings.DEBUG,
        "version": "cors_debug_v1"
    }
