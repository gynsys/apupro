import pdfplumber
import pytesseract
import re
import json
import sys
from pathlib import Path

# ==============================================================================
# CONFIGURACIÓN
# ==============================================================================
UNIDADES_VALIDAS = {
    "M", "M2", "M3", "KGF", "KG", "GLB", "UND", "H", "HM", "HA", "ML", "L",
    "G", "GL", "LT", "HR", "MIN", "SEG", "MES", "VIAJE", "PZA", "PAR", "JGO",
    "DOC", "CIENTO", "MILLAR", "KG/M2", "KG/M3", "M3/KM"
}

SECCIONES = {
    "MATERIALES": "Material",
    "EQUIPOS": "Equipo",
    "MANO DE OBRA": "Mano de Obra",
    "MANO DE OBRAS": "Mano de Obra",
    "TRANSPORTE": "Transporte",
}

def limpiar_numero(valor):
    if valor is None or str(valor).strip() == "":
        return 0.0
    limpio = str(valor).strip()
    limpio = limpio.replace("$", "").replace("Bs.", "").replace(" ", "").replace(";", ",")
    
    if limpio.count(',') > 1:
        partes = limpio.rsplit(',', 1)
        limpio = partes[0].replace(',', '') + '.' + partes[1]
    elif limpio.count('.') > 1:
        partes = limpio.rsplit('.', 1)
        limpio = partes[0].replace('.', '') + '.' + partes[1]
    elif ',' in limpio and '.' in limpio:
        limpio = limpio.replace('.', '').replace(',', '.')
    else:
        limpio = limpio.replace(',', '.')
        
    try:
        return float(limpio)
    except ValueError:
        return 0.0

def corregir_ocr(texto):
    texto = re.sub(r"(\d)\s+,\s*(\d)", r"\1,\2", texto)
    texto = re.sub(r"(\d)\s+\.\s*(\d)", r"\1.\2", texto)
    texto = texto.replace(";", ",")
    return texto

def extraer_datos_partida(texto):
    match_covenin = re.search(r"COVENIN\s+\w+.*?\n\s*([A-Z0-9\.\,]+)", texto, re.IGNORECASE)
    if match_covenin:
        covenin = match_covenin.group(1).replace(",", ".")
    else:
        covenin = "Desconocido"

    match = re.search(r"Descripci.*?n de la Partida:\s*\n(.+?)(?=\n\s*(?:MATERIALES|EQUIPOS|MANO DE OBRA))", texto, re.IGNORECASE | re.DOTALL)
    descripcion = match.group(1).replace("\n", " ").strip() if match else ""

    match = re.search(
        r"([A-Z0-9\.\,]+)\s+([\w\.]+)\s+([\d\.,]+)\s+[\w\.]*\s+([\d\.,]+)\s+.*?Bs\.?\s+([\d\.,]+)\s+([\d\.,]+)",
        texto, re.IGNORECASE | re.DOTALL
    )
    if match:
        unidad, cantidad, rendimiento, precio, fcas = match.groups()[1:]
    else:
        unidad = cantidad = rendimiento = precio = fcas = None

    return {
        "codigo_covenin": covenin,
        "descripcion": descripcion,
        "unidad": unidad,
        "cantidad_analisis": limpiar_numero(cantidad),
        "rendimiento": limpiar_numero(rendimiento),
        "precio_unitario": limpiar_numero(precio),
        "fcas_pct": limpiar_numero(fcas),
        "calculos_por": "Rendimiento",
    }

