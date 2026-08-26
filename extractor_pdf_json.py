"""
Extractor Completo de APU - Colegio de Ingenieros de Venezuela
Extrae TODO: partida, insumos, totales, porcentajes, FCAS, admin, utilidad, IVA.
Genera Excel y un archivo JSON estructurado (compatible con CostBase).

Requisitos:
    pip install pdfplumber pandas pdf2image pytesseract pillow openpyxl
    sudo apt-get install tesseract-ocr poppler-utils
"""

import pdfplumber
import pandas as pd
import re
import json
from pathlib import Path
from datetime import datetime

try:
    from pdf2image import convert_from_path
    import pytesseract
    OCR_DISPONIBLE = True
except ImportError:
    OCR_DISPONIBLE = False

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

# ==============================================================================
# FUNCIONES AUXILIARES
# ==============================================================================

def limpiar_numero(valor):
    if valor is None or str(valor).strip() == "":
        return 0.0
    limpio = str(valor).strip()
    limpio = limpio.replace("$", "").replace("Bs.", "").replace(" ", "").replace(";", ",")
    puntos = limpio.count(".")
    comas = limpio.count(",")
    
    if comas >= 1 and puntos >= 1:
        limpio = limpio.replace(".", "").replace(",", ".")
    elif comas == 1 and puntos == 0:
        limpio = limpio.replace(",", ".")
    elif puntos == 1 and comas == 0:
        partes = limpio.split(".")
        if len(partes[1]) <= 2:
            limpio = limpio.replace(".", "")
    elif puntos > 1:
        partes = limpio.split(".")
        if len(partes[-1]) == 2:
            limpio = "".join(partes[:-1]) + "." + partes[-1]
        else:
            limpio = limpio.replace(".", "")
    try:
        return float(limpio)
    except ValueError:
        return 0.0

def corregir_ocr(texto):
    texto = re.sub(r"(\d)\s+,\s*(\d)", r"\1,\2", texto)
    texto = re.sub(r"(\d)\s+\.\s*(\d)", r"\1.\2", texto)
    texto = texto.replace(";", ",")
    return texto

def extraer_campo(texto, patron, grupo=1):
    m = re.search(patron, texto, re.IGNORECASE)
    return m.group(grupo).strip() if m else None

# ==============================================================================
# EXTRACTORES
# ==============================================================================

