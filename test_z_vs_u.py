import pandas as pd
from sqlalchemy import create_engine, text

def main():
    engine = create_engine('postgresql://apupro_user:apupro_password@costbase.arko360.net:5440/apupro_db')
    
    with engine.connect() as conn:
        # 1. Obtener 3 partidas aleatorias o las primeras 3 de la letra Z
        z_items = conn.execute(text(r'''
            SELECT "CovPar", "Descri" FROM cost360_items 
            WHERE "CovPar" LIKE 'Z%'
            LIMIT 3
        ''')).fetchall()
        
        print("--- BUSCANDO COINCIDENCIAS DE PARTIDAS Z EN URBANISMO (U) ---")
        
        for z_code, z_descri in z_items:
            print(f"\nPartida Z Seleccionada:")
            print(f"Código: {z_code}")
            print(f"Descripción: {z_descri}")
            
            # Buscamos coincidencias en U usando las primeras palabras (o partes clave de la descripción)
            # Para ser más flexibles, extraeremos un par de palabras significativas para la búsqueda
            # Excluimos palabras muy comunes como "DE", "LA", "EN", "EL", "PARA", "CON"
            
            words = [w for w in z_descri.split() if len(w) > 3 and w not in ["PARA", "COMO", "TIPO", "CADA"]]
            
            if not words:
                continue
                
            # Buscar en 'U' que contenga al menos algunas de estas palabras
            search_query = " AND ".join([f"\"Descri\" ILIKE '%{w}%'" for w in words[:3]]) # tomar las 3 primeras palabras clave
            
            u_query = f'''
                SELECT "CovPar", "Descri" FROM cost360_items 
                WHERE "CovPar" LIKE 'U%' AND {search_query}
                LIMIT 5
            '''
            
            u_matches = conn.execute(text(u_query)).fetchall()
            
            if u_matches:
                print(f"--> Posibles coincidencias en Urbanismo (U):")
                for u_code, u_desc in u_matches:
                    print(f"    - {u_code}: {u_desc}")
            else:
                print(f"--> No se encontraron coincidencias directas en Urbanismo (U) usando las palabras clave.")
                
            # Intento de búsqueda más flexible (solo la primera palabra clave)
            if not u_matches and len(words) > 0:
                flexible_query = f'''
                    SELECT "CovPar", "Descri" FROM cost360_items 
                    WHERE "CovPar" LIKE 'U%' AND "Descri" ILIKE '%{words[0]}%'
                    LIMIT 3
                '''
                flex_matches = conn.execute(text(flexible_query)).fetchall()
                if flex_matches:
                    print(f"--> Coincidencias amplias en Urbanismo (U) (usando solo '{words[0]}'):")
                    for u_code, u_desc in flex_matches:
                        print(f"    - {u_code}: {u_desc}")

if __name__ == '__main__':
    main()
