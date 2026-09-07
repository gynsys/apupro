import sys
import psycopg2

# Conexion a la base de datos
conn = psycopg2.connect("postgresql://apupro_user:apupro_password@localhost:5432/apupro_db")
cursor = conn.cursor()

# Codigos a buscar
codigos = ['EQU002', 'EQU-0022DD', 'EQU004', 'EQU-004053', 'EQU-007480', 'EQU008', 'EQU009', 'EQU-00BDB8', 'EQU-00D54A', 'EQU010']

query = "SELECT CodPar, Descri, PreUni FROM cost360_equipment WHERE CodPar IN %s ORDER BY CodPar"
cursor.execute(query, (tuple(codigos),))

resultados = cursor.fetchall()

print("Equipos encontrados en la base de datos:")
print("=" * 60)
for row in resultados:
    print(f"Codigo: {row[0]}")
    print(f"Descripcion: {row[1]}")
    print(f"Precio: {row[2]}")
    print("-" * 40)

print(f"Total encontrados: {len(resultados)}")

cursor.close()
conn.close()
