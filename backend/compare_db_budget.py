import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

from app.db.base import SessionLocal
from app.db.models.budget import Budget, BudgetItem, BudgetAPUMaterial, BudgetAPUEquipment, BudgetAPULabor

db = SessionLocal()

# Find the 88 items budget
b = db.query(Budget).filter(Budget.id == '0efa568a-ec0d-4714-b0c5-cf0fde507b33').first()
if not b:
    b = db.query(Budget).filter(Budget.id == 'dc7d17bd-415c-4a02-9feb-1645e714cda8').first()

print(f"Budget ID: {b.id}")
print(f"Name: {b.name}")
print(f"Currency: {b.currency}")
print(f"FCAS %: {b.fcas_percent}")
print(f"Admin %: {b.admin_percent}")
print(f"Profit %: {b.profit_percent}")
print(f"IVA %: {b.iva_percent}")
print(f"Labor Bonus: {b.labor_bonus}")
print(f"Bono in FCAS: {b.bono_in_fcas}")

items = db.query(BudgetItem).filter(BudgetItem.budget_id == b.id).order_by(BudgetItem.order).all()
print(f"Total items in DB: {len(items)}")

for it in items[:5]:
    mats = db.query(BudgetAPUMaterial).filter(BudgetAPUMaterial.budget_item_id == it.id).all()
    eqs = db.query(BudgetAPUEquipment).filter(BudgetAPUEquipment.budget_item_id == it.id).all()
    labs = db.query(BudgetAPULabor).filter(BudgetAPULabor.budget_item_id == it.id).all()
    
    print(f"\nItem #{it.order}: {it.cod_par} - {it.description[:40]}")
    print(f"  Qty: {it.quantity}, Unit: {it.unit}, Perf: {it.performance}")
    print(f"  Materials ({len(mats)}): {[(m.descripcion[:20], m.cantidad, m.precio_unitario) for m in mats[:2]]}")
    print(f"  Equipments ({len(eqs)}): {[(e.descripcion[:20], e.cantidad, e.precio_unitario, e.depreciacion) for e in eqs[:2]]}")
    print(f"  Labors ({len(labs)}): {[(l.descripcion[:20], l.cantidad, l.jornal, l.bono) for l in labs[:2]]}")
