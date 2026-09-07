import psycopg2
import os

# Configuracion de la base de datos de produccion
DATABASE_URL = "postgresql://apupro_user:apupro_password@167.172.115.154:5440/apupro_db"

def verificar_equipos():
    """Verificar equipos especificados en la base de datos de produccion"""
    
    # Codigos a buscar
    codigos_buscar = ['EQU002', 'EQU-0022DD', 'EQU004', 'EQU-004053', 'EQU-007480']
    
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor()
        
        # Buscar equipos en la base de datos
        query = """
        SELECT CodPar, Descri, PreUni 
        FROM cost360_equipment 
        WHERE CodPar IN %s
        ORDER BY CodPar
        """
        
        cursor.execute(query, (tuple(codigos_buscar),))
        resultados = cursor.fetchall()
        
        print("Equipos encontrados en la base de datos:")
        print("-" * 60)
        for row in resultados:
            cod, descri, precio = row
            print(f"Codigo: {cod}")
            print(f"Descripcion: {descri}")
            print(f"Precio Actual: ${precio}")
            print("-" * 40)
        
        print(f"\nTotal encontrados: {len(resultados)}")
        print(f"Total buscados: {len(codigos_buscar)}")
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    verificar_equipos()
