"""
Budgets package aggregator.
Exposes a unified APIRouter containing core CRUD, items, APU components,
sync, export, backup, and sharing routes.
"""
from fastapi import APIRouter

from .apu_components import router as apu_components_router
from .backup import router as backup_router
from .core import router as core_router
from .export import router as export_router
from .helpers import ensure_budget_share_columns, log_backup_action
from .items import router as items_router
from .share import router as share_router
from .sync import router as sync_router

router = APIRouter()

# Incluir subrouters en orden de especificidad de ruta
router.include_router(share_router)
router.include_router(backup_router)
router.include_router(export_router)
router.include_router(sync_router)
router.include_router(apu_components_router)
router.include_router(items_router)
router.include_router(core_router)

__all__ = [
    "router",
    "ensure_budget_share_columns",
    "log_backup_action",
]
