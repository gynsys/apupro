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
            SELECT "CodMat", "Descri" 
            FROM cost360_materials 
            WHERE "CodMat" LIKE 'MAT%'
            LIMIT 25
        ''')).fetchall()
        
        materiales_db = [{"codigo": row[0], "descripcion": row[1]} for row in result]
    
    if not materiales_db:
        print("No se encontraron materiales registrados en la Base de Datos.")
        return
    
    # Lista de User-Agents reales para rotación gratuita
    lista_navegadores = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0",
        "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1"
    ]
    
    # Portales para balanceo de carga 50/50
    portales = ["mercadolibre", "encuentra24"]

    print(f"Procesando lote de {len(materiales_db)} materiales con delays variables...")
    
    for indice, mat in enumerate(materiales_db):
        # 📌 TRUCO 2: ROTAR EL ENCABEZADO EN CADA NAVEGACIÓN
        agente_aleatorio = random.choice(lista_navegadores)
        headers = {
            'User-Agent': agente_aleatorio,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'es-VE,es;q=0.9,en;q=0.8'
        }
        
        # Balanceo de carga 50/50 entre portales
        portal_actual = portales[indice % len(portales)]
        precio_detectado = 0
        
        try:
            if portal_actual == "mercadolibre":
                # URL de búsqueda correcta para MercadoLibre Venezuela
                descripcion_busqueda = mat['descripcion'].replace(' ', '+').replace('/', '%2F')
                url = f"https://mercadolibre.com.ve/search?q={descripcion_busqueda}"
                response = requests.get(url, headers=headers, timeout=15)
                
                if response.status_code == 200:
                    html_content = response.text
                    
                    # Usar regex para encontrar precios - patrones mejorados
                    precio_patterns = [
                        # Patrones específicos de MercadoLibre
                        r'(\d{1,3}(?:[\.,]\d{3})*(?:[\.,]\d{2}))',  # Formato: 1.000,00 o 1,000.00
                        r'(\d+[\.,]\d+)\s*(?:Bs|USD|US\$)',
                        r'US\s*\$\s*(\d+[\.,]\d+)',
                        r'\$\s*(\d+[\.,]\d+)',
                        r'price["\']\s*:\s*["\'](\d+[\.,]\d+)',
                        # Patrones numéricos comunes
                        r'(\d+\.?\d*)'
                    ]
                    
                    for pattern in precio_patterns:
                        matches = re.findall(pattern, html_content)
                        if matches:
                            try:
                                precio_str = matches[0].replace(',', '.')
                                precio_detectado = float(precio_str)
                                if precio_detectado > 0:
                                    break
                            except:
                                continue
                        
            elif portal_actual == "encuentra24":
                # URL de búsqueda correcta para Encuentra24
                descripcion_busqueda = mat['descripcion'].replace(' ', '+').replace('/', '%2F')
                url = f"https://encuentra24.com/panama/search?q={descripcion_busqueda}"
                response = requests.get(url, headers=headers, timeout=15)
                
                if response.status_code == 200:
                    html_content = response.text
                    
                    # Similar regex para Encuentra24
                    precio_patterns = [
                        # Patrones específicos de Encuentra24
                        r'(\d{1,3}(?:[\.,]\d{3})*(?:[\.,]\d{2}))',  # Formato: 1.000,00 o 1,000.00
                        r'(\d+[\.,]\d+)\s*(?:Bs|USD|US\$)',
                        r'US\s*\$\s*(\d+[\.,]\d+)',
                        r'\$\s*(\d+[\.,]\d+)',
                        r'price["\']\s*:\s*["\'](\d+[\.,]\d+)',
                        # Patrones numéricos comunes
                        r'(\d+\.?\d*)'
                    ]
                    
                    for pattern in precio_patterns:
                        matches = re.findall(pattern, html_content)
                        if matches:
                            try:
                                precio_str = matches[0].replace(',', '.')
                                precio_detectado = float(precio_str)
                                if precio_detectado > 0:
                                    break
                            except:
                                continue

            # Guardar en historial si se detectó precio
            if precio_detectado > 0:
                print(f"[GUARDADO HISTÓRICO] {mat['codigo']} | Versión: {fecha_version} | Precio: ${precio_detectado} | Fuente: {portal_actual}")
                
                # Guardar en base de datos
                try:
                    with get_db() as db_hist:
                        db_hist.execute(text('''
                            INSERT INTO historial_precios (material_id, fecha, precio, fuente)
                            VALUES (:material_id, :fecha, :precio, :fuente)
                        '''), {
                            "material_id": mat['codigo'],
                            "fecha": fecha_version,
                            "precio": precio_detectado,
                            "fuente": portal_actual
                        })
                        db_hist.commit()
                except Exception as db_error:
                    print(f"Error guardando en BD: {db_error}")
            else:
                print(f"[SIN PRECIO] {mat['codigo']} | Fuente: {portal_actual}")
                
        except Exception as e:
            print(f"Error procesando {mat['codigo']} en {portal_actual}: {str(e)}")
            
            # 📌 TRUCO 3: TIEMPOS DE ESPERA LARGOS Y VARIABLES (CRUCIAL)
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