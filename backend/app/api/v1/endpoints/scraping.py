import io
import time
import random
import re
import html
import urllib.parse
import threading
from datetime import datetime
from typing import List, Optional, Dict, Any, Set
from pydantic import BaseModel
from fastapi import APIRouter, BackgroundTasks, HTTPException, Depends
from fastapi.responses import Response
from sqlalchemy.orm import Session
from sqlalchemy import text
import requests
import pandas as pd

from app.db.base import get_db, get_db_session
from app.api.v1.endpoints.arko import get_current_arko_admin
from app.db.models.arko import ArkoAdmin
try:
    import cloudscraper
except ImportError:
    cloudscraper = None

router = APIRouter()

# --- MODELO DE CONFIGURACIÓN DINÁMICA ---
class ScrapingConfig(BaseModel):
    max_concurrency: int = 25
    headless: bool = True
    bypass_cloudflare: bool = True
    request_delay_ms: int = 10000
    active_portals: List[str] = ["epa", "mercadolibre"]
    batch_size: int = 10
    continuous_mode: bool = False
    portal_urls: Dict[str, str] = {
        "epa": "https://ve.epaenlinea.com/catalogsearch/result/?q={query}",
        "mercadolibre": "https://listado.mercadolibre.com.ve/{query}"
    }

# --- ESTADO GLOBAL DEL BOT ---
class BotState:
    def __init__(self) -> None:
        self.status: str = "idle"  # idle, running, paused, error
        self.config: ScrapingConfig = ScrapingConfig()
        self.current_task: Optional[threading.Thread] = None
        self.logs: List[Dict[str, Any]] = []
        self.stop_flag: bool = False
        self.pause_flag: bool = False
        
    def add_log(self, level: str, message: str) -> None:
        log_entry = {
            "id": f"{int(time.time() * 1000)}-{random.randint(100, 999)}",
            "timestamp": datetime.now().strftime("%H:%M:%S"),
            "level": level,
            "message": message
        }
        self.logs.append(log_entry)
        # Mantener solo últimos 1000 logs
        if len(self.logs) > 1000:
            self.logs = self.logs[-1000:]
        
    def set_status(self, status: str) -> None:
        self.status = status
        self.add_log("INFO", f"Estado cambiado a: {status}")

bot_state = BotState()

# --- NORMALIZACIÓN Y HELPERS DE TEXTO ---
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

def normalize_text_dimensions(text: str) -> str:
    """Decodifica entidades HTML y normaliza fracciones vulgares como ¼ a 1/4."""
    if not text:
        return ""
    unescaped = html.unescape(text)
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

def extract_numbers_and_dims(text: str) -> Set[str]:
    text = normalize_text_dimensions(text).replace('"', '').replace("'", "")
    pattern = r'\b(\d+(?:/\d+)?(?:[\.,]\d+)?)\b'
    matches = re.findall(pattern, text)
    return set(matches)

def get_keywords(text: str) -> Set[str]:
    text = normalize_text_dimensions(text).lower().replace('"', '').replace("'", "")
    words = re.findall(r'\b[a-z]{3,}\b', text)
    stop_words = {
        'para', 'con', 'sin', 'los', 'las', 'del', 'por', 'que', 'una', 'uno',
        'uso', 'tipo', 'color', 'marca', 'nacional', 'importado', 'varios'
    }
    return set([w for w in words if w not in stop_words])

def clean_search_term(desc: str) -> str:
    """Limpia la descripción eliminando palabras de relleno para buscar en EPA/portales."""
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
    """Verifica si el producto encontrado coincide con la descripción de la BD."""
    if not scraped_desc or not db_desc:
        return False
        
    db_desc_norm = normalize_text_dimensions(db_desc).lower()
    scraped_desc_norm = normalize_text_dimensions(scraped_desc).lower()
    
    nums_db = extract_numbers_and_dims(db_desc_norm)
    scraped_desc_clean = scraped_desc_norm.replace('"', '').replace("'", "")
    
    for num in nums_db:
        pattern = r'(?<!\d)' + re.escape(num) + r'(?!\d)'
        if not re.search(pattern, scraped_desc_clean):
            return False
            
    kw_db = get_keywords(db_desc_norm)
    kw_scraped = get_keywords(scraped_desc_norm)
    
    if kw_db:
        intersection = kw_db.intersection(kw_scraped)
        if len(intersection) == 0:
            return False
            
        ratio = len(intersection) / len(kw_db)
        required_ratio = 0.25 if nums_db else 0.5
        if ratio < required_ratio:
            return False
            
    return True

