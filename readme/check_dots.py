import pandas as pd
from sqlalchemy import create_engine, text

def main():
    print("Conectando a la base de datos...")
    # Usa la conexión definida por defecto o la que configures en el entorno
    engine = create_engine('postgresql://apupro_user:apupro_password@localhost:5440/apupro_db')
    
    with engine.connect() as conn:
        print("Buscando códigos con puntos intermedios en CovPar...")
        
        # Consulta para buscar cualquier CovPar que tenga puntos intermedios (ej. M.1, C.1, pero no solo al final)
        rs = conn.execute(text(r'''
            SELECT "CovPar" 
            FROM cost360_items 
            WHERE "CovPar" LIKE '%.%' 
        '''))
        
        resultados = [row[0] for row in rs.fetchall()]
        
        # Agrupar por la letra inicial para ver qué categorías están afectadas
        categorias_afectadas = {}
        for cov in resultados:
            inicial = cov.split('.')[0] if '.' in cov else cov[0]
            categorias_afectadas[inicial] = categorias_afectadas.get(inicial, 0) + 1
            
        if not resultados:
            print("No se encontraron códigos con puntos intermedios.")
        else:
            print(f"\nSe encontraron {len(resultados)} códigos con puntos intermedios.")
            print("Desglose por categoría inicial:")
            for cat, count in categorias_afectadas.items():
                print(f"  - Categoría '{cat}': {count} partidas afectadas.")
                
            print("\nEjemplos encontrados:")
            for ex in resultados[:10]:
                print(f"  - {ex}")

if __name__ == '__main__':
    main()
