"""
Script autónomo para ejecución nocturna de scraping de precios.
Permite dejar el proceso corriendo toda la noche de forma desatendida,
con guardado continuo en PostgreSQL y generación automática de reporte Excel.

Uso:
    python backend/scripts/scraping_nocturno.py
    python backend/scripts/scraping_nocturno.py --delay 8 --limit 500 --portals epa
"""
import sys
import time
import random
import re
import html
import urllib.parse
import argparse
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional, Set

# Agregar directorio backend a sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

import dotenv
_env_path = BASE_DIR / ".env"
if _env_path.exists():
    dotenv.load_dotenv(dotenv_path=_env_path)

# Asegurar encoding UTF-8 en consolas de Windows
if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if sys.stderr and hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

import pandas as pd
from sqlalchemy import text
from app.core.logging import logger
from app.db.base import get_db_session

try:
    import cloudscraper
except ImportError:
    cloudscraper = None

VULGAR_FRACTIONS: Dict[str, str] = {
    '¼': '1/4', '½': '1/2', '¾': '3/4', 
    '⅛': '1/8', '⅜': '3/8', '⅝': '5/8', '⅞': '7/8',
    '”': '"', '“': '"', '’': "'", '‘': "'"
}

GENERIC_PLACEHOLDERS: Set[str] = {
    "ACCESORIOS PARA FIJACION",
    "ACCESORIOS Y ELEMENTOS DE FIJACION",
    "MATERIAL DE FIJACION Y REMATE",
    "MATERIALES PARA INSTALACIONES",
    "MATERIALES VARIOS PARA INSTALACION",
    "MATERIALES VARIOS",
    "ELEMENTOS DE FIJACION",
    "HERRAMIENTAS MENORES",
    "MISCELANEOS",
    "VARIOS DE INSTALACION"
}

def normalize_text_dimensions(text_val: str) -> str:
    """Decodifica entidades HTML y normaliza fracciones vulgares como ¼ a 1/4."""
    if not text_val:
        return ""
    unescaped = html.unescape(text_val)
    for v_char, repl in VULGAR_FRACTIONS.items():
        unescaped = unescaped.replace(v_char, repl)
    return unescaped

def is_generic_placeholder(desc: str) -> bool:
    """Identifica materiales genéricos o de canasta en APU que no son productos comerciales."""
    if not desc:
        return True
    cleaned = re.sub(r'[^A-Z\s]', '', desc.upper()).strip()
    cleaned = re.sub(r'\s+', ' ', cleaned)
    if cleaned in GENERIC_PLACEHOLDERS:
        return True
    if re.match(r'^(ACCESORIOS|MATERIALES VARIOS|ELEMENTOS DE FIJACION)(\s+PARA\s+\w+)?$', cleaned):
        return True
    return False

def extract_numbers_and_dims(text_input: str) -> Set[str]:
    clean_text = normalize_text_dimensions(text_input).replace('"', '').replace("'", "")
    pattern = r'\b(\d+(?:/\d+)?(?:[\.,]\d+)?)\b'
    matches = re.findall(pattern, clean_text)
    return set(matches)


def get_keywords(text_input: str) -> Set[str]:
    clean_text = normalize_text_dimensions(text_input).lower().replace('"', '').replace("'", "")
    words = re.findall(r'\b[a-z]{3,}\b', clean_text)
    stop_words = {
        'para', 'con', 'sin', 'los', 'las', 'del', 'por', 'que', 'una', 'uno',
        'uso', 'tipo', 'color', 'marca', 'nacional', 'importado', 'varios'
    }
    return set([w for w in words if w not in stop_words])


def clean_search_term(desc: str) -> str:
    if not desc:
        return ""
    desc_clean = normalize_text_dimensions(desc).upper()
    medida = re.search(r'\d+(?:/\d+)?(?:[\.,]\d+)?\s*(?:MM|CM|M|PULG|\"|KG|G|L|ML)', desc_clean)
    medida_str = medida.group() if medida else ''
    
    palabras = re.findall(r'\b[A-Z]{3,}\b', desc_clean)
    stop_words = {
        'PARA', 'CON', 'SIN', 'LOS', 'LAS', 'DEL', 'POR', 'QUE', 'UNA', 'UNO',
        'USO', 'TIPO', 'COLOR', 'MARCA', 'NACIONAL', 'IMPORTADO', 'VARIOS',
        'CALIDAD', 'PRIMERA', 'SEGUNDA'
    }
    palabras_filtradas = [p for p in palabras if p not in stop_words]
    
    core = ' '.join(palabras_filtradas[:3])
    query = f'{core} {medida_str}'.strip()
    return query or ' '.join(palabras[:2])


