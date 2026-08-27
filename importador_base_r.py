import os
import sys
import json
import re
import pandas as pd
from sqlalchemy import create_engine, text
import pdfplumber
import argparse


def reparar_covenin_faltantes(json_path, pdf_path):
    print("Verificando si faltan códigos COVENIN en el JSON...")
    with open(json_path, "r", encoding="utf-8") as f:
        datos = json.load(f)
        
    faltan = sum(1 for item in datos if "codigo_covenin" not in item)
    if faltan == 0:
        print("Todos los ítems tienen su código COVENIN.")
        return datos
        
    print(f"Faltan {faltan} códigos. Escaneando PDF nativo para repararlos (rápido)...")
    desc_to_covenin = {}
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            texto = page.extract_text() or ""
            # Buscar COVENIN
            match_cov = re.search(r"COVENIN\s+\w+.*?\n\s*([A-Z]\.[\d\.]+)", texto, re.IGNORECASE | re.DOTALL)
            covenin = match_cov.group(1).strip() if match_cov else None
            # Buscar Descripción
            match_desc = re.search(r"DESCRIPCION:\s*(.*?)(?:\n|$)", texto, re.IGNORECASE)
            if covenin and match_desc:
                desc_limpia = match_desc.group(1).strip()
                desc_to_covenin[desc_limpia] = covenin
                
    # Reparar
    reparados = 0
    for item in datos:
        if "codigo_covenin" not in item:
            # Intentar match por descripción exacta o parcial
            item_desc = item["description"].strip()
            # Búsqueda exacta
            if item_desc in desc_to_covenin:
                item["codigo_covenin"] = desc_to_covenin[item_desc]
                reparados += 1
            else:
                # Búsqueda parcial si hay recortes
                encontrado = False
                for k, v in desc_to_covenin.items():
                    if k.startswith(item_desc[:20]) or item_desc.startswith(k[:20]):
                        item["codigo_covenin"] = v
                        reparados += 1
                        encontrado = True
                        break
                if not encontrado:
                    item["codigo_covenin"] = "R-DESCONOCIDO"
                    
    print(f"Se repararon {reparados} códigos COVENIN.")
    
    # Guardar parche
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(datos, f, ensure_ascii=False, indent=4)
        
    return datos

def step1_generar_excel(json_path, pdf_path):
    # 1. Reparar si es necesario
    datos = reparar_covenin_faltantes(json_path, pdf_path)
    
    # 2. Obtener COVENIN de las partidas R existentes desde el archivo descargado de producción
    print("Leyendo códigos Covenin de partidas R existentes desde r_items.txt...")
    existentes = set()
    try:
        with open("r_items.txt", "r", encoding="utf-16", errors="ignore") as f:
            for line in f:
                val = line.strip()
                if val:
                    existentes.add(val)
    except FileNotFoundError:
        print("ADVERTENCIA: No se encontró r_items.txt. Asumiendo que no hay duplicados.")
        
    print(f"Se encontraron {len(existentes)} partidas R en la Base Maestra.")
    
    # 3. Filtrar JSON
    nuevas_partidas = []
    descartadas = 0
    for item in datos:
        cov = item.get("codigo_covenin", "").replace(".", "")
        if cov in existentes:
            descartadas += 1
        else:
            nuevas_partidas.append(item)
            
    print(f"Partidas descartadas por duplicidad (COVENIN ya existe): {descartadas}")
    print(f"Partidas nuevas a procesar: {len(nuevas_partidas)}")
    
    # 4. Extraer insumos únicos
    materiales = {}
    equipos = {}
    mano_obra = {}
    
    for item in nuevas_partidas:
        apu = json.loads(item.get("apu_data", "{}"))
        for mat in apu.get("materials", []):
            materiales[mat["id"]] = {"Descripción": mat["descripcion"], "Unidad": mat["unidad"], "Precio Base": mat.get("precio_unitario", 0)}
        for eq in apu.get("equipments", []):
            equipos[eq["id"]] = {"Descripción": eq["descripcion"], "Unidad": eq["unidad"], "Precio Base": eq.get("precio_unitario", 0)}
        for mo in apu.get("labor", []):
            mano_obra[mo["id"]] = {"Descripción": mo["descripcion"], "Unidad": mo["unidad"], "Precio Base": mo.get("jornal", 0)}
            
    # 5. Exportar a Excel
    print("Generando Excel de precios...")
    with pd.ExcelWriter("precios_para_actualizar.xlsx") as writer:
        pd.DataFrame([{"ID": k, **v, "Nuevo Precio": v["Precio Base"]} for k,v in materiales.items()]).to_excel(writer, sheet_name="Materiales", index=False)
        pd.DataFrame([{"ID": k, **v, "Nuevo Precio": v["Precio Base"]} for k,v in equipos.items()]).to_excel(writer, sheet_name="Equipos", index=False)
        pd.DataFrame([{"ID": k, **v, "Nuevo Precio": v["Precio Base"]} for k,v in mano_obra.items()]).to_excel(writer, sheet_name="Mano_Obra", index=False)
        
    print("\n¡EXCEL GENERADO CON ÉXITO!")
    print("Por favor, abre 'precios_para_actualizar.xlsx', modifica la columna 'Nuevo Precio' y guárdalo.")
    print("Luego ejecuta: python importador_base_r.py step2")

def step2_importar_bd(json_path):
    print("Este paso creará el schema en PostgreSQL y subirá todo.")
    print("Requiere leer el Excel de precios y re-calcular las partidas. (Implementación pendiente tras tu validación del paso 1)")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("step", choices=["step1", "step2"], help="Paso a ejecutar")
    args = parser.parse_args()
    
    JSON_PATH = r"C:\Users\pablo\Documents\partidas_R_FINAL.json"
    PDF_PATH = r"C:\Users\pablo\Documents\partidas_R.pdf"
    
    if args.step == "step1":
        step1_generar_excel(JSON_PATH, PDF_PATH)
    else:
        step2_importar_bd(JSON_PATH)