def safe_sleep(seconds: float) -> None:
    """Duerme en intervalos cortos de hasta 0.3s para responder de inmediato al Kill Switch."""
    end_time = time.time() + max(0.0, seconds)
    while time.time() < end_time:
        if bot_state.stop_flag:
            break
        time.sleep(min(0.3, max(0.0, end_time - time.time())))

# --- ORQUESTADOR DEL BOT CON CONFIGURACIÓN DINÁMICA ---
def scraping_seguro_configurable() -> None:
    """
    Scraping seguro con configuración dinámica del dashboard
    """
    bot_state.set_status("running")
    bot_state.add_log("INFO", "Iniciando scraping con configuración del dashboard...")
    
    config = bot_state.config
    fecha_version = datetime.now().strftime("%Y-%m-%d")
    
    try:
        if config.bypass_cloudflare and cloudscraper:
            bot_state.add_log("INFO", "Iniciando Cloudscraper para evadir Cloudflare/PerimeterX")
            scraper = cloudscraper.create_scraper(browser={'browser': 'chrome', 'platform': 'windows', 'mobile': False})
        else:
            bot_state.add_log("INFO", "Usando requests estándar (sin bypass)")
            scraper = requests
        
        lista_navegadores = [
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0"
        ]
        
        # Priorizar EPA si está en los portales activos
        portales = list(config.active_portals)
        if "epa" in portales and portales[0] != "epa":
            portales = ["epa"] + [p for p in portales if p != "epa"]
            
        processed_count = 0
        success_count = 0
        offset = 0
        processed_in_session: Set[str] = set()

        while True:
            if bot_state.stop_flag:
                bot_state.add_log("INFO", "Bot detenido por Kill Switch")
                break

            with get_db_session() as db:
                result = db.execute(text('''
                    SELECT "CodMat", "Descri", "CosMat" 
                    FROM cost360_materials 
                    WHERE "Descri" IS NOT NULL AND TRIM("Descri") != ''
                      AND "CodMat" NOT IN (
                          SELECT material_id FROM historial_precios WHERE fecha = :fecha
                      )
                    ORDER BY "CodMat" ASC
                    LIMIT :batch_size OFFSET :offset
                '''), {
                    "batch_size": config.batch_size, 
                    "fecha": fecha_version,
                    "offset": offset
                }).fetchall()

                materiales_db = [{"codigo": row[0], "descripcion": row[1], "precio_bd": row[2]} for row in result]
            
            if not materiales_db:
                bot_state.add_log("INFO", "Todos los materiales disponibles para la fecha han sido procesados")
                break
            
            # Avanzar offset para el siguiente lote
            offset += len(materiales_db)
            bot_state.add_log("INFO", f"Procesando lote de {len(materiales_db)} materiales (Total acumulado: {processed_count}, Offset: {offset})")
            
            for indice, mat in enumerate(materiales_db):
                if bot_state.stop_flag:
                    bot_state.add_log("INFO", "Bot detenido por Kill Switch")
                    break
                    
                while bot_state.pause_flag:
                    time.sleep(0.5)
                    if bot_state.stop_flag:
                        break
                
                if bot_state.stop_flag:
                    break

                # Evitar repetir en la misma sesión
                if mat['codigo'] in processed_in_session:
                    continue
                processed_in_session.add(mat['codigo'])

                # Saltar placeholders genéricos de APU
                if is_generic_placeholder(mat['descripcion']):
                    bot_state.add_log("INFO", f"Material genérico/placeholder saltado: {mat['codigo']} ({mat['descripcion']})")
                    processed_count += 1
                    continue
                    
                agente_aleatorio = random.choice(lista_navegadores)
                precio_detectado = 0.0
                portal_exitoso = ''
                titulo_exitoso = ''
                
                try:
                    termino_limpio = clean_search_term(mat['descripcion'])
                    descripcion_url = urllib.parse.quote_plus(termino_limpio)
                    
                    bot_state.add_log("INFO", f"Procesando [{indice+1}/{len(materiales_db)}] {mat['codigo']}: {mat['descripcion']} -> Busqueda: '{termino_limpio}'")
                    
                    for portal_actual in portales:
                        if precio_detectado > 0 or bot_state.stop_flag:
                            break

                        url_template = config.portal_urls.get(portal_actual)
                        if not url_template:
                            bot_state.add_log("WARN", f"Portal '{portal_actual}' no tiene URL configurada, saltando...")
                            continue

                        url = url_template.replace('{query}', descripcion_url)

                        if portal_actual == 'epa':
                            headers = {'User-Agent': agente_aleatorio, 'Referer': 'https://ve.epaenlinea.com/'}
                            try:
                                response = scraper.get(url, headers=headers, timeout=12)
                                if response.status_code == 200:
                                    response.encoding = response.apparent_encoding or 'utf-8'
                                    html_content = response.text
                                    
                                    raw_titles = re.findall(r'class="product-item-link"[^>]*>(.*?)</a>', html_content, re.DOTALL)
                                    raw_prices = re.findall(r'data-price-amount="([\d\.,]+)"', html_content)
                                    
                                    for raw_t, raw_p in zip(raw_titles, raw_prices):
                                        try:
                                            precio_candidato = float(raw_p.replace(',', '.'))
                                            titulo_candidato = normalize_text_dimensions(raw_t.strip())
                                            if precio_candidato > 0:
                                                if not is_valid_product(mat['descripcion'], titulo_candidato):
                                                    continue
                                                precio_detectado = precio_candidato
                                                portal_exitoso = portal_actual
                                                titulo_exitoso = titulo_candidato
                                                break
                                        except Exception:
                                            continue
                            except Exception as epa_err:
                                bot_state.add_log("WARN", f"Error consultando EPA: {epa_err}")
                                            
                        elif portal_actual == 'mercadolibre':
                            headers = {'User-Agent': agente_aleatorio, 'Referer': 'https://www.mercadolibre.com.ve/'}
                            try:
                                response = scraper.get(url, headers=headers, timeout=12)
                                if response.status_code == 200:
                                    response.encoding = response.apparent_encoding or 'utf-8'
                                    html_content = response.text
                                    if "suspicious-traffic" in html_content:
                                        bot_state.add_log("WARN", "MercadoLibre requiere verificación anti-bot (captcha). Saltando a otros portales...")
                                        continue

                                    raw_titles = re.findall(r'class="ui-search-item__title"[^>]*>(.*?)<', html_content)
                                    raw_prices = [m[0] if isinstance(m, tuple) else m for m in re.findall(
                                        r'class="andes-money-amount__fraction">([\d\.,]+)<|<meta itemprop="price" content="([\d\.,]+)">',
                                        html_content
                                    ) if (isinstance(m, tuple) and any(m)) or isinstance(m, str)]
                                    
                                    for raw_t, raw_p in zip(raw_titles, raw_prices):
                                        try:
                                            precio_candidato = float(raw_p.replace(',', '.'))
                                            titulo_candidato = normalize_text_dimensions(raw_t.strip())
                                            if precio_candidato > 0:
                                                if not is_valid_product(mat['descripcion'], titulo_candidato):
                                                    continue
                                                precio_detectado = precio_candidato
                                                portal_exitoso = portal_actual
                                                titulo_exitoso = titulo_candidato
                                                break
                                        except Exception:
                                            continue
                            except Exception as ml_err:
                                bot_state.add_log("WARN", f"Error consultando MercadoLibre: {ml_err}")
                    
                    if precio_detectado > 0:
                        bot_state.add_log("INFO", f"[EXITO] {mat['codigo']} | BD: ${mat['precio_bd']} | Scraping: ${precio_detectado:.2f} | Fuente: {portal_exitoso} | {titulo_exitoso}")
                        try:
                            with get_db_session() as db_hist:
                                db_hist.execute(text('''
                                    INSERT INTO historial_precios (material_id, fecha, precio, fuente, status, titulo_scraped)
                                    VALUES (:material_id, :fecha, :precio, :fuente, 'pending', :titulo_scraped)
                                '''), {
                                    "material_id": mat['codigo'],
                                    "fecha": fecha_version,
                                    "precio": precio_detectado,
                                    "fuente": portal_exitoso,
                                    "titulo_scraped": titulo_exitoso
                                })
                                db_hist.commit()
                            success_count += 1
                        except Exception as db_error:
                            bot_state.add_log("ERROR", f"Error guardando en BD: {db_error}")
                    else:
                        bot_state.add_log("WARN", f"[SIN PRECIO] {mat['codigo']} | BD: ${mat['precio_bd']}")
                        
                except Exception as e:
                    bot_state.add_log("ERROR", f"Error procesando {mat['codigo']}: {str(e)}")
                
                processed_count += 1
                
                # Delay configurable e interrumpible
                delay_seconds = config.request_delay_ms / 1000
                bot_state.add_log("INFO", f"Esperando {delay_seconds:.1f}s antes del siguiente material...")
                safe_sleep(delay_seconds)
                if bot_state.stop_flag:
                    bot_state.add_log("INFO", "Bot detenido por Kill Switch")
                    break
        
            bot_state.add_log("INFO", f"Lote finalizado: {processed_count} acumulados, {success_count} exitosos")
            if not config.continuous_mode or bot_state.stop_flag:
                break
        
        bot_state.add_log("INFO", f"Sesión de scraping finalizada: {processed_count} procesados, {success_count} exitosos")
        bot_state.set_status("idle")
        
    except Exception as e:
        bot_state.add_log("ERROR", f"Error crítico en scraping: {str(e)}")
        bot_state.set_status("error")

