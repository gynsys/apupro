import pandas as pd
df = pd.read_excel('partidas_M.xlsx', sheet_name='PARTIDAS-RRM')
count = 0
for idx, row in df.iterrows():
    cod = str(row['Unnamed: 2']).strip()
    if cod == 'M111110000':
        print(f"Item row: {row.to_dict()}")
        count += 1
        if count >= 1:
            break
