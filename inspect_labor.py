import pandas as pd

excel_path = r'C:\Users\pablo\Desktop\Urbanismo.xlsx'
df = pd.read_excel(excel_path, sheet_name='APUS-URB')
col_main = 'ANALISIS DE PRECIO UNITARIO - Urbanismo - (Marzo de 2017)'

# Find MANO DE OBRA rows and see what col1 looks like
in_labor = False
count = 0
for idx, row in df.iterrows():
    col1 = str(row[col_main]).strip()
    if col1 == 'MANO DE OBRA':
        in_labor = True
        count = 0
        continue
    if col1 in ['MATERIALES', 'EQUIPOS']:
        in_labor = False
        continue
    if in_labor and count < 8:
        c2 = str(row['Unnamed: 2'])
        c3 = str(row['Unnamed: 3'])
        c5 = str(row['Unnamed: 5'])
        print(f"col1=[{col1}] col2=[{c2}] col3=[{c3}] col5=[{c5}]")
        count += 1
    if count >= 8:
        break
