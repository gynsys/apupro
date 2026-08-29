import os
from sqlalchemy import create_engine, text

DATABASE_URL = "postgresql://apupro_user:apupro_password@apupro-db:5432/apupro_db"
engine = create_engine(DATABASE_URL)

with engine.connect() as conn:
    # Partidas con 'SC' pero no 'S/C'
    sc_count = conn.execute(text("SELECT COUNT(*) FROM cost360_items WHERE \"CovPar\" LIKE '%SC%' AND \"CovPar\" NOT LIKE '%S/C%'")).scalar()
    print(f"Partidas con SC pero no S/C: {sc_count}")
    
    # Muestra algunas
    sc_items = conn.execute(text("SELECT \"CodPar\", \"CovPar\" FROM cost360_items WHERE \"CovPar\" LIKE '%SC%' AND \"CovPar\" NOT LIKE '%S/C%' LIMIT 10")).fetchall()
    for row in sc_items:
        print(row)
