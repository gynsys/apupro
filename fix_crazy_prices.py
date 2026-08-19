import sys
from app.db.base import SessionLocal
from app.db.models.cost360 import CostMaterial

def fix_prices():
    db = SessionLocal()
    # Filter only materials starting with 'MAT'
    mats = db.query(CostMaterial).filter(CostMaterial.CodMat.like('MAT%')).all()
    
    suspects = []
    
    for m in mats:
        if m.CosMat is None:
            continue
            
        price_str = str(m.CosMat)
        is_suspect = False
        if "384615" in price_str or "692307" in price_str or "153846" in price_str or "923076" in price_str:
            is_suspect = True
        else:
            val_65 = m.CosMat * 65
            if abs(val_65 - round(val_65, 2)) < 0.0001 and len(price_str.split('.')[-1]) > 4:
                is_suspect = True
                
        if is_suspect:
            suspects.append(m)
            
    print(f"Total materiales con prefijo MAT analizados: {len(mats)}")
    print(f"Total a corregir (dividir entre 10): {len(suspects)}\n")
    
    # Apply correction
    count = 0
    for m in suspects:
        m.CosMat = m.CosMat / 10
        count += 1
        
    db.commit()
    db.close()
    
    print(f"=== ÉXITO: Se corrigió el precio de {count} materiales ===")

if __name__ == '__main__':
    fix_prices()
