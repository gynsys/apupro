import sys
from app.db.base import SessionLocal
from app.db.models.cost360 import CostMaterial, CostAPUMaterial
from sqlalchemy import func

def search_materials(keyword):
    db = SessionLocal()
    print(f"\n--- Buscando: {keyword} ---")
    mats = db.query(CostMaterial).filter(CostMaterial.Descri.ilike(f"%{keyword}%")).all()
    
    usage_counts = dict(
        db.query(CostAPUMaterial.CodIns, func.count(CostAPUMaterial.CodPar))
        .filter(CostAPUMaterial.CodIns.in_([m.CodMat for m in mats]))
        .group_by(CostAPUMaterial.CodIns)
        .all()
    )
    
    for m in mats:
        print(f"[{m.CodMat}] {m.Descri[:60]} | Unidad: {m.UniMat} | Precio: ${m.CosMat} | Usos: {usage_counts.get(m.CodMat, 0)}")
    db.close()

if __name__ == '__main__':
    search_materials("BALASTO")
