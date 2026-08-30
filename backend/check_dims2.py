import json
from sqlalchemy import create_engine, text
import re

DATABASE_URL = "postgresql://apupro_user:apupro_password@apupro-db:5432/apupro_db"
engine = create_engine(DATABASE_URL)

missing = []

with engine.connect() as conn:
    valid_apu_query = "SELECT \"CodPar\" FROM cost360_items WHERE \"CovPar\" ~ '^[A-Za-z]{1,2}[\.\-]?[0-9\.]+$'"
    used_materials = f"SELECT \"CodIns\" FROM cost360_apu_materials WHERE \"CodPar\" IN ({valid_apu_query})"
    
    materials = conn.execute(text(f"SELECT \"CodMat\", \"Descri\" FROM cost360_materials WHERE \"CodMat\" IN ({used_materials})")).fetchall()
    
    for mat in materials:
        desc = mat[1].lower()
        if not re.search(r'\d', desc):
            missing.append(mat[0])

    print(f"Total missing: {len(missing)}")
    
    if len(missing) > 0:
        query = text('''
            SELECT a."CodIns", a."CodPar", i."Descri"
            FROM cost360_apu_materials a 
            JOIN cost360_items i ON a."CodPar" = i."CodPar" 
            WHERE a."CodIns" IN :cods
        ''')
        # solo los primeros 100
        rows = conn.execute(query, {"cods": tuple(missing[:100])}).fetchall()
        
        extracted = {}
        for r in rows:
            mat_cod = r[0]
            apu_desc = r[2]
            
            # Simple regex to find dimensions like "2 PLG (51 MM)" or "2 PLG" or "E= 1/2""
            match = re.search(r'(DIAMETRO[^\.]*|E=\s*[^,\.]*|\d+\s*/\s*\d+\s*PLG|\d+\s*PLG)', apu_desc, re.IGNORECASE)
            if match:
                if mat_cod not in extracted:
                    extracted[mat_cod] = set()
                extracted[mat_cod].add(match.group(1).strip())
                
        for k, v in list(extracted.items())[:20]:
            print(f"{k}: {v}")
