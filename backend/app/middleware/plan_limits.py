from typing import Any
from fastapi import HTTPException
from app.core.config import settings
from app.core.logging import logger
from app.db.models.budget import Budget, BudgetItem
from app.db.arko_base import ArkoSessionLocal

def check_budget_limit(current_user: Any) -> None:
    """Verifica autenticación antes de crear presupuestos (sin límite para uso gratuito)."""
    if current_user is None:
        raise HTTPException(status_code=401, detail="Usuario no autenticado")
    return


def check_items_limit(current_user: Any, budget_id: str) -> None:
    """Verifica autenticación antes de agregar partidas (sin límite para uso gratuito)."""
    _ = budget_id
    if current_user is None:
        raise HTTPException(status_code=401, detail="Usuario no autenticado")
    return

FREE_AI_APU_LIMIT = 3


def check_ai_access(current_user: Any) -> None:
    """Verifica si el usuario tiene acceso a IA (3 APUs gratis en plan Free, luego requiere Plan IA)."""
    if current_user is None:
        raise HTTPException(status_code=401, detail="Usuario no autenticado")

    is_super = (
        getattr(current_user, 'email', '') in ["admin@arko360.net", settings.ADMIN_EMAIL or ""]
        or bool(getattr(current_user, 'site_config', None) and current_user.site_config.get("is_superadmin"))
        or getattr(current_user, 'plan', '') in ["enterprise", "admin", "unlimited"]
    )
    if is_super:
        return

    generated = getattr(current_user, 'ai_apus_generated', 0) or 0
    has_ai = bool(getattr(current_user, 'has_ai_access', False))

    if not has_ai:
        free_limit = getattr(current_user, 'max_ai_apus', 0) or FREE_AI_APU_LIMIT
        if generated >= free_limit:
            raise HTTPException(
                status_code=403,
                detail=f"Has alcanzado el límite de {free_limit} APUs gratuitos con Inteligencia Artificial. Activa el Plan IA para continuar."
            )
        return

    max_ai = getattr(current_user, 'max_ai_apus', 0) or 0
    if max_ai > 0 and generated >= max_ai:
        raise HTTPException(
            status_code=403,
            detail=f"Has alcanzado el límite de {max_ai} APUs generados con IA de tu Plan IA este mes. Actualiza tu plan para continuar."
        )