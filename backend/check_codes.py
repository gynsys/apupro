import os
from sqlalchemy import create_engine, text

DATABASE_URL = "postgresql://apupro_user:apupro_password@apupro-db:5432/apupro_db"
engine = create_engine(DATABASE_URL)

with engine.connect() as conn:
    # Muestra algunos códigos
    result = conn.execute(text("SELECT \"CodPar\", \"CovPar\" FROM cost360_items LIMIT 20")).fetchall()
    print("Muestra de códigos:")
    for row in result:
        print(f"CodPar: {row[0]}, CovPar: {row[1]}")
        
    # Cuenta las partidas con CovPar no nulo
    with_covpar = conn.execute(text("SELECT COUNT(*) FROM cost360_items WHERE \"CovPar\" IS NOT NULL AND \"CovPar\" != ''")).scalar()
    print(f"\nTotal APUs con CovPar asignado: {with_covpar}")
    
    # Intenta ver qué formato tienen
    format1 = conn.execute(text("SELECT COUNT(*) FROM cost360_items WHERE \"CodPar\" ~ '^[A-Z][0-9]+$'")).scalar()
    print(f"CodPar que son Letra + Numeros (cualquier cantidad): {format1}")
    
    format2 = conn.execute(text("SELECT COUNT(*) FROM cost360_items WHERE \"CodPar\" ~ '^[0-9]+$'")).scalar()
    print(f"CodPar que son solo Numeros: {format2}")
    
    format3 = conn.execute(text("SELECT COUNT(*) FROM cost360_items WHERE \"CodPar\" LIKE '%-%'")).scalar()
    print(f"CodPar con guiones: {format3}")
    
    # Cuántos tienen la Letra + 9 numeros
    exact_covenin = conn.execute(text("SELECT COUNT(*) FROM cost360_items WHERE \"CodPar\" ~ '^[a-zA-Z][0-9]{9}$'")).scalar()
    print(f"CodPar Letra + 9 numeros: {exact_covenin}")
    
    # Categoria distribution
    cats = conn.execute(text("SELECT \"Categoria\", COUNT(*) FROM cost360_items GROUP BY \"Categoria\"")).fetchall()
    print("\nCategorias:")
    for row in cats:
        print(f"{row[0]}: {row[1]}")
