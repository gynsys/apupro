import time
import random
import re
import threading
from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from fastapi import APIRouter, BackgroundTasks, HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
import requests
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
    request_delay_ms: int = 20000
    active_portals: List[str] = ["mercadolibre", "epa"]
    batch_size: int = 10

# --- ESTADO GLOBAL DEL BOT ---
class BotState:
    def __init__(self):
        self.status = "idle"  # idle, running, paused, error
        self.config = ScrapingConfig()
        self.current_task: Optional[threading.Thread] = None
        self.logs: List[Dict[str, Any]] = []
        self.stop_flag = False
        self.pause_flag = False
        
    def add_log(self, level: str, message: str):
        log_entry = {
            "id": f"{len(self.logs)}-{datetime.now().timestamp()}",
            "timestamp": datetime.now().strftime("%H:%M:%S"),
            "level": level,
            "message": message
        }
        self.logs.append(log_entry)
        # Mantener solo últimos 1000 logs
        if len(self.logs) > 1000:
            self.logs = self.logs[-1000:]
        
    def set_status(self, status: str):
        self.status = status
        self.add_log("INFO", f"Estado cambiado a: {status}")

bot_state = BotState()

# --- FUNCIONES DE VALIDACIÓN (MANTENIDAS DEL ORIGINAL) ---
def extract_numbers_and_dims(text):
    text = text.replace('"', '').replace("'", "")
    pattern = r'\b(\d+(?:/\d+)?(?:[\.,]\d+)?)\b'
    matches = re.findall(pattern, text)
    return set(matches)

def get_keywords(text):
    text = text.lower().replace('"', '').replace("'", "")
    words = re.findall(r'\b[a-z]{3,}\b', text)
    stop_words = {'para', 'con', 'sin', 'los', 'las', 'del', 'por', 'que', 'una', 'uso', 'tipo'}
    return set([w for w in words if w not in stop_words])

def clean_search_term(desc):
    desc_upper = desc.upper()
    medida = re.search(r'\d+(?:/\d+)?(?:[\.,]\d+)?\s*(?:MM|CM|M|PULG|\"|KG|G|L|ML)', desc_upper)
    medida_str = medida.group() if medida else ''
    
    palabras = re.findall(r'\b[A-Z]{3,}\b', desc_upper)
    stop_words = {'PARA', 'CON', 'SIN', 'LOS', 'LAS', 'DEL', 'POR'}
    palabras = [p for p in palabras if p not in stop_words]
    
    core = ' '.join(palabras[:3])
    query = f'{core} {medida_str}'.strip()
    return query

def is_valid_product(db_desc, scraped_desc):
    if not scraped_desc: return False
    db_desc = db_desc.lower()
    scraped_desc = scraped_desc.lower()
    
    nums_db = extract_numbers_and_dims(db_desc)
    scraped_desc_clean = scraped_desc.replace('"', '').replace("'", "")
    
    for num in nums_db:
        pattern = r'(?<!\d)' + re.escape(num) + r'(?!\d)'
        if not re.search(pattern, scraped_desc_clean):
            return False
            
    kw_db = get_keywords(db_desc)
    kw_scraped = get_keywords(scraped_desc)
    
    if kw_db:
        intersection = kw_db.intersection(kw_scraped)
        if len(intersection) == 0:
            return False
            
        ratio = len(intersection) / len(kw_db)
        required_ratio = 0.3 if nums_db else 0.6
        if ratio < required_ratio:
            return False
            
    return True

