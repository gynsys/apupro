import pandas as pd
import math

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
    excel_path = r'C:\Users\pablo\Desktop\partidas_M.xlsx'
    df_partidas = pd.read_excel(excel_path, sheet_name='Partidas')
    df_apus = pd.read_excel(excel_path, sheet_name='APUS-RRM')
    
    items_dict = {}
    print("Parsing Partidas...")
    for idx, row in df_partidas.iterrows():
        cod = str(row['Unnamed: 2']).strip()
        if cod.startswith('M'):
            cod = cod.replace('.', '')
            items_dict[cod] = {
                'Descri': str(row['Unnamed: 3']),
                'UniPar': str(row['Unnamed: 4']),
                'RenPar': get_float(row['Unnamed: 5'], 1.0),
                'PreUni': get_float(row['Unnamed: 6'], 0.0)
            }

    current_apu = None
    current_section = None
    
    materials = {}
    equipments = {}
    labors = {}
    
    apu_materials = []
    apu_equipments = []
    apu_labors = []
    
    col_main = 'ANALISIS DE PRECIO UNITARIO - Reparaciones, Reformas y Mejoras - (Marzo de 2025)'
    
    print("Parsing APUS-RRM...")
    for idx, row in df_apus.iterrows():
        col1 = str(row[col_main]).strip()
        col5 = str(row['Unnamed: 5']).strip()
        col6 = str(row['Unnamed: 6']).strip()
        
        if col5 == 'Código:':
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
                # If it's a material row
                if not (col1.startswith('Total') or col1.startswith('Unitario')):
                    materials[col1] = {
                        'Descri': str(row['Unnamed: 2']),
                        'UniMat': str(row['Unnamed: 3']),
                        'CosMat': get_float(row['Unnamed: 5'])
                    }
                    apu_materials.append((current_apu, col1, get_float(row['Unnamed: 4']), 0.0))
            elif current_section == 'EQUIPOS' and col1 != 'nan' and len(col1) > 2:
                if not (col1.startswith('Total') or col1.startswith('Unitario')):
                    equipments[col1] = {
                        'Descri': str(row['Unnamed: 2']),
                        'CosDia': get_float(row['Unnamed: 5'])
                    }
                    apu_equipments.append((current_apu, col1, get_float(row['Unnamed: 3']), get_float(row['Unnamed: 4'], 1.0)))
            elif current_section == 'MANO DE OBRA' and col1 != 'nan' and len(col1) > 2:
                if not (col1.startswith('Total') or col1.startswith('Sub') or col1.startswith('Unitario') or col1.startswith('Factor') or col1.startswith('Calculado') or col1.startswith('Uso') or col1.startswith('Bono')):
                    labors[col1] = {
                        'Descri': str(row['Unnamed: 2']),
                        'Jornal': get_float(row['Unnamed: 5']),
                        'Bono': 0.0
                    }
                    apu_labors.append((current_apu, col1, get_float(row['Unnamed: 3'])))
    
    print(f"Items: {len(items_dict)}")
    print(f"Materials: {len(materials)}")
    print(f"Equipments: {len(equipments)}")
    print(f"Labors: {len(labors)}")
    
    print("Writing SQL...")
    with open('import_m.sql', 'w', encoding='utf-8') as f:
        f.write("BEGIN;\n")
        
        for cod, data in items_dict.items():
            f.write(f"INSERT INTO temp_m_items (\"CodPar\", \"Descri\", \"CovPar\", \"UniPar\", \"PreUni\", \"RenPar\", \"Categoria\", \"TipoActividad\") VALUES ('{escape_sql(cod)}', '{escape_sql(data['Descri'])}', '{escape_sql(cod)}', '{escape_sql(data['UniPar'])}', {data['PreUni']}, {data['RenPar']}, 'M', 'Construcciones Menores') ON CONFLICT DO NOTHING;\n")
            
        for cod, data in materials.items():
            f.write(f"INSERT INTO temp_m_materials (\"CodMat\", \"Descri\", \"UniMat\", \"CosMat\") VALUES ('{escape_sql(cod)}', '{escape_sql(data['Descri'])}', '{escape_sql(data['UniMat'])}', {data['CosMat']}) ON CONFLICT DO NOTHING;\n")
            
        for cod, data in equipments.items():
            f.write(f"INSERT INTO temp_m_equipment (\"CodEqu\", \"Descri\", \"CosDia\") VALUES ('{escape_sql(cod)}', '{escape_sql(data['Descri'])}', {data['CosDia']}) ON CONFLICT DO NOTHING;\n")
            
        for cod, data in labors.items():
            f.write(f"INSERT INTO temp_m_labor (\"CodMan\", \"Descri\", \"Jornal\", \"Bono\") VALUES ('{escape_sql(cod)}', '{escape_sql(data['Descri'])}', {data['Jornal']}, {data['Bono']}) ON CONFLICT DO NOTHING;\n")
            
        for apu, mat, qty, desp in apu_materials:
            f.write(f"INSERT INTO temp_m_apu_materials (\"CodPar\", \"CodIns\", \"CanIns\", \"Desper\") VALUES ('{escape_sql(apu)}', '{escape_sql(mat)}', {qty}, {desp}) ON CONFLICT DO NOTHING;\n")
            
        for apu, eq, qty, deprec in apu_equipments:
            f.write(f"INSERT INTO temp_m_apu_equipment (\"CodPar\", \"CodIns\", \"CanIns\", \"Deprec\") VALUES ('{escape_sql(apu)}', '{escape_sql(eq)}', {qty}, {deprec}) ON CONFLICT DO NOTHING;\n")
            
        for apu, lab, qty in apu_labors:
            f.write(f"INSERT INTO temp_m_apu_labor (\"CodPar\", \"CodIns\", \"CanIns\") VALUES ('{escape_sql(apu)}', '{escape_sql(lab)}', {qty}) ON CONFLICT DO NOTHING;\n")
            
        f.write("COMMIT;\n")
        
    print("Done! SQL file written to import_m.sql")

if __name__ == '__main__':
    main()
