import pandas as pd
df = pd.read_excel('partidas_M.xlsx', sheet_name='APUS-RRM')
col_main = 'ANALISIS DE PRECIO UNITARIO - Reparaciones, Reformas y Mejoras - (Marzo de 2025)'
count = 0
for idx, row in df.iterrows():
    col5 = str(row['Unnamed: 5']).strip()
    col6 = str(row['Unnamed: 6']).strip()
    if col5 == 'Código:':
        print(f"APU row: {row.to_dict()}")
        count += 1
        if count >= 1:
            break
