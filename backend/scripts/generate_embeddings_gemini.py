"""
Generador de Embeddings Gemini con Checkpointing y Manejo Inteligente de Cuota (Free Tier).
Guarda el progreso incremental en /app/ai_brain/embeddings_gemini_partial.npy
"""
import os
import sys
import time
import re
import csv
import numpy as np

from sqlalchemy import text
from app.db.base import SessionLocal
from app.crud.llm import get_active_providers_for_use_case, decrypt_api_key

db = SessionLocal()
try:
    providers = get_active_providers_for_use_case(db)
    gemini_prov = next((p for p in providers if p.provider_key == "gemini"), None)
    if not gemini_prov:
        print("ERROR: No se encontro proveedor activo de Gemini en la BD.")
        sys.exit(1)
    api_key = decrypt_api_key(gemini_prov.api_key_enc)
    
    # Cargar las 17.343 partidas completas directamente desde la base de datos
    print("Consultando todas las partidas desde cost360_items en PostgreSQL...")
    sql = text("""
        SELECT "CodPar", "Descri" 
        FROM cost360_items 
        WHERE "CodPar" IS NOT NULL AND "CodPar" != '' 
          AND "Descri" IS NOT NULL AND "Descri" != '' 
        ORDER BY "CodPar"
    """)
    rows = db.execute(sql).fetchall()
finally:
    db.close()

references = [r[0].strip() for r in rows]
descriptions = [r[1].strip() for r in rows]
total = len(descriptions)
print(f"Total partidas cargadas de la BD: {total}")

API_KEYS = []
if os.getenv("GEMINI_API_KEY"):
    API_KEYS.append(os.getenv("GEMINI_API_KEY"))


# Leer claves adicionales desde archivo si existe
extra_keys_file = '/app/ai_brain/gemini_keys.txt'
if os.path.exists(extra_keys_file):
    with open(extra_keys_file, 'r', encoding='utf-8') as kf:
        for line in kf:
            k = line.strip()
            if k and not k.startswith('#') and k not in API_KEYS:
                API_KEYS.append(k)

import google.generativeai as genai

checkpoint_npy = '/app/ai_brain/embeddings_gemini_checkpoint.npy'
final_npy = '/app/ai_brain/embeddings_gemini.npy'

# Cargar checkpoint si existe
all_vectors = []
start_idx = 0
if os.path.exists(checkpoint_npy):
    try:
        existing = np.load(checkpoint_npy)
        all_vectors = list(existing)
        start_idx = len(all_vectors)
        print(f"Reanudando desde checkpoint: {start_idx}/{total} partidas ya procesadas.")
    except Exception as e:
        print(f"Aviso: no se pudo leer checkpoint ({e}), iniciando desde cero.")
        all_vectors = []
        start_idx = 0

BATCH_SIZE = 80  # Tamaño optimo por clave en Free Tier (80 items)
log_file = '/app/ai_brain/generator.log'

def log(msg: str):
    print(msg, flush=True)
    try:
        with open(log_file, 'a', encoding='utf-8') as lf:
            lf.write(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {msg}\n")
    except Exception:
        pass

def get_wait_time(err_msg: str) -> int:
    m = re.search(r'retry in ([0-9.]+)s', err_msg)
    if m:
        return int(float(m.group(1))) + 2
    m2 = re.search(r'seconds:\s*(\d+)', err_msg)
    if m2:
        return int(m2.group(1)) + 2
    return 65

active_keys = list(API_KEYS)
current_key_idx = 0
last_used_time = {k: 0.0 for k in active_keys}

log(f"\nIniciando procesamiento de {total - start_idx} partidas con pool de {len(active_keys)} claves API...")
for i in range(start_idx, total, BATCH_SIZE):
    batch = descriptions[i:i + BATCH_SIZE]
    batch_num = (i // BATCH_SIZE) + 1
    
    while True:
        # Re-leer archivo de claves adicionales dinamicamente
        if os.path.exists(extra_keys_file):
            with open(extra_keys_file, 'r', encoding='utf-8') as kf:
                for line in kf:
                    k = line.strip()
                    if k and not k.startswith('#') and k not in API_KEYS:
                        API_KEYS.append(k)
                        active_keys.append(k)
                        last_used_time[k] = 0.0
                        log(f"[Pool Dinamico] Nueva clave agregada: ...{k[-6:]}")

        if not active_keys:
            log("Todas las claves API alcanzaron su cupo diario. Esperando 1 hora...")
            time.sleep(3600)
            active_keys = list(API_KEYS)
            continue
            
        current_key = active_keys[current_key_idx % len(active_keys)]
        
        # Ritmo de 60s por clave individual
        now = time.time()
        elapsed = now - last_used_time.get(current_key, 0.0)
        if elapsed < 60.0:
            # Buscar si otra clave esta lista
            ready_key = None
            for alt in active_keys:
                if (now - last_used_time.get(alt, 0.0)) >= 60.0:
                    ready_key = alt
                    break
            if ready_key:
                current_key = ready_key
            else:
                sleep_needed = max(1, int(60.0 - elapsed) + 1)
                time.sleep(sleep_needed)

        try:
            genai.configure(api_key=current_key)
            res = genai.embed_content(
                model="models/gemini-embedding-001",
                content=batch,
                output_dimensionality=768
            )
            batch_vectors = res["embedding"]
            all_vectors.extend(batch_vectors)
            last_used_time[current_key] = time.time()
            current_key_idx += 1
            
            # Guardar checkpoint
            np.save(checkpoint_npy, np.array(all_vectors, dtype=np.float32))
            
            done = len(all_vectors)
            percent = (done / total) * 100
            log(f"[{done}/{total}] ({percent:.1f}%) procesadas [Clave ...{current_key[-6:]}].")
            time.sleep(1)
            break
        except Exception as e:
            err_str = str(e)
            if "limit: 1000" in err_str or "limit: 0" in err_str:
                log(f"[Cupo diario agotado en clave ...{current_key[-6:]}]. Rotando a siguiente clave...")
                if current_key in active_keys:
                    active_keys.remove(current_key)
            elif "429" in err_str or "Quota exceeded" in err_str:
                wait_s = get_wait_time(err_str)
                log(f"[Minuto saturado en clave ...{current_key[-6:]}] Esperando {wait_s}s...")
                time.sleep(wait_s)
                current_key_idx += 1
            else:
                log(f"Error en clave ...{current_key[-6:]}: {err_str[:90]}. Esperando 5s...")
                time.sleep(5)
                current_key_idx += 1

# Finalizar y guardar version definitiva
final_matrix = np.array(all_vectors, dtype=np.float32)
np.save(final_npy, final_matrix)
log(f"\nPROCESO COMPLETO: Guardado {final_npy} con forma {final_matrix.shape}")

# Guardar CSV correspondiente
csv_out = '/app/ai_brain/Base_Datos_IA_Gemini.csv'
with open(csv_out, 'w', newline='', encoding='utf-8') as f:
    writer = csv.writer(f)
    writer.writerow(['Referencia', 'Descripcion'])
    for r, d in zip(references, descriptions):
        writer.writerow([r, d])
log(f"CSV de referencia guardado en: {csv_out}")

# Remover checkpoint temporal
if os.path.exists(checkpoint_npy):
    os.remove(checkpoint_npy)


