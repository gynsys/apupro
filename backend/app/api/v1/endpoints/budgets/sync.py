"""
Budget synchronization endpoints: Update unit prices from Cost360 master catalog.
"""
from typing import Dict

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.v1.endpoints.arko import get_current_arko_admin
from app.db.base import get_db
from app.db.models.arko import ArkoAdmin
from app.db.models.budget import Budget
from app.db.models.cost360 import CostEquipment, CostLabor, CostMaterial

router = APIRouter()


@router.post("/{budget_id}/sync_prices")
def sync_budget_prices(
    budget_id: str,
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_arko_admin),
) -> Dict[str, str]:
    """Sincroniza los precios de materiales, equipos y mano de obra con la base maestra de Cost360."""
    budget = db.query(Budget).filter(Budget.id == budget_id, Budget.user_id == str(current_user.id)).first()
    if not budget:
        raise HTTPException(status_code=404, detail="Presupuesto no encontrado")

    for item in budget.items:
        # Sincronizar Materiales
        for mat in item.materials:
            cost_mat = db.query(CostMaterial).filter(
                (CostMaterial.ref_code == mat.codigo) | (CostMaterial.CodMat == mat.codigo)
            ).first()
            if cost_mat:
                mat.precio_unitario = cost_mat.CosMat if cost_mat.CosMat is not None else 0.0
                mat.descripcion = cost_mat.Descri if cost_mat.Descri is not None else mat.descripcion

        # Sincronizar Equipos
        for eq in item.equipments:
            cost_eq = db.query(CostEquipment).filter(
                (CostEquipment.ref_code == eq.codigo) | (CostEquipment.CodEqu == eq.codigo)
            ).first()
            if cost_eq:
                eq.precio_unitario = cost_eq.CosDia if cost_eq.CosDia is not None else 0.0
                eq.descripcion = cost_eq.Descri if cost_eq.Descri is not None else eq.descripcion

        # Sincronizar Mano de Obra
        for lab in item.labors:
            cost_lab = db.query(CostLabor).filter(
                (CostLabor.ref_code == lab.codigo) | (CostLabor.CodMan == lab.codigo)
            ).first()
            if cost_lab:
                lab.jornal = cost_lab.Jornal if cost_lab.Jornal is not None else 0.0
                lab.bono = cost_lab.Bono if cost_lab.Bono is not None else 0.0
                lab.descripcion = cost_lab.Descri if cost_lab.Descri is not None else lab.descripcion

    db.commit()
    return {"status": "ok", "message": "Precios sincronizados con la Base Maestra"}
