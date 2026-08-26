import json
import requests
import time
from pathlib import Path

import sys

# CONFIGURACIÓN
if len(sys.argv) > 1:
    JSON_FILE = sys.argv[1]
else:
    JSON_FILE = r"C:\Users\pablo\Documents\pdf.json"

API_URL = "https://costbase.net/api/v1/cost360/custom-apus"

def upload_apus():
    path = Path(JSON_FILE)
    if not path.exists():
        print(f"❌ No se encontró el archivo JSON en: {JSON_FILE}")
        return

    with open(path, "r", encoding="utf-8") as f:
        try:
            partidas = json.load(f)
        except json.JSONDecodeError:
            print("❌ El archivo JSON es inválido o está corrupto.")
            return

    total = len(partidas)
    print(f"Iniciando subida de {total} partidas a {API_URL}...")
    
    exitos = 0
    errores = 0

    for i, partida in enumerate(partidas, 1):
        print(f"[{i}/{total}] Subiendo: {partida['description'][:40]}...", end=" ")
        
        try:
            # Enviamos el POST al endpoint de FastAPI
            response = requests.post(API_URL, json=partida, timeout=10)
            
            if response.status_code == 200:
                print("OK")
                exitos += 1
            else:
                print(f"Error {response.status_code}: {response.text}")
                errores += 1
                
        except requests.exceptions.RequestException as e:
            print(f"Error de conexion: {e}")
            errores += 1
            
        # Pausa de seguridad para no saturar el servidor de producción (100ms)
        time.sleep(0.1)

    print("\n" + "="*40)
    print("RESUMEN DE SUBIDA")
    print("="*40)
    print(f"Exitosos: {exitos}")
    print(f"Errores:  {errores}")
    print(f"Total procesados: {total}")

if __name__ == "__main__":
    upload_apus()
