import pandas as pd
from sqlalchemy import create_engine, text

# Leer los MAT que deberían eliminarse
archivo_matr = "mat_triple_diferencia_20260825_073217.xlsx"
df_matr = pd.read_excel(archivo_matr)

codigos_a_eliminar = set(df_matr['codigo'].astype(str))
print(f"Códigos MAT a eliminar: {len(codigos_a_eliminar)}")

# Verificar cuántos existen en BD
engine = create_engine('postgresql://apupro_user:apupro_password@costbase.net:5440/apupro_db')
conn = engine.connect()

# Verificar MAT que existen
mat_existentes = []
for cod in codigos_a_eliminar:
    result = conn.execute(text('''
        SELECT "CodMat" FROM cost360_materials 
        WHERE "CodMat" = :cod
    '''), {"cod": cod}).fetchone()
    if result:
        mat_existentes.append(cod)

print(f"MAT que realmente existen en BD: {len(mat_existentes)}")
print(f"Primeros 10 MAT existentes: {mat_existentes[:10]}")

conn.close()
