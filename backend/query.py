import psycopg2
import pandas as pd

conn = psycopg2.connect('postgresql://apupro_user:apupro_password@localhost:5440/apupro_db')
cur = conn.cursor()
cur.execute("SELECT \"CodPar\", \"Descri\" FROM cost360_items WHERE \"Descri\" LIKE 'CONST%'")
items = cur.fetchall()
print(f"Encontrados {len(items)} items.")

cur.execute("SELECT \"CodMat\", \"Descri\" FROM cost360_materials WHERE \"Descri\" LIKE 'CONST%'")
mats = cur.fetchall()
print(f"Encontrados {len(mats)} materials.")

conn.close()
