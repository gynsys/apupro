"""
Budget item endpoints: Add, update, delete, and reorder items/chapters.
"""
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.v1.endpoints.arko import get_current_arko_admin
from app.api.v1.endpoints.budgets.helpers import get_budget_or_404
from app.core.logging import logger
from app.crud.crud_costbase import get_item_by_code_or_covpar
from app.db.base import get_db
from app.db.models.arko import ArkoAdmin
from app.db.models.budget import (
    Budget,
    BudgetAPUEquipment as DBEquipment,
    BudgetAPULabor as DBLabor,
    BudgetAPUMaterial as DBMaterial,
    BudgetItem,
)
from app.db.models.cost360 import CostItem
from app.middleware.plan_limits import check_items_limit
from app.schemas.budget import (
    BudgetItem as BudgetItemSchema,
    BudgetItemCreate,
    BudgetItemUpdate,
)
from app.services.budget_postprocessor import recalibrate_budget_performances

router = APIRouter()


@router.post("/{budget_id}/items", response_model=BudgetItemSchema, status_code=status.HTTP_201_CREATED)
def add_item_to_budget(
    budget_id: str,
    item_in: BudgetItemCreate,
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_arko_admin),
) -> BudgetItem:
    """Agrega una partida o capitulo al presupuesto, poblando sus insumos APU."""
    budget = get_budget_or_404(db, budget_id, current_user, for_write=True)

    # Verificar limite de partidas por plan
    check_items_limit(current_user, budget_id)

    target_order = item_in.order
    if target_order <= 0:
        max_order = db.query(func.max(BudgetItem.order)).filter(BudgetItem.budget_id == budget_id).scalar() or 0
        target_order = max_order + 1
    else:
        db.query(BudgetItem).filter(
            BudgetItem.budget_id == budget_id,
            BudgetItem.order >= target_order,
        ).update({BudgetItem.order: BudgetItem.order + 1})

    # 1. Crear el BudgetItem (excluir listas de insumos — no son columnas del modelo ORM)
    item_data = item_in.model_dump(exclude={"materials", "equipments", "labors"})
    item_data["order"] = target_order
    db_item = BudgetItem(**item_data, budget_id=budget_id)
    db.add(db_item)
    db.commit()
    db.refresh(db_item)

    # Si es capitulo, no requiere componentes APU
    if item_in.is_chapter:
        return db_item

    # 2. Guardar el APU en BudgetAPU
    # PRIORIDAD: Si el frontend envió insumos no vacíos (con factores aplicados), se usan directamente.
    # Si las listas vienen vacías o None, se copia desde el catálogo maestro/covenin de Cost360.
    has_custom_components = bool(
        (item_in.materials and len(item_in.materials) > 0)
        or (item_in.equipments and len(item_in.equipments) > 0)
        or (item_in.labors and len(item_in.labors) > 0)
    )

    if has_custom_components:
        # --- Ruta A: Frontend proveyó los insumos con factores o precios aplicados ---
        for mat in (item_in.materials or []):
            db_mat = DBMaterial(
                budget_item_id=db_item.id,
                codigo=mat.codigo,
                descripcion=mat.descripcion,
                unidad=mat.unidad,
                precio_unitario=mat.precio_unitario,
                cantidad=mat.cantidad,
                desperdicio=mat.desperdicio or 0.0,
            )
            db.add(db_mat)

        for eq in (item_in.equipments or []):
            db_eq = DBEquipment(
                budget_item_id=db_item.id,
                codigo=eq.codigo,
                descripcion=eq.descripcion,
                unidad=eq.unidad,
                precio_unitario=eq.precio_unitario,
                cantidad=eq.cantidad,
                depreciacion=eq.depreciacion or 1.0,
            )
            db.add(db_eq)

        for lab in (item_in.labors or []):
            db_lab = DBLabor(
                budget_item_id=db_item.id,
                codigo=lab.codigo,
                descripcion=lab.descripcion,
                jornal=lab.jornal,
                bono=lab.bono,
                cantidad=lab.cantidad,
            )
            db.add(db_lab)
    else:
        # --- Ruta B: Fallback — Copiar desde catálogo de Cost360 sin insumos vacíos ---
        cost_item = get_item_by_code_or_covpar(db, item_in.cod_par)
        if not cost_item and item_in.cov_par:
            cost_item = get_item_by_code_or_covpar(db, item_in.cov_par)

        if cost_item:
            for mat in cost_item.apu_materials:
                db_mat = DBMaterial(
                    budget_item_id=db_item.id,
                    codigo=mat.CodIns,
                    descripcion=mat.material.Descri if mat.material else "",
                    unidad=mat.material.UniMat if mat.material else "",
                    precio_unitario=(mat.material.CosMat if (mat.material and mat.material.CosMat is not None) else 0.0),
                    cantidad=mat.CanIns or 0.0,
                    desperdicio=mat.Desper or 0.0,
                )
                db.add(db_mat)

            for eq in cost_item.apu_equipments:
                precio_diario_depreciado = eq.equipment.CosDia if (eq.equipment and eq.equipment.CosDia is not None) else 0.0
                depreciacion = eq.Deprec if (eq.Deprec is not None and eq.Deprec > 0) else 1.0
                precio_adquisicion = precio_diario_depreciado / depreciacion if depreciacion > 0 else precio_diario_depreciado

                db_eq = DBEquipment(
                    budget_item_id=db_item.id,
                    codigo=eq.CodIns,
                    descripcion=eq.equipment.Descri if eq.equipment else "",
                    unidad="Día",
                    precio_unitario=precio_adquisicion,
                    cantidad=eq.CanIns or 0.0,
                    depreciacion=eq.Deprec or 1.0,
                )
                db.add(db_eq)

            for lab in cost_item.apu_labors:
                db_lab = DBLabor(
                    budget_item_id=db_item.id,
                    codigo=lab.CodIns,
                    descripcion=lab.labor.Descri if lab.labor else "",
                    jornal=(lab.labor.Jornal if (lab.labor and lab.labor.Jornal is not None) else 0.0),
                    bono=(lab.labor.Bono if (lab.labor and lab.labor.Bono is not None) else 0.0),
                    cantidad=lab.CanIns or 0.0,
                )
                db.add(db_lab)

            if cost_item.RenPar and cost_item.RenPar > 0 and db_item.performance == 1.0:
                db_item.performance = float(cost_item.RenPar)

    db.commit()
    db.refresh(db_item)
    return db_item


