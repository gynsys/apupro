import pandas as pd
from sqlalchemy import create_engine, text

# Leer los MATR
archivo_matr = "mat_triple_diferencia_20260825_073217.xlsx"
df_matr = pd.read_excel(archivo_matr)

# Mapeo MAT -> MATR
codigos_matr = set()
for cod in df_matr['codigo'].astype(str):
    cod_matr = cod.replace('MAT', 'MATR')
    codigos_matr.add(cod_matr)

print(f"Códigos MATR a verificar: {len(codigos_matr)}")

# Verificar referencias en partidas
engine = create_engine('postgresql://apupro_user:apupro_password@costbase.net:5440/apupro_db')
conn = engine.connect()

matr_con_referencias = []
matr_sin_referencias = []

for cod_matr in codigos_matr:
    result = conn.execute(text('''
        SELECT COUNT(*) FROM cost360_apu_materials 
        WHERE "CodIns" = :cod_matr
    '''), {"cod_matr": cod_matr}).scalar()
    
    if result > 0:
        matr_con_referencias.append((cod_matr, result))
    else:
        matr_sin_referencias.append(cod_matr)

print(f"MATR con referencias: {len(matr_con_referencias)}")
print(f"MATR sin referencias: {len(matr_sin_referencias)}")

if matr_con_referencias:
    print(f"\nMATR con referencias (ejemplos):")
    for cod, count in matr_con_referencias[:10]:
        print(f"  {cod}: {count} referencias")

conn.close()
