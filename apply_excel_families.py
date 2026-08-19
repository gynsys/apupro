import pandas as pd
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.db.base import SessionLocal
from app.db.models.cost360 import CostMaterial
from app.db.models.market import CostMaterialFamily
import uuid
import re

def main():
    print("=== ASIGNACIÓN DE FAMILIAS DESDE EXCEL ===")
    
    # 1. Leer Excel
    print("\n1. Leyendo Excel...")
    df = pd.read_excel('/app/insumos_familia.xlsx')
    
    db = SessionLocal()
    
    # 2. Crear familias del Excel en BD
    print("\n2. Sincronizando Familias en BD...")
    excel_familias = df['Familia'].dropna().unique()
    family_map = {} # Nombre Excel -> ID Familia en BD
    
    for fam_name in excel_familias:
        fam_name = fam_name.strip()
        db_fam = db.query(CostMaterialFamily).filter(CostMaterialFamily.name == fam_name).first()
        if not db_fam:
            new_id = "FAM-" + str(uuid.uuid4())[:8].upper()
            db_fam = CostMaterialFamily(id=new_id, name=fam_name)
            db.add(db_fam)
            db.commit()
        family_map[fam_name] = db_fam.id
        
    print(f"  {len(family_map)} familias sincronizadas.")
    
    # 3. Asignar familia a los materiales del Excel
    print("\n3. Asignando familias a materiales del Excel...")
    updated_excel = 0
    excel_codmats = set()
    for _, row in df.iterrows():
        cod = str(row['Referencia'])
        fam = str(row['Familia']).strip()
        if pd.notnull(fam) and fam != 'nan':
            excel_codmats.add(cod)
            mat = db.query(CostMaterial).filter(CostMaterial.CodMat == cod).first()
            if mat:
                mat.family_id = family_map[fam]
                updated_excel += 1
    db.commit()
    print(f"  {updated_excel} materiales del Excel actualizados.")
    
    # 4. Reglas para asignar a los materiales nuevos
    print("\n4. Categorizando materiales nuevos...")
    # Crear un diccionario de palabras clave por familia del Excel basado en los datos del Excel
    keywords_by_family = {}
    for fam in excel_familias:
        fam_desc = ' '.join(df[df['Familia'] == fam]['Descripción'].dropna().astype(str).tolist()).upper()
        # Extract 10 most common words in this family (naive tf)
        words = re.findall(r'\b[A-Z]{4,}\b', fam_desc)
        from collections import Counter
        common = [w for w, c in Counter(words).most_common(15) if w not in ('PARA', 'TIPO', 'CONCRETO', 'ACERO', 'CABLE', 'TUBO')] 
        keywords_by_family[fam] = common
    
    # Materiales sin familia (o que no están en excel_codmats)
    nuevos = db.query(CostMaterial).filter(CostMaterial.family_id == None).all()
    if not nuevos:
        nuevos = [m for m in db.query(CostMaterial).all() if m.CodMat not in excel_codmats]
        
    print(f"  {len(nuevos)} materiales por categorizar.")
    categorizados = 0
    
    for mat in nuevos:
        if not mat.Descri: continue
        desc = mat.Descri.upper()
        best_fam = None
        best_score = 0
        for fam, kws in keywords_by_family.items():
            score = sum(1 for kw in kws if kw in desc)
            if score > best_score:
                best_score = score
                best_fam = fam
        
        if best_fam and best_score > 0:
            mat.family_id = family_map[best_fam]
            categorizados += 1
    
    db.commit()
    print(f"  {categorizados} materiales nuevos categorizados exitosamente.")
    
    db.close()
    print("\n=== FIN ASIGNACIÓN ===")

if __name__ == '__main__':
    main()
