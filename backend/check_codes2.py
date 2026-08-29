import os
from sqlalchemy import create_engine, text

DATABASE_URL = "postgresql://apupro_user:apupro_password@apupro-db:5432/apupro_db"
engine = create_engine(DATABASE_URL)

with engine.connect() as conn:
    # Cuántos tienen CovPar válido (Letra + 9 numeros)
    valid_covpar = conn.execute(text("SELECT COUNT(*) FROM cost360_items WHERE \"CovPar\" ~ '^[a-zA-Z][0-9]{9}$'")).scalar()
    print(f"Partidas con CovPar valido (Letra + 9 numeros): {valid_covpar}")
    
    # Y si agrupamos por Categorias?
    cats = conn.execute(text("SELECT \"Categoria\", COUNT(*) FROM cost360_items WHERE \"CovPar\" ~ '^[a-zA-Z][0-9]{9}$' GROUP BY \"Categoria\"")).fetchall()
    print("\nCategorias de las válidas:")
    for row in cats:
        print(f"{row[0]}: {row[1]}")
    
    # Que pasa con el resto? Muestra algunos CovPar
    rest = conn.execute(text("SELECT \"CodPar\", \"CovPar\", \"Descri\" FROM cost360_items WHERE \"CovPar\" !~ '^[a-zA-Z][0-9]{9}$' LIMIT 10")).fetchall()
    print("\nEjemplos de Partidas NO validas por CovPar:")
    for row in rest:
        print(f"CodPar: {row[0]}, CovPar: {row[1]}, Descri: {row[2][:30]}...")
