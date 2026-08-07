"""
Main API router that aggregates all v1 endpoints for Arko360.
"""
from fastapi import APIRouter

from app.api.v1.endpoints import arko
from app.api.v1.endpoints import arko_landing_sites
from app.api.v1.endpoints import calculadora
from app.api.v1.endpoints import arko_app
from app.api.v1.endpoints import contact
from app.api.v1.endpoints import leads
from app.api.v1.endpoints import uploads
from app.blog.router import router as blog_router
from app.api.v1.endpoints import budgets

api_router = APIRouter()

from app.api.v1.endpoints import solver
from app.api.v1.endpoints import materials
from app.api.v1.endpoints import cost360
from app.api.v1.endpoints import search_v6

# Arko 360 Endpoints
api_router.include_router(cost360.router, prefix="/cost360", tags=["cost360"])
api_router.include_router(search_v6.router, prefix="/cost360/v6", tags=["cost360_v6"])
api_router.include_router(budgets.router, prefix="/budgets", tags=["budgets"])
api_router.include_router(materials.router, prefix="/materials", tags=["materials"])
api_router.include_router(leads.router, prefix="/leads", tags=["leads"])
api_router.include_router(contact.router, prefix="/arko360/contact", tags=["contact"])
api_router.include_router(arko.router, prefix="/arko", tags=["arko360"])
api_router.include_router(
    arko_landing_sites.router, prefix="/arko/landing_sites", tags=["arko_admin_landing_sites"]
)

api_router.include_router(
    calculadora.router, prefix="/calculadora-losas", tags=["calculadora_losas"]
)
api_router.include_router(
    solver.router, prefix="/arko3d", tags=["arko3d_solver"]
)
api_router.include_router(
    arko_app.router, prefix="/arko_app", tags=["arko_app"]
)
api_router.include_router(
    uploads.router, prefix="/uploads", tags=["uploads"]
)
api_router.include_router(
    blog_router, prefix="/blog", tags=["blog"]
)

