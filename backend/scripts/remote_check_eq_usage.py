import json
import sys
sys.path.append('/app')
from app.db.base import SessionLocal
from app.db.models.cost360 import CostEquipment, CostAPUEquipment

def check_usage():
    with open('excel_equipos.json', 'r') as f:
        excel_refs = set(json.load(f))
        
    db = SessionLocal()
    try:
        db_equipments = db.query(CostEquipment.CodEqu).all()
        db_refs = set([e[0].strip() for e in db_equipments])
        
        missing_in_excel = list(db_refs - excel_refs)
        
        # Check if any of these 33 are used in APUs
        used_equipments = []
        for eq_code in missing_in_excel:
            count = db.query(CostAPUEquipment).filter(CostAPUEquipment.CodIns == eq_code).count()
            if count > 0:
                used_equipments.append((eq_code, count))
                
        print(f"Total sobrantes: {len(missing_in_excel)}")
        print(f"Sobrantes usados en APUs: {len(used_equipments)}")
        
        if len(used_equipments) > 0:
            print("Detalle de equipos sobrantes usados en APUs (Código -> En cuántos APU se usa):")
            for eq, count in sorted(used_equipments, key=lambda x: x[1], reverse=True):
                print(f"  {eq} se usa en {count} APUs")
        else:
            print("Ninguno de estos equipos sobrantes está siendo utilizado en ningún APU.")
            
    finally:
        db.close()

if __name__ == "__main__":
    check_usage()
