from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List, Dict, Any
from app.db.models.cost360 import CostMaterial
from app.db.models.market import CostMaterialFamily
from app.core.logging import logger

def get_unsanitized_materials(db: Session, limit: int = 50):
    """
    Obtiene materiales que aún no han sido asignados a una familia
    o no tienen una descripción limpia.
    """
    return db.query(CostMaterial).filter(
        or_(
            CostMaterial.family_id == None,
            CostMaterial.family_id == ""
        )
    ).limit(limit).all()

def apply_sanitization_batch(db: Session, approved_items: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Aplica los cambios aprobados a los materiales en la BD.
    - Actualiza descripción limpia
    - Crea familia si no existe y la asigna
    - Marca material como saneado (family_id != None)
    """
    families_cache: Dict[str, str] = {}
    processed = 0
    skipped = 0
    
    for item in approved_items:
        mat_code = item.get("original_code") or item.get("id")
        clean_desc = item.get("clean_description") or item.get("clean")
        clean_unit = item.get("clean_unit")
        family_name = item.get("family", "GENERAL")
        
        if not mat_code:
            skipped += 1
            continue
            
        # Buscar o crear familia
        family_id = None
        if family_name:
            fam_key = family_name.strip().upper()
            if fam_key not in families_cache:
                try:
                    existing_fam = db.query(CostMaterialFamily).filter(
                        CostMaterialFamily.name.ilike(family_name)
                    ).first()
                    if not existing_fam:
                        import uuid
                        new_fam_id = "FAM-" + str(uuid.uuid4())[:8].upper()
                        new_fam = CostMaterialFamily(id=new_fam_id, name=family_name)
                        db.add(new_fam)
                        db.flush()  # flush instead of commit to keep atomicity
                        families_cache[fam_key] = new_fam_id
                    else:
                        families_cache[fam_key] = existing_fam.id
                except Exception as e:
                    logger.error(f"Error creating family '{family_name}': {e}", exc_info=True)
                    db.rollback()
                    continue
            
            family_id = families_cache.get(fam_key)

        # Actualizar material
        material = db.query(CostMaterial).filter(CostMaterial.CodMat == mat_code).first()
        if material:
            if clean_desc:
                material.Descri = clean_desc.upper()  # BD siempre en mayúsculas
            if clean_unit:
                material.UniMat = clean_unit.lower()
            if family_id:
                material.family_id = family_id
            processed += 1
        else:
            logger.warning(f"Material not found: {mat_code}")
            skipped += 1

    try:
        db.commit()
    except Exception as e:
        logger.error("Error committing sanitization batch", exc_info=True)
        db.rollback()
        return {"status": "error", "detail": str(e)}
    
    return {"status": "success", "processed": processed, "skipped": skipped}
