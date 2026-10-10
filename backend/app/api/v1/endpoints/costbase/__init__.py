from fastapi import APIRouter

from app.api.v1.endpoints.costbase.common import (
    set_schema_for_db,
    clean_cell_str,
    normalize_text_alphanumeric,
    is_covenin_coded_item,
    get_db_factors,
    get_active_typesafe_key,
    RESOURCE_CONFIG
)
from app.api.v1.endpoints.costbase import items
from app.api.v1.endpoints.costbase import resources
from app.api.v1.endpoints.costbase import bulk_operations
from app.api.v1.endpoints.costbase import ai_generation
from app.api.v1.endpoints.costbase import custom_apus
from app.api.v1.endpoints.costbase import export
from app.api.v1.endpoints.costbase import typesafe_admin

router = APIRouter()

# Incluir todos los sub-routers en el router principal de costbase
router.include_router(items.router)
router.include_router(resources.router)
router.include_router(bulk_operations.router)
router.include_router(ai_generation.router)
router.include_router(custom_apus.router)
router.include_router(export.router)
router.include_router(typesafe_admin.router)

__all__ = [
    "router",
    "set_schema_for_db",
    "clean_cell_str",
    "normalize_text_alphanumeric",
    "is_covenin_coded_item",
    "get_db_factors",
    "get_active_typesafe_key",
    "RESOURCE_CONFIG",
    "items",
    "resources",
    "bulk_operations",
    "ai_generation",
    "custom_apus",
    "export",
    "typesafe_admin",
]
