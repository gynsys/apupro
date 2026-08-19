from sqlalchemy import func
from app.db.base import SessionLocal
from app.db.models.cost360 import CostMaterial, CostAPUMaterial
from app.db.models.market import CostMaterialFamily

def main():
    print("=== CALCULANDO FACTORES DE DISPERSIÓN (OPTIMIZADO) ===")
    db = SessionLocal()
    
    familias = db.query(CostMaterialFamily).all()
    
    # Pre-calcular usages for all materials to avoid N+1 queries
    print("Pre-calculando usos de materiales...")
    usage_counts = dict(
        db.query(CostAPUMaterial.CodIns, func.count(CostAPUMaterial.CodPar))
        .group_by(CostAPUMaterial.CodIns)
        .all()
    )
    print(f"Usos pre-calculados para {len(usage_counts)} materiales.")
    
    total_updated = 0
    for fam in familias:
        materiales = db.query(CostMaterial).filter(CostMaterial.family_id == fam.id).all()
        if not materiales:
            continue
            
        print(f"\nFamilia: {fam.name} ({len(materiales)} materiales)")
        
        leader = None
        max_usages = -1
        max_price = -1
        
        for mat in materiales:
            usages = usage_counts.get(mat.CodMat, 0)
            if usages > max_usages or (usages == max_usages and (mat.CosMat or 0) > max_price):
                max_usages = usages
                max_price = mat.CosMat or 0
                leader = mat
                
        if not leader or (leader.CosMat or 0) == 0:
            print("  No se encontró un líder válido (precio > 0). Saltando...")
            continue
            
        print(f"  Líder: [{leader.CodMat}] {leader.Descri[:50]} (Usos: {max_usages}, Precio: ${leader.CosMat})")
        
        leader_price = leader.CosMat
        for mat in materiales:
            precio_hijo = mat.CosMat or 0
            factor = precio_hijo / leader_price
            
            mat.market_indicator_id = leader.CodMat
            mat.market_factor = factor
            total_updated += 1
            
    db.commit()
    db.close()
    
    print(f"\n=== FIN: Se calcularon y guardaron los factores para {total_updated} materiales. ===")

if __name__ == '__main__':
    main()
