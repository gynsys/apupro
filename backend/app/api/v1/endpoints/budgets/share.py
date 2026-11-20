"""
Budget sharing endpoints: Public share links, read-only preview, and shared cloning.
"""
import copy
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from app.api.v1.endpoints.arko import get_current_arko_admin, get_optional_arko_admin
from app.core.config import settings
from app.core.logging import logger
from app.db.arko_base import ArkoSessionLocal
from app.db.base import get_db
from app.db.models.arko import ArkoAdmin
from app.db.models.notification import Notification
from app.db.models.budget import (
    Budget,
    BudgetAPUEquipment as DBEquipment,
    BudgetAPULabor as DBLabor,
    BudgetAPUMaterial as DBMaterial,
    BudgetItem,
)
from app.middleware.plan_limits import check_budget_limit, check_items_limit
from .helpers import ensure_budget_share_columns

router = APIRouter()


def _clone_budget_for_user(db: Session, source_budget: Budget, target_user_id: Any) -> Budget:
    """Crea una copia independiente del presupuesto para otro usuario."""
    new_budget = Budget(
        user_id=str(target_user_id),
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
        bono_in_fcas=source_budget.bono_in_fcas,
        material_inflation=source_budget.material_inflation,
        labor_inflation=source_budget.labor_inflation,
        equipment_inflation=source_budget.equipment_inflation,
        company_name=source_budget.company_name,
        company_rif=source_budget.company_rif,
        project_name=source_budget.project_name,
        ubicacion=source_budget.ubicacion,
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
            is_pending=s_item.is_pending,
        )
        db.add(new_item)
        db.flush()

        for mat in s_item.materials:
            db.add(DBMaterial(
                budget_item_id=new_item.id,
                codigo=mat.codigo,
                descripcion=mat.descripcion,
                unidad=mat.unidad,
                precio_unitario=mat.precio_unitario,
                cantidad=mat.cantidad,
                desperdicio=mat.desperdicio or 0.0,
            ))

        for eq in s_item.equipments:
            db.add(DBEquipment(
                budget_item_id=new_item.id,
                codigo=eq.codigo,
                descripcion=eq.descripcion,
                unidad=eq.unidad,
                precio_unitario=eq.precio_unitario,
                cantidad=eq.cantidad,
                depreciacion=eq.depreciacion if eq.depreciacion is not None else 1.0,
            ))

        for lab in s_item.labors:
            db.add(DBLabor(
                budget_item_id=new_item.id,
                codigo=lab.codigo,
                descripcion=lab.descripcion,
                jornal=lab.jornal,
                bono=lab.bono,
                cantidad=lab.cantidad,
            ))

    return new_budget


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
    if origin and ("kostos360.com" in origin or "costbase.net" in origin or "localhost" in origin):
        frontend_base_url = origin.rstrip("/")
    else:
        frontend_base_url = getattr(settings, "FRONTEND_URL", "https://www.kostos360.com")
        if "gynsys.net" in frontend_base_url:
            frontend_base_url = "https://www.kostos360.com"

    share_url = f"{frontend_base_url}/budgets/shared/{budget.share_token}"

    return {
        "share_token": budget.share_token,
        "share_url": share_url,
        "is_public_share": budget.is_public_share,
    }


