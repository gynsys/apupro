import sys
import psycopg2

print("=== ANALISIS DE BASE DE DATOS COSTBASE ===")

# Conexion a la base de datos
conn = psycopg2.connect("postgresql://apupro_user:apupro_password@localhost:5432/apupro_db")
cursor = conn.cursor()

# 1. Buscar partidas CovPar de familia R que empiezan con minusculas
print("\n1. Partidas CovPar de familia R que empiezan con minusculas:")
query1 = """
SELECT COUNT(*) 
FROM cost360_items 
WHERE CovPar LIKE 'R%' 
AND CovPar ~ '^[a-z]'
"""
cursor.execute(query1)
resultado1 = cursor.fetchone()
print(f"Total: {resultado1[0]}")

# 2. Buscar equipos de familia R para referencia del usuario
print("\n2. Ejemplo de equipos de familia R:")
query2 = """
SELECT CodPar, Descri, PreUni 
FROM cost360_equipment 
WHERE CodPar LIKE 'R%' 
LIMIT 5
"""
cursor.execute(query2)
resultados2 = cursor.fetchall()
for row in resultados2:
    print(f"Codigo: {row[0]}, Descripcion: {row[1]}, Precio: {row[2]}")

# 3. Contar total de equipos
print("\n3. Total de equipos en base de datos:")
query3 = "SELECT COUNT(*) FROM cost360_equipment"
cursor.execute(query3)
resultado3 = cursor.fetchone()
print(f"Total equipos: {resultado3[0]}")

# 4. Contar total de partidas
print("\n4. Total de partidas en base de datos:")
query4 = "SELECT COUNT(*) FROM cost360_items"
cursor.execute(query4)
resultado4 = cursor.fetchone()
print(f"Total partidas: {resultado4[0]}")

cursor.close()
conn.close()

print("\n=== FIN DEL ANALISIS ===")
