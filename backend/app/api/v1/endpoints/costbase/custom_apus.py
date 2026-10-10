from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.logging import logger
from app.db.base import get_db
from app.api.v1.endpoints.arko import get_current_arko_admin, get_optional_arko_admin
from app.db.models.arko import ArkoAdmin
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