# --- ENDPOINTS DE CONTROL ---
@router.post("/start")
async def start_scraping(current_user: ArkoAdmin = Depends(get_current_arko_admin)) -> Dict[str, Any]:
    """Iniciar el bot de scraping (requiere admin)"""
    if bot_state.status == "running":
        raise HTTPException(status_code=400, detail="El bot ya está ejecutándose")
    
    bot_state.stop_flag = False
    bot_state.pause_flag = False
    
    task = threading.Thread(target=scraping_seguro_configurable)
    bot_state.current_task = task
    task.start()
    
    return {"status": "started", "message": "Bot iniciado en background"}

@router.post("/pause")
async def pause_scraping(current_user: ArkoAdmin = Depends(get_current_arko_admin)) -> Dict[str, Any]:
    """Pausar el bot de scraping (requiere admin)"""
    if bot_state.status != "running":
        raise HTTPException(status_code=400, detail="El bot no está ejecutándose")
    
    bot_state.pause_flag = True
    bot_state.set_status("paused")
    return {"status": "paused", "message": "Bot pausado"}

@router.post("/resume")
async def resume_scraping(current_user: ArkoAdmin = Depends(get_current_arko_admin)) -> Dict[str, Any]:
    """Reanudar el bot de scraping (requiere admin)"""
    if bot_state.status != "paused":
        raise HTTPException(status_code=400, detail="El bot no está pausado")
    
    bot_state.pause_flag = False
    bot_state.set_status("running")
    return {"status": "resumed", "message": "Bot reanudado"}