@router.post("/{budget_id}/items/{item_id}/share")
def generate_item_share_link(
    budget_id: str,
    item_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_arko_admin),
) -> Dict[str, Any]:
    """Genera un enlace firmado para compartir una partida/APU individual."""
    budget = db.query(Budget).filter(
        Budget.id == budget_id,
        Budget.user_id == str(current_user.id),
    ).first()
    if not budget:
        raise HTTPException(status_code=404, detail="Presupuesto no encontrado")

    item = db.query(BudgetItem).filter(
        BudgetItem.id == item_id,
        BudgetItem.budget_id == budget_id,
        BudgetItem.is_chapter.is_(False),
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Partida no encontrada")

    token = jwt.encode(
        {
            "scope": "partida_share",
            "budget_id": budget_id,
            "item_id": item_id,
            "exp": int((datetime.now(timezone.utc) + timedelta(days=30)).timestamp()),
        },
        settings.SECRET_KEY,
        algorithm="HS256",
    )

    origin = request.headers.get("origin")
    if origin and ("kostos360.com" in origin or "costbase.net" in origin or "localhost" in origin):
        frontend_base_url = origin.rstrip("/")
    else:
        frontend_base_url = getattr(settings, "FRONTEND_URL", "https://www.kostos360.com")
        if "gynsys.net" in frontend_base_url:
            frontend_base_url = "https://www.kostos360.com"

    return {
        "share_token": token,
        "share_url": f"{frontend_base_url}/budgets/shared/partida/{token}",
        "budget_id": budget_id,
        "item_id": item_id,
        "description": item.description,
        "expires_in_days": 30,
    }


@router.get("/shared/partida/{share_token}")
def get_shared_item_preview(
    share_token: str,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Vista pública de una partida compartida mediante token firmado."""
    try:
        payload = jwt.decode(share_token, settings.SECRET_KEY, algorithms=["HS256"])
    except JWTError:
        raise HTTPException(status_code=404, detail="Enlace de partida inválido o expirado")

    if payload.get("scope") != "partida_share":
        raise HTTPException(status_code=404, detail="Enlace de partida inválido")

    budget_id = payload.get("budget_id")
    item_id = payload.get("item_id")
    budget = db.query(Budget).filter(Budget.id == budget_id).first()
    item = db.query(BudgetItem).filter(
        BudgetItem.id == item_id,
        BudgetItem.budget_id == budget_id,
    ).first()
    if not budget or not item:
        raise HTTPException(status_code=404, detail="Partida no encontrada")

    return {
        "budget": {
            "id": budget.id,
            "name": budget.name,
            "client_name": budget.client_name,
            "currency": budget.currency or "USD",
            "exchange_rate": budget.exchange_rate or 1.0,
            "fcas_percent": budget.fcas_percent if budget.fcas_percent is not None else 417.0,
            "bono_in_fcas": budget.bono_in_fcas,
            "labor_bonus": budget.labor_bonus or 0,
            "material_inflation": budget.material_inflation or 0,
            "equipment_inflation": budget.equipment_inflation or 0,
            "labor_inflation": budget.labor_inflation or 0,
            "admin_percent": budget.admin_percent if budget.admin_percent is not None else 15.0,
            "profit_percent": budget.profit_percent if budget.profit_percent is not None else 10.0,
            "iva_percent": budget.iva_percent if budget.iva_percent is not None else 16.0,
        },
        "item": {
            "id": item.id,
            "cod_par": item.cod_par,
            "cov_par": item.cov_par,
            "description": item.description,
            "unit": item.unit,
            "quantity": item.quantity,
            "performance": item.performance,
            "materials": [
                {
                    "id": m.id,
                    "codigo": m.codigo,
                    "descripcion": m.descripcion,
                    "unidad": m.unidad,
                    "cantidad": m.cantidad,
                    "precio_unitario": m.precio_unitario,
                    "desperdicio": m.desperdicio,
                }
                for m in item.materials
            ],
            "equipments": [
                {
                    "id": e.id,
                    "codigo": e.codigo,
                    "descripcion": e.descripcion,
                    "unidad": e.unidad,
                    "cantidad": e.cantidad,
                    "precio_unitario": e.precio_unitario,
                    "depreciacion": e.depreciacion,
                }
                for e in item.equipments
            ],
            "labors": [
                {
                    "id": l.id,
                    "codigo": l.codigo,
                    "descripcion": l.descripcion,
                    "cantidad": l.cantidad,
                    "jornal": l.jornal,
                    "bono": l.bono,
                }
                for l in item.labors
            ],
        },
    }


@router.post("/{budget_id}/import-shared-partida")
def import_shared_item(
    budget_id: str,
    payload: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_arko_admin),
) -> Dict[str, Any]:
    """Copia una partida compartida al final de un presupuesto del usuario."""
    token = (payload or {}).get("token", "").strip()
    if not token:
        raise HTTPException(status_code=400, detail="El enlace de la partida es obligatorio")

    target_budget = db.query(Budget).filter(
        Budget.id == budget_id,
        Budget.user_id == str(current_user.id),
    ).first()
    if not target_budget:
        raise HTTPException(status_code=404, detail="Presupuesto destino no encontrado")

    try:
        token_payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
    except JWTError:
        raise HTTPException(status_code=404, detail="Enlace de partida inválido o expirado")

    if token_payload.get("scope") != "partida_share":
        raise HTTPException(status_code=404, detail="Enlace de partida inválido")

    source_item = db.query(BudgetItem).filter(
        BudgetItem.id == token_payload.get("item_id"),
        BudgetItem.budget_id == token_payload.get("budget_id"),
        BudgetItem.is_chapter.is_(False),
    ).first()
    if not source_item:
        raise HTTPException(status_code=404, detail="Partida compartida no encontrada")

    check_items_limit(current_user, budget_id)

    try:
        last_order = db.query(BudgetItem).filter(
            BudgetItem.budget_id == budget_id,
        ).order_by(BudgetItem.order.desc()).first()

        new_item = BudgetItem(
            budget_id=budget_id,
            cod_par=source_item.cod_par,
            cov_par=source_item.cov_par,
            description=source_item.description,
            unit=source_item.unit,
            quantity=source_item.quantity,
            performance=source_item.performance,
            order=(last_order.order + 1) if last_order else 0,
            is_chapter=False,
        )
        db.add(new_item)
        db.flush()

        for mat in source_item.materials:
            db.add(DBMaterial(
                budget_item_id=new_item.id,
                codigo=mat.codigo,
                descripcion=mat.descripcion,
                unidad=mat.unidad,
                precio_unitario=mat.precio_unitario,
                cantidad=mat.cantidad,
                desperdicio=mat.desperdicio or 0.0,
            ))

        for eq in source_item.equipments:
            db.add(DBEquipment(
                budget_item_id=new_item.id,
                codigo=eq.codigo,
                descripcion=eq.descripcion,
                unidad=eq.unidad,
                precio_unitario=eq.precio_unitario,
                cantidad=eq.cantidad,
                depreciacion=eq.depreciacion if eq.depreciacion is not None else 1.0,
            ))

        for lab in source_item.labors:
            db.add(DBLabor(
                budget_item_id=new_item.id,
                codigo=lab.codigo,
                descripcion=lab.descripcion,
                jornal=lab.jornal,
                bono=lab.bono,
                cantidad=lab.cantidad,
            ))

        db.commit()
        db.refresh(new_item)

        return {
            "success": True,
            "item_id": new_item.id,
            "description": new_item.description,
            "message": "Partida importada exitosamente",
        }
    except HTTPException:
        db.rollback()
        raise
    except Exception as err:
        db.rollback()
        logger.error(f"Error al importar partida compartida budget={budget_id}: {err}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error interno al importar la partida")


@router.post("/{budget_id}/share-to-user")
def share_budget_with_user(
    budget_id: str,
    request: Request,
    payload: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_arko_admin),
) -> Dict[str, Any]:
    """Comparte un presupuesto con un usuario y le envía una notificación."""
    recipient_id = (payload or {}).get("recipient_id")
    note = (payload or {}).get("note") or ""
    if not recipient_id:
        raise HTTPException(status_code=400, detail="Selecciona un usuario destinatario")
    if str(recipient_id) == str(current_user.id):
        raise HTTPException(status_code=400, detail="No puedes compartir un presupuesto contigo mismo")

    ensure_budget_share_columns(db)
    budget = db.query(Budget).filter(
        Budget.id == budget_id,
        Budget.user_id == str(current_user.id),
    ).first()
    if not budget:
        raise HTTPException(status_code=404, detail="Presupuesto no encontrado")

    with ArkoSessionLocal() as arko_db:
        recipient = arko_db.query(ArkoAdmin).filter(
            ArkoAdmin.id == int(recipient_id),
            ArkoAdmin.is_active.is_(True),
        ).first()
        if not recipient:
            raise HTTPException(status_code=404, detail="Usuario destinatario no encontrado")
        check_budget_limit(recipient)

    try:
        new_budget = _clone_budget_for_user(db, budget, recipient_id)
        db.commit()
        db.refresh(new_budget)
    except HTTPException:
        db.rollback()
        raise
    except Exception as err:
        db.rollback()
        logger.error(f"Error al compartir presupuesto con usuario {recipient_id}: {err}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error interno al compartir el presupuesto")

    sender_name = current_user.full_name or current_user.username or current_user.email
    with ArkoSessionLocal() as arko_db:
        arko_db.add(Notification(
            user_id=int(recipient_id),
            message=f"{sender_name} te compartió el presupuesto: {budget.name}" + (f" — {note}" if note else ""),
            type="budget_shared",
            link=f"/budgets/{new_budget.id}",
            is_read=False,
        ))
        arko_db.commit()

    return {
        "success": True,
        "budget_id": new_budget.id,
        "recipient_id": int(recipient_id),
        "message": "Presupuesto agregado a los presupuestos del destinatario",
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

    owner_name = "Usuario de Kostos360"
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
        new_budget = _clone_budget_for_user(db, source_budget, current_user.id)
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


# ---------------------------------------------------------------------------
# Planillas de Cómputos Métricos: Compartir por enlace o directo a otro usuario
# ---------------------------------------------------------------------------

def _find_user_computos_draft(
    arko_db: Session,
    user_id: int,
    draft_id: str,
) -> Optional[Dict[str, Any]]:
    user = arko_db.query(ArkoAdmin).filter(ArkoAdmin.id == int(user_id)).first()
    if not user:
        return None
    config = user.site_config or {}
    drafts = config.get("computos_drafts", [])
    if not isinstance(drafts, list):
        return None
    clean_id = str(draft_id or "").strip()
    return next((d for d in drafts if isinstance(d, dict) and str(d.get("id")) == clean_id), None)


def _clone_computos_draft_for_user(
    arko_db: Session,
    recipient_id: int,
    source_draft: Dict[str, Any],
    sender_name: Optional[str] = None,
) -> Dict[str, Any]:
    recipient = arko_db.query(ArkoAdmin).filter(
        ArkoAdmin.id == int(recipient_id),
        ArkoAdmin.is_active.is_(True),
    ).first()
    if not recipient:
        raise HTTPException(status_code=404, detail="Usuario destinatario no encontrado")

    config = dict(recipient.site_config or {})
    raw_drafts = config.get("computos_drafts", [])
    drafts: List[Dict[str, Any]] = list(raw_drafts) if isinstance(raw_drafts, list) else []

    cloned = copy.deepcopy(source_draft)
    new_draft_id = f"draft-{uuid.uuid4().hex[:12]}"
    base_name = (cloned.get("budgetName") or "Planilla de Cómputos").strip()
    candidate_name = base_name if base_name.endswith("(Compartida)") else f"{base_name} (Compartida)"
    existing_names = {(d.get("budgetName") or "").strip().lower() for d in drafts if isinstance(d, dict)}
    if candidate_name.lower() in existing_names:
        suffix = 2
        while f"{candidate_name} ({suffix})".lower() in existing_names:
            suffix += 1
        candidate_name = f"{candidate_name} ({suffix})"
    cloned["budgetName"] = candidate_name
    cloned["id"] = new_draft_id
    cloned["budgetId"] = ""
    cloned["savedAt"] = datetime.now(timezone.utc).isoformat()
    cloned["versions"] = []
    if sender_name:
        cloned["sharedBy"] = sender_name

    drafts.insert(0, cloned)
    config["computos_drafts"] = drafts[:40]
    recipient.site_config = config
    flag_modified(recipient, "site_config")
    arko_db.commit()
    return cloned


def _resolve_frontend_base_url(request: Request) -> str:
    origin = request.headers.get("origin")
    if origin and ("kostos360.com" in origin or "costbase.net" in origin or "localhost" in origin):
        return origin.rstrip("/")
    frontend_base_url = getattr(settings, "FRONTEND_URL", "https://www.kostos360.com")
    if "gynsys.net" in frontend_base_url:
        return "https://www.kostos360.com"
    return frontend_base_url.rstrip("/")


@router.post("/computos/drafts/{draft_id}/share")
def generate_computos_share_link(
    draft_id: str,
    request: Request,
    current_user: ArkoAdmin = Depends(get_current_arko_admin),
) -> Dict[str, Any]:
    """Genera un enlace firmado para compartir una planilla de cómputos."""
    with ArkoSessionLocal() as arko_db:
        draft = _find_user_computos_draft(arko_db, int(current_user.id), draft_id)
        if not draft:
            raise HTTPException(status_code=404, detail="Planilla de cómputos no encontrada. Guárdala primero para compartir.")

    token = jwt.encode(
        {
            "scope": "computos_share",
            "owner_id": int(current_user.id),
            "draft_id": str(draft_id).strip(),
            "exp": int((datetime.now(timezone.utc) + timedelta(days=30)).timestamp()),
        },
        settings.SECRET_KEY,
        algorithm="HS256",
    )
    frontend_base_url = _resolve_frontend_base_url(request)
    return {
        "share_token": token,
        "share_url": f"{frontend_base_url}/computos/shared/{token}",
        "draft_id": str(draft_id).strip(),
        "budget_name": draft.get("budgetName") or "Planilla de Cómputos",
        "expires_in_days": 30,
    }


@router.post("/computos/drafts/{draft_id}/share-to-user")
def share_computos_with_user(
    draft_id: str,
    payload: Dict[str, Any],
    current_user: ArkoAdmin = Depends(get_current_arko_admin),
) -> Dict[str, Any]:
    """Clona una planilla de cómputos directamente en la cuenta de otro usuario de Kostos y le notifica."""
    recipient_id = (payload or {}).get("recipient_id")
    note = str((payload or {}).get("note") or "").strip()
    if not recipient_id:
        raise HTTPException(status_code=400, detail="Selecciona un usuario destinatario")
    if str(recipient_id) == str(current_user.id):
        raise HTTPException(status_code=400, detail="No puedes compartir una planilla contigo mismo")

    sender_name = current_user.full_name or current_user.username or current_user.email
    with ArkoSessionLocal() as arko_db:
        source_draft = _find_user_computos_draft(arko_db, int(current_user.id), draft_id)
        if not source_draft:
            raise HTTPException(status_code=404, detail="Planilla de cómputos no encontrada. Guárdala primero para compartir.")

        cloned = _clone_computos_draft_for_user(arko_db, int(recipient_id), source_draft, sender_name=sender_name)
        planilla_name = source_draft.get("budgetName") or "Planilla de Cómputos"
        token = jwt.encode(
            {
                "scope": "computos_share",
                "owner_id": int(current_user.id),
                "draft_id": str(draft_id).strip(),
                "exp": int((datetime.now(timezone.utc) + timedelta(days=30)).timestamp()),
            },
            settings.SECRET_KEY,
            algorithm="HS256",
        )
        arko_db.add(Notification(
            user_id=int(recipient_id),
            message=f"{sender_name} te compartió la planilla de cómputos: {planilla_name}" + (f" — {note}" if note else ""),
            type="computos_shared",
            link=f"/computos/shared/{token}",
            is_read=False,
        ))
        arko_db.commit()

    return {
        "success": True,
        "draft_id": cloned["id"],
        "recipient_id": int(recipient_id),
        "message": "Planilla agregada a los Cómputos Guardados del destinatario",
    }


@router.get("/computos/shared/{share_token}")
def get_shared_computos_preview(
    share_token: str,
    current_user: Optional[ArkoAdmin] = Depends(get_optional_arko_admin),
) -> Dict[str, Any]:
    """Vista pública de solo lectura de una planilla de cómputos compartida."""
    try:
        payload = jwt.decode(share_token, settings.SECRET_KEY, algorithms=["HS256"])
    except JWTError:
        raise HTTPException(status_code=404, detail="Enlace de planilla inválido o expirado")

    if payload.get("scope") != "computos_share":
        raise HTTPException(status_code=404, detail="Enlace de planilla inválido")

    owner_id = payload.get("owner_id")
    draft_id = payload.get("draft_id")
    if not owner_id or not draft_id:
        raise HTTPException(status_code=404, detail="Enlace de planilla incompleto")

    with ArkoSessionLocal() as arko_db:
        owner = arko_db.query(ArkoAdmin).filter(ArkoAdmin.id == int(owner_id)).first()
        if not owner:
            raise HTTPException(status_code=404, detail="Planilla no encontrada")
        draft = _find_user_computos_draft(arko_db, int(owner_id), str(draft_id))
        if not draft:
            raise HTTPException(status_code=404, detail="La planilla compartida ya no está disponible")

        owner_name = owner.full_name or owner.username or "Usuario de Kostos360"
        is_own = bool(current_user and str(current_user.id) == str(owner_id))
        items = draft.get("items") if isinstance(draft.get("items"), list) else []

        return {
            "draft": {
                "id": draft.get("id"),
                "budgetName": draft.get("budgetName") or "Planilla de Cómputos",
                "projectName": draft.get("projectName") or "",
                "savedAt": draft.get("savedAt"),
                "itemCount": len(items),
                "items": items,
            },
            "owner_name": owner_name,
            "is_own_draft": is_own,
        }


@router.post("/computos/shared/{share_token}/import")
def import_shared_computos(
    share_token: str,
    current_user: ArkoAdmin = Depends(get_current_arko_admin),
) -> Dict[str, Any]:
    """Clona una planilla de cómputos compartida hacia los Cómputos Guardados del usuario actual."""
    try:
        payload = jwt.decode(share_token, settings.SECRET_KEY, algorithms=["HS256"])
    except JWTError:
        raise HTTPException(status_code=404, detail="Enlace de planilla inválido o expirado")

    if payload.get("scope") != "computos_share":
        raise HTTPException(status_code=404, detail="Enlace de planilla inválido")

    owner_id = payload.get("owner_id")
    draft_id = payload.get("draft_id")
    if not owner_id or not draft_id:
        raise HTTPException(status_code=404, detail="Enlace de planilla incompleto")

    with ArkoSessionLocal() as arko_db:
        owner = arko_db.query(ArkoAdmin).filter(ArkoAdmin.id == int(owner_id)).first()
        source_draft = _find_user_computos_draft(arko_db, int(owner_id), str(draft_id))
        if not source_draft:
            raise HTTPException(status_code=404, detail="La planilla compartida ya no está disponible")

        owner_name = (owner.full_name or owner.username) if owner else None
        cloned = _clone_computos_draft_for_user(
            arko_db,
            int(current_user.id),
            source_draft,
            sender_name=owner_name,
        )

    return {
        "success": True,
        "draft": cloned,
        "message": "Planilla importada a tus Cómputos Guardados",
    }