def extraer_datos_partida(texto):
    match = re.search(r"COVENIN\s+\w+.*?\n\s*([A-Z]\.[\d\.]+)", texto, re.IGNORECASE | re.DOTALL)
    covenin = match.group(1).strip() if match else "Desconocido"

    match = re.search(r"Descripcion de la Partida:\s*\n(.+?)(?:\n\s*\n|\n[A-Z])", texto, re.IGNORECASE | re.DOTALL)
    descripcion = match.group(1).replace("\n", " ").strip() if match else ""

    match = re.search(
        r"([A-Z]\.[\d\.]+)\s+(\w+)\s+([\d\.,]+)\s+\w*\s+([\d\.,]+)\s+.*?Bs\.?\s+([\d\.,]+)\s+([\d\.,]+)",
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
        t = tokens[idx].replace(".", "").replace(",", ".")
        try:
            float(t)
            numeros.append(tokens[idx])
            idx -= 1
        except ValueError:
            break

    if len(numeros) < 3 or idx < 0:
        return None

    unidad = tokens[idx].upper().replace(".", "").replace(",", "").replace(")", "")
    if unidad in {"M2,", "M2.", "M2)"}: unidad = "M2"
    elif unidad in {"M3,", "M3."}: unidad = "M3"
    elif unidad in {"KGF,", "KGF."}: unidad = "KGF"

    if unidad not in UNIDADES_VALIDAS:
        return None

    desc_tokens = tokens[:idx]
    descripcion_completa = " ".join(desc_tokens)

    match_codigo = re.match(r"^(REM-\d+)\s+(.+)$", descripcion_completa)
    if match_codigo:
        codigo = match_codigo.group(1)
        descripcion = match_codigo.group(2)
    else:
        codigo = None
        descripcion = descripcion_completa

    return {
        "codigo_insumo": codigo,
        "descripcion": descripcion,
        "tipo": tipo_forzado,
        "unidad": unidad,
        "cantidad": limpiar_numero(numeros[-1]),
        "costo_unitario": limpiar_numero(numeros[1]),
        "total": limpiar_numero(numeros[0]),
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

# ==============================================================================
# EJECUCIÓN
# ==============================================================================

if __name__ == "__main__":
    PDF_ENTRADA = "partidas_R.pdf"          # <-- Cambia por tu archivo
    SALIDA_EXCEL = "apu_completo.xlsx"
    SALIDA_JSON = "apu_completo.json"

    pdf_path = Path(PDF_ENTRADA)
    if not pdf_path.exists():
        raise FileNotFoundError(f"No se encontró: {pdf_path}")

    # Extraer texto
    with pdfplumber.open(pdf_path) as pdf:
        texto_prueba = pdf.pages[0].extract_text() or ""
        necesita_ocr = len(texto_prueba.strip()) < 50

        if necesita_ocr:
            if not OCR_DISPONIBLE:
                raise RuntimeError("OCR no disponible. Instala pdf2image + pytesseract + tesseract-ocr")
            print("📄 PDF escaneado detectado. Usando OCR...")
            imagenes = convert_from_path(str(pdf_path), dpi=300)
            textos = [pytesseract.image_to_string(img, lang="eng") for img in imagenes]
        else:
            print("📄 PDF con texto nativo. Usando pdfplumber...")
            textos = [p.extract_text() or "" for p in pdf.pages]

    todas_partidas = []
    todos_insumos = []

    for i, texto in enumerate(textos, 1):
        texto = corregir_ocr(texto)
        partida = extraer_datos_partida(texto)
        partida["pagina"] = i
        partida["archivo_origen"] = pdf_path.name

        insumos = extraer_insumos(texto)
        for ins in insumos:
            ins["pagina"] = i
            ins["partida_covenin"] = partida["codigo_covenin"]

        todas_partidas.append(partida)
        todos_insumos.extend(insumos)

    if not todas_partidas:
        print("⚠️ No se extrajo ninguna partida.")
        exit()

    # 1. EXPORTAR EXCEL
    df_partidas = pd.DataFrame(todas_partidas)
    df_insumos = pd.DataFrame(todos_insumos)

    with pd.ExcelWriter(SALIDA_EXCEL, engine="openpyxl") as writer:
        df_partidas.to_excel(writer, sheet_name="Partidas", index=False)
        df_insumos.to_excel(writer, sheet_name="Insumos", index=False)
    
    print(f"\n✅ Excel: {SALIDA_EXCEL}")
    print(f"   Hoja 'Partidas': {len(df_partidas)} fila(s)")
    print(f"   Hoja 'Insumos': {len(df_insumos)} fila(s)")

    # 2. EXPORTAR JSON (Corregido y Estructurado)
    datos_json = []
    for p in todas_partidas:
        ins_de_partida = [i for i in todos_insumos if i["partida_covenin"] == p["codigo_covenin"]]
        
        # Mapear los insumos al formato que espera CostBase (CustomCostItemCreate)
        apu_data = {
            "materials": [
                {
                    "CodMat": i["codigo_insumo"] or f"MAT-{str(hash(i['descripcion']))[:6]}",
                    "Descri": i["descripcion"],
                    "UniMat": i["unidad"],
                    "cantidad": i["cantidad"],
                    "precio_unitario": i["costo_unitario"]
                } for i in ins_de_partida if i["tipo"] == "Material"
            ],
            "equipments": [
                {
                    "CodEqu": i["codigo_insumo"] or f"EQU-{str(hash(i['descripcion']))[:6]}",
                    "Descri": i["descripcion"],
                    "cantidad": i["cantidad"],
                    "precio_unitario": i["costo_unitario"]
                } for i in ins_de_partida if i["tipo"] == "Equipo"
            ],
            "labor": [
                {
                    "CodMan": i["codigo_insumo"] or f"MAN-{str(hash(i['descripcion']))[:6]}",
                    "Descri": i["descripcion"],
                    "cantidad": i["cantidad"],
                    "precio_unitario": i["costo_unitario"] # (Jornal Base)
                } for i in ins_de_partida if i["tipo"] == "Mano de Obra"
            ]
        }
        
        # Construir el payload del CustomCostItem
        item_data = {
            "description": p["descripcion"],
            "unit": p["unidad"] or "UND",
            "performance": p["rendimiento"] or 1.0,
            "apu_data": json.dumps(apu_data) # Convertimos la estructura de insumos a JSON string
        }
        
        datos_json.append(item_data)

    # Escribir el archivo JSON con toda la lista final
    with open(SALIDA_JSON, "w", encoding="utf-8") as f:
        json.dump(datos_json, f, ensure_ascii=False, indent=4)
        
    print(f"✅ JSON estructurado generado en: {SALIDA_JSON}")
    print("   (Listo para ser consumido por CostBase)")