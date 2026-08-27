import time
import random
import re
from datetime import datetime
import cloudscraper
from sqlalchemy import create_engine, text

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
    return f'{core} {medida_str}'.strip()

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

def test_scraping():
    print("Iniciando prueba de scraping con CLOUDSCRAPER y CLEAN_SEARCH...")
    
    engine = create_engine('postgresql://apupro_user:apupro_password@costbase.net:5440/apupro_db')
    with engine.connect() as conn:
        result = conn.execute(text('''
            SELECT "CodMat", "Descri", "CosMat" 
            FROM cost360_materials 
            WHERE "CodMat" LIKE 'MAT%'
            ORDER BY RANDOM()
            LIMIT 5
        ''')).fetchall()
        materiales_test = [{"codigo": row[0], "descripcion": row[1], "precio_bd": row[2]} for row in result]
    conn.close()
    
    scraper = cloudscraper.create_scraper(browser={'browser': 'chrome', 'platform': 'windows', 'mobile': False})
    lista_navegadores = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    ]
    portales = ["epa", "mercadolibre"]
    
    print("-" * 80)
    
    for indice, mat in enumerate(materiales_test):
        agente_aleatorio = random.choice(lista_navegadores)
        portal_actual = portales[indice % len(portales)]
        precio_detectado = 0
        
        termino_limpio = clean_search_term(mat['descripcion'])
        descripcion_url = termino_limpio.replace(' ', '+').replace('/', '')
        
        try:
            if portal_actual == "mercadolibre":
                url = f"https://listado.mercadolibre.com.ve/{descripcion_url}"
                print(f"[{indice+1}/5] ML - ORIGINAL: {mat['descripcion']}")
                print(f"       -> BUSCANDO: {termino_limpio}")
                
                response = scraper.get(url, headers={'User-Agent': agente_aleatorio}, timeout=15)
                
                if response.status_code == 200:
                    html_content = response.text
                    titulo_detectado = ""
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
                                        print(f"  -> DESCARTADO. Encontró: '{titulo_detectado}'")
                                        break
                                    precio_detectado = precio_candidato
                                    print(f"  -> ACEPTADO. Título: '{titulo_detectado}'")
                                    break
                            except:
                                continue
                        
            elif portal_actual == "epa":
                url = f"https://ve.epaenlinea.com/catalogsearch/result/?q={descripcion_url}"
                print(f"[{indice+1}/5] EPA - ORIGINAL: {mat['descripcion']}")
                print(f"       -> BUSCANDO: {termino_limpio}")
                
                response = scraper.get(url, headers={'User-Agent': agente_aleatorio}, timeout=15)
                
                if response.status_code == 200:
                    html_content = response.text
                    titulo_detectado = ""
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
                                        print(f"  -> DESCARTADO. Encontró: '{titulo_detectado}'")
                                        break
                                    precio_detectado = precio_candidato
                                    print(f"  -> ACEPTADO. Título: '{titulo_detectado}'")
                                    break
                            except:
                                continue

            if precio_detectado > 0:
                print(f"  -> PRECIO BD: ${mat['precio_bd']:.2f} | SCRAPING: ${precio_detectado:.2f}")
            else:
                print(f"  -> PRECIO BD: ${mat['precio_bd']:.2f} | SCRAPING: No detectado o descartado")
                
        except Exception as e:
            print("Error:", e)
        
        time.sleep(2)
        
    print("=" * 80)
    print("Prueba finalizada.")

if __name__ == "__main__":
    test_scraping()