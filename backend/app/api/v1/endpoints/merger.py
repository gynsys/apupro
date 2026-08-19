from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.db.base import get_db
from app.db.models.cost360 import CostMaterial, CostEquipment, CostLabor
from app.db.models.cost360 import CostAPUMaterial, CostAPUEquipment, CostAPULabor

router = APIRouter()

class MergeRequest(BaseModel):
    old_code: str
    new_code: str
    item_type: str  # 'material', 'equipment', 'labor'

@router.get("/items/{item_type}/{code}")
def get_item_details(item_type: str, code: str, db: Session = Depends(get_db)):
    if item_type == "material":
        item = db.query(CostMaterial).filter(CostMaterial.CodMat == code).first()
        if not item:
            raise HTTPException(status_code=404, detail="Material no encontrado")
        return {"code": item.CodMat, "description": item.Descri, "price": item.CosMat, "unit": item.UniMat}
        
    elif item_type == "equipment":
        item = db.query(CostEquipment).filter(CostEquipment.CodEqu == code).first()
        if not item:
            raise HTTPException(status_code=404, detail="Equipo no encontrado")
        return {"code": item.CodEqu, "description": item.Descri, "price": item.CosDia, "unit": "DIA"}
        
    elif item_type == "labor":
        item = db.query(CostLabor).filter(CostLabor.CodMan == code).first()
        if not item:
            raise HTTPException(status_code=404, detail="Mano de obra no encontrada")
        return {"code": item.CodMan, "description": item.Descri, "price": item.CosDia, "unit": "DIA"}
        
    raise HTTPException(status_code=400, detail="Tipo de insumo inválido")


@router.post("/merge-items")
def merge_items(payload: MergeRequest, db: Session = Depends(get_db)):
    if payload.old_code == payload.new_code:
        raise HTTPException(status_code=400, detail="Los códigos no pueden ser iguales")
        
    if payload.item_type == "material":
        old_item = db.query(CostMaterial).filter(CostMaterial.CodMat == payload.old_code).first()
        new_item = db.query(CostMaterial).filter(CostMaterial.CodMat == payload.new_code).first()
        
        if not old_item or not new_item:
            raise HTTPException(status_code=404, detail="Uno de los materiales no existe")
            
        apus = db.query(CostAPUMaterial).filter(CostAPUMaterial.CodIns == payload.old_code).all()
        for apu in apus:
            existing = db.query(CostAPUMaterial).filter(
                CostAPUMaterial.CodPar == apu.CodPar,
                CostAPUMaterial.CodIns == payload.new_code
            ).first()
            if existing:
                existing.CanIns = (existing.CanIns or 0) + (apu.CanIns or 0)
                db.delete(apu)
            else:
                apu.CodIns = payload.new_code
                
        db.delete(old_item)
        
    elif payload.item_type == "equipment":
        old_item = db.query(CostEquipment).filter(CostEquipment.CodEqu == payload.old_code).first()
        new_item = db.query(CostEquipment).filter(CostEquipment.CodEqu == payload.new_code).first()
        
        if not old_item or not new_item:
            raise HTTPException(status_code=404, detail="Uno de los equipos no existe")
            
        apus = db.query(CostAPUEquipment).filter(CostAPUEquipment.CodIns == payload.old_code).all()
        for apu in apus:
            existing = db.query(CostAPUEquipment).filter(
                CostAPUEquipment.CodPar == apu.CodPar,
                CostAPUEquipment.CodIns == payload.new_code
            ).first()
            if existing:
                existing.CanIns = (existing.CanIns or 0) + (apu.CanIns or 0)
                db.delete(apu)
            else:
                apu.CodIns = payload.new_code
                
        db.delete(old_item)
        
    elif payload.item_type == "labor":
        old_item = db.query(CostLabor).filter(CostLabor.CodMan == payload.old_code).first()
        new_item = db.query(CostLabor).filter(CostLabor.CodMan == payload.new_code).first()
        
        if not old_item or not new_item:
            raise HTTPException(status_code=404, detail="Una de las manos de obra no existe")
            
        apus = db.query(CostAPULabor).filter(CostAPULabor.CodIns == payload.old_code).all()
        for apu in apus:
            existing = db.query(CostAPULabor).filter(
                CostAPULabor.CodPar == apu.CodPar,
                CostAPULabor.CodIns == payload.new_code
            ).first()
            if existing:
                existing.CanIns = (existing.CanIns or 0) + (apu.CanIns or 0)
                db.delete(apu)
            else:
                apu.CodIns = payload.new_code
                
        db.delete(old_item)
        
    else:
        raise HTTPException(status_code=400, detail="Tipo de insumo inválido")
        
    db.commit()
    return {"status": "success", "message": "Insumos unificados correctamente"}