def is_valid_product(db_desc: str, scraped_desc: str) -> bool:
    if not scraped_desc or not db_desc:
        return False
    db_desc_lower = normalize_text_dimensions(db_desc).lower()
    scraped_desc_lower = normalize_text_dimensions(scraped_desc).lower()
    
    nums_db = extract_numbers_and_dims(db_desc_lower)
    scraped_desc_clean = scraped_desc_lower.replace('"', '').replace("'", "")
    
    for num in nums_db:
        pattern = r'(?<!\d)' + re.escape(num) + r'(?!\d)'
        if not re.search(pattern, scraped_desc_clean):
            return False
            
    kw_db = get_keywords(db_desc_lower)
    kw_scraped = get_keywords(scraped_desc_lower)
    
    if kw_db:
        intersection = kw_db.intersection(kw_scraped)
        if len(intersection) == 0:
            return False
            
        ratio = len(intersection) / len(kw_db)
        required_ratio = 0.25 if nums_db else 0.5
        if ratio < required_ratio:
            return False
            
    return True


def export_scraped_to_excel(output_path: Path, target_date: Optional[str] = None) -> int:
    """Genera o actualiza el archivo Excel con los precios scrapeados."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    with get_db_session() as db:
        query_str = '''
            SELECT 
                h.id AS "ID",
                h.material_id AS "Código",
                c."Descri" AS "Descripción Base de Datos",
                ROUND(CAST(c."CosMat" AS numeric), 2) AS "Precio Anterior BD ($)",
                ROUND(CAST(h.precio AS numeric), 2) AS "Precio Scrapeado ($)",
                ROUND(CAST(h.precio - c."CosMat" AS numeric), 2) AS "Diferencia ($)",
                CASE 
                    WHEN c."CosMat" > 0 THEN ROUND(CAST(((h.precio - c."CosMat") / c."CosMat") * 100 AS numeric), 2)
                    ELSE 0 
                END AS "Variación (%)",
                h.titulo_scraped AS "Título Producto Tienda",
                h.fuente AS "Portal / Fuente",
                h.fecha AS "Fecha",
                h.status AS "Estado Aprobación"
            FROM historial_precios h
            LEFT JOIN cost360_materials c ON h.material_id = c."CodMat"
        '''
        if target_date:
            query_str += " WHERE h.fecha = :target_date"
            query_str += " ORDER BY h.id DESC"
            rows = db.execute(text(query_str), {"target_date": target_date}).fetchall()
        else:
            query_str += " ORDER BY h.id DESC"
            rows = db.execute(text(query_str)).fetchall()

    if not rows:
        return 0

    df = pd.DataFrame(rows, columns=[
        "ID", "Código", "Descripción Base de Datos", "Precio Anterior BD ($)",
        "Precio Scrapeado ($)", "Diferencia ($)", "Variación (%)",
        "Título Producto Tienda", "Portal / Fuente", "Fecha", "Estado Aprobación"
    ])

    with pd.ExcelWriter(str(output_path), engine="openpyxl") as writer:
        df.to_excel(writer, sheet_name="Nuevos Precios Scraped", index=False)
        # Ajustar ancho de columnas automáticamente
        ws = writer.sheets["Nuevos Precios Scraped"]
        for col in ws.columns:
            max_len = max(len(str(cell.value or '')) for cell in col)
            col_letter = col[0].column_letter
            ws.column_dimensions[col_letter].width = min(max_len + 3, 50)

    return len(df)


def run_overnight_scraping(
    delay_seconds: float = 10.0,
    batch_size: int = 25,
    max_materials: Optional[int] = None,
    portals: Optional[List[str]] = None,
    output_excel: Optional[str] = None
) -> None:
    """Ejecuta el loop nocturno continuo de scraping."""
    if delay_seconds < 1.0:
        raise ValueError("delay_seconds no puede ser menor a 1.0s para evitar bloqueos")
    if batch_size < 1:
        raise ValueError("batch_size debe ser al menos 1")

    if portals is None:
        portals = ["epa"]

    fecha_hoy = datetime.now().strftime("%Y-%m-%d")
    
    if output_excel:
        excel_path = Path(output_excel)
    else:
        reports_dir = BASE_DIR / "reports"
        reports_dir.mkdir(parents=True, exist_ok=True)
        excel_path = reports_dir / f"precios_scraped_{fecha_hoy}.xlsx"

    print("=" * 70)
    print("[INICIO] BOT DE SCRAPING NOCTURNO APUPRO")
    print(f"[FECHA]  {fecha_hoy}")
    print(f"[DELAY]  Intervalo entre consultas: {delay_seconds} segundos")
    print(f"[LOTE]   Tamano de lote por consulta a BD: {batch_size}")
    print(f"[PORTAL] Portales activos: {', '.join(portals)}")
    print(f"[EXCEL]  Reporte Excel de salida: {excel_path}")
    print("[INFO]   Puedes detenerlo en cualquier momento con Ctrl+C (los datos se guardan al instante)")
    print("=" * 70)

    if cloudscraper is None:
        raise RuntimeError("cloudscraper no esta instalado en el entorno")

    scraper = cloudscraper.create_scraper(
        browser={'browser': 'chrome', 'platform': 'windows', 'mobile': False}
    )

    lista_navegadores = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 Edg/121.0.0.0"
    ]

    total_procesados = 0
    total_con_precio = 0
    offset = 0
    processed_in_session: Set[str] = set()
    start_time = time.time()

    # Priorizar EPA si está activo
    if "epa" in portals and portals[0] != "epa":
        portals = ["epa"] + [p for p in portals if p != "epa"]

    try:
        while True:
            # Obtener siguiente lote con OFFSET
            with get_db_session() as db:
                query = text('''
                    SELECT "CodMat", "Descri", "CosMat" 
                    FROM cost360_materials 
                    WHERE "Descri" IS NOT NULL AND TRIM("Descri") != ''
                      AND "CodMat" NOT IN (
                          SELECT material_id FROM historial_precios WHERE fecha = :fecha
                      )
                    ORDER BY "CodMat" ASC
                    LIMIT :batch_size OFFSET :offset
                ''')
                result = db.execute(query, {
                    "fecha": fecha_hoy, 
                    "batch_size": batch_size,
                    "offset": offset
                }).fetchall()

            if not result:
                print("\n[FIN] Todos los materiales del catalogo han sido escaneados para el dia de hoy!")
                break

            offset += len(result)
            materiales_lote = [{"codigo": r[0], "descripcion": r[1], "precio_bd": float(r[2] or 0.0)} for r in result]
            print(f"\n[CARGA] Nuevo lote de {len(materiales_lote)} materiales (Offset acumulado: {offset})...")

            for mat in materiales_lote:
                if max_materials and total_procesados >= max_materials:
                    print(f"\n[FIN] Se alcanzo el limite solicitado de {max_materials} materiales.")
                    return

                if mat["codigo"] in processed_in_session:
                    continue
                processed_in_session.add(mat["codigo"])

                if is_generic_placeholder(mat["descripcion"]):
                    print(f"[SKIP GENERICO] {mat['codigo']} | '{mat['descripcion']}'")
                    total_procesados += 1
                    continue

                total_procesados += 1
                termino = clean_search_term(mat["descripcion"])
                query_encoded = urllib.parse.quote_plus(termino)
                agente = random.choice(lista_navegadores)

                precio_encontrado: float = 0.0
                portal_exitoso: str = ""
                titulo_exitoso: str = ""

                hora_actual = datetime.now().strftime("%H:%M:%S")

                for portal in portals:
                    if precio_encontrado > 0:
                        break

                    if portal == "epa":
                        url = f"https://ve.epaenlinea.com/catalogsearch/result/?q={query_encoded}"
                        headers = {'User-Agent': agente, 'Referer': 'https://ve.epaenlinea.com/'}
                        try:
                            resp = scraper.get(url, headers=headers, timeout=12)
                            if resp.status_code == 200:
                                resp.encoding = resp.apparent_encoding or 'utf-8'
                                html_text = resp.text
                                titulos = re.findall(r'class="product-item-link"[^>]*>(.*?)</a>', html_text, re.DOTALL)
                                precios = re.findall(r'data-price-amount="([\d\.,]+)"', html_text)
                                if not precios:
                                    precios = re.findall(r'class="price"[^>]*>\s*(?:US\s*\$|\$)?\s*([\d\.,]+)', html_text)

                                for i, t in enumerate(titulos):
                                    titulo_limpio = normalize_text_dimensions(t.strip())
                                    if is_valid_product(mat["descripcion"], titulo_limpio):
                                        if i < len(precios):
                                            try:
                                                cand = float(precios[i].replace(',', '.'))
                                                if cand > 0:
                                                    precio_encontrado = cand
                                                    portal_exitoso = "epa"
                                                    titulo_exitoso = titulo_limpio
                                                    break
                                            except ValueError:
                                                continue
                        except Exception as req_err:
                            logger.error(f"Error consultando EPA para {mat['codigo']}: {req_err}", exc_info=False)

                    elif portal == "mercadolibre":
                        url = f"https://listado.mercadolibre.com.ve/{query_encoded}"
                        headers = {'User-Agent': agente, 'Referer': 'https://www.mercadolibre.com.ve/'}
                        try:
                            resp = scraper.get(url, headers=headers, timeout=15)
                            if resp.status_code == 200:
                                if "suspicious-traffic" in resp.text:
                                    continue
                                titulos = re.findall(r'class="ui-search-item__title"[^>]*>(.*?)<', resp.text)
                                precios = re.findall(r'class="andes-money-amount__fraction">([\d\.,]+)<', resp.text)
                                for i, t in enumerate(titulos):
                                    titulo_limpio = t.strip()
                                    if is_valid_product(mat["descripcion"], titulo_limpio):
                                        if i < len(precios):
                                            try:
                                                cand = float(precios[i].replace(',', '.'))
                                                if cand > 0:
                                                    precio_encontrado = cand
                                                    portal_exitoso = "mercadolibre"
                                                    titulo_exitoso = titulo_limpio
                                                    break
                                            except ValueError:
                                                continue
                        except Exception as req_err:
                            logger.error(f"Error consultando ML para {mat['codigo']}: {req_err}", exc_info=False)

                if precio_encontrado > 0:
                    total_con_precio += 1
                    diff = precio_encontrado - mat["precio_bd"]
                    diff_sign = "+" if diff >= 0 else ""
                    print(
                        f"[{hora_actual}] [{total_procesados}] [MATCH] {mat['codigo']} | "
                        f"BD: ${mat['precio_bd']:.2f} -> {portal_exitoso.upper()}: ${precio_encontrado:.2f} ({diff_sign}${diff:.2f}) | "
                        f"'{titulo_exitoso[:40]}...'"
                    )
                    # Guardar en BD
                    try:
                        with get_db_session() as db:
                            db.execute(text('''
                                INSERT INTO historial_precios (material_id, fecha, precio, fuente, status, titulo_scraped)
                                VALUES (:material_id, :fecha, :precio, :fuente, 'pending', :titulo_scraped)
                            '''), {
                                "material_id": mat["codigo"],
                                "fecha": fecha_hoy,
                                "precio": precio_encontrado,
                                "fuente": portal_exitoso,
                                "titulo_scraped": titulo_exitoso
                            })
                    except Exception as db_err:
                        logger.error(f"Error insertando en BD para {mat['codigo']}: {db_err}", exc_info=True)

                    # Actualizar Excel cada 5 precios encontrados
                    if total_con_precio % 5 == 0:
                        export_scraped_to_excel(excel_path, target_date=fecha_hoy)
                        print(f"   [EXCEL] Reporte actualizado ({total_con_precio} registros guardados)")
                else:
                    print(
                        f"[{hora_actual}] [{total_procesados}] [SKIP]  {mat['codigo']} | "
                        f"BD: ${mat['precio_bd']:.2f} -> Sin coincidencia exacta"
                    )

                # Pausa respetuosa para evitar ser bloqueado
                time.sleep(delay_seconds)

    except KeyboardInterrupt:
        print("\n\n[PAUSA] Interrupcion detectada por el usuario (Ctrl+C). Finalizando de forma segura...")

    finally:
        elapsed = time.time() - start_time
        hours, rem = divmod(elapsed, 3600)
        minutes, seconds = divmod(rem, 60)
        
        # Generar versión final del Excel
        total_excel = export_scraped_to_excel(excel_path, target_date=fecha_hoy)

        print("\n" + "=" * 70)
        print("[RESUMEN] SCRAPING NOCTURNO FINALIZADO")
        print(f"[TIEMPO]    {int(hours):02d}h {int(minutes):02d}m {int(seconds):02d}s")
        print(f"[EVALUADOS] {total_procesados} materiales")
        print(f"[EXITOSOS]  {total_con_precio} precios nuevos encontrados")
        print(f"[EXCEL]     {excel_path} ({total_excel} filas)")
        print("=" * 70)


def main() -> None:
    parser = argparse.ArgumentParser(description="Scraping Nocturno ApuPro con reporte Excel")
    parser.add_argument("--delay", type=float, default=10.0, help="Segundos de espera entre peticiones (default: 10.0s)")
    parser.add_argument("--batch-size", type=int, default=25, help="Tamaño de lote para consulta a base de datos (default: 25)")
    parser.add_argument("--limit", type=int, default=None, help="Límite máximo de materiales a procesar (opcional)")
    parser.add_argument("--portals", nargs="+", default=["epa"], help="Portales a consultar: epa mercadolibre (default: epa)")
    parser.add_argument("--output", type=str, default=None, help="Ruta del archivo Excel de salida")

    args = parser.parse_args()

    run_overnight_scraping(
        delay_seconds=args.delay,
        batch_size=args.batch_size,
        max_materials=args.limit,
        portals=args.portals,
        output_excel=args.output
    )


if __name__ == "__main__":
    main()
