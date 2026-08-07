"""
Main API router that aggregates all v1 endpoints for APUpro.
"""
from fastapi import APIRouter

from app.api.v1.endpoints import budgets
from app.api.v1.endpoints import materials
from app.api.v1.endpoints import cost360
from app.api.v1.endpoints import search_v6
from app.api.v1.endpoints import uploads
from app.api.v1.endpoints import arko

api_router = APIRouter()

# APUpro Endpoints
api_router.include_router(arko.router, prefix="/arko", tags=["arko360"])
api_router.include_router(cost360.router, prefix="/cost360", tags=["cost360"])
api_router.include_router(search_v6.router, prefix="/cost360/v6", tags=["cost360_v6"])
api_router.include_router(budgets.router, prefix="/budgets", tags=["budgets"])
api_router.include_router(materials.router, prefix="/materials", tags=["materials"])
api_router.include_router(uploads.router, prefix="/uploads", tags=["uploads"])
