import pandas as pd

excel_path = r'C:\Users\pablo\Desktop\partidas_M.xlsx'
df = pd.read_excel(excel_path, sheet_name='Partidas')

print("Partidas that contain M.111.110.000:")
for idx, row in df.iterrows():
    cod = str(row['Unnamed: 2']).strip()
    if '111110000' in cod.replace('.', ''):
        print(f"Row {idx}: {cod} - {row['Unnamed: 3']}")
