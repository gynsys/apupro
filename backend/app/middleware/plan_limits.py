from typing import Any
from fastapi import HTTPException
from app.core.config import settings
from app.core.logging import logger
from app.db.models.budget import Budget, BudgetItem
from app.db.arko_base import ArkoSessionLocal

def check_budget_limit(current_user: Any) -> None:
    """Verifica si el usuario puede crear más presupuestos"""
    if current_user is None:
        raise HTTPException(status_code=401, detail="Usuario no autenticado")

    if current_user.max_budgets is None:
        return  # Sin límite para admins con planes superiores

    with ArkoSessionLocal() as db:
        budget_count = db.query(Budget).filter(Budget.user_id == str(current_user.id)).count()
        if budget_count >= current_user.max_budgets:
            raise HTTPException(
                status_code=403,
                detail=f"Límite de presupuestos alcanzado. Tu plan permite máximo {current_user.max_budgets} presupuestos."
            )

def check_items_limit(current_user: Any, budget_id: str) -> None:
    """Verifica si el usuario puede agregar más partidas a un presupuesto"""
    if current_user is None:
        raise HTTPException(status_code=401, detail="Usuario no autenticado")

    if current_user.max_items_per_budget is None:
        return  # Sin límite para admins con planes superiores

    with ArkoSessionLocal() as db:
        items_count = db.query(BudgetItem).filter(BudgetItem.budget_id == budget_id).count()
        if items_count >= current_user.max_items_per_budget:
            raise HTTPException(
                status_code=403,
                detail=f"Límite de partidas alcanzado. Tu plan permite máximo {current_user.max_items_per_budget} partidas por presupuesto."
            )

def check_ai_access(current_user: Any) -> None:
    """Verifica si el usuario tiene acceso a IA"""
    if current_user is None:
        raise HTTPException(status_code=401, detail="Usuario no autenticado")

    is_super = (
        getattr(current_user, 'email', '') in ["admin@arko360.net", settings.ADMIN_EMAIL or ""]
        or bool(getattr(current_user, 'site_config', None) and current_user.site_config.get("is_superadmin"))
        or getattr(current_user, 'plan', '') in ["enterprise", "admin", "unlimited"]
    )
    if is_super:
        return

    if not getattr(current_user, 'has_ai_access', False):
        raise HTTPException(
            status_code=403,
            detail="No tienes una suscripción activa o permiso para utilizar el Generador de APU asistido por IA. Actualiza tu plan para desbloquear esta función premium."
        )
    
    if current_user.plan != "free" and getattr(current_user, 'max_ai_apus', 0) > 0:
        if getattr(current_user, 'ai_apus_generated', 0) >= current_user.max_ai_apus:
            raise HTTPException(
                status_code=403,
                detail=f"Has alcanzado el límite de {current_user.max_ai_apus} APUs generados con IA para tu plan este mes. Actualiza tu plan para continuar."
            )