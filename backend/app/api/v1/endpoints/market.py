from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Dict, Any
from app.db.base import get_db
from app.services.ai_sanitization_service import sanitize_materials_batch
from app.services.rule_sanitizer import sanitize_batch_rules
from app.crud.crud_market import get_unsanitized_materials, apply_sanitization_batch
from app.db.models.market import Base
from app.db.base import engine

router = APIRouter()

@router.get("/upgrade-db")
def upgrade_db_endpoint():
    Base.metadata.create_all(bind=engine)
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE cost360_materials ADD COLUMN family_id VARCHAR"))
            conn.commit()
        except: pass
        try:
            conn.execute(text("ALTER TABLE cost360_materials ADD COLUMN market_indicator_id VARCHAR"))
            conn.commit()
        except: pass
        try:
            conn.execute(text("ALTER TABLE cost360_materials ADD COLUMN market_factor FLOAT DEFAULT 1.0"))
            conn.commit()
        except: pass
    return {"status": "Database upgraded successfully"}

from app.db.models.llm_provider import LLMProvider
from app.crud.llm import encrypt_api_key

@router.get("/update-key")
def update_key_endpoint(new_key: str, db: Session = Depends(get_db)):
    providers = db.query(LLMProvider).filter(LLMProvider.provider_key == "gemini").all()
    if not providers:
        provider = LLMProvider(
            provider_key="gemini",
            display_name="Google Gemini",
            model_name="gemini-3.6-flash",
            api_key_enc=encrypt_api_key(new_key),
            is_active=True,
            priority=1,
            use_case="all"
        )
        db.add(provider)
    else:
        for p in providers:
            p.api_key_enc = encrypt_api_key(new_key)
            p.model_name = "gemini-3.6-flash"  # Always update to latest
    db.commit()
    
    # Invalidate cache
    from app.services.llm_router import invalidate_llm_cache
    invalidate_llm_cache()
    
    return {"status": "API key updated"}

@router.post("/sanitize/batch")
def sanitize_batch(materials: List[Dict[str, str]], db: Session = Depends(get_db)):
    """
    Recibe un lote de materiales y devuelve propuesta IA con nombres limpios y familias.
    """
    if not materials:
        raise HTTPException(status_code=400, detail="El lote está vacío")
        
    result = sanitize_materials_batch(materials)
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
        
    return result

@router.post("/sanitize/rules")
def sanitize_batch_rules_endpoint(materials: List[Dict[str, str]], db: Session = Depends(get_db)):
    """
    Saneamiento sin IA - basado en reglas (gratuito, instantáneo).
    Limpia formato, mayúsculas, abreviaturas y detecta familias.
    """
    if not materials:
        raise HTTPException(status_code=400, detail="El lote está vacío")
    return sanitize_batch_rules(materials)

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

from pydantic import BaseModel
class LeaderPriceUpdate(BaseModel):
    leader_id: str
    new_price: float

@router.post("/update-leader-price")
def update_leader_price(payload: LeaderPriceUpdate, db: Session = Depends(get_db)):
    """
    Actualiza el precio de un Insumo Líder (Material Fuerte) y aplica en cascada
    la fórmula de dispersión (precio_hijo = precio_líder * factor) a toda su familia.
    """
    from app.db.models.cost360 import CostMaterial
    leader = db.query(CostMaterial).filter(CostMaterial.CodMat == payload.leader_id).first()
    if not leader:
        raise HTTPException(status_code=404, detail="Insumo líder no encontrado")
        
    leader.CosMat = payload.new_price
    
    children = db.query(CostMaterial).filter(CostMaterial.market_indicator_id == payload.leader_id).all()
    count = 0
    for child in children:
        if child.CodMat != payload.leader_id:
            factor = child.market_factor or 1.0
            child.CosMat = payload.new_price * factor
            count += 1
            
    db.commit()
    return {
        "status": "success", 
        "updated_children": count, 
        "leader_id": payload.leader_id, 
        "new_price": payload.new_price
    }


# Aquí irán los endpoints para el CRUD de Insumos Líderes (Web Scraping)
@router.get("/indicators")
def list_market_indicators(db: Session = Depends(get_db)):
    from app.db.models.cost360 import CostMaterial
    from sqlalchemy import func
    
    counts = db.query(CostMaterial.market_indicator_id, func.count(CostMaterial.CodMat)).group_by(CostMaterial.market_indicator_id).all()
    count_map = {c[0]: c[1] for c in counts if c[0]}
    
    indicator_ids = list(count_map.keys())
    if not indicator_ids:
        return {"items": []}
        
    leaders = db.query(CostMaterial).filter(CostMaterial.CodMat.in_(indicator_ids)).all()
    
    results = []
    for leader in leaders:
        results.append({
            "id": leader.CodMat,
            "description": leader.Descri,
            "price": leader.CosMat,
            "unit": leader.UniMat,
            "children_count": count_map.get(leader.CodMat, 0) - 1,
            "family_id": leader.family_id
        })
        
    # Sort by children count descending
    results.sort(key=lambda x: x["children_count"], reverse=True)
    return {"items": results}

@router.put("/indicators/{indicator_id}/apply")
def apply_market_indicator_prices(indicator_id: str, payload: LeaderPriceUpdate, db: Session = Depends(get_db)):
    # Redirigir al nuevo endpoint update_leader_price
    payload.leader_id = indicator_id
    return update_leader_price(payload, db)
