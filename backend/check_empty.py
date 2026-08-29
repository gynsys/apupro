import os
from sqlalchemy import create_engine, text

DATABASE_URL = "postgresql://apupro_user:apupro_password@apupro-db:5432/apupro_db"
engine = create_engine(DATABASE_URL)

with engine.connect() as conn:
    empty = conn.execute(text("SELECT COUNT(*) FROM cost360_items WHERE \"CovPar\" IS NULL OR TRIM(\"CovPar\") = ''")).scalar()
    print(f"Partidas con CovPar NULO o VACIO: {empty}")
    
    valid = conn.execute(text("SELECT COUNT(*) FROM cost360_items WHERE \"CovPar\" NOT LIKE '%S/C%' AND \"CovPar\" IS NOT NULL AND TRIM(\"CovPar\") != ''")).scalar()
    print(f"Partidas VALIDAS (Sin S/C y No Vacias): {valid}")
