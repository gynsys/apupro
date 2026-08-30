import os
from sqlalchemy import create_engine, text

DATABASE_URL = "postgresql://apupro_user:apupro_password@apupro-db:5432/apupro_db"
engine = create_engine(DATABASE_URL)

with engine.connect() as conn:
    print("Buscando material ELE901...")
    mat = conn.execute(text("SELECT \"CodMat\", \"Descri\" FROM cost360_materials WHERE \"CodMat\" = 'ELE901'")).fetchone()
    print(f"Material: {mat}")
    
    print("\nPartidas donde se usa:")
    query = text('''
        SELECT a."CodPar", i."Descri"
        FROM cost360_apu_materials a 
        JOIN cost360_items i ON a."CodPar" = i."CodPar" 
        WHERE a."CodIns" = 'ELE901'
    ''')
    rows = conn.execute(query).fetchall()
    for r in rows:
        print(f"CodPar: {r[0]} | Descri: {r[1]}")
