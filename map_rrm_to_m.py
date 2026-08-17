import pandas as pd
import re

def normalize(text):
    if pd.isna(text): return ""
    # remove all non-alphanumeric characters and convert to lowercase
    return re.sub(r'[^a-z0-9]', '', str(text).lower())

def main():
    excel_path = 'partidas_M.xlsx'
    df_partidas = pd.read_excel(excel_path, sheet_name='Partidas')
    
    desc_to_code = {}
    for idx, row in df_partidas.iterrows():
        cod = str(row['Unnamed: 2']).strip()
        desc = normalize(row['Unnamed: 3'])
        if cod.startswith('M'):
            cod = cod.replace('.', '')
            if desc not in desc_to_code:
                desc_to_code[desc] = []
            desc_to_code[desc].append(cod)
            
    df_apus = pd.read_excel(excel_path, sheet_name='APUS-RRM')
    col_main = 'ANALISIS DE PRECIO UNITARIO - Reparaciones, Reformas y Mejoras - (Marzo de 2025)'
    
    rrm_to_m = {}
    missing_desc = []
    
    for idx, row in df_apus.iterrows():
        col1 = normalize(row[col_main])
        col5 = str(row['Unnamed: 5']).strip()
        col6 = str(row['Unnamed: 6']).strip()
        
        if col5 == 'Código:':
            rrm_code = col6.replace('.', '')
            desc = col1
            if desc in desc_to_code:
                # If there are multiple, just pick the first one for now
                rrm_to_m[rrm_code] = desc_to_code[desc][0]
            else:
                missing_desc.append(desc)
                
    print(f"Mapped {len(rrm_to_m)} APUs.")
    if missing_desc:
        print(f"Missing descriptions: {len(missing_desc)}")
        print(missing_desc[:5])
        
if __name__ == '__main__':
    main()
