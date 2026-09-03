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
    plan_started_at: Optional[str] = None
    plan_expires_at: Optional[str] = None
    max_ai_apus: int = 0
    ai_apus_generated: int = 0
    created_at: str

class UserUpdateRequest(BaseModel):
    is_active: Optional[bool] = None
    plan: Optional[str] = None
    max_budgets: Optional[int] = None
    max_items_per_budget: Optional[int] = None
    has_ai_access: Optional[bool] = None
    test_mode: Optional[bool] = False

@router.get("/", response_model=List[UserListResponse])
def get_users(current_user = Depends(get_current_arko_admin)):
    """Obtener lista de usuarios (solo admin)"""
    with ArkoSessionLocal() as db:
        users = db.query(ArkoAdmin).order_by(ArkoAdmin.created_at.desc()).all()
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
                "created_at": user.created_at.isoformat() if user.created_at else None,
                "plan_started_at": user.plan_started_at.isoformat() if user.plan_started_at else None,
                "plan_expires_at": user.plan_expires_at.isoformat() if user.plan_expires_at else None,
                "max_ai_apus": user.max_ai_apus or 0,
                "ai_apus_generated": user.ai_apus_generated or 0
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
            # If changing to a new plan, set the logic
            if user.plan != user_data.plan and user_data.plan != "free":
                from datetime import datetime, timedelta
                from app.services.email import send_plan_activated_email
                import threading
                threading.Thread(target=send_plan_activated_email, args=(user.email, user_data.plan, user_data.test_mode)).start()
                # Modo prueba: expira en 5 minutos para probar alertas
                user.plan_started_at = datetime.utcnow()
                if user_data.test_mode:
                    user.plan_expires_at = datetime.utcnow() + timedelta(minutes=5)
                else:
                    user.plan_expires_at = datetime.utcnow() + timedelta(days=30)
                    
                user.ai_apus_generated = 0
                if user_data.plan == "Básico":
                    user.max_ai_apus = 10
                elif user_data.plan == "Profesional":
                    user.max_ai_apus = 25
                elif user_data.plan == "Experto":
                    user.max_ai_apus = 50
                else:
                    user.max_ai_apus = 0
            elif user_data.plan == "free":
                user.plan_started_at = None
                user.plan_expires_at = None
                user.max_ai_apus = 0
            user.plan = user_data.plan
        if user_data.max_budgets is not None:
            user.max_budgets = user_data.max_budgets
        if user_data.max_items_per_budget is not None:
            user.max_items_per_budget = user_data.max_items_per_budget
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

@router.post("/system/process-expirations")
def process_plan_expirations(current_user = Depends(get_current_arko_admin)):
    """Verifica y vence los planes expirados, y genera alertas de 3 días."""
    from datetime import datetime, timedelta
    from sqlalchemy import and_
    from app.db.models.notification import Notification

    # Por seguridad, verificar que es super admin
    if current_user.email != "costbaseia@gmail.com":
        pass # Podríamos bloquearlo, pero para pruebas permitiremos que el admin lo ejecute

    processed_expired = 0
    processed_warnings = 0
    now = datetime.utcnow()
    warning_threshold = now + timedelta(days=3)

    with ArkoSessionLocal() as db:
        # 1. Usuarios expirados
        expired_users = db.query(ArkoAdmin).filter(
            and_(
                ArkoAdmin.plan != 'free',
                ArkoAdmin.plan_expires_at != None,
                ArkoAdmin.plan_expires_at <= now
            )
        ).all()

        for u in expired_users:
            old_plan = u.plan
            u.plan = 'free'
            u.max_budgets = 1
            u.max_items_per_budget = 2
            u.has_ai_access = False
            u.max_ai_apus = 0
            
            # Crear notificacion
            notif = Notification(
                user_id=u.id,
                message=f"Tu plan {old_plan} ha caducado. Has regresado al modo Demo. Contáctanos para renovar tu suscripción.",
                type="plan_expired"
            )
            db.add(notif)
            processed_expired += 1

        # 2. Usuarios próximos a vencer (Warning de 3 días)
        # Queremos notificar si están a menos de 3 días PERO solo enviar la notificación una vez.
        # Por simplicidad, buscaremos los que vencen en las próximas 72h y no tengan ya una notificación de "plan_warning"
        # reciente. (Mejor usar una query simple y un estado).
        warning_users = db.query(ArkoAdmin).filter(
            and_(
                ArkoAdmin.plan != 'free',
                ArkoAdmin.plan_expires_at != None,
                ArkoAdmin.plan_expires_at > now,
                ArkoAdmin.plan_expires_at <= warning_threshold
            )
        ).all()

        for u in warning_users:
            # Check if warning already exists in the last 3 days
            recent_warning = db.query(Notification).filter(
                and_(
                    Notification.user_id == u.id,
                    Notification.type == "plan_warning",
                    Notification.created_at >= (now - timedelta(days=3))
                )
            ).first()

            if not recent_warning:
                days_left = (u.plan_expires_at - now).days
                if days_left == 0:
                    time_str = "hoy"
                else:
                    time_str = f"en {days_left} día(s)"
                    
                notif = Notification(
                    user_id=u.id,
                    message=f"Atención: Tu plan {u.plan} expirará {time_str}. Renueva a tiempo para no perder tus beneficios.",
                    type="plan_warning"
                )
                db.add(notif)
                processed_warnings += 1

        db.commit()

    return {
        "status": "ok",
        "expired_processed": processed_expired,
        "warnings_sent": processed_warnings
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