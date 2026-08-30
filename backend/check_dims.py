import os
from sqlalchemy import create_engine, text
import re

DATABASE_URL = "postgresql://apupro_user:apupro_password@apupro-db:5432/apupro_db"
engine = create_engine(DATABASE_URL)

with engine.connect() as conn:
    # Obtener materiales válidos
    valid_apu_query = "SELECT \"CodPar\" FROM cost360_items WHERE \"CovPar\" ~ '^[A-Za-z]{1,2}[\.\-]?[0-9\.]+$'"
    used_materials = f"SELECT \"CodIns\" FROM cost360_apu_materials WHERE \"CodPar\" IN ({valid_apu_query})"
    
    query = text(f"SELECT \"CodMat\", \"Descri\" FROM cost360_materials WHERE \"CodMat\" IN ({used_materials})")
    materials = conn.execute(query).fetchall()
    
    missing_dimension = []
    
    # regex to check if description has numbers that might be dimensions (digits + ", mm, cm, plg, m, kg)
    # Actually, let's just check if it has ANY digits.
    for mat in materials:
        desc = mat[1].lower()
        if not re.search(r'\d', desc):
            missing_dimension.append(mat)
            
    print(f"Total de materiales validos: {len(materials)}")
    print(f"Materiales sin CUALQUIER NÚMERO en la descripcion: {len(missing_dimension)}")
    
    print("\nEjemplos:")
    for m in missing_dimension[:10]:
        print(f"{m[0]}: {m[1]}")
