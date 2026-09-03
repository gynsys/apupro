from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from app.db.arko_base import ArkoSessionLocal
from app.db.models.arko import ArkoAdmin
from app.api.v1.endpoints.arko import get_current_arko_admin

from app.services.email import send_subscription_request_email, send_payment_instructions_email

router = APIRouter()

class SubscriptionRequest(BaseModel):
    plan_name: str

class UserListResponse(BaseModel):
    id: int
    email: str
    full_name: Optional[str] = None
    is_active: bool
    plan: str
    max_budgets: Optional[int] = None
    max_items_per_budget: Optional[int] = None
    has_ai_access: bool
    created_at: str

class UserUpdateRequest(BaseModel):
    is_active: Optional[bool] = None
    plan: Optional[str] = None
    max_budgets: Optional[int] = None
    max_items_per_budget: Optional[int] = None
    has_ai_access: Optional[bool] = None

@router.get("/", response_model=List[UserListResponse])
def get_users(current_user = Depends(get_current_arko_admin)):
    """Obtener lista de usuarios (solo admin)"""
    with ArkoSessionLocal() as db:
        users = db.query(ArkoAdmin).all()
        return [
            {
                "id": user.id,
                "email": user.email,
                "full_name": user.full_name,
                "is_active": user.is_active,
                "plan": user.plan or 'free',
                "max_budgets": user.max_budgets,
                "max_items_per_budget": user.max_items_per_budget,
                "has_ai_access": user.has_ai_access or False,
                "created_at": user.created_at.isoformat() if user.created_at else None
            }
            for user in users
        ]

@router.put("/{user_id}", response_model=UserListResponse)
def update_user(user_id: int, user_data: UserUpdateRequest, current_user = Depends(get_current_arko_admin)):
    """Actualizar usuario (solo admin)"""
    with ArkoSessionLocal() as db:
        user = db.query(ArkoAdmin).filter(ArkoAdmin.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")

        if user_data.is_active is not None:
            user.is_active = user_data.is_active
        if user_data.plan is not None:
            user.plan = user_data.plan
        if user_data.max_budgets is not None:
            user.max_budgets = user_data.max_budgets  # FIX: era user.max_budgets = user.max_budgets
        if user_data.max_items_per_budget is not None:
            user.max_items_per_budget = user_data.max_items_per_budget  # FIX: idem
        if user_data.has_ai_access is not None:
            user.has_ai_access = user_data.has_ai_access

        db.commit()
        db.refresh(user)

        return {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "is_active": user.is_active,
            "plan": user.plan or 'free',
            "max_budgets": user.max_budgets,
            "max_items_per_budget": user.max_items_per_budget,
            "has_ai_access": user.has_ai_access or False,
            "created_at": user.created_at.isoformat() if user.created_at else None
        }


@router.post("/demo-budget")
def create_demo_budget(current_user = Depends(get_current_arko_admin)):
    """Crear presupuesto de ejemplo con 2 partidas (solo para demo)"""
    from app.db.base import get_db
    from app.db.models.budget import Budget, BudgetItem, BudgetAPUMaterial as DBMaterial, BudgetAPUEquipment as DBEquipment, BudgetAPULabor as DBLabor
    import uuid

    def generate_uuid():
        return str(uuid.uuid4())

    with get_db() as db:
        # Crear presupuesto de ejemplo
        demo_budget = Budget(
            user_id=str(current_user.id),
            name="Presupuesto de Ejemplo",
            description="Presupuesto de ejemplo para demostración del sistema",
            currency="USD",
            exchange_rate=36.5,
            fcas_percent=417.0,
            admin_percent=15.0,
            profit_percent=10.0,
            iva_percent=16.0,
            labor_bonus=0.0,
            material_inflation=0.0,
            labor_inflation=0.0,
            equipment_inflation=0.0,
            project_name="Proyecto Demo"
        )
        db.add(demo_budget)
        db.commit()
        db.refresh(demo_budget)

        # Crear partidas de ejemplo
        # Partida 1: Excavación
        item1 = BudgetItem(
            budget_id=demo_budget.id,
            cod_par="E0101",
            cov_par="E0101",
            description="EXCAVACIÓN MANUAL PARA CIMENTO ARMADO",
            unit="m2",
            quantity=100.0,
            performance=1.0,
            order=1,
            is_chapter=False
        )
        db.add(item1)
        db.commit()
        db.refresh(item1)

        # Agregar materiales a partida 1
        db.add(DBMaterial(
            budget_item_id=item1.id,
            codigo="MAT001",
            descripcion="CEMENTO PORTLAND TIPO I",
            unidad="saco",
            precio_unitario=12.50,
            cantidad=5.0,
            desperdicio=5.0
        ))
        db.add(DBMaterial(
            budget_item_id=item1.id,
            codigo="MAT002",
            descripcion="ARENA FINA",
            unidad="m3",
            precio_unitario=45.00,
            cantidad=0.5,
            desperdicio=0.0
        ))
        db.commit()

        # Partida 2: Concreto
        item2 = BudgetItem(
            budget_id=demo_budget.id,
            cod_par="E0201",
            cov_par="E0201",
            description="CONCRETO ARMADO 3000 PSI",
            unit="m3",
            quantity=50.0,
            performance=1.0,
            order=2,
            is_chapter=False
        )
        db.add(item2)
        db.commit()
        db.refresh(item2)

        # Agregar materiales a partida 2
        db.add(DBMaterial(
            budget_item_id=item2.id,
            codigo="MAT003",
            descripcion="CEMENTO PORTLAND TIPO I",
            unidad="saco",
            precio_unitario=12.50,
            cantidad=8.0,
            desperdicio=3.0
        ))
        db.add(DBMaterial(
            budget_item_id=item2.id,
            codigo="MAT004",
            descripcion="ARENA GRUESA",
            unidad="m3",
            precio_unitario=35.00,
            cantidad=0.8,
            desperdicio=0.0
        ))
        db.commit()

        return {
            "status": "success",
            "message": "Presupuesto de ejemplo creado exitosamente",
            "budget_id": demo_budget.id,
            "budget_name": demo_budget.name
        }

@router.delete("/{user_id}")
def delete_user(user_id: int, current_user = Depends(get_current_arko_admin)):
    """Eliminar usuario (solo admin)"""
    with ArkoSessionLocal() as db:
        user = db.query(ArkoAdmin).filter(ArkoAdmin.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")

        # Prevenir eliminación del usuario actual
        if user.id == current_user.id:
            raise HTTPException(status_code=400, detail="No puedes eliminar tu propio usuario")

        # Eliminar presupuestos del usuario primero
        from app.db.models.budget import Budget
        budgets = db.query(Budget).filter(Budget.user_id == str(user_id)).all()
        for budget in budgets:
            db.delete(budget)

        # Eliminar usuario
        db.delete(user)
        db.commit()

        return {"status": "success", "message": "Usuario eliminado exitosamente"}

@router.post("/subscription-request")
def request_subscription(request: SubscriptionRequest, current_user = Depends(get_current_arko_admin)):
    """El usuario solicita información o adquirir un plan"""
    try:
        # Correo al Superadmin
        success_admin = send_subscription_request_email(current_user.email, request.plan_name)
        # Correo al Usuario con los datos de pago
        success_user = send_payment_instructions_email(current_user.email, request.plan_name)
        
        if not success_admin and not success_user:
            raise HTTPException(status_code=500, detail="Error al enviar los correos de solicitud")
            
        return {"status": "success", "message": f"Solicitud de plan {request.plan_name} enviada y correo con datos de pago enviado al usuario."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))