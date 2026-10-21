from app.db.session import SessionLocal
from app.db.models.budget import BudgetItem

def main():
    db = SessionLocal()
    try:
        budget_id = 'dc7d17bd-415c-4a02-9feb-1645e714cda8'
        items = db.query(BudgetItem).filter(BudgetItem.budget_id == budget_id).order_by(BudgetItem.order).all()
        for it in items:
            print(f"[{it.order:02d}] cod={it.cod_par} | cov={it.cov_par} | u={it.unit} | perf={it.performance} | mats={len(it.materials)} | desc={it.description[:50]}")
    finally:
        db.close()

if __name__ == "__main__":
    main()
