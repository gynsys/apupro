from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from app.db.session import get_db
from app.services.ai_sanitization_service import sanitize_materials_batch
from app.crud.crud_market import get_unsanitized_materials, apply_sanitization_batch

router = APIRouter()

@router.post("/sanitize/batch")
def sanitize_batch(materials: List[Dict[str, str]], db: Session = Depends(get_db)):
    """
    Recibe un lote de materiales [{code, description, unit}]
    y devuelve la propuesta de la IA con nombres limpios y familias asignadas.
    """
    if not materials:
        raise HTTPException(status_code=400, detail="El lote está vacío")
        
    result = sanitize_materials_batch(materials)
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
        
    return result

@router.get("/unsanitized")
def list_unsanitized(limit: int = 50, db: Session = Depends(get_db)):
    materials = get_unsanitized_materials(db, limit)
    return {
        "items": [
            {"code": m.CodMat, "description": m.Descri, "unit": m.UniMat}
            for m in materials
        ]
    }

@router.post("/sanitize/apply")
def apply_sanitization(approved_items: List[Dict[str, Any]], db: Session = Depends(get_db)):
    if not approved_items:
        raise HTTPException(status_code=400, detail="No hay items para aplicar")
    
    result = apply_sanitization_batch(db, approved_items)
    return result

# Aquí irán los endpoints para el CRUD de Insumos Líderes (Web Scraping)
@router.get("/indicators")
def list_market_indicators(db: Session = Depends(get_db)):
    # Placeholder for indicators logic
    return {"items": []}

@router.put("/indicators/{indicator_id}/apply")
def apply_market_indicator_prices(indicator_id: str, new_price: float, db: Session = Depends(get_db)):
    # Placeholder for cascade update logic
    return {"status": "success", "updated_count": 0}
