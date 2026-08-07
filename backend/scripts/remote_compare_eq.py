import json

# This script will be uploaded and run on the remote server
# We will use sqlalchemy to fetch all CodEqu from cost360_equipment

with open('excel_equipos.json', 'r') as f:
    excel_refs = set(json.load(f))

import sys
sys.path.append('/app')
from app.db.base import SessionLocal
from app.db.models.cost360 import CostEquipment

def compare():
    db = SessionLocal()
    try:
        db_equipments = db.query(CostEquipment.CodEqu).all()
        db_refs = set([e[0].strip() for e in db_equipments])
        
        print(f"DB_COUNT={len(db_refs)}")
        
        missing_in_db = excel_refs - db_refs
        missing_in_excel = db_refs - excel_refs
        
        print(f"MISSING_IN_DB={len(missing_in_db)}")
        print(f"MISSING_IN_EXCEL={len(missing_in_excel)}")
        
        if len(missing_in_db) > 0:
            print("Examples of codes in Excel but NOT in DB:")
            print(list(missing_in_db)[:5])
            
        if len(missing_in_excel) > 0:
            print("Examples of codes in DB but NOT in Excel:")
            print(list(missing_in_excel)[:5])
            
    finally:
        db.close()

if __name__ == "__main__":
    compare()
