import time
import random
import re
from datetime import datetime
import requests

# Prueba del sistema de scraping con requests
def test_scraping():
    print("Iniciando prueba de scraping con requests...")
    fecha_version = datetime.now().strftime("%Y-%m-%d")
    
    # Lista de User-Agents reales para rotación gratuita
    lista_navegadores = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0"
    ]
    
    # Materiales de prueba
    materiales_test = [
        {"codigo": "MAT1402", "descripcion": "FLOTANTE DE BRONCE D=2 1/2"},
        {"codigo": "MAT1766", "descripcion": "MANGUERA C/INCENDIO 1.1/2"},
        {"codigo": "MAT1793", "descripcion": "MASTIQUE DRY WALL"}
    ]
    
    portales = ["mercadolibre", "encuentra24"]
    
    print(f"Procesando {len(materiales_test)} materiales de prueba...")
    
    for indice, mat in enumerate(materiales_test):
        agente_aleatorio = random.choice(lista_navegadores)
        headers = {
            'User-Agent': agente_aleatorio,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'es-VE,es;q=0.9,en;q=0.8'
        }
        
        portal_actual = portales[indice % len(portales)]
        precio_detectado = 0
        
        try:
            if portal_actual == "mercadolibre":
                # Probar diferentes estructuras de URL para MercadoLibre
                descripcion_simple = mat['descripcion'].replace(' ', '+').replace('/', '')
                url = f"https://mercadolibre.com.ve/search?q={descripcion_simple}"
                print(f"Consultando: {url}")
                response = requests.get(url, headers=headers, timeout=15)
                
                if response.status_code == 200:
                    html_content = response.text
                    print(f"Response OK ({len(html_content)} caracteres)")
                    
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
                                    print(f"Precio detectado: ${precio_detectado}")
                                    break
                            except:
                                continue
                else:
                    print(f"Error HTTP: {response.status_code}")
                        
            elif portal_actual == "encuentra24":
                # Probar estructura más simple para Encuentra24
                descripcion_simple = mat['descripcion'].replace(' ', '+').replace('/', '')
                url = f"https://encuentra24.com/panama/search?q={descripcion_simple}"
                print(f"Consultando: {url}")
                response = requests.get(url, headers=headers, timeout=15)
                
                if response.status_code == 200:
                    html_content = response.text
                    print(f"Response OK ({len(html_content)} caracteres)")
                    
                    precio_patterns = [
                        r'(\d+[\.,]\d+)\s*(?:Bs|USD|US\$)',
                        r'US\s*\$\s*(\d+[\.,]\d+)',
                        r'\$\s*(\d+[\.,]\d+)',
                        r'price["\']\s*:\s*["\'](\d+[\.,]\d+)'
                    ]
                    
                    for pattern in precio_patterns:
                        matches = re.findall(pattern, html_content)
                        if matches:
                            try:
                                precio_str = matches[0].replace(',', '.')
                                precio_detectado = float(precio_str)
                                if precio_detectado > 0:
                                    print(f"Precio detectado: ${precio_detectado}")
                                    break
                            except:
                                continue
                else:
                    print(f"Error HTTP: {response.status_code}")

            if precio_detectado > 0:
                print(f"[EXITO] {mat['codigo']} | Versión: {fecha_version} | Precio: ${precio_detectado} | Fuente: {portal_actual}")
            else:
                print(f"[SIN PRECIO] {mat['codigo']} | Fuente: {portal_actual}")
                
        except Exception as e:
            print(f"Error procesando {mat['codigo']} en {portal_actual}: {str(e)}")
        
        # Tiempo de espera más corto para prueba
        tiempo_espera = random.uniform(5.0, 10.0)
        print(f"Esperando {round(tiempo_espera, 1)} segundos...")
        time.sleep(tiempo_espera)
    
    print("Prueba finalizada.")

if __name__ == "__main__":
    test_scraping()