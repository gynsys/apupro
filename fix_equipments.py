import sys
from app.db.base import SessionLocal
from app.db.models.cost360 import CostEquipment

def fix_equipments():
    db = SessionLocal()
    equipments = db.query(CostEquipment).filter(CostEquipment.CodEqu.like('EQU%')).all()
    
    suspects = []
    
    for e in equipments:
        if e.CosDia is None:
            continue
            
        price_str = str(e.CosDia)
        is_suspect = False
        if "384615" in price_str or "692307" in price_str or "153846" in price_str or "923076" in price_str:
            is_suspect = True
        else:
            val_65 = e.CosDia * 65
            if abs(val_65 - round(val_65, 2)) < 0.0001 and len(price_str.split('.')[-1]) > 4:
                is_suspect = True
                
        if is_suspect:
            suspects.append(e)
            
    count = 0
    for e in suspects:
        e.CosDia = e.CosDia / 10
        count += 1
        
    db.commit()
    db.close()
    print(f"=== ÉXITO: Se corrigió el precio de {count} equipos ===")

if __name__ == '__main__':
    fix_equipments()