@router.post("/kill")
async def kill_scraping(current_user: ArkoAdmin = Depends(get_current_arko_admin)) -> Dict[str, Any]:
    """Detener completamente el bot de scraping (requiere admin)"""
    bot_state.stop_flag = True
    bot_state.pause_flag = False
    bot_state.set_status("idle")
    bot_state.add_log("INFO", "Kill Switch accionado por el usuario. Deteniendo bot...")
    return {"status": "killed", "message": "Bot detenido completamente"}

# --- ENDPOINTS DE CONFIGURACIÓN ---
@router.get("/config")
async def get_config(current_user: ArkoAdmin = Depends(get_current_arko_admin)) -> ScrapingConfig:
    """Obtener configuración actual del bot"""
    return bot_state.config

@router.put("/config")
async def update_config(config: ScrapingConfig, current_user: ArkoAdmin = Depends(get_current_arko_admin)) -> Dict[str, Any]:
    """Actualizar configuración del bot"""
    bot_state.config = config
    bot_state.add_log("INFO", f"Configuración actualizada: {config}")
    return {"status": "updated", "config": config}

# --- ENDPOINTS DE ESTADO Y LOGS ---
@router.get("/status")
async def get_status(current_user: ArkoAdmin = Depends(get_current_arko_admin)) -> Dict[str, Any]:
    """Obtener estado actual del bot"""
    return {
        "status": bot_state.status,
        "config": bot_state.config,
        "log_count": len(bot_state.logs)
    }

@router.get("/logs")
async def get_logs(limit: int = 100, current_user: ArkoAdmin = Depends(get_current_arko_admin)) -> List[Dict[str, Any]]:
    """Obtener logs del bot"""
    return bot_state.logs[-limit:]

@router.delete("/logs")
async def clear_logs(current_user: ArkoAdmin = Depends(get_current_arko_admin)) -> Dict[str, Any]:
    """Limpiar logs del bot"""
    bot_state.logs = []
    return {"status": "cleared"}

