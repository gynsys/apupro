"""
Main API router that aggregates all v1 endpoints for APUpro.
"""
from fastapi import APIRouter

from app.api.v1.endpoints import budgets
from app.api.v1.endpoints import materials
from app.api.v1.endpoints import costbase
from app.api.v1.endpoints import costbase_databases
from app.api.v1.endpoints import search_v6
from app.api.v1.endpoints import uploads
from app.api.v1.endpoints import arko
from app.api.v1.endpoints import market
from app.api.v1.endpoints import llm
from app.api.v1.endpoints import pdf_updater
from app.api.v1.endpoints import notifications
from app.api.v1.endpoints import payments
from app.api.v1.endpoints.dedup import router_dedup
from app.api.v1.endpoints import users as users_module
api_router = APIRouter()

# Arko Core Endpoints
api_router.include_router(arko.router, prefix="/arko", tags=["arko360"])

# Primary CostBase Endpoints
api_router.include_router(costbase.router, prefix="/costbase", tags=["costbase"])
api_router.include_router(costbase_databases.router, prefix="/costbase/databases", tags=["costbase_databases"])
api_router.include_router(search_v6.router, prefix="/costbase/v6", tags=["costbase_v6"])

# Backward-Compatible Cost360 Aliases
api_router.include_router(costbase.router, prefix="/cost360", tags=["cost360"])
api_router.include_router(costbase_databases.router, prefix="/cost360/databases", tags=["cost360_databases"])
api_router.include_router(search_v6.router, prefix="/cost360/v6", tags=["cost360_v6"])
api_router.include_router(budgets.router, prefix="/budgets", tags=["budgets"])
api_router.include_router(materials.router, prefix="/materials", tags=["materials"])
api_router.include_router(uploads.router, prefix="/uploads", tags=["uploads"])
api_router.include_router(market.router, prefix="/market", tags=["market"])
api_router.include_router(llm.router, prefix="/llm", tags=["llm"])
api_router.include_router(pdf_updater.router, prefix="/pdf-updater", tags=["pdf_updater"])
api_router.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
api_router.include_router(payments.router, prefix="/payments", tags=["payments"])
api_router.include_router(router_dedup, prefix="/dedup", tags=["dedup"])
api_router.include_router(users_module.router, prefix="/users", tags=["users"])
