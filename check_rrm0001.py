import pandas as pd

df = pd.read_excel('partidas_M.xlsx', sheet_name='APUS-RRM')
col_main = 'ANALISIS DE PRECIO UNITARIO - Reparaciones, Reformas y Mejoras - (Marzo de 2025)'

in_rrm0001 = False
for idx, row in df.iterrows():
    col6 = str(row['Unnamed: 6']).strip()
    col5 = str(row['Unnamed: 5']).strip()
    
    if col5 == 'Código:':
        if col6 == 'RRM0001':
            in_rrm0001 = True
            print("FOUND RRM0001")
        else:
            if in_rrm0001:
                break
    
    if in_rrm0001:
        print(f"Row: {row.to_dict()}")
