import sys
from app.db.base import SessionLocal
from app.db.models.cost360 import CostEquipment

def check_equipments():
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
            
    print(f"Total equipos con prefijo EQU analizados: {len(equipments)}")
    print(f"Total equipos sospechosos (posible error de /65): {len(suspects)}\n")
    
    if suspects:
        print("--- MUESTRA DE EQUIPOS SOSPECHOSOS ---")
        print(f"{'CÓDIGO':<10} | {'DESCRIPCIÓN':<50} | {'PRECIO ACTUAL':<20} | {'PRECIO / 10':<20}")
        print("-" * 110)
        
        for e in suspects[:20]:
            price_div_10 = e.CosDia / 10
            print(f"{e.CodEqu:<10} | {e.Descri[:48]:<50} | ${e.CosDia:<19.4f} | ${price_div_10:<19.4f}")
            
    db.close()

if __name__ == '__main__':
    check_equipments()
