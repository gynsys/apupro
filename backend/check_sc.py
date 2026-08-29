import os
from sqlalchemy import create_engine, text

DATABASE_URL = "postgresql://apupro_user:apupro_password@apupro-db:5432/apupro_db"
engine = create_engine(DATABASE_URL)

with engine.connect() as conn:
    total = conn.execute(text("SELECT COUNT(*) FROM cost360_items")).scalar()
    
    # Cuántos NO tienen S/C
    valid_covpar = conn.execute(text("SELECT COUNT(*) FROM cost360_items WHERE \"CovPar\" NOT LIKE '%S/C%'")).scalar()
    print(f"Total Partidas: {total}")
    print(f"Partidas que NO tienen 'S/C' en el CovPar: {valid_covpar}")
    
    # Agrupadas por categoría
    cats = conn.execute(text("SELECT \"Categoria\", COUNT(*) FROM cost360_items WHERE \"CovPar\" NOT LIKE '%S/C%' GROUP BY \"Categoria\"")).fetchall()
    print("\nCategorias válidas (Sin S/C):")
    for row in cats:
        print(f"{row[0]}: {row[1]}")
        
    # Y cuántos materiales usan estas partidas?
    materials_in_valid = conn.execute(text("""
        SELECT COUNT(DISTINCT m."CodMat")
        FROM cost360_materials m
        JOIN cost360_apu_materials am ON m."CodMat" = am."CodIns"
        JOIN cost360_items i ON am."CodPar" = i."CodPar"
        WHERE i."CovPar" NOT LIKE '%S/C%'
    """)).scalar()
    print(f"\nMateriales usados en partidas válidas (Sin S/C): {materials_in_valid}")
    
    # Algunos de los basura
    print("\nEjemplo de partidas basura (Con S/C):")
    basura = conn.execute(text("SELECT \"CodPar\", \"CovPar\" FROM cost360_items WHERE \"CovPar\" LIKE '%S/C%' LIMIT 5")).fetchall()
    for row in basura:
        print(f"{row[0]} | {row[1]}")