def parsear_fila_insumo(linea, tipo_forzado):
    linea = linea.strip()
    tokens = linea.split()
    if len(tokens) < 4:
        return None

    numeros = []
    idx = len(tokens) - 1
    while idx >= 0:
        raw_val = tokens[idx]
        
        # Limpiar ruido OCR al final (ej. "11,78," -> "11,78")
        clean_val = raw_val.rstrip('.,')
        
        if clean_val.count(',') > 1:
            partes = clean_val.rsplit(',', 1)
            check_val = partes[0].replace(',', '') + '.' + partes[1]
        elif clean_val.count('.') > 1:
            partes = clean_val.rsplit('.', 1)
            check_val = partes[0].replace('.', '') + '.' + partes[1]
        elif ',' in clean_val and '.' in clean_val:
            check_val = clean_val.replace('.', '').replace(',', '.')
        else:
            check_val = clean_val.replace(',', '.')

        try:
            if clean_val: # Asegurar que no quedó vacío
                float(check_val)
                # Guardamos el token LIMPIO, no el original sucio
                numeros.append(clean_val)
                idx -= 1
            else:
                break
        except ValueError:
            break

    if len(numeros) < 3 or idx < 0:
        return None

    if tipo_forzado in ["Equipo", "Mano de Obra"]:
        unidad_str = tokens[idx].upper().replace(".", "").replace(",", "").replace(")", "")
        if unidad_str in UNIDADES_VALIDAS:
            unidad = unidad_str
            desc_tokens = tokens[:idx]
        else:
            unidad = "UND" if tipo_forzado == "Equipo" else "DIA"
            desc_tokens = tokens[:idx + 1]
    else:
        unidad_str = tokens[idx].upper().replace(".", "").replace(",", "").replace(")", "")
        if unidad_str in {"M2,", "M2.", "M2)"}: unidad = "M2"
        elif unidad_str in {"M3,", "M3."}: unidad = "M3"
        elif unidad_str in {"KGF,", "KGF."}: unidad = "KGF"
        elif unidad_str in {"PIEZA", "PZ"}: unidad = "PZA"
        else: unidad = unidad_str

        desc_tokens = tokens[:idx]
        
    descripcion_completa = " ".join(desc_tokens)

    match_codigo = re.match(r"^(REM-\d+)\s+(.+)$", descripcion_completa)
    if match_codigo:
        codigo = match_codigo.group(1)
        descripcion = match_codigo.group(2)
    else:
        codigo = None
        descripcion = descripcion_completa

    if tipo_forzado == "Equipo" and len(numeros) >= 4:
        cantidad = limpiar_numero(numeros[-1])
        depreciacion = limpiar_numero(numeros[-2])
        costo_unitario = limpiar_numero(numeros[-3])
        total = limpiar_numero(numeros[-4])
    else:
        cantidad = limpiar_numero(numeros[-1])
        costo_unitario = limpiar_numero(numeros[-2])
        total = limpiar_numero(numeros[-3])
        depreciacion = 1.0

    return {
        "codigo_insumo": codigo,
        "descripcion": descripcion,
        "tipo": tipo_forzado,
        "unidad": unidad,
        "cantidad": cantidad,
        "costo_unitario": costo_unitario,
        "depreciacion": depreciacion,
        "total": total,
    }

def extraer_insumos(texto):
    registros = []
    seccion_actual = None

    for linea in texto.split("\n"):
        linea_strip = linea.strip()
        if not linea_strip:
            continue

        linea_upper = linea_strip.upper()
        for sec_key, sec_val in SECCIONES.items():
            if linea_upper.startswith(sec_key):
                seccion_actual = sec_val
                break

        if not seccion_actual:
            continue

        if any(h in linea_upper for h in ["DESCRIPCION", "UNIDAD", "CANTIDAD", "COSTO", "JORNAL", "COP "]):
            continue

        if any(p in linea_upper for p in [
            "% COSTO", "% PRECIO", "TOTAL ", "SUB-TOTAL", "UNITARIO DE",
            "NO TIENE", "FACTOR DE", "BONO", "ADMINISTRACION", "UTILIDAD",
            "PRECIO UNITARIO:", "IMPUESTO", "PARA USO EXCLUSIVO",
            "DEPARTAMENTO DE", "COLEGIO DE", "EDICION:", "ANALISIS DE",
            "DATOS DE LA PARTIDA", "DESCRIPCION DE LA PARTIDA:",
            "CALCULOS POR", "RENDIMIENTO", "F.C.A.S.",
        ]):
            continue

        if not any(re.search(r"\d", t) for t in linea_strip.split()[-3:]):
            continue

        fila = parsear_fila_insumo(linea_strip, seccion_actual)
        if fila:
            registros.append(fila)

    return registros

