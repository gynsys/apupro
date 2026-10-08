from typing import Any, Dict
from sqlalchemy.orm import Session
from app.db.models.cost360 import (
    CostItem,
    CostAPUMaterial,
    CostAPUEquipment,
    CostAPULabor,
    CostMaterial,
    CostEquipment,
    CostLabor,
)


def fetch_base_apu_for_prompt(db: Session, codpar: str) -> Dict[str, Any]:
    """
    Recupera los datos completos del APU de una partida histórica para
    pasarlos al LLM como base de adaptación.
    """
    if not codpar or not isinstance(codpar, str):
        return {}

    item = db.query(CostItem).filter(CostItem.CodPar == codpar).first()
    if not item:
        return {}

    mat_rows = (
        db.query(CostAPUMaterial, CostMaterial)
        .join(CostMaterial, CostAPUMaterial.CodIns == CostMaterial.CodMat)
        .filter(CostAPUMaterial.CodPar == codpar)
        .all()
    )
    eq_rows = (
        db.query(CostAPUEquipment, CostEquipment)
        .join(CostEquipment, CostAPUEquipment.CodIns == CostEquipment.CodEqu)
        .filter(CostAPUEquipment.CodPar == codpar)
        .all()
    )
    mo_rows = (
        db.query(CostAPULabor, CostLabor)
        .join(CostLabor, CostAPULabor.CodIns == CostLabor.CodMan)
        .filter(CostAPULabor.CodPar == codpar)
        .all()
    )

    return {
        "codpar": item.CodPar,
        "covenin": item.CovPar,
        "descripcion": item.Descri,
        "unidad": item.UniPar,
        "rendimiento": item.RenPar or 1.0,
        "materiales": [
            {
                "codigo": mat.ref_code or mat.CodMat,
                "descripcion": mat.Descri,
                "unidad": mat.UniMat,
                "cantidad": rel.CanIns,
                "desperdicio": getattr(rel, "Desper", 0.0) or 0.0,
                "precio_unitario": mat.CosMat or 0.0,
            }
            for rel, mat in mat_rows
        ],
        "equipos": [
            {
                "codigo": eq.ref_code or eq.CodEqu,
                "descripcion": eq.Descri,
                "cantidad": rel.CanIns,
                "depreciacion": getattr(rel, "Deprec", 1.0) or 1.0,
                "precio_unitario": round(
                    eq.precio if (getattr(eq, "precio", None) is not None and eq.precio > 0)
                    else ((eq.CosDia or 0.0) / (getattr(rel, "Deprec", 1.0) or 1.0) if (getattr(rel, "Deprec", 1.0) or 1.0) > 0 else (eq.CosDia or 0.0)),
                    2
                ),
            }
            for rel, eq in eq_rows
        ],
        "mano_obra": [
            {
                "codigo": mo.ref_code or mo.CodMan,
                "descripcion": mo.Descri,
                "cantidad": rel.CanIns,
                "jornal": mo.Jornal or 0.0,
                "bono": mo.Bono or 0.0,
            }
            for rel, mo in mo_rows
            if mo.Descri and str(mo.Descri).lower() != "nan" and str(mo.CodMan).lower() != "nan" and not str(mo.CodMan).startswith("DESCRIPCION")
        ],
    }
