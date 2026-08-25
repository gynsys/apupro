"""
Script de prueba para búsqueda de precios usando web scraping
"""
import requests
from bs4 import BeautifulSoup
import re

def buscar_precio_mercadolibre(producto):
    """
    Busca precio en MercadoLibre Venezuela usando web scraping
    """
    # URL de búsqueda de MercadoLibre Venezuela
    url = f"https://www.mercadolibre.com.ve/search?q={producto}"
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
    
    try:
        respuesta = requests.get(url, headers=headers)
        
        if respuesta.status_code == 200:
            soup = BeautifulSoup(respuesta.text, 'html.parser')
            
            # Buscar items de producto
            items = soup.find_all('li', class_='ui-search-layout__item')
            
            if items:
                print(f"Resultados para: {producto}")
                print("="*50)
                
                for i, item in enumerate(items[:3], 1):
                    # Extraer título
                    titulo_elem = item.find('h2', class_='ui-search-item__title')
                    titulo = titulo_elem.text.strip() if titulo_elem else "Sin título"
                    
                    # Extraer precio
                    precio_elem = item.find('span', class_='price-tag-fraction')
                    if precio_elem:
                        precio_texto = precio_elem.text.strip()
                        # Extraer valor numérico
                        precio_match = re.search(r'[\d.,]+', precio_texto)
                        precio = precio_match.group() if precio_match else "N/A"
                    else:
                        precio = "N/A"
                    
                    # Extraer link
                    link_elem = item.find('a', class_='ui-search-item__group__link')
                    link = link_elem['href'] if link_elem else "Sin link"
                    
                    print(f"{i}. {titulo[:60]}...")
                    print(f"   Precio: {precio} VES")
                    print(f"   Link: {link}\n")
            else:
                print(f"No se encontraron resultados para: {producto}")
        else:
            print(f"Error en la consulta: {respuesta.status_code}")
            
    except Exception as e:
        print(f"Error: {e}")

# Prueba desde terminal
if __name__ == '__main__':
    buscar_precio_mercadolibre("Extintor CO2 10 lbs")
