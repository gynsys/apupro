"""
APU component endpoints: Add, update, and delete materials, equipment, and labor inside budget items.
"""
from typing import Dict

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.v1.endpoints.arko import get_current_arko_admin
from app.db.base import get_db
from app.db.models.arko import ArkoAdmin
from app.db.models.budget import (
    BudgetAPUEquipment as DBEquipment,
    BudgetAPULabor as DBLabor,
    BudgetAPUMaterial as DBMaterial,
    BudgetItem,
)
from app.schemas.budget import (
    BudgetAPUEquipment,
    BudgetAPUEquipmentBase,
    BudgetAPUEquipmentUpdate,
    BudgetAPULabor,
    BudgetAPULaborBase,
    BudgetAPULaborUpdate,
    BudgetAPUMaterial,
    BudgetAPUMaterialBase,
    BudgetAPUMaterialUpdate,
)

router = APIRouter()


# ---------------------------------------------------------------------------
# Materials
# ---------------------------------------------------------------------------

@router.post(
    "/{budget_id}/items/{item_id}/materials",
    response_model=BudgetAPUMaterial,
    status_code=status.HTTP_201_CREATED,
)
def add_material_to_item(
    budget_id: str,
    item_id: str,
    material_in: BudgetAPUMaterialBase,
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_arko_admin),
) -> DBMaterial:
    """Agrega un material al APU de la partida."""
    db_item = db.query(BudgetItem).filter(BudgetItem.id == item_id, BudgetItem.budget_id == budget_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Item not found")

    db_material = DBMaterial(
        budget_item_id=item_id,
        **material_in.model_dump(),
    )
    db.add(db_material)
    db.commit()
    db.refresh(db_material)
    return db_material


@router.put(
    "/{budget_id}/items/{item_id}/materials/{component_id}",
    response_model=BudgetAPUMaterial,
)
def update_material_in_item(
    budget_id: str,
    item_id: str,
    component_id: str,
    comp_in: BudgetAPUMaterialUpdate,
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_arko_admin),
) -> DBMaterial:
    """Actualiza un material del APU."""
    comp = db.query(DBMaterial).filter(DBMaterial.id == component_id, DBMaterial.budget_item_id == item_id).first()
    if not comp:
        raise HTTPException(status_code=404, detail="Material not found")

    for key, value in comp_in.model_dump(exclude_unset=True).items():
        setattr(comp, key, value)

    db.commit()
    db.refresh(comp)
    return comp


@router.delete("/{budget_id}/items/{item_id}/materials/{component_id}")
def delete_material_from_item(
    budget_id: str,
    item_id: str,
    component_id: str,
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_arko_admin),
) -> Dict[str, bool]:
    """Elimina un material del APU."""
    comp = db.query(DBMaterial).filter(DBMaterial.id == component_id, DBMaterial.budget_item_id == item_id).first()
    if not comp:
        raise HTTPException(status_code=404, detail="Material not found")
    db.delete(comp)
    db.commit()
    return {"ok": True}


# ---------------------------------------------------------------------------
# Equipment
# ---------------------------------------------------------------------------

@router.post(
    "/{budget_id}/items/{item_id}/equipments",
    response_model=BudgetAPUEquipment,
    status_code=status.HTTP_201_CREATED,
)
def add_equipment_to_item(
    budget_id: str,
    item_id: str,
    equipment_in: BudgetAPUEquipmentBase,
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_arko_admin),
) -> DBEquipment:
    """Agrega un equipo al APU de la partida."""
    db_item = db.query(BudgetItem).filter(BudgetItem.id == item_id, BudgetItem.budget_id == budget_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Item not found")

    db_equipment = DBEquipment(
        budget_item_id=item_id,
        **equipment_in.model_dump(),
    )
    db.add(db_equipment)
    db.commit()
    db.refresh(db_equipment)
    return db_equipment


@router.put(
    "/{budget_id}/items/{item_id}/equipments/{component_id}",
    response_model=BudgetAPUEquipment,
)
def update_equipment_in_item(
    budget_id: str,
    item_id: str,
    component_id: str,
    comp_in: BudgetAPUEquipmentUpdate,
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_arko_admin),
) -> DBEquipment:
    """Actualiza un equipo del APU."""
    comp = db.query(DBEquipment).filter(DBEquipment.id == component_id, DBEquipment.budget_item_id == item_id).first()
    if not comp:
        raise HTTPException(status_code=404, detail="Equipment not found")

    for key, value in comp_in.model_dump(exclude_unset=True).items():
        setattr(comp, key, value)

    db.commit()
    db.refresh(comp)
    return comp


@router.delete("/{budget_id}/items/{item_id}/equipments/{component_id}")
def delete_equipment_from_item(
    budget_id: str,
    item_id: str,
    component_id: str,
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_arko_admin),
) -> Dict[str, bool]:
    """Elimina un equipo del APU."""
    comp = db.query(DBEquipment).filter(DBEquipment.id == component_id, DBEquipment.budget_item_id == item_id).first()
    if not comp:
        raise HTTPException(status_code=404, detail="Equipment not found")
    db.delete(comp)
    db.commit()
    return {"ok": True}


# ---------------------------------------------------------------------------
# Labor
# ---------------------------------------------------------------------------

@router.post(
    "/{budget_id}/items/{item_id}/labors",
    response_model=BudgetAPULabor,
    status_code=status.HTTP_201_CREATED,
)
def add_labor_to_item(
    budget_id: str,
    item_id: str,
    labor_in: BudgetAPULaborBase,
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_arko_admin),
) -> DBLabor:
    """Agrega una labor (mano de obra) al APU de la partida."""
    db_item = db.query(BudgetItem).filter(BudgetItem.id == item_id, BudgetItem.budget_id == budget_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Item not found")

    db_labor = DBLabor(
        budget_item_id=item_id,
        **labor_in.model_dump(),
    )
    db.add(db_labor)
    db.commit()
    db.refresh(db_labor)
    return db_labor


@router.put(
    "/{budget_id}/items/{item_id}/labors/{component_id}",
    response_model=BudgetAPULabor,
)
def update_labor_in_item(
    budget_id: str,
    item_id: str,
    component_id: str,
    comp_in: BudgetAPULaborUpdate,
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_arko_admin),
) -> DBLabor:
    """Actualiza una labor del APU."""
    comp = db.query(DBLabor).filter(DBLabor.id == component_id, DBLabor.budget_item_id == item_id).first()
    if not comp:
        raise HTTPException(status_code=404, detail="Labor not found")

    for key, value in comp_in.model_dump(exclude_unset=True).items():
        setattr(comp, key, value)

    db.commit()
    db.refresh(comp)
    return comp


@router.delete("/{budget_id}/items/{item_id}/labors/{component_id}")
def delete_labor_from_item(
    budget_id: str,
    item_id: str,
    component_id: str,
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_arko_admin),
) -> Dict[str, bool]:
    """Elimina una labor del APU."""
    comp = db.query(DBLabor).filter(DBLabor.id == component_id, DBLabor.budget_item_id == item_id).first()
    if not comp:
        raise HTTPException(status_code=404, detail="Labor not found")
    db.delete(comp)
    db.commit()
    return {"ok": True}
