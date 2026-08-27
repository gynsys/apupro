import subprocess
import time
import json
import os

pdf_path = r"C:\Users\pablo\Documents\partidas_R.pdf"
total_pages = 1042
processes = 4
chunk_size = total_pages // processes

commands = []
for i in range(processes):
    start = i * chunk_size + 1
    end = (i + 1) * chunk_size if i < processes - 1 else total_pages
    cmd = f'python extractor_pdf_json.py "{pdf_path}" {start} {end}'
    commands.append(cmd)

print(f"Iniciando {processes} procesos en paralelo...")
procs = [subprocess.Popen(cmd, shell=True) for cmd in commands]

for p in procs:
    p.wait()

print("¡Extracción paralela terminada!")

# Consolidar los JSONs
print("Consolidando resultados...")
datos_completos = []
for i in range(processes):
    start = i * chunk_size + 1
    end = (i + 1) * chunk_size if i < processes - 1 else total_pages
    json_path = f"C:\\Users\\pablo\\Documents\\partidas_R_{start}_{end}.json"
    
    if os.path.exists(json_path):
        with open(json_path, 'r', encoding='utf-8') as f:
            chunk_data = json.load(f)
            datos_completos.extend(chunk_data)
        os.remove(json_path)
        print(f"Consolidado chunk {start}-{end} ({len(chunk_data)} partidas)")
    else:
        print(f"ADVERTENCIA: No se encontró {json_path}")

final_json = r"C:\Users\pablo\Documents\partidas_R_FINAL.json"
with open(final_json, 'w', encoding='utf-8') as f:
    json.dump(datos_completos, f, ensure_ascii=False, indent=4)

print(f"Guardado {len(datos_completos)} partidas en {final_json}")