# --- ENDPOINTS DE PENDING RESULTS (MANTENIDOS DEL ORIGINAL) ---
@router.get("/pending")
async def get_pending_scraping_results(
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_arko_admin)
) -> List[Dict[str, Any]]:
    results = db.execute(text('''
        SELECT h.id, h.material_id, h.precio as scraped_price, h.fuente, h.fecha, h.titulo_scraped, c."Descri" as db_desc, c."CosMat" as db_price 
        FROM historial_precios h 
        JOIN cost360_materials c ON h.material_id = c."CodMat" 
        WHERE h.status = 'pending' 
        ORDER BY h.created_at DESC
    ''')).fetchall()
    
    return [
        {
            "id": r[0],
            "material_id": r[1],
            "scraped_price": float(r[2]),
            "fuente": r[3],
            "fecha": str(r[4]),
            "titulo_scraped": r[5],
            "db_desc": r[6],
            "db_price": float(r[7]) if r[7] else 0.0
        } for r in results
    ]

class ApproveRequest(BaseModel):
    price: float

@router.post("/approve/{result_id}")
async def approve_scraping_result(
    result_id: int,
    req: ApproveRequest,
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_arko_admin)
) -> Dict[str, Any]:
    row = db.execute(text("SELECT material_id FROM historial_precios WHERE id = :id AND status = 'pending'"), {"id": result_id}).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Result not found or already processed")
        
    mat_id = row[0]
    
    db.execute(text("UPDATE historial_precios SET status = 'approved', precio = :price WHERE id = :id"), {"id": result_id, "price": req.price})
    db.execute(text("UPDATE cost360_materials SET \"CosMat\" = :price WHERE \"CodMat\" = :mat_id"), {"price": req.price, "mat_id": mat_id})
    
    db.commit()
    return {"status": "success"}

@router.post("/reject/{result_id}")
async def reject_scraping_result(
    result_id: int,
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_arko_admin)
) -> Dict[str, Any]:
    db.execute(text("UPDATE historial_precios SET status = 'rejected' WHERE id = :id"), {"id": result_id})
    db.commit()
    return {"status": "success"}


class VersionarRequest(BaseModel):
    limit: int = 25


@router.post("/versionar-precios-db")
async def versionar_precios_db(
    payload: Optional[VersionarRequest] = None,
    current_user: ArkoAdmin = Depends(get_current_arko_admin)
) -> Dict[str, Any]:
    """Lanzar una tanda de scraping (compatible con el botón del frontend)."""
    limit = payload.limit if payload else 25
    if limit < 1:
        raise HTTPException(status_code=400, detail="limit debe ser mayor o igual a 1")
    
    bot_state.config.batch_size = limit
    if bot_state.status != "running":
        bot_state.stop_flag = False
        bot_state.pause_flag = False
        task = threading.Thread(target=scraping_seguro_configurable)
        bot_state.current_task = task
        task.start()
    return {"status": "processing", "message": f"Escaneo de {limit} materiales iniciado en segundo plano"}


@router.get("/export-excel")
async def export_scraped_excel(
    date: Optional[str] = None,
    current_user: ArkoAdmin = Depends(get_current_arko_admin)
) -> Response:
    """Genera y descarga un archivo Excel con todos los precios scrapeados y variaciones."""
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
        if date:
            query_str += " WHERE h.fecha = :date"
            query_str += " ORDER BY h.id DESC"
            rows = db.execute(text(query_str), {"date": date}).fetchall()
        else:
            query_str += " ORDER BY h.id DESC"
            rows = db.execute(text(query_str)).fetchall()

    if not rows:
        raise HTTPException(status_code=404, detail="No hay precios en el historial para exportar")

    df = pd.DataFrame(rows, columns=[
        "ID", "Código", "Descripción Base de Datos", "Precio Anterior BD ($)",
        "Precio Scrapeado ($)", "Diferencia ($)", "Variación (%)",
        "Título Producto Tienda", "Portal / Fuente", "Fecha", "Estado Aprobación"
    ])

    excel_buffer = io.BytesIO()
    with pd.ExcelWriter(excel_buffer, engine="openpyxl") as writer:
        df.to_excel(writer, sheet_name="Nuevos Precios Scraped", index=False)
        ws = writer.sheets["Nuevos Precios Scraped"]
        for col in ws.columns:
            max_len = max(len(str(cell.value or '')) for cell in col)
            col_letter = col[0].column_letter
            ws.column_dimensions[col_letter].width = min(max_len + 3, 50)

    excel_buffer.seek(0)
    file_date = date or datetime.now().strftime("%Y-%m-%d")
    filename = f"precios_scraped_{file_date}.xlsx"

    return Response(
        content=excel_buffer.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )