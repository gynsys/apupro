import sys
from app.db.base import SessionLocal
from app.db.models.cost360 import CostMaterial
import math

def analyze_prices():
    db = SessionLocal()
    mats = db.query(CostMaterial).all()
    
    suspects = []
    
    for m in mats:
        if m.CosMat is None:
            continue
            
        # Check if the price has the recurring 384615 decimal pattern
        price_str = str(m.CosMat)
        if "384615" in price_str or "692307" in price_str or "153846" in price_str or "923076" in price_str:
            suspects.append(m)
            continue
            
        # Alternatively, check if multiplying by 65 gives a clean 2-decimal number
        # Float precision can be tricky, so we check if the difference to round(val, 2) is very small
        val_65 = m.CosMat * 65
        if abs(val_65 - round(val_65, 2)) < 0.0001 and len(price_str.split('.')[-1]) > 4:
            if m not in suspects:
                suspects.append(m)
                
    print(f"Total materiales en BD: {len(mats)}")
    print(f"Total materiales sospechosos (posible error de /65 o factor x10): {len(suspects)}\n")
    
    print("--- MUESTRA DE 20 MATERIALES SOSPECHOSOS ---")
    print(f"{'CÓDIGO':<10} | {'DESCRIPCIÓN':<50} | {'PRECIO ACTUAL':<20} | {'PRECIO / 10':<20}")
    print("-" * 110)
    
    for m in suspects[:20]:
        price_div_10 = m.CosMat / 10
        print(f"{m.CodMat:<10} | {m.Descri[:48]:<50} | ${m.CosMat:<19.4f} | ${price_div_10:<19.4f}")
        
    db.close()

if __name__ == '__main__':
    analyze_prices()