# --- ORQUESTADOR DEL BOT CON CONFIGURACIÓN DINÁMICA ---
def scraping_seguro_configurable():
    """
    Scraping seguro con configuración dinámica del dashboard
    """
    bot_state.set_status("running")
    bot_state.add_log("INFO", "Iniciando scraping con configuración del dashboard...")
    
    config = bot_state.config
    fecha_version = datetime.now().strftime("%Y-%m-%d")
    
    try:
        from app.db.base import get_db
        
        with get_db() as db:
            result = db.execute(text(f'''
                SELECT "CodMat", "Descri", "CosMat" 
                FROM cost360_materials 
                WHERE "CodMat" LIKE 'MAT%'
                LIMIT {config.batch_size}
            ''')).fetchall()
            
            materiales_db = [{"codigo": row[0], "descripcion": row[1], "precio_bd": row[2]} for row in result]
        
        if not materiales_db:
            bot_state.add_log("WARN", "No se encontraron materiales en la base de datos")
            bot_state.set_status("idle")
            return
        
        bot_state.add_log("INFO", f"Procesando lote de {len(materiales_db)} materiales")
        bot_state.add_log("INFO", f"Configuración: Concurrency={config.max_concurrency}, Delay={config.request_delay_ms}ms, Portals={config.active_portals}")
        
        # Inicializar Cloudscraper si bypass_cloudflare está activo
        if config.bypass_cloudflare:
            bot_state.add_log("INFO", "Iniciando Cloudscraper para evadir Cloudflare/PerimeterX")
            scraper = cloudscraper.create_scraper(browser={'browser': 'chrome', 'platform': 'windows', 'mobile': False})
        else:
            bot_state.add_log("INFO", "Usando requests estándar (sin bypass)")
            scraper = requests
        
        # User-Agents para rotación
        lista_navegadores = [
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0",
            "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1"
        ]
        
        portales = config.active_portals
        processed_count = 0
        success_count = 0
        
        for indice, mat in enumerate(materiales_db):
            # Verificar flags de control
            if bot_state.stop_flag:
                bot_state.add_log("INFO", "Bot detenido por Kill Switch")
                break
                
            while bot_state.pause_flag:
                time.sleep(1)
                if bot_state.stop_flag:
                    break
            
            if bot_state.stop_flag:
                break
                
            agente_aleatorio = random.choice(lista_navegadores)
            precio_detectado = 0
            portal_exitoso = ''
            titulo_exitoso = ''
            
            try:
                termino_limpio = clean_search_term(mat['descripcion'])
                descripcion_url = termino_limpio.replace(' ', '+').replace('/', '')
                
                bot_state.add_log("INFO", f"Procesando [{indice+1}/{len(materiales_db)}] {mat['codigo']}: {mat['descripcion']}")
                
                for portal_actual in portales:
                    if precio_detectado > 0:
                        break
                        
                    if portal_actual == 'epa':
                        url = f'https://ve.epaenlinea.com/catalogsearch/result/?q={descripcion_url}'
                        headers = {'User-Agent': agente_aleatorio, 'Referer': 'https://ve.epaenlinea.com/'}
                        response = scraper.get(url, headers=headers, timeout=15)
                        
                        if response.status_code == 200:
                            html_content = response.text
                            titulo_detectado = ''
                            title_matches = re.findall(r'class="product-item-link"[^>]*>(.*?)</a>', html_content, re.DOTALL)
                            if title_matches:
                                titulo_detectado = title_matches[0].strip()

                            precio_patterns = [
                                r'data-price-amount="([\d\.,]+)"',
                                r'class="price"[^>]*>\s*(?:US\s*\$|\$)?\s*([\d\.,]+)',
                            ]
                            
                            for pattern in precio_patterns:
                                matches = re.findall(pattern, html_content)
                                if matches:
                                    try:
                                        precio_candidato = float(matches[0].replace(',', '.'))
                                        if precio_candidato > 0:
                                            if titulo_detectado and not is_valid_product(mat['descripcion'], titulo_detectado):
                                                bot_state.add_log("WARN", f"Descartado (Falso Positivo EPA): '{titulo_detectado}'")
                                                break
                                            precio_detectado = precio_candidato
                                            portal_exitoso = portal_actual
                                            titulo_exitoso = titulo_detectado
                                            break
                                    except:
                                        continue
                                        
                    elif portal_actual == 'mercadolibre':
                        url = f'https://listado.mercadolibre.com.ve/{descripcion_url}'
                        headers = {'User-Agent': agente_aleatorio, 'Referer': 'https://www.mercadolibre.com.ve/'}
                        response = scraper.get(url, headers=headers, timeout=15)
                        
                        if response.status_code == 200:
                            html_content = response.text
                            titulo_detectado = ''
                            title_matches = re.findall(r'class="ui-search-item__title"[^>]*>(.*?)<', html_content)
                            if title_matches:
                                titulo_detectado = title_matches[0].strip()

                            precio_patterns = [
                                r'class="andes-money-amount__fraction">([\d\.,]+)<',
                                r'<meta itemprop="price" content="([\d\.,]+)">',
                                r'USD\s*\$\s*(\d{1,3}(?:[\.,]\d{3})*(?:[\.,]\d{2}))',
                                r'\$\s*(\d{1,3}(?:[\.,]\d{3})*(?:[\.,]\d{2}))'
                            ]
                            
                            for pattern in precio_patterns:
                                matches = re.findall(pattern, html_content)
                                if matches:
                                    try:
                                        precio_candidato = float(matches[0].replace(',', '.'))
                                        if precio_candidato > 0:
                                            if titulo_detectado and not is_valid_product(mat['descripcion'], titulo_detectado):
                                                bot_state.add_log("WARN", f"Descartado (Falso Positivo ML): '{titulo_detectado}'")
                                                break
                                            precio_detectado = precio_candidato
                                            portal_exitoso = portal_actual
                                            titulo_exitoso = titulo_detectado
                                            break
                                    except:
                                        continue
                
                if precio_detectado > 0:
                    bot_state.add_log("INFO", f"[EXITO] {mat['codigo']} | BD: ${mat['precio_bd']} | Scraping: ${precio_detectado} | Fuente: {portal_exitoso}")
                    try:
                        with get_db() as db_hist:
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
            
            # Delay configurable
            delay_seconds = config.request_delay_ms / 1000
            bot_state.add_log("INFO", f"Esperando {delay_seconds:.1f}s antes del siguiente material...")
            time.sleep(delay_seconds)
        
        bot_state.add_log("INFO", f"Lote finalizado: {processed_count} procesados, {success_count} exitosos")
        bot_state.set_status("idle")
        
    except Exception as e:
        bot_state.add_log("ERROR", f"Error crítico en scraping: {str(e)}")
        bot_state.set_status("error")

