import json
import re
from sqlalchemy import create_engine, text

DATABASE_URL = "postgresql://apupro_user:apupro_password@apupro-db:5432/apupro_db"
engine = create_engine(DATABASE_URL)

missing = []

with engine.connect() as conn:
    valid_apu_query = "SELECT \"CodPar\" FROM cost360_items WHERE \"CovPar\" ~ '^[A-Za-z]{1,2}[\.\-]?[0-9\.]+$'"
    used_materials = f"SELECT \"CodIns\" FROM cost360_apu_materials WHERE \"CodPar\" IN ({valid_apu_query})"
    
    # Just select CodMat, Descri, and UniMat
    materials = conn.execute(text(f'''
        SELECT "CodMat", "Descri", "UniMat"
        FROM cost360_materials 
        WHERE "CodMat" IN ({used_materials})
    ''')).fetchall()
    
    for mat in materials:
        desc = (mat[1] or "").strip()
        if not re.search(r'\d', desc):
            missing.append({
                "Codigo": mat[0],
                "Descripcion": desc,
                "Unidad": mat[2]
            })

with open("missing_dims.json", "w", encoding="utf-8") as f:
    json.dump(missing, f)
