import pdfplumber
import json
import sys
import os
import time

sys.path.append(os.path.dirname(os.path.abspath('extractor_pdf_json.py')))
from extractor_pdf_json import extraer_datos_partida, extraer_insumos

pdf_path = r'C:\Users\pablo\Documents\Partidas_Electrica.pdf'
salida = r'C:\Users\pablo\Documents\partidas_Electrica.json'

datos_json = []

print(f"Procesando {pdf_path} (Modo NATIVO - sin OCR)...")
t0 = time.time()

with pdfplumber.open(pdf_path) as pdf:
    total = len(pdf.pages)
    for i, p in enumerate(pdf.pages):
        # Extract using layout=True to preserve columns correctly
        texto = p.extract_text(layout=True)
        
        partida = extraer_datos_partida(texto)
        insumos = extraer_insumos(texto)
        
        if not partida["descripcion"]:
            continue
            
        apu_data = {
            "materials": [ins for ins in insumos if ins["tipo"] == "Material"],
            "equipments": [ins for ins in insumos if ins["tipo"] == "Equipo"],
            "labor": [ins for ins in insumos if ins["tipo"] == "Mano de Obra"]
        }
        
        registro = {
            "id": partida["codigo_covenin"],
            "description": partida["descripcion"],
            "unit": partida["unidad"],
            "performance": partida["rendimiento"],
            "codigo_covenin": partida["codigo_covenin"],
            "apu_data": json.dumps(apu_data, ensure_ascii=False)
        }
        
        datos_json.append(registro)
        
        if (i+1) % 50 == 0:
            print(f"  -> Pagina {i+1}/{total} procesada en {time.time() - t0:.1f}s")

with open(salida, 'w', encoding='utf-8') as f:
    json.dump(datos_json, f, ensure_ascii=False, indent=4)

print(f"LISTO! {len(datos_json)} partidas de la base Electrica extraidas en {time.time() - t0:.1f}s")
print(f"Guardadas en {salida}")
