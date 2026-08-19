import pandas as pd
df = pd.read_excel('C:/Users/pablo/Desktop/insumos_familia.xlsx')
familias = df['Familia'].dropna().unique()
for f in sorted(familias):
    print(f)
