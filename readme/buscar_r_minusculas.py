import sys
import psycopg2

# Conexion a la base de datos
conn = psycopg2.connect("postgresql://apupro_user:apupro_password@localhost:5432/apupro_db")
cursor = conn.cursor()

# Buscar partidas de familia R que empiezan con minusculas
query = """
SELECT COUNT(*) as total 
FROM cost360_items 
WHERE CovPar LIKE 'R%' 
AND CovPar ~ '^[a-z]'
"""

cursor.execute(query)
resultado = cursor.fetchone()

print(f"Partidas de familia R que empiezan con minusculas: {resultado[0]}")

cursor.close()
conn.close()
