import json
import sys
sys.path.append('/app')
from app.db.base import SessionLocal
from app.db.models.cost360 import CostEquipment, CostAPUEquipment

def process_equipments():
    with open('excel_equipos_costs.json', 'r') as f:
        excel_data = json.load(f)
        
    db = SessionLocal()
    try:
        # 1. Compare costs
        db_equipments = db.query(CostEquipment).all()
        
        mismatches = []
        matches = 0
        
        for eq in db_equipments:
            code = eq.CodEqu.strip()
            if code in excel_data:
                excel_cost = excel_data[code]
                db_cost = eq.CosDia if eq.CosDia else 0.0
                
                # Compare rounded to 2 decimals
                if round(excel_cost, 2) != round(db_cost, 2):
                    mismatches.append({
                        'code': code,
                        'excel_cost': excel_cost,
                        'db_cost': db_cost
                    })
                else:
                    matches += 1
                    
        print(f"Cost Comparison:")
        print(f"Matches: {matches}")
        print(f"Mismatches: {len(mismatches)}")
        if mismatches:
            print(f"First 5 mismatches: {mismatches[:5]}")
            
        # 2. Delete the 13 unused equipments
        excel_refs = set(excel_data.keys())
        db_refs = set([e.CodEqu.strip() for e in db_equipments])
        missing_in_excel = list(db_refs - excel_refs)
        
        to_delete = []
        for eq_code in missing_in_excel:
            count = db.query(CostAPUEquipment).filter(CostAPUEquipment.CodIns == eq_code).count()
            if count == 0:
                to_delete.append(eq_code)
                
        print(f"\nDeleting {len(to_delete)} unused equipments...")
        deleted_count = 0
        for eq_code in to_delete:
            eq = db.query(CostEquipment).filter(CostEquipment.CodEqu == eq_code).first()
            if eq:
                db.delete(eq)
                deleted_count += 1
                
        db.commit()
        print(f"Successfully deleted {deleted_count} unused equipments.")
        
    except Exception as e:
        print(f"ERROR: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    process_equipments()
