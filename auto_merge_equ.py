import sys
import difflib
from app.db.base import SessionLocal
from app.db.models.cost360 import CostEquipment, CostAPUEquipment

def merge_equipment():
    db = SessionLocal()
    
    # 1. Obtener equipos EQU
    equ_items = db.query(CostEquipment).filter(CostEquipment.CodEqu.like('EQU%')).all()
    
    # 2. Obtener equipos sanos (NO EQU)
    good_items = db.query(CostEquipment).filter(~CostEquipment.CodEqu.like('EQU%')).all()
    
    print(f"Buscando gemelos para {len(equ_items)} equipos EQU...")
    print(f"Candidatos sanos disponibles: {len(good_items)}")
    
    good_dict = {m.CodEqu: m.Descri.upper().strip() for m in good_items if m.Descri}
    
    merges_done = 0
    
    for equ in equ_items:
        if not equ.Descri:
            continue
            
        equ_desc = equ.Descri.upper().strip()
        best_match_code = None
        best_ratio = 0.0
        
        for good_code, good_desc in good_dict.items():
            ratio = difflib.SequenceMatcher(None, equ_desc, good_desc).ratio()
            if ratio > best_ratio:
                best_ratio = ratio
                best_match_code = good_code
                
        # 88% similarity threshold
        if best_ratio >= 0.88 and best_match_code:
            good_equ = db.query(CostEquipment).filter(CostEquipment.CodEqu == best_match_code).first()
            print(f"FUSIÓN EQU [{best_ratio*100:.1f}%]: {equ.CodEqu} ({equ_desc}) -> {good_equ.CodEqu} ({good_equ.Descri.upper()})")
            
            # 1. Mover todas las partidas al código bueno
            apus = db.query(CostAPUEquipment).filter(CostAPUEquipment.CodIns == equ.CodEqu).all()
            for apu in apus:
                existing = db.query(CostAPUEquipment).filter(
                    CostAPUEquipment.CodPar == apu.CodPar,
                    CostAPUEquipment.CodIns == good_equ.CodEqu
                ).first()
                
                if existing:
                    # Sumar cantidades
                    existing.CanIns = (existing.CanIns or 0) + (apu.CanIns or 0)
                    db.delete(apu)
                else:
                    # Cambiar código
                    apu.CodIns = good_equ.CodEqu
            
            # 2. Borrar el EQU
            db.delete(equ)
            db.commit()
            merges_done += 1

    db.close()
    print(f"=== ÉXITO: Se fusionaron y limpiaron {merges_done} equipos EQU ===")

if __name__ == '__main__':
    merge_equipment()
