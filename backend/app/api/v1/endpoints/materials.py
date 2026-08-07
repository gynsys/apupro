from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.db.arko_base import get_arko_db
from app.db.models.material import MaterialPrice
from app.schemas.material import MaterialPriceCreate, MaterialPriceUpdate, MaterialPriceResponse
from app.core.logging import logger

router = APIRouter()

@router.post("/", response_model=MaterialPriceResponse)
def create_material(material_in: MaterialPriceCreate, db: Session = Depends(get_arko_db)):
    try:
        db_material = db.query(MaterialPrice).filter(MaterialPrice.nombre == material_in.nombre).first()
        if db_material:
            raise HTTPException(status_code=400, detail="El material ya existe.")
        
        new_material = MaterialPrice(
            nombre=material_in.nombre,
            unidad=material_in.unidad,
            precio_usd=material_in.precio_usd
        )
        db.add(new_material)
        db.commit()
        db.refresh(new_material)
        return new_material
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error al crear material: {e}", exc_info=True)
        db.rollback()
        raise HTTPException(status_code=500, detail="Error interno al guardar los datos.")

@router.get("/", response_model=List[MaterialPriceResponse])
def get_materials(db: Session = Depends(get_arko_db)):
    try:
        materials = db.query(MaterialPrice).order_by(MaterialPrice.nombre).all()
        return materials
    except Exception as e:
        logger.error(f"Error al obtener materiales: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error interno.")

@router.put("/{material_id}", response_model=MaterialPriceResponse)
def update_material(material_id: int, material_in: MaterialPriceUpdate, db: Session = Depends(get_arko_db)):
    try:
        material = db.query(MaterialPrice).filter(MaterialPrice.id == material_id).first()
        if not material:
            raise HTTPException(status_code=404, detail="Material no encontrado.")
        
        # Check if name is taken by another material
        existing = db.query(MaterialPrice).filter(MaterialPrice.nombre == material_in.nombre).first()
        if existing and existing.id != material_id:
            raise HTTPException(status_code=400, detail="El nombre del material ya está en uso.")

        material.nombre = material_in.nombre
        material.unidad = material_in.unidad
        material.precio_usd = material_in.precio_usd
        
        db.commit()
        db.refresh(material)
        return material
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error al actualizar material {material_id}: {e}", exc_info=True)
        db.rollback()
        raise HTTPException(status_code=500, detail="Error interno.")

@router.delete("/{material_id}")
def delete_material(material_id: int, db: Session = Depends(get_arko_db)):
    try:
        material = db.query(MaterialPrice).filter(MaterialPrice.id == material_id).first()
        if not material:
            raise HTTPException(status_code=404, detail="Material no encontrado.")
        
        db.delete(material)
        db.commit()
        return {"ok": True, "message": "Material eliminado."}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error al eliminar material {material_id}: {e}", exc_info=True)
        db.rollback()
        raise HTTPException(status_code=500, detail="Error interno.")
