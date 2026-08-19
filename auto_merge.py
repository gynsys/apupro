import sys
import difflib
from app.db.base import SessionLocal
from app.db.models.cost360 import CostMaterial, CostAPUMaterial

def merge_items():
    db = SessionLocal()
    
    # 1. Obtener los insumos MAT
    mat_items = db.query(CostMaterial).filter(CostMaterial.CodMat.like('MAT%')).all()
    # 2. Obtener insumos sanos (NO MAT)
    good_items = db.query(CostMaterial).filter(~CostMaterial.CodMat.like('MAT%')).all()
    
    print(f"Buscando gemelos para {len(mat_items)} insumos MAT...")
    
    # Pre-procesar nombres para hacer la búsqueda más rápida
    good_dict = {m.CodMat: m.Descri.upper().strip() for m in good_items if m.Descri}
    
    merges_done = 0
    
    for mat in mat_items:
        if not mat.Descri:
            continue
            
        mat_desc = mat.Descri.upper().strip()
        best_match_code = None
        best_ratio = 0.0
        
        for good_code, good_desc in good_dict.items():
            # Comparación rápida de ratio
            ratio = difflib.SequenceMatcher(None, mat_desc, good_desc).ratio()
            if ratio > best_ratio:
                best_ratio = ratio
                best_match_code = good_code
                
        # Si la similitud es mayor al 88%, lo consideramos el mismo material
        if best_ratio >= 0.88 and best_match_code:
            good_mat = db.query(CostMaterial).filter(CostMaterial.CodMat == best_match_code).first()
            print(f"FUSIÓN [{best_ratio*100:.1f}%]: {mat.CodMat} ({mat_desc}) -> {good_mat.CodMat} ({good_mat.Descri.upper()})")
            
            # 1. Mover todas las partidas al código bueno
            apus = db.query(CostAPUMaterial).filter(CostAPUMaterial.CodIns == mat.CodMat).all()
            for apu in apus:
                # Verificar si el APU ya tiene el insumo bueno
                existing = db.query(CostAPUMaterial).filter(
                    CostAPUMaterial.CodPar == apu.CodPar,
                    CostAPUMaterial.CodIns == good_mat.CodMat
                ).first()
                
                if existing:
                    # Sumar cantidades
                    existing.CanIns = (existing.CanIns or 0) + (apu.CanIns or 0)
                    db.delete(apu)
                else:
                    # Cambiar código
                    apu.CodIns = good_mat.CodMat
            
            # 2. Borrar el MAT
            db.delete(mat)
            db.commit()
            merges_done += 1

    db.close()
    print(f"=== ÉXITO: Se fusionaron y limpiaron {merges_done} insumos MAT ===")

if __name__ == '__main__':
    merge_items()
