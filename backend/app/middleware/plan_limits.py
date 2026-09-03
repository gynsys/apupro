from fastapi import HTTPException, Depends
from sqlalchemy.orm import Session
from app.db.base import get_db
from app.db.models.arko import ArkoAdmin
from app.api.v1.endpoints.arko import get_current_arko_admin

def check_budget_limit(current_user):
    """Verifica si el usuario puede crear más presupuestos"""
    if current_user.max_budgets is None:
        return  # Sin límite para admins con planes superiores

    from app.db.models.budget import Budget
    from app.db.arko_base import ArkoSessionLocal

    with ArkoSessionLocal() as db:
        budget_count = db.query(Budget).filter(Budget.user_id == str(current_user.id)).count()
        if budget_count >= current_user.max_budgets:
            raise HTTPException(
                status_code=403,
                detail=f"Límite de presupuestos alcanzado. Tu plan permite máximo {current_user.max_budgets} presupuestos."
            )

def check_items_limit(current_user, budget_id):
    """Verifica si el usuario puede agregar más partidas a un presupuesto"""
    if current_user.max_items_per_budget is None:
        return  # Sin límite para admins con planes superiores

    from app.db.models.budget import BudgetItem
    from app.db.arko_base import ArkoSessionLocal

    with ArkoSessionLocal() as db:
        items_count = db.query(BudgetItem).filter(BudgetItem.budget_id == budget_id).count()
        if items_count >= current_user.max_items_per_budget:
            raise HTTPException(
                status_code=403,
                detail=f"Límite de partidas alcanzado. Tu plan permite máximo {current_user.max_items_per_budget} partidas por presupuesto."
            )

def check_ai_access(current_user):
    """Verifica si el usuario tiene acceso a IA"""
    if not current_user.has_ai_access:
        raise HTTPException(
            status_code=403,
            detail="El acceso al generador APU con IA requiere un plan de pago."
        )
    
    if current_user.plan != "free" and getattr(current_user, 'max_ai_apus', 0) > 0:
        if getattr(current_user, 'ai_apus_generated', 0) >= current_user.max_ai_apus:
            raise HTTPException(
                status_code=403,
                detail=f"Límite de APUs con IA alcanzado. Tu plan permite máximo {current_user.max_ai_apus} APUs por mes."
            )