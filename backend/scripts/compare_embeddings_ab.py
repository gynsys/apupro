"""
Benchmark y Comparación A/B Lado a Lado:
Motor Local (MiniLM-L12-v2 / 384d) vs. Motor Gemini (gemini-embedding-001 / 768d)
"""
import os
import sys
import time
import csv
import numpy as np

# 1. API key de Gemini
from app.db.base import SessionLocal
from app.crud.llm import get_active_providers_for_use_case, decrypt_api_key

db = SessionLocal()
try:
    providers = get_active_providers_for_use_case(db)
    gemini_prov = next((p for p in providers if p.provider_key == "gemini"), None)
    if not gemini_prov:
        print("ERROR: No se encontro proveedor Gemini.")
        sys.exit(1)
    api_key = decrypt_api_key(gemini_prov.api_key_enc)
finally:
    db.close()

import google.generativeai as genai
genai.configure(api_key=api_key)

# 2. Cargar modelo MiniLM local
print("Cargando modelo local SentenceTransformer...")
from sentence_transformers import SentenceTransformer
local_model = SentenceTransformer('sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2')
print("Modelo local listo.")

# 3. Cargar matrices de embeddings
npy_local = '/app/ai_brain/embeddings_partidas.npy'
npy_gemini = '/app/ai_brain/embeddings_gemini.npy'
checkpoint_gemini = '/app/ai_brain/embeddings_gemini_checkpoint.npy'
csv_path = '/app/ai_brain/Base_Datos_IA.csv'

if not os.path.exists(npy_gemini) and os.path.exists(checkpoint_gemini):
    print("Aviso: embeddings_gemini.npy aun no finaliza, usando checkpoint en progreso.")
    npy_gemini = checkpoint_gemini

if not os.path.exists(npy_local) or not os.path.exists(npy_gemini):
    print("ERROR: No se encontraron ambas matrices .npy en /app/ai_brain/")
    sys.exit(1)

matrix_gemini = np.load(npy_gemini)
matrix_local_full = np.load(npy_local)

# Cargar partidas
id_map_full = []
desc_map_full = []
with open(csv_path, 'r', encoding='utf-8') as f:
    reader = csv.reader(f)
    next(reader, None)
    for row in reader:
        if len(row) >= 2:
            id_map_full.append(row[0].strip())
            desc_map_full.append(row[1].strip())

num_items = len(matrix_gemini)
matrix_local = matrix_local_full[:num_items]
id_map = id_map_full[:num_items]
desc_map = desc_map_full[:num_items]

norm_local = np.linalg.norm(matrix_local, axis=1)
norm_gemini = np.linalg.norm(matrix_gemini, axis=1)

print(f"Matrices cargadas:")
print(f" - Local MiniLM: {matrix_local.shape}")
print(f" - Gemini API:   {matrix_gemini.shape}")
print(f" - Partidas:     {len(id_map)}\n")

TEST_QUERIES = [
    "concreto premezclado para losa de fundacion f'c 250 kg/cm2",
    "empaste y encamisado de muros interiores con pasta profesional",
    "tuberia de aguas blancas de 1/2 pulgada pvc roscada",
    "bote y desalojo de escombros en camion volteo",
    "muro de gaviones con alambre galvanizado calibre 12",
    "pintura de caucho mate sobre friso liso a dos manos",
    "excavacion a mano para zanjas de tuberias en tierra blanda",
    "colocacion de porcelanato en pisos con pega especial",
    "impermeabilizacion de techo con manto asfaltico 4mm",
    "valla publicitaria metalica de 3x2 metros",
    "friso rustico en paredes exteriores",
    "acero de refuerzo cabilla 1/2 fy 4200 kg/cm2",
    "puerta de madera entamborada con marco de chapa metalica",
    "demolicion de piso de concreto con compresor",
    "punto de iluminacion embutido en cielo raso drywall"
]

print("=" * 100)
print(f"{'PRUEBA COMPARATIVA A/B: LOCAL (MiniLM) vs. CLOUD (Gemini)':^100}")
print("=" * 100)

for idx, query in enumerate(TEST_QUERIES, 1):
    print(f"\n[CASO {idx:02d}] Consulta: \"{query}\"")
    print("-" * 100)
    
    # --- MOTOR LOCAL ---
    t0 = time.time()
    q_vec_local = local_model.encode([query])[0]
    q_norm_local = np.linalg.norm(q_vec_local)
    sims_local = np.dot(matrix_local, q_vec_local) / (norm_local * q_norm_local + 1e-10)
    top3_local = np.argsort(sims_local)[::-1][:3]
    t_local = (time.time() - t0) * 1000
    
    # --- MOTOR GEMINI ---
    t0 = time.time()
    res = genai.embed_content(
        model="models/gemini-embedding-001",
        content=query,
        output_dimensionality=768
    )
    q_vec_gemini = np.array(res["embedding"], dtype=np.float32)
    q_norm_gemini = np.linalg.norm(q_vec_gemini)
    sims_gemini = np.dot(matrix_gemini, q_vec_gemini) / (norm_gemini * q_norm_gemini + 1e-10)
    top3_gemini = np.argsort(sims_gemini)[::-1][:3]
    t_gemini = (time.time() - t0) * 1000
    
    print(f"-> MOTOR LOCAL (MiniLM) [Latencia: {t_local:.1f} ms]:")
    for rank, pos in enumerate(top3_local, 1):
        print(f"   #{rank} [{id_map[pos]}] (Score: {sims_local[pos]:.4f}) {desc_map[pos][:75]}...")
        
    print(f"-> MOTOR GEMINI API    [Latencia: {t_gemini:.1f} ms]:")
    for rank, pos in enumerate(top3_gemini, 1):
        print(f"   #{rank} [{id_map[pos]}] (Score: {sims_gemini[pos]:.4f}) {desc_map[pos][:75]}...")
    time.sleep(1)

print("\n" + "=" * 100)
print(f"{'FIN DEL BENCHMARK COMPARATIVO':^100}")
print("=" * 100)
