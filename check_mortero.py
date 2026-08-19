import sys
from app.db.base import SessionLocal
from app.db.models.cost360 import CostMaterial, CostAPUMaterial
from sqlalchemy import func

def main():
    db = SessionLocal()
    # Find the material
    mortero = db.query(CostMaterial).filter(CostMaterial.Descri.ilike("%MORTERO DE CEMENTO-ARENA 1:3%")).first()
    if not mortero:
        print("Mortero no encontrado")
        return
        
    family_id = mortero.family_id
    print(f"Familia del mortero: {family_id}")
    
    # Get all materials in that family
    mats = db.query(CostMaterial).filter(CostMaterial.family_id == family_id).all()
    
    # Get usage counts
    usage_counts = dict(
        db.query(CostAPUMaterial.CodIns, func.count(CostAPUMaterial.CodPar))
        .filter(CostAPUMaterial.CodIns.in_([m.CodMat for m in mats]))
        .group_by(CostAPUMaterial.CodIns)
        .all()
    )
    
    # Sort materials by usage
    mats_sorted = sorted(mats, key=lambda m: usage_counts.get(m.CodMat, 0), reverse=True)
    
    print("\nTop 15 candidatos para líder en esta familia:")
    for m in mats_sorted[:15]:
        print(f" - [{m.CodMat}] {m.Descri[:60]} (Usos: {usage_counts.get(m.CodMat, 0)}) (Precio: {m.CosMat})")
        
    db.close()

if __name__ == '__main__':
    main()
