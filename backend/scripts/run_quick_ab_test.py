"""
Test Rapido A/B en Vivo: Compara la precision semantica de Google Gemini vs MiniLM
sobre las partidas maestras ya indexadas.
"""
import os
import sys
import time
import csv
import numpy as np

from app.db.base import SessionLocal
from app.crud.llm import get_active_providers_for_use_case, decrypt_api_key

db = SessionLocal()
try:
    providers = get_active_providers_for_use_case(db)
    gemini_prov = next((p for p in providers if p.provider_key == "gemini"), None)
    api_key = decrypt_api_key(gemini_prov.api_key_enc)
finally:
    db.close()

import google.generativeai as genai
genai.configure(api_key=api_key)

from sentence_transformers import SentenceTransformer
local_model = SentenceTransformer('sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2')

# Cargar primeras 100 partidas de Base_Datos_IA.csv
csv_path = '/app/ai_brain/Base_Datos_IA.csv'
id_map = []
desc_map = []
with open(csv_path, 'r', encoding='utf-8') as f:
    reader = csv.reader(f)
    next(reader, None)
    for row in reader:
        if len(row) >= 2 and len(id_map) < 30:
            id_map.append(row[0].strip())
            desc_map.append(row[1].strip())

print(f"Cargadas {len(id_map)} partidas para test A/B en vivo.")

# 1. Generar vectores Gemini para estas 100 partidas
print("Generando vectores Gemini para las 100 partidas...")
res_gem = genai.embed_content(
    model="models/gemini-embedding-001",
    content=desc_map,
    output_dimensionality=768
)
gemini_matrix = np.array(res_gem["embedding"], dtype=np.float32)

# 2. Generar vectores MiniLM para estas 100 partidas
print("Generando vectores MiniLM para las 100 partidas...")
local_matrix = local_model.encode(desc_map)

norm_local = np.linalg.norm(local_matrix, axis=1)
norm_gemini = np.linalg.norm(gemini_matrix, axis=1)

QUERIES = [
    "limpieza de terreno a maquina",
    "desmonte de vegetacion y tala",
    "concreto para fundaciones",
    "demolicion de pavimento asfaltico",
    "remocion de cercas de alambre"
]

print("\n" + "=" * 90)
print(f"{'RESULTADOS COMPARATIVOS A/B (MiniLM vs. Gemini Embeddings)':^90}")
print("=" * 90)

for q in QUERIES:
    print(f"\nConsulta: \"{q}\"")
    print("-" * 90)
    
    # Local
    t0 = time.time()
    q_loc = local_model.encode([q])[0]
    s_loc = np.dot(local_matrix, q_loc) / (norm_local * np.linalg.norm(q_loc) + 1e-10)
    best_loc = np.argsort(s_loc)[::-1][0]
    t_loc = (time.time() - t0) * 1000
    
    # Gemini
    t0 = time.time()
    res_q = genai.embed_content(model="models/gemini-embedding-001", content=q, output_dimensionality=768)
    q_gem = np.array(res_q["embedding"], dtype=np.float32)
    s_gem = np.dot(gemini_matrix, q_gem) / (norm_gemini * np.linalg.norm(q_gem) + 1e-10)
    best_gem = np.argsort(s_gem)[::-1][0]
    t_gem = (time.time() - t0) * 1000
    
    print(f"  [MiniLM Local] ({t_loc:.1f} ms | Score: {s_loc[best_loc]:.3f}) -> [{id_map[best_loc]}] {desc_map[best_loc][:60]}...")
    print(f"  [Gemini Cloud] ({t_gem:.1f} ms | Score: {s_gem[best_gem]:.3f}) -> [{id_map[best_gem]}] {desc_map[best_gem][:60]}...")

print("\n" + "=" * 90)
