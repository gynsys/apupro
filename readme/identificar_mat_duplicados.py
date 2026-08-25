import pandas as pd
from sqlalchemy import create_engine, text

# Leer los MATR
archivo_matr = "mat_triple_diferencia_20260825_073217.xlsx"
df_matr = pd.read_excel(archivo_matr)

# Mapeo MAT -> MATR
mapeo_matr = {}
for cod in df_matr['codigo'].astype(str):
    cod_matr = cod.replace('MAT', 'MATR')
    mapeo_matr[cod] = cod_matr

print(f"Mapeo MAT -> MATR: {len(mapeo_matr)}")

# Verificar qué MAT originales existen actualmente
engine = create_engine('postgresql://apupro_user:apupro_password@costbase.net:5440/apupro_db')
conn = engine.connect()

mat_existen = []
for cod_mat in mapeo_matr.keys():
    result = conn.execute(text('''
        SELECT "CodMat" FROM cost360_materials 
        WHERE "CodMat" = :cod_mat
    '''), {"cod_mat": cod_mat}).fetchone()
    if result:
        mat_existen.append(cod_mat)

print(f"MAT originales que existen actualmente: {len(mat_existen)}")
print(f"Primeros 10 MAT existentes: {mat_existen[:10]}")

conn.close()
