"""
Budget sharing endpoints: Public share links, read-only preview, and shared cloning.
"""
import secrets
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.api.v1.endpoints.arko import get_current_arko_admin, get_optional_arko_admin
from app.core.config import settings
from app.core.logging import logger
from app.db.arko_base import ArkoSessionLocal
from app.db.base import get_db
from app.db.models.arko import ArkoAdmin
from app.db.models.budget import (
    Budget,
    BudgetAPUEquipment as DBEquipment,
    BudgetAPULabor as DBLabor,
    BudgetAPUMaterial as DBMaterial,
    BudgetItem,
)
from app.middleware.plan_limits import check_budget_limit
from .helpers import ensure_budget_share_columns

router = APIRouter()


@router.post("/{budget_id}/share")
def generate_share_link(
    budget_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_arko_admin),
) -> Dict[str, Any]:
    """Genera o activa el enlace unico de comparticion para un presupuesto."""
    if not budget_id:
        raise ValueError("budget_id es obligatorio")

    ensure_budget_share_columns(db)
    budget = db.query(Budget).filter(Budget.id == budget_id, Budget.user_id == str(current_user.id)).first()
    if not budget:
        raise HTTPException(status_code=404, detail="Presupuesto no encontrado")

    if not budget.share_token:
        budget.share_token = f"cb_{secrets.token_urlsafe(12)}"

    budget.is_public_share = True
    db.commit()
    db.refresh(budget)

    origin = request.headers.get("origin")
    if origin and ("costbase.net" in origin or "localhost" in origin):
        frontend_base_url = origin.rstrip("/")
    else:
        frontend_base_url = getattr(settings, "FRONTEND_URL", "https://www.costbase.net")
        if "gynsys.net" in frontend_base_url:
            frontend_base_url = "https://www.costbase.net"

    share_url = f"{frontend_base_url}/budgets/shared/{budget.share_token}"

    return {
        "share_token": budget.share_token,
        "share_url": share_url,
        "is_public_share": budget.is_public_share,
    }


@router.delete("/{budget_id}/share")
def revoke_share_link(
    budget_id: str,
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_arko_admin),
) -> Dict[str, Any]:
    """Revoca el enlace de comparticion de un presupuesto."""
    if not budget_id:
        raise ValueError("budget_id es obligatorio")

    ensure_budget_share_columns(db)
    budget = db.query(Budget).filter(Budget.id == budget_id, Budget.user_id == str(current_user.id)).first()
    if not budget:
        raise HTTPException(status_code=404, detail="Presupuesto no encontrado")

    budget.is_public_share = False
    db.commit()
    return {"message": "Enlace de compartición revocado exitosamente", "is_public_share": False}


@router.get("/shared/{share_token}")
def get_shared_budget_preview(
    share_token: str,
    db: Session = Depends(get_db),
    current_user: Optional[ArkoAdmin] = Depends(get_optional_arko_admin),
) -> Dict[str, Any]:
    """Obtiene vista previa de un presupuesto compartido mediante su token."""
    if not share_token:
        raise ValueError("share_token es obligatorio")

    ensure_budget_share_columns(db)
    budget = db.query(Budget).filter(
        Budget.share_token == share_token,
        Budget.is_public_share == True,
    ).first()
    if not budget:
        raise HTTPException(status_code=404, detail="Presupuesto no encontrado o el enlace ha sido revocado")

    owner_name = "Usuario de CostBase"
    with ArkoSessionLocal() as arko_db:
        owner = arko_db.query(ArkoAdmin).filter(
            ArkoAdmin.id == int(budget.user_id) if str(budget.user_id).isdigit() else None
        ).first()
        if owner:
            owner_name = getattr(owner, "name", None) or owner.email

    items = db.query(BudgetItem).filter(BudgetItem.budget_id == budget.id).all()
    items_count = len([i for i in items if not getattr(i, "is_chapter", False)])

    ex_rate = (budget.exchange_rate or 1.0) if budget.currency == "BS" else 1.0
    fcas_percent = budget.fcas_percent if budget.fcas_percent is not None else 417.0
    admin_percent = budget.admin_percent if budget.admin_percent is not None else 15.0
    profit_percent = budget.profit_percent if budget.profit_percent is not None else 10.0
    iva_percent = budget.iva_percent if budget.iva_percent is not None else 16.0

    subtotal_presupuesto = 0.0

    for it in items:
        if getattr(it, "is_chapter", False):
            continue
        qty = float(it.quantity or 0.0)
        perf = float(it.performance or 1.0)
        if perf <= 0:
            perf = 1.0

        mat_cost = 0.0
        for m in it.materials:
            q = float(m.cantidad or 0.0)
            w = float(m.desperdicio or 0.0)
            p = float(m.precio_unitario or 0.0) * ex_rate
            mat_cost += (q * (1.0 + w / 100.0) * p)

        eq_day = 0.0
        for e in it.equipments:
            q = float(e.cantidad or 0.0)
            d = float(e.depreciacion if e.depreciacion is not None else 1.0)
            p = float(e.precio_unitario or 0.0) * ex_rate
            eq_day += (q * d * p)
        eq_cost = eq_day / perf

        tot_jornal = 0.0
        tot_bono = 0.0
        for l in it.labors:
            q = float(l.cantidad or 0.0)
            j = float(l.jornal or 0.0) * ex_rate
            b = float(l.bono or 0.0) * ex_rate
            tot_jornal += (q * j)
            tot_bono += (q * b)

        fcas_monto = tot_jornal * (fcas_percent / 100.0)
        lab_cost = (tot_jornal + tot_bono + fcas_monto) / perf

        subtotal = mat_cost + eq_cost + lab_cost
        subtotal_b = subtotal + (subtotal * (admin_percent / 100.0))
        pu = subtotal_b + (subtotal_b * (profit_percent / 100.0))

        subtotal_presupuesto += (pu * qty)

    iva_amount = subtotal_presupuesto * (iva_percent / 100.0)
    total_amount = subtotal_presupuesto + iva_amount

    is_own_budget = (str(current_user.id) == str(budget.user_id)) if current_user else False

    return {
        "id": budget.id,
        "name": budget.name,
        "description": budget.description,
        "client_name": budget.client_name,
        "currency": budget.currency or "USD",
        "created_at": budget.created_at.isoformat() if budget.created_at else None,
        "items_count": items_count,
        "total_amount": round(total_amount, 2),
        "owner_name": owner_name,
        "is_own_budget": is_own_budget,
    }


