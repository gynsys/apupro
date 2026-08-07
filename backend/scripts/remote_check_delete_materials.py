import json
import sys
sys.path.append('/app')
from app.db.base import SessionLocal
from app.db.models.cost360 import CostMaterial, CostAPUMaterial

def check_and_delete_materials():
    with open('excel_materials.json', 'r', encoding='utf-8') as f:
        excel_data = json.load(f)
        
    db = SessionLocal()
    try:
        db_materials = db.query(CostMaterial).all()
        db_refs = set([m.CodMat.strip() for m in db_materials])
        excel_refs = set([m['code'] for m in excel_data])
        
        missing_in_excel = list(db_refs - excel_refs)
        
        used_materials = []
        unused_materials = []
        
        for mat_code in missing_in_excel:
            count = db.query(CostAPUMaterial).filter(CostAPUMaterial.CodIns == mat_code).count()
            if count > 0:
                used_materials.append((mat_code, count))
            else:
                unused_materials.append(mat_code)
                
        print(f"Total sobrantes: {len(missing_in_excel)}")
        print(f"Sobrantes usados en APUs: {len(used_materials)}")
        print(f"Sobrantes NO usados (se eliminarán): {len(unused_materials)}")
        
        if len(used_materials) > 0:
            print("\nDetalle de materiales sobrantes usados en APUs (Código -> En cuántos APU se usa):")
            for mat, count in sorted(used_materials, key=lambda x: x[1], reverse=True):
                print(f"  {mat} se usa en {count} APUs")
                
        if len(unused_materials) > 0:
            print(f"\nEliminando {len(unused_materials)} materiales sin uso...")
            deleted_count = 0
            for mat_code in unused_materials:
                mat = db.query(CostMaterial).filter(CostMaterial.CodMat == mat_code).first()
                if mat:
                    db.delete(mat)
                    deleted_count += 1
            db.commit()
            print(f"¡Se han eliminado {deleted_count} materiales exitosamente!")
            
    except Exception as e:
        print(f"ERROR: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    check_and_delete_materials()
