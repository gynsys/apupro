import json
import sys
sys.path.append('/app')
from app.db.base import SessionLocal
from app.db.models.cost360 import CostMaterial

def check_materials():
    with open('excel_materials.json', 'r', encoding='utf-8') as f:
        excel_data = json.load(f)
        
    db = SessionLocal()
    try:
        db_materials = db.query(CostMaterial).all()
        db_dict = {m.CodMat.strip(): m for m in db_materials}
        
        matches = 0
        desc_mismatches = []
        cost_mismatches = []
        missing_in_db = []
        
        for excel_mat in excel_data:
            code = excel_mat['code']
            if code not in db_dict:
                missing_in_db.append(code)
                continue
                
            db_mat = db_dict[code]
            
            # Check price
            excel_cost = round(excel_mat['price'], 2)
            db_cost = round(db_mat.CosMat if db_mat.CosMat else 0.0, 2)
            
            if excel_cost != db_cost:
                cost_mismatches.append({
                    'code': code,
                    'excel_cost': excel_cost,
                    'db_cost': db_cost
                })
            else:
                matches += 1
                
            # Optionally check description (might have minor differences, just count them)
            excel_desc = excel_mat['desc'].strip().lower()
            db_desc = db_mat.Descri.strip().lower() if db_mat.Descri else ""
            if excel_desc != db_desc:
                desc_mismatches.append(code)
                
        db_codes = set(db_dict.keys())
        excel_codes = set([m['code'] for m in excel_data])
        missing_in_excel = list(db_codes - excel_codes)
        
        print("=== MATERIAL COMPARISON RESULTS ===")
        print(f"Total in Excel: {len(excel_data)}")
        print(f"Total in DB: {len(db_materials)}")
        print(f"Missing in DB (in Excel but not in DB): {len(missing_in_db)}")
        print(f"Missing in Excel (in DB but not in Excel): {len(missing_in_excel)}")
        print(f"Cost Matches: {matches}")
        print(f"Cost Mismatches: {len(cost_mismatches)}")
        print(f"Description Mismatches (string comparison): {len(desc_mismatches)}")
        
        if len(cost_mismatches) > 0:
            print("\nExamples of Cost Mismatches:")
            print(cost_mismatches[:5])
            
        if len(missing_in_excel) > 0:
            print("\nExamples of Missing in Excel (Extra in DB):")
            print(missing_in_excel[:5])
            
    finally:
        db.close()

if __name__ == "__main__":
    check_materials()
