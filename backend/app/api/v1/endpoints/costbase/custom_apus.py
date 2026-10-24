from datetime import datetime, timezone
from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
import json
import uuid

from app.core.logging import logger
from app.db.base import get_db
from app.db.arko_base import ArkoSessionLocal
from app.api.v1.endpoints.arko import get_current_arko_admin, get_optional_arko_admin
from app.db.models.arko import ArkoAdmin
from app.db.models.budget import Budget, BudgetItem
from app.db.models.costbase import CustomCostItem
from app.db.models.notification import Notification
from app.schemas.costbase import (
    CustomCostItemCreate,
    CustomCostItemResponse
)
from app.crud.crud_costbase import (
    save_custom_apu,
    delete_custom_apu
)

router = APIRouter()


@router.post("/custom-apus", response_model=CustomCostItemResponse)
def save_custom_apu_route(
    payload: CustomCostItemCreate,
    current_user: Optional[ArkoAdmin] = Depends(get_optional_arko_admin),
    db: Session = Depends(get_db)
) -> Any:
    user_id = current_user.id if current_user else None
    try:
        new_item = save_custom_apu(
            db=db,
            description=payload.description,
            unit=payload.unit or "und",
            performance=payload.performance or 1.0,
            apu_data=payload.apu_data,
            user_id=user_id
        )
        return new_item
    except ValueError as val_err:
        logger.warning("Validación fallida en /custom-apus: %s", val_err)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(val_err)
        )
    except Exception as exc:
        logger.error("Error al procesar /custom-apus: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error interno al guardar la partida personalizada: {str(exc)}"
        )


class ShareApuRequest(BaseModel):
    recipient_id: int
    budget_id: str
    item_id: str
    note: Optional[str] = None


@router.post("/custom-apus/share")
def share_apu_with_user(
    payload: ShareApuRequest,
    current_user: ArkoAdmin = Depends(get_current_arko_admin),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Copia el APU de una partida a la base Compartidos conmigo del receptor."""
    if payload.recipient_id == current_user.id:
        raise HTTPException(status_code=400, detail="No puedes compartir una partida contigo mismo")

    budget = db.query(Budget).filter(
        Budget.id == payload.budget_id,
        Budget.user_id == str(current_user.id),
    ).first()
    if not budget:
        raise HTTPException(status_code=404, detail="Presupuesto no encontrado")

    item = db.query(BudgetItem).filter(
        BudgetItem.id == payload.item_id,
        BudgetItem.budget_id == payload.budget_id,
        BudgetItem.is_chapter.is_(False),
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Partida no encontrada")

    with ArkoSessionLocal() as arko_db:
        recipient = arko_db.query(ArkoAdmin).filter(
            ArkoAdmin.id == payload.recipient_id,
            ArkoAdmin.is_active.is_(True),
        ).first()
        if not recipient:
            raise HTTPException(status_code=404, detail="Usuario destinatario no encontrado")
        recipient_name = recipient.full_name or recipient.username or recipient.email

    apu_data = {
        "cod_par": item.cov_par or item.cod_par,
        "cov_par": item.cov_par,
        "description": item.description,
        "unit": item.unit,
        "performance": item.performance or 1.0,
        "materials": [
            {
                "codigo": m.codigo,
                "descripcion": m.descripcion,
                "unidad": m.unidad,
                "cantidad": m.cantidad,
                "precio_unitario": m.precio_unitario,
                "desperdicio": m.desperdicio or 0.0,
            }
            for m in item.materials
        ],
        "equipments": [
            {
                "codigo": e.codigo,
                "descripcion": e.descripcion,
                "unidad": e.unidad,
                "cantidad": e.cantidad,
                "precio_unitario": e.precio_unitario,
                "depreciacion": e.depreciacion if e.depreciacion is not None else 1.0,
            }
            for e in item.equipments
        ],
        "labors": [
            {
                "codigo": l.codigo,
                "descripcion": l.descripcion,
                "cantidad": l.cantidad,
                "jornal": l.jornal,
                "bono": l.bono,
            }
            for l in item.labors
        ],
    }

    shared = db.query(CustomCostItem).filter(
        CustomCostItem.shared_with_user_id == payload.recipient_id,
        CustomCostItem.shared_by_user_id == current_user.id,
        CustomCostItem.source_budget_item_id == item.id,
    ).first()

    if shared:
        shared.description = item.description
        shared.unit = item.unit or "und"
        shared.performance = item.performance or 1.0
        shared.apu_data = json.dumps(apu_data)
        shared.shared_note = payload.note
        shared.shared_at = datetime.now(timezone.utc)
    else:
        shared = CustomCostItem(
            id=str(uuid.uuid4()),
            user_id=current_user.id,
            description=item.description,
            unit=item.unit or "und",
            performance=item.performance or 1.0,
            apu_data=json.dumps(apu_data),
            shared_with_user_id=payload.recipient_id,
            shared_by_user_id=current_user.id,
            shared_note=payload.note,
            shared_at=datetime.now(timezone.utc),
            source_budget_item_id=item.id,
        )
        db.add(shared)

    db.commit()
    db.refresh(shared)

    sender_name = current_user.full_name or current_user.username or current_user.email
    with ArkoSessionLocal() as arko_db:
        arko_db.add(Notification(
            user_id=payload.recipient_id,
            message=f"{sender_name} te compartió el APU: {item.description}",
            type="apu_shared",
            link=f"/cost360/apu/{shared.id}?db=compartidos",
            is_read=False,
        ))
        arko_db.commit()

    return {
        "success": True,
        "item_id": shared.id,
        "recipient_id": payload.recipient_id,
        "recipient_name": recipient_name,
        "message": "APU compartido en la base Compartidos conmigo",
    }


@router.delete("/custom-apus/{item_id}")
def delete_custom_apu_route(
    item_id: str,
    current_user: ArkoAdmin = Depends(get_current_arko_admin),
    db: Session = Depends(get_db)
) -> Dict[str, str]:
    is_superadmin = (
        getattr(current_user, 'is_superadmin', False) or
        (current_user.email == 'admin@arko360.net') or
        getattr(current_user, 'role', '') in ['admin', 'superadmin']
    )
    try:
        success = delete_custom_apu(
            db=db,
            item_id=item_id,
            user_id=current_user.id,
            is_superadmin=is_superadmin
        )
        if not success:
            raise HTTPException(status_code=404, detail="Partida personalizada no encontrada")
        return {"status": "success", "message": "Partida personalizada eliminada exitosamente"}
    except PermissionError as pe:
        raise HTTPException(status_code=403, detail=str(pe))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error al eliminar partida personalizada {item_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error interno al eliminar la partida")
