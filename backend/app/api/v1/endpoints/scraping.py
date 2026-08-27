import time
import random
import re
from datetime import datetime
from typing import List
from pydantic import BaseModel
from fastapi import APIRouter, BackgroundTasks, HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
import requests

router = APIRouter()

# --- FUNCIONES DE VALIDACION DE SIMILITUD Y DIMENSIONES ---
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
    # Extraer medida si existe
    medida = re.search(r'\d+(?:/\d+)?(?:[\.,]\d+)?\s*(?:MM|CM|M|PULG|\"|KG|G|L|ML)', desc_upper)
    medida_str = medida.group() if medida else ''
    
    # Tomar las primeras 3 palabras ignorando codigos
    palabras = re.findall(r'\b[A-Z]{3,}\b', desc_upper)
    
    # Ignorar palabras de parada comunes en nombres de materiales
    stop_words = {'PARA', 'CON', 'SIN', 'LOS', 'LAS', 'DEL', 'POR'}
    palabras = [p for p in palabras if p not in stop_words]
    
    core = ' '.join(palabras[:3])
    
    query = f'{core} {medida_str}'.strip()
    return query

def is_valid_product(db_desc, scraped_desc):
    if not scraped_desc: return False
    db_desc = db_desc.lower()
    scraped_desc = scraped_desc.lower()
    
    # 1. Validar dimensiones y números (REQUISITO ESTRICTO)
    nums_db = extract_numbers_and_dims(db_desc)
    scraped_desc_clean = scraped_desc.replace('"', '').replace("'", "")
    
    for num in nums_db:
        # (?!\d) asegura que 110 coincida con 110mm pero no con 1100
        # (?<!\d) asegura que no sea sufijo de otro numero (ej 1 no coincida con 11)
        pattern = r'(?<!\d)' + re.escape(num) + r'(?!\d)'
        if not re.search(pattern, scraped_desc_clean):
            return False
            
    # 2. Validar palabras clave
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

# --- SIMULACIÓN HUMANA ULTRA LENTA (MODO GRATUITO CON REQUESTS) ---
def scraping_seguro_gratuito_db():
    """
    Scraping seguro en modo gratuito con Requests simple
    3 estrategias de mitigación:
    1. Batching (procesar solo 25 materiales por lote)
    2. Jitter (tiempos de espera variables 15-40 segundos)
    3. User-Agent spoofing (rotación de encabezados)
    """
    print("Iniciando scraping seguro con Requests...")
    fecha_version = datetime.now().strftime("%Y-%m-%d")
    
    # 📌 TRUCO 1: LIMITAR LA CONSULTA A LOTES PEQUEÑOS
    from app.db.base import get_db
    
    with get_db() as db:
        result = db.execute(text('''
            SELECT "CodMat", "Descri", "CosMat" 
            FROM cost360_materials 
            WHERE "CodMat" LIKE 'MAT%'
            LIMIT 10
        ''')).fetchall()
        
        materiales_db = [{"codigo": row[0], "descripcion": row[1], "precio_bd": row[2]} for row in result]
    
    if not materiales_db:
        print("No se encontraron materiales registrados en la Base de Datos.")
        return
    
    # Inicializar Cloudscraper para evadir bloqueos de Cloudflare/PerimeterX
    import cloudscraper
    scraper = cloudscraper.create_scraper(browser={'browser': 'chrome', 'platform': 'windows', 'mobile': False})
    
    # Lista de User-Agents (Ya no son tan críticos si usamos cloudscraper, pero ayudan a EPA)
    lista_navegadores = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0",
        "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1"
    ]
    
    # Portales - MercadoLibre y EPA Venezuela
    portales = ["mercadolibre", "epa"]

    print(f"Procesando lote de {len(materiales_db)} materiales con delays variables...")
    

    for indice, mat in enumerate(materiales_db):
        agente_aleatorio = random.choice(lista_navegadores)
        precio_detectado = 0
        portal_exitoso = ''
        titulo_exitoso = ''
        
        try:
            termino_limpio = clean_search_term(mat['descripcion'])
            descripcion_url = termino_limpio.replace(' ', '+').replace('/', '')
            
            # CADENA DE FALLBACKS: Intentar EPA primero, si falla MercadoLibre
            portales_a_intentar = ['epa', 'mercadolibre']
            
            for portal_actual in portales_a_intentar:
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
                                            print(f"Descartado (Falso Positivo EPA). Buscado: '{mat['descripcion']}', Encontrado: '{titulo_detectado}'")
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
                                            print(f"Descartado (Falso Positivo ML). Buscado: '{mat['descripcion']}', Encontrado: '{titulo_detectado}'")
                                            break
                                        precio_detectado = precio_candidato
                                        portal_exitoso = portal_actual
                                        titulo_exitoso = titulo_detectado
                                        break
                                except:
                                    continue
                
                # Jitter entre reintentos de portales
                if precio_detectado == 0:
                    time.sleep(random.uniform(2.0, 5.0))

            if precio_detectado > 0:
                print(f"[COMPARATIVO] {mat['codigo']} | BD: ${mat['precio_bd']} | Scraping: ${precio_detectado} | Fuente: {portal_exitoso}")
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
                except Exception as db_error:
                    print(f"Error guardando en BD: {db_error}")
            else:
                print(f"[SIN PRECIO] {mat['codigo']} | BD: ${mat['precio_bd']} | Fuente: N/A")
                
        except Exception as e:
            print(f"Error procesando {mat['codigo']}: {str(e)}")
            
        tiempo_espera = random.uniform(15.0, 40.0)
        print(f"Esperando {round(tiempo_espera, 1)} segundos para evadir bloqueos...")
        time.sleep(tiempo_espera)
    print(f"Lote de {len(materiales_db)} materiales finalizado de forma segura.")
    print(f"Versión histórica grabada con fecha: {fecha_version}")

# Pydantic models para la API
class ScrapingRequest(BaseModel):
    limit: int = 25  # Por defecto procesar 25 materiales

class ScrapingResponse(BaseModel):
    status: str
    message: str
    processed: int = 0

# Endpoint para iniciar el scraping
@router.post("/versionar-precios-db")
async def endpoint_iniciar_versionamiento(
    request: ScrapingRequest, 
    background_tasks: BackgroundTasks
):
    """
    Endpoint que inicia el scraping en background para evitar timeouts
    """
    # Levantar proceso asíncrono en segundo plano
    background_tasks.add_task(scraping_seguro_gratuito_db)
    
    return {
        "status": "processing",
        "message": f"Scraping lento por lotes activado. Procesando {request.limit} materiales con delays variables para evadir bloqueos.",
        "processed": request.limit
    }
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
        
        # Update history
        db.execute(text("UPDATE historial_precios SET status = 'approved', precio = :price WHERE id = :id"), {"id": result_id, "price": req.price})
        
        # Update master
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