# --- ENDPOINTS DE CONTROL ---
@router.post("/start")
async def start_scraping():
    """Iniciar el bot de scraping"""
    if bot_state.status == "running":
        raise HTTPException(status_code=400, detail="El bot ya está ejecutándose")
    
    bot_state.stop_flag = False
    bot_state.pause_flag = False
    
    # Iniciar en thread separado
    task = threading.Thread(target=scraping_seguro_configurable)
    bot_state.current_task = task
    task.start()
    
    return {"status": "started", "message": "Bot iniciado en background"}

@router.post("/pause")
async def pause_scraping():
    """Pausar el bot de scraping"""
    if bot_state.status != "running":
        raise HTTPException(status_code=400, detail="El bot no está ejecutándose")
    
    bot_state.pause_flag = True
    bot_state.set_status("paused")
    return {"status": "paused", "message": "Bot pausado"}

@router.post("/resume")
async def resume_scraping():
    """Reanudar el bot de scraping"""
    if bot_state.status != "paused":
        raise HTTPException(status_code=400, detail="El bot no está pausado")
    
    bot_state.pause_flag = False
    bot_state.set_status("running")
    return {"status": "resumed", "message": "Bot reanudado"}

@router.post("/kill")
async def kill_scraping():
    """Detener completamente el bot de scraping"""
    bot_state.stop_flag = True
    bot_state.pause_flag = False
    bot_state.set_status("idle")
    
    if bot_state.current_task and bot_state.current_task.is_alive():
        bot_state.current_task.join(timeout=5)
    
    return {"status": "killed", "message": "Bot detenido completamente"}

# --- ENDPOINTS DE CONFIGURACIÓN ---
@router.get("/config")
async def get_config():
    """Obtener configuración actual"""
    return bot_state.config

@router.put("/config")
async def update_config(config: ScrapingConfig):
    """Actualizar configuración del bot"""
    bot_state.config = config
    bot_state.add_log("INFO", f"Configuración actualizada: {config}")
    return {"status": "updated", "config": config}

# --- ENDPOINTS DE ESTADO Y LOGS ---
@router.get("/status")
async def get_status():
    """Obtener estado actual del bot"""
    return {
        "status": bot_state.status,
        "config": bot_state.config,
        "log_count": len(bot_state.logs)
    }

@router.get("/logs")
async def get_logs(limit: int = 100):
    """Obtener logs del bot"""
    return bot_state.logs[-limit:]

@router.delete("/logs")
async def clear_logs():
    """Limpiar logs del bot"""
    bot_state.logs = []
    return {"status": "cleared"}

# --- ENDPOINTS DE PENDING RESULTS (MANTENIDOS DEL ORIGINAL) ---
@router.get("/pending")
async def get_pending_scraping_results():
    from app.db.base import get_db
    with get_db() as db:
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
async def approve_scraping_result(result_id: int, req: ApproveRequest):
    from app.db.base import get_db
    with get_db() as db:
        row = db.execute(text("SELECT material_id FROM historial_precios WHERE id = :id AND status = 'pending'"), {"id": result_id}).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Result not found or already processed")
            
        mat_id = row[0]
        
        db.execute(text("UPDATE historial_precios SET status = 'approved', precio = :price WHERE id = :id"), {"id": result_id, "price": req.price})
        db.execute(text("UPDATE cost360_materials SET \"CosMat\" = :price WHERE \"CodMat\" = :mat_id"), {"price": req.price, "mat_id": mat_id})
        
        db.commit()
    return {"status": "success"}

@router.post("/reject/{result_id}")
async def reject_scraping_result(result_id: int):
    from app.db.base import get_db
    with get_db() as db:
        db.execute(text("UPDATE historial_precios SET status = 'rejected' WHERE id = :id"), {"id": result_id})
        db.commit()
    return {"status": "success"}