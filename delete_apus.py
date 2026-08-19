from app.db.base import SessionLocal
from app.db.models.cost360 import CostItem, CostAPUMaterial, CostAPULabor, CostAPUEquipment

TARGETS = ["M111510000"]

db = SessionLocal()
for cod in TARGETS:
    item = db.query(CostItem).filter(CostItem.CodPar == cod).first()
    if item:
        mat_del = db.query(CostAPUMaterial).filter(CostAPUMaterial.CodPar == cod).delete()
        lab_del = db.query(CostAPULabor).filter(CostAPULabor.CodPar == cod).delete()
        eq_del = db.query(CostAPUEquipment).filter(CostAPUEquipment.CodPar == cod).delete()
        db.delete(item)
        print(f"Deleted APU {cod}")
db.commit()
db.close()
