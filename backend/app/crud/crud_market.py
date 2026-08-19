from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List, Dict, Any
from app.db.models.cost360 import CostMaterial
from app.db.models.market import CostMaterialFamily

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

def apply_sanitization_batch(db: Session, approved_items: List[Dict[str, Any]]):
    """
    Aplica los cambios aprobados a los materiales.
    """
    # 1. Asegurar que las familias existan o crearlas al vuelo
    families_cache = {}
    
    for item in approved_items:
        mat_code = item.get("original_code")
        clean_desc = item.get("clean_description")
        clean_unit = item.get("clean_unit")
        family_name = item.get("family")
        
        if not mat_code:
            continue
            
        # Buscar o crear familia
        family_id = None
        if family_name:
            fam_key = family_name.strip().upper()
            if fam_key not in families_cache:
                existing_fam = db.query(CostMaterialFamily).filter(CostMaterialFamily.name.ilike(family_name)).first()
                if not existing_fam:
                    import uuid
                    new_fam_id = "FAM-" + str(uuid.uuid4())[:8].upper()
                    new_fam = CostMaterialFamily(id=new_fam_id, name=family_name)
                    db.add(new_fam)
                    db.commit() # Commit para que exista la familia
                    families_cache[fam_key] = new_fam_id
                else:
                    families_cache[fam_key] = existing_fam.id
            
            family_id = families_cache[fam_key]

        # Actualizar material
        material = db.query(CostMaterial).filter(CostMaterial.CodMat == mat_code).first()
        if material:
            if clean_desc: material.Descri = clean_desc.upper()
            if clean_unit: material.UniMat = clean_unit.lower()
            if family_id: material.family_id = family_id

    db.commit()
    return {"status": "success", "processed": len(approved_items)}