@router.delete("/{budget_id}/items/{item_id}")
def delete_item_from_budget(
    budget_id: str,
    item_id: str,
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_arko_admin),
) -> Dict[str, bool]:
    """Elimina una partida del presupuesto."""
    budget = get_budget_or_404(db, budget_id, current_user, for_write=True)

    item = db.query(BudgetItem).filter(BudgetItem.id == item_id, BudgetItem.budget_id == budget_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    db.delete(item)
    db.commit()
    return {"ok": True}


@router.post("/{budget_id}/items/reorder")
def reorder_budget_items(
    budget_id: str,
    item_ids: List[str],
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_arko_admin),
) -> Dict[str, bool]:
    """Reordena las partidas de un presupuesto segun el listado de IDs provisto."""
    budget = get_budget_or_404(db, budget_id, current_user, for_write=True)

    for index, item_id in enumerate(item_ids):
        db.query(BudgetItem).filter(
            BudgetItem.id == item_id,
            BudgetItem.budget_id == budget_id,
        ).update({BudgetItem.order: index + 1})

    db.commit()
    return {"ok": True}


@router.put("/{budget_id}/items/{item_id}", response_model=BudgetItemSchema)
def update_item_in_budget(
    budget_id: str,
    item_id: str,
    item_in: BudgetItemUpdate,
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_arko_admin),
) -> BudgetItem:
    """Actualiza una partida dentro de un presupuesto."""
    db_budget = get_budget_or_404(db, budget_id, current_user, for_write=True)

    db_item = db.query(BudgetItem).filter(BudgetItem.id == item_id, BudgetItem.budget_id == budget_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Item not found in budget")

    for key, value in item_in.model_dump(exclude_unset=True).items():
        setattr(db_item, key, value)

    db.commit()
    db.refresh(db_item)
    return db_item


@router.post("/{budget_id}/recalibrate-performances")
def recalibrate_budget(
    budget_id: str,
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_arko_admin),
) -> Dict[str, Any]:
    """Recalibra rendimientos de todas las partidas del presupuesto según COVENIN y cuadrillas reales."""
    if not budget_id or not isinstance(budget_id, str):
        raise HTTPException(status_code=400, detail="Identificador de presupuesto inválido.")

    db_budget = get_budget_or_404(db, budget_id, current_user, for_write=True)

    try:
        return recalibrate_budget_performances(budget_id, db, dry_run=False)
    except Exception as exc:
        logger.error("Error recalibrando rendimientos del presupuesto %s: %s", budget_id, exc, exc_info=True)
        raise HTTPException(status_code=500, detail="Error al recalibrar rendimientos.") from exc

