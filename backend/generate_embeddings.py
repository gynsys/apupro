"""
Script que se ejecuta DENTRO del contenedor apupro-backend.
Lee todas las partidas de cost360_items (todos los schemas),
genera embeddings con MiniLM y guarda /app/embeddings_partidas.npy y /app/Base_Datos_IA.csv
"""
import os
import sys
import numpy as np
import csv

print("Iniciando generacion de embeddings desde BD...")
print(f"PYTHONPATH: {sys.path[:3]}")

from sqlalchemy import create_engine, text

DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://apupro_user:4pu_Pr0_2024!@apupro_db:5432/apupro_db")
print(f"Conectando a: {DATABASE_URL.split('@')[1]}")

engine = create_engine(DATABASE_URL)

# Buscar en todos los schemas disponibles
with engine.connect() as conn:
    # Listar todos los schemas que tengan cost360_items
    schemas_result = conn.execute(text("""
        SELECT table_schema 
        FROM information_schema.tables 
        WHERE table_name = 'cost360_items'
        ORDER BY table_schema
    """))
    schemas = [r[0] for r in schemas_result.fetchall()]
    print(f"Schemas con cost360_items: {schemas}")
    
    all_rows = []
    for schema in schemas:
        # El regex oficial de apupro que da las 7546 partidas maestras + partidas de otras dbs
        result = conn.execute(text(f"""
            SELECT "CodPar", "Descri" 
            FROM "{schema}".cost360_items
            WHERE "CodPar" IS NOT NULL AND "Descri" IS NOT NULL AND "CodPar" != ''
            AND "CovPar" ~ '^[A-Za-z]{{1,2}}[\.\-]?[0-9\.]+$'
        """))
        rows = result.fetchall()
        print(f"  Schema '{schema}': {len(rows)} partidas")
        for row in rows:
            all_rows.append((row[0], row[1]))

# Deduplicar por CodPar (en caso de schemas repetidos)
seen = {}
for cod, desc in all_rows:
    if cod not in seen:
        seen[cod] = desc

references = list(seen.keys())
descriptions = list(seen.values())
print(f"\nTotal partidas unicas: {len(references)}")

if not references:
    print("ERROR: No se encontraron partidas.")
    sys.exit(1)

# Cargar modelo (ya en cache del contenedor)
print("Cargando modelo SentenceTransformer...")
from sentence_transformers import SentenceTransformer
model = SentenceTransformer('sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2')
print("Modelo listo.")

# Generar embeddings en batches
BATCH_SIZE = 512
all_embeddings = []
for i in range(0, len(descriptions), BATCH_SIZE):
    batch = descriptions[i:i+BATCH_SIZE]
    embs = model.encode(batch, show_progress_bar=False)
    all_embeddings.append(embs)
    done = min(i + BATCH_SIZE, len(descriptions))
    print(f"  [{done}/{len(descriptions)}] procesadas...")

embeddings_matrix = np.vstack(all_embeddings)
print(f"Matriz final: {embeddings_matrix.shape}")

# Guardar .npy
npy_path = '/app/embeddings_partidas.npy'
np.save(npy_path, embeddings_matrix)
print(f"Guardado: {npy_path} ({os.path.getsize(npy_path) // 1024 // 1024} MB)")

# Guardar CSV
csv_path = '/app/Base_Datos_IA.csv'
with open(csv_path, 'w', newline='', encoding='utf-8') as f:
    writer = csv.writer(f)
    writer.writerow(['Referencia', 'Descripcion'])
    for ref, desc in zip(references, descriptions):
        writer.writerow([ref, desc])
print(f"Guardado: {csv_path}")

print(f"\nEXITO TOTAL: {len(references)} partidas indexadas y listas para el motor RAG V6.")