if __name__ == "__main__":
    # IMPORTANTE: Ruta de Tesseract en Windows
    pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

    if len(sys.argv) > 1:
        PDF_ENTRADA = sys.argv[1]
    else:
        PDF_ENTRADA = r"C:\Users\pablo\Documents\partidas_R.pdf"

    start_page = int(sys.argv[2]) if len(sys.argv) > 2 else 1
    end_page = int(sys.argv[3]) if len(sys.argv) > 3 else None

    pdf_path = Path(PDF_ENTRADA)
    if not pdf_path.exists():
        raise FileNotFoundError(f"No se encontró el archivo: {pdf_path}")

    if end_page:
        SALIDA_JSON = str(pdf_path).replace('.pdf', f'_{start_page}_{end_page}.json')
    else:
        SALIDA_JSON = str(pdf_path).replace('.pdf', '.json')

    datos_json = []

    print(f"Iniciando extracción de {pdf_path.name} (Páginas {start_page} a {end_page or 'fin'}). Guardando en {SALIDA_JSON}...")

    with pdfplumber.open(pdf_path) as pdf:
        total_paginas = len(pdf.pages)
        if end_page is None or end_page > total_paginas:
            end_page = total_paginas
            
        for i in range(start_page, end_page + 1):
            p = pdf.pages[i - 1]
            
            texto_prueba = p.extract_text() or ""
            
            # OCR si es necesario
            if len(texto_prueba.strip()) < 50:
                print(f"[{i}/{total_paginas}] OCR en proceso para pág {p.page_number}...")
                img = p.to_image(resolution=300).original
                texto_final = pytesseract.image_to_string(img, lang="spa+eng")
            else:
                print(f"[{i}/{total_paginas}] Leyendo texto pág {p.page_number}...")
                texto_final = texto_prueba

            # Procesamiento de la página
            texto_final = corregir_ocr(texto_final)
            partida = extraer_datos_partida(texto_final)
            insumos = extraer_insumos(texto_final)
            
            if not partida["descripcion"]:
                print(f"  -> Se saltó la pág {p.page_number} (No se detectó descripción de partida).")
                continue


            apu_data = {
                "materials": [
                    {
                        "id": ins["codigo_insumo"] or f"MAT-{str(hash(ins['descripcion']))[:6]}",
                        "descripcion": ins["descripcion"],
                        "unidad": ins["unidad"],
                        "cantidad": ins["cantidad"],
                        "precio_unitario": ins["costo_unitario"]
                    } for ins in insumos if ins["tipo"] == "Material"
                ],
                "equipments": [
                    {
                        "id": ins["codigo_insumo"] or f"EQU-{str(hash(ins['descripcion']))[:6]}",
                        "descripcion": ins["descripcion"],
                        "unidad": ins["unidad"],
                        "cantidad": ins["cantidad"],
                        "precio_unitario": ins["costo_unitario"],
                        "depreciacion": ins["depreciacion"]
                    } for ins in insumos if ins["tipo"] == "Equipo"
                ],
                "labor": [
                    {
                        "id": ins["codigo_insumo"] or f"MAN-{str(hash(ins['descripcion']))[:6]}",
                        "descripcion": ins["descripcion"],
                        "unidad": ins["unidad"],
                        "cantidad": ins["cantidad"],
                        "jornal": ins["costo_unitario"],
                        "bono": 0.0
                    } for ins in insumos if ins["tipo"] == "Mano de Obra"
                ]
            }
            
            item_data = {
                "codigo_covenin": partida["codigo_covenin"],
                "description": partida["descripcion"],
                "unit": partida["unidad"] or "UND",
                "performance": partida["rendimiento"] or 1.0,
                "apu_data": json.dumps(apu_data)
            }
            
            # Guardar progresivamente
            datos_json.append(item_data)
            
            # Intentar guardar con reintentos en caso de que el archivo esté abierto/bloqueado
            exito_guardado = False
            import time
            for intento in range(5):
                try:
                    with open(SALIDA_JSON, "w", encoding="utf-8") as f:
                        json.dump(datos_json, f, ensure_ascii=False, indent=4)
                    exito_guardado = True
                    break
                except PermissionError:
                    print(f"  [!] Archivo {SALIDA_JSON} bloqueado. Reintentando en 2 segundos... (Cierra el archivo si lo tienes abierto)")
                    time.sleep(2)
            
            if not exito_guardado:
                print(f"  [ERROR FATAL] No se pudo guardar la pág {p.page_number} porque el archivo está bloqueado permanentemente.")
            else:
                print(f"  -> Pág {p.page_number} guardada exitosamente ({len(insumos)} insumos).")

    print(f"\nExtracción terminada exitosamente. Total: {len(datos_json)} partidas en {SALIDA_JSON}")