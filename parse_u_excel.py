import pandas as pd
import math
import re

def normalize(text):
    if pd.isna(text): return ""
    return re.sub(r'[^a-z0-9]', '', str(text).lower())

def escape_sql(val):
    if pd.isna(val):
        return ""
    return str(val).replace("'", "''")

def get_float(val, default=0.0):
    try:
        if pd.isna(val): return default
        if isinstance(val, str):
            val = val.replace(',', '.')
        return float(val)
    except:
        return default

def main():
    print("Reading Excel...")
    excel_path = r'C:\Users\pablo\Desktop\Urbanismo.xlsx'
    df_partidas = pd.read_excel(excel_path, sheet_name='Partidas')
    df_apus = pd.read_excel(excel_path, sheet_name='APUS-URB')
    
    items_dict = {}
    print("Parsing Partidas...")
    for idx, row in df_partidas.iterrows():
        cod = str(row['Unnamed: 2']).strip()
        if cod.startswith('U'):
            cod = cod.replace('.', '')
            items_dict[cod] = {
                'Descri': str(row['Unnamed: 3']),
                'UniPar': str(row['Unnamed: 4']),
                'RenPar': get_float(row['Unnamed: 5'], 1.0),
                'PreUni': get_float(row['Unnamed: 6'], 0.0)
            }
            
    desc_to_code = {}
    for idx, row in df_partidas.iterrows():
        cod = str(row['Unnamed: 2']).strip()
        desc = normalize(row['Unnamed: 3'])
        if cod.startswith('U'):
            cod = cod.replace('.', '')
            if desc not in desc_to_code:
                desc_to_code[desc] = []
            desc_to_code[desc].append(cod)

    current_apu = None
    current_section = None
    
    materials = {}
    equipments = {}
    labors = {}
    
    apu_materials = []
    apu_equipments = []
    apu_labors = []
    
    col_main = 'ANALISIS DE PRECIO UNITARIO - Urbanismo - (Marzo de 2017)'
    
    print("Parsing APUS-URB...")
    for idx, row in df_apus.iterrows():
        col1 = str(row[col_main]).strip()
        col5 = str(row['Unnamed: 5']).strip()
        col6 = str(row['Unnamed: 6']).strip()
        
        if col5 == 'Código:':
            desc_norm = normalize(col1)
            if desc_norm in desc_to_code and desc_to_code[desc_norm]:
                current_apu = desc_to_code[desc_norm].pop(0)
            else:
                current_apu = col6.replace('.', '')
                
            current_section = None
            continue
            
        if col1 in ['MATERIALES', 'EQUIPOS', 'MANO DE OBRA']:
            current_section = col1
            continue
            
        if col1 == 'CODIGO' or not col1:
            continue
            
        if current_apu and current_section:
            if current_section == 'MATERIALES' and col1 != 'nan' and len(col1) > 2:
                if not (col1.startswith('Total') or col1.startswith('Unitario')):
                    descri = str(row['Unnamed: 2'])
                    if descri == 'nan': descri = col1
                    materials[col1] = {
                        'Descri': descri,
                        'UniMat': str(row['Unnamed: 3']),
                        'CosMat': get_float(row['Unnamed: 5'])
                    }
                    apu_materials.append((current_apu, col1, get_float(row['Unnamed: 4']), 0.0))
            elif current_section == 'EQUIPOS' and col1 != 'nan' and len(col1) > 2:
                if not (col1.startswith('Total') or col1.startswith('Unitario')):
                    descri_eq = str(row['Unnamed: 2'])
                    if descri_eq == 'nan': descri_eq = col1
                    equipments[col1] = {
                        'Descri': descri_eq,
                        'CosDia': get_float(row['Unnamed: 5'])
                    }
                    apu_equipments.append((current_apu, col1, get_float(row['Unnamed: 3']), get_float(row['Unnamed: 4'], 1.0)))
            elif current_section == 'MANO DE OBRA' and col1 != 'nan' and len(col1) > 2:
                if not (col1.startswith('Total') or col1.startswith('Sub') or col1.startswith('Unitario') or col1.startswith('Factor') or col1.startswith('Calculado') or col1.startswith('Uso') or col1.startswith('Bono')):
                    descri_lab = str(row['Unnamed: 2'])
                    if descri_lab == 'nan': descri_lab = col1
                    labors[col1] = {
                        'Descri': descri_lab,
                        'Jornal': get_float(row['Unnamed: 5']),
                        'Bono': 0.0
                    }
                    apu_labors.append((current_apu, col1, get_float(row['Unnamed: 3'])))
    
    print(f"Items: {len(items_dict)}")
    print(f"Materials: {len(materials)}")
    print(f"Equipments: {len(equipments)}")
    print(f"Labors: {len(labors)}")
    
    print("Writing SQL...")
    with open('import_u.sql', 'w', encoding='utf-8') as f:
        f.write("BEGIN;\n")
        
        for cod, data in items_dict.items():
            f.write(f"INSERT INTO temp_u_items (\"CodPar\", \"Descri\", \"CovPar\", \"UniPar\", \"PreUni\", \"RenPar\", \"Categoria\", \"TipoActividad\") VALUES ('{escape_sql(cod)}', '{escape_sql(data['Descri'])}', '{escape_sql(cod)}', '{escape_sql(data['UniPar'])}', {data['PreUni']}, {data['RenPar']}, 'U', 'Urbanismo') ON CONFLICT DO NOTHING;\n")
            
        for cod, data in materials.items():
            f.write(f"INSERT INTO temp_u_materials (\"CodMat\", \"Descri\", \"UniMat\", \"CosMat\") VALUES ('{escape_sql(cod)}', '{escape_sql(data['Descri'])}', '{escape_sql(data['UniMat'])}', {data['CosMat']}) ON CONFLICT DO NOTHING;\n")
            
        for cod, data in equipments.items():
            f.write(f"INSERT INTO temp_u_equipment (\"CodEqu\", \"Descri\", \"CosDia\") VALUES ('{escape_sql(cod)}', '{escape_sql(data['Descri'])}', {data['CosDia']}) ON CONFLICT DO NOTHING;\n")
            
        for cod, data in labors.items():
            f.write(f"INSERT INTO temp_u_labor (\"CodMan\", \"Descri\", \"Jornal\", \"Bono\") VALUES ('{escape_sql(cod)}', '{escape_sql(data['Descri'])}', {data['Jornal']}, {data['Bono']}) ON CONFLICT DO NOTHING;\n")
            
        for apu, mat, qty, desp in apu_materials:
            f.write(f"INSERT INTO temp_u_apu_materials (\"CodPar\", \"CodIns\", \"CanIns\", \"Desper\") VALUES ('{escape_sql(apu)}', '{escape_sql(mat)}', {qty}, {desp}) ON CONFLICT DO NOTHING;\n")
            
        for apu, eq, qty, deprec in apu_equipments:
            f.write(f"INSERT INTO temp_u_apu_equipment (\"CodPar\", \"CodIns\", \"CanIns\", \"Deprec\") VALUES ('{escape_sql(apu)}', '{escape_sql(eq)}', {qty}, {deprec}) ON CONFLICT DO NOTHING;\n")
            
        for apu, lab, qty in apu_labors:
            f.write(f"INSERT INTO temp_u_apu_labor (\"CodPar\", \"CodIns\", \"CanIns\") VALUES ('{escape_sql(apu)}', '{escape_sql(lab)}', {qty}) ON CONFLICT DO NOTHING;\n")
            
        f.write("COMMIT;\n")
        
    print("Done! SQL file written to import_u.sql")

if __name__ == '__main__':
    main()
