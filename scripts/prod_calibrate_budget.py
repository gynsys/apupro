import sys
import os

from app.db.session import SessionLocal
from app.db.models.budget import Budget, BudgetItem
from app.services.budget_postprocessor import recalibrate_budget_performances

def main():
    db = SessionLocal()
    try:
        # Find all budgets
        budgets = db.query(Budget).order_by(Budget.created_at.desc()).all()
        print(f"Total budgets found: {len(budgets)}")
        target_budget = None
        for b in budgets:
            items_count = db.query(BudgetItem).filter(BudgetItem.budget_id == b.id).count()
            print(f"- Budget ID: {b.id} | Name: {b.name} | Items: {items_count} | Created: {b.created_at}")
            if "HIGUEROTE" in (b.name or "").upper() or "COMPUTOS" in (b.name or "").upper() or items_count == 88:
                target_budget = b

        if not target_budget:
            if budgets:
                target_budget = budgets[0]
            else:
                print("No budgets in DB!")
                return

        print(f"\nTarget budget selected: {target_budget.id} ('{target_budget.name}')")
        
        # Rename to formal name if it was COMPUTOS METRICOS
        if target_budget.name == "COMPUTOS METRICOS":
            target_budget.name = "REHABILITACION DE AREAS INTERNAS Y EXTERNAS DEL CUARTEL DE BOMBEROS DEL AEROPUERTO NACIONAL DE HIGUEROTE, EDO MIRANDA"
            db.commit()
            print("Renamed budget to formal project title.")

        # Execute recalibration & material purge
        print("\nExecuting recalibrate_budget_performances(dry_run=False)...")
        result = recalibrate_budget_performances(target_budget.id, db, dry_run=False)
        print("\n=== RECALIBRATION RESULT ===")
        print(f"Budget ID: {result['budget_id']}")
        print(f"Budget Name: {result['budget_name']}")
        print(f"Total Items: {result['total_items']}")
        print(f"Updated Items: {result['updated_items']}")
        print(f"COVENIN Matched: {result['covenin_matched']}")
        print(f"Typology Calibrated: {result['typology_calibrated']}")
        print(f"Global Items: {result['global_items']}")
        print(f"Unchanged Items: {result['unchanged_items']}")
        print(f"Total Materials Purged: {result['total_materials_purged']}")
        print(f"Items with Purged Materials: {result['items_with_purged_materials']}")

        # Verify specific items
        sample_items = db.query(BudgetItem).filter(BudgetItem.budget_id == target_budget.id).order_by(BudgetItem.order).limit(10).all()
        print("\n=== SAMPLE ITEMS AFTER RECALIBRATION ===")
        for it in sample_items:
            mats_count = len(it.materials) if hasattr(it, "materials") else 0
            print(f"[{it.order}] {it.description[:55]}... | Unit: {it.unit} | Perf: {it.performance} | Mats: {mats_count}")

    except Exception as e:
        print(f"Error during recalibration: {e}", exc_info=True)
    finally:
        db.close()

if __name__ == "__main__":
    main()