@router.post("/shared/{share_token}/import")
def import_shared_budget(
    share_token: str,
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_arko_admin),
) -> Dict[str, Any]:
    """Clona un presupuesto compartido hacia la cuenta del usuario actual."""
    if not share_token:
        raise ValueError("share_token es obligatorio")

    ensure_budget_share_columns(db)
    source_budget = db.query(Budget).filter(
        Budget.share_token == share_token,
        Budget.is_public_share == True,
    ).first()
    if not source_budget:
        raise HTTPException(status_code=404, detail="Presupuesto no encontrado o el enlace ha sido revocado")

    check_budget_limit(current_user)

    try:
        new_budget = Budget(
            user_id=str(current_user.id),
            name=f"{source_budget.name} (Compartido)",
            description=source_budget.description,
            notes=source_budget.notes,
            client_name=source_budget.client_name,
            currency=source_budget.currency,
            exchange_rate=source_budget.exchange_rate,
            fcas_percent=source_budget.fcas_percent,
            admin_percent=source_budget.admin_percent,
            profit_percent=source_budget.profit_percent,
            iva_percent=source_budget.iva_percent,
            labor_bonus=source_budget.labor_bonus,
            material_inflation=source_budget.material_inflation,
            labor_inflation=source_budget.labor_inflation,
            equipment_inflation=source_budget.equipment_inflation,
            company_name=source_budget.company_name,
            company_rif=source_budget.company_rif,
            project_name=source_budget.project_name,
        )
        db.add(new_budget)
        db.flush()

        source_items = db.query(BudgetItem).filter(BudgetItem.budget_id == source_budget.id).all()
        for s_item in source_items:
            new_item = BudgetItem(
                budget_id=new_budget.id,
                cod_par=s_item.cod_par,
                cov_par=s_item.cov_par,
                description=s_item.description,
                unit=s_item.unit,
                quantity=s_item.quantity,
                performance=s_item.performance,
                order=s_item.order,
                is_chapter=s_item.is_chapter,
            )
            db.add(new_item)
            db.flush()

            for mat in s_item.materials:
                new_mat = DBMaterial(
                    budget_item_id=new_item.id,
                    codigo=mat.codigo,
                    descripcion=mat.descripcion,
                    unidad=mat.unidad,
                    precio_unitario=mat.precio_unitario,
                    cantidad=mat.cantidad,
                    desperdicio=mat.desperdicio or 0.0,
                )
                db.add(new_mat)

            for eq in s_item.equipments:
                new_eq = DBEquipment(
                    budget_item_id=new_item.id,
                    codigo=eq.codigo,
                    descripcion=eq.descripcion,
                    unidad=eq.unidad,
                    precio_unitario=eq.precio_unitario,
                    cantidad=eq.cantidad,
                    depreciacion=eq.depreciacion if eq.depreciacion is not None else 1.0,
                )
                db.add(new_eq)

            for lab in s_item.labors:
                new_lab = DBLabor(
                    budget_item_id=new_item.id,
                    codigo=lab.codigo,
                    descripcion=lab.descripcion,
                    jornal=lab.jornal,
                    bono=lab.bono,
                    cantidad=lab.cantidad,
                )
                db.add(new_lab)

        db.commit()
        db.refresh(new_budget)

        return {
            "success": True,
            "budget_id": new_budget.id,
            "message": "Presupuesto importado exitosamente",
        }
    except HTTPException:
        db.rollback()
        raise
    except Exception as err:
        db.rollback()
        logger.error(f"Error al importar presupuesto compartido token={share_token}: {err}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error interno al importar presupuesto compartido")
