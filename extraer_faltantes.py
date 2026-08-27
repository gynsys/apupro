import subprocess
import time
import json
import os

# Rangos exactos que faltaron (excluimos 1034-1042 que ya terminó completo)
rangos_faltantes = [
    (65, 260),
    (357, 520),
    (676, 780)
]

pdf_path = r"C:\Users\pablo\Documents\partidas_R.pdf"

commands = []
for start, end in rangos_faltantes:
    cmd = f'python extractor_pdf_json.py "{pdf_path}" {start} {end}'
    commands.append(cmd)

print(f"Iniciando {len(commands)} procesos en paralelo para rescatar las paginas faltantes...")
procs = [subprocess.Popen(cmd, shell=True) for cmd in commands]

# Esperar a que todos terminen
for p in procs:
    p.wait()

print("¡Extracción de paginas faltantes terminada!")

# Consolidar los JSONs rescatados
print("Consolidando resultados...")
datos_completos = []

# Agregamos el rango 1034-1042 a la consolidación porque ya terminó previamente
rangos_para_consolidar = rangos_faltantes + [(1034, 1042)]

for start, end in rangos_para_consolidar:
    json_path = f"C:\\Users\\pablo\\Documents\\partidas_R_{start}_{end}.json"
    
    if os.path.exists(json_path):
        with open(json_path, 'r', encoding='utf-8') as f:
            chunk_data = json.load(f)
            datos_completos.extend(chunk_data)
        os.remove(json_path)  # Limpiar archivo temporal
        print(f"Consolidado chunk {start}-{end} ({len(chunk_data)} partidas)")
    else:
        print(f"ADVERTENCIA: No se encontro {json_path}")

final_json = r"C:\Users\pablo\Documents\partidas_R_FALTANTES.json"
with open(final_json, 'w', encoding='utf-8') as f:
    json.dump(datos_completos, f, ensure_ascii=False, indent=4)

print(f"\n¡Mision de rescate exitosa!")
print(f"Se han guardado {len(datos_completos)} nuevas partidas rescatadas en {final_json}")
print("Cuando desees, podemos integrarlas con el resto del sistema.")
