import sys
import difflib
from app.db.base import SessionLocal
from app.db.models.cost360 import CostLabor, CostAPULabor

def merge_labor():
    db = SessionLocal()
    
    # 1. Obtener la mano de obra MOB
    mob_items = db.query(CostLabor).filter(CostLabor.CodMan.like('MOB%')).all()
    
    # 2. Obtener insumos sanos (Cualquiera que NO sea MOB)
    good_items = db.query(CostLabor).filter(~CostLabor.CodMan.like('MOB%')).all()
    
    print(f"Buscando gemelos para {len(mob_items)} insumos MOB...")
    print(f"Candidatos sanos disponibles (NO MOB): {len(good_items)}")
    
    good_dict = {m.CodMan: m.Descri.upper().strip() for m in good_items if m.Descri}
    
    merges_done = 0
    
    for mob in mob_items:
        if not mob.Descri:
            continue
            
        mob_desc = mob.Descri.upper().strip()
        best_match_code = None
        best_ratio = 0.0
        
        for good_code, good_desc in good_dict.items():
            ratio = difflib.SequenceMatcher(None, mob_desc, good_desc).ratio()
            if ratio > best_ratio:
                best_ratio = ratio
                best_match_code = good_code
                
        # 88% similarity threshold
        if best_ratio >= 0.88 and best_match_code:
            good_labor = db.query(CostLabor).filter(CostLabor.CodMan == best_match_code).first()
            print(f"FUSIÓN MOB [{best_ratio*100:.1f}%]: {mob.CodMan} ({mob_desc}) -> {good_labor.CodMan} ({good_labor.Descri.upper()})")
            
            # 1. Mover todas las partidas al código bueno
            apus = db.query(CostAPULabor).filter(CostAPULabor.CodIns == mob.CodMan).all()
            for apu in apus:
                existing = db.query(CostAPULabor).filter(
                    CostAPULabor.CodPar == apu.CodPar,
                    CostAPULabor.CodIns == good_labor.CodMan
                ).first()
                
                if existing:
                    # Sumar cantidades
                    existing.CanIns = (existing.CanIns or 0) + (apu.CanIns or 0)
                    db.delete(apu)
                else:
                    # Cambiar código
                    apu.CodIns = good_labor.CodMan
            
            # 2. Borrar el MOB
            db.delete(mob)
            db.commit()
            merges_done += 1

    db.close()
    print(f"=== ÉXITO: Se fusionaron y limpiaron {merges_done} insumos MOB ===")

if __name__ == '__main__':
    merge_labor()
