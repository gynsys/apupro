import pandas as pd
import json
from sqlalchemy import create_engine, text

def main():
    print("Conectando a la base de datos...")
    engine = create_engine('postgresql://apupro_user:apupro_password@costbase.net:5440/apupro_db')
    
    # Cargar las categorías exactas de la interfaz
    tree_path = r'c:\Users\pablo\Documents\apupro_platform\frontend\src\modules\cost360\data\covenin_tree.json'
    with open(tree_path, 'r', encoding='utf-8') as f:
        covenin_tree = json.load(f)
        
    # El usuario indicó que "Hidráulica" falta en la interfaz (covenin_tree.json) 
    # pero debe incluirse en el conteo. La agregamos manualmente para el reporte.
    covenin_tree.append({"code": "H", "name": "HIDRÁULICA"})
    
    reporte = []
    
    with engine.connect() as conn:
        print("Calculando estadísticas por categoría...")
        
        for cat in covenin_tree:
            code = cat.get('code')
            name = cat.get('name')
            full_name = f"{code} - {name}"
            
            # Total Partidas de esta especialidad
            total = conn.execute(text('''
                SELECT COUNT(*) FROM cost360_items 
                WHERE "CovPar" LIKE :prefix
            '''), {"prefix": f"{code}%"}).scalar()
            
            # Codificadas (COVENIN Completo)
            codificadas = conn.execute(text(r'''
                SELECT COUNT(*) FROM cost360_items 
                WHERE "CovPar" LIKE :prefix 
                AND "CovPar" ~ '^[A-Za-z]{1,2}[\.\-]?[0-9\.]+$'
            '''), {"prefix": f"{code}%"}).scalar()
            
            # Incompletas
            incompletas = total - codificadas
            
            reporte.append({
                "Especialidad": full_name,
                "Total Partidas": total,
                "Codificadas COVENIN": codificadas,
                "Incompletas o S/C": incompletas
            })
            
    df = pd.DataFrame(reporte)
    
    # Calculate OTRAS / SIN CLASIFICAR
    with engine.connect() as conn:
        total_db = conn.execute(text('SELECT COUNT(*) FROM cost360_items')).scalar()
        codificadas_db = conn.execute(text(r'''
            SELECT COUNT(*) FROM cost360_items 
            WHERE "CovPar" ~ '^[A-Za-z]{1,2}[\.\-]?[0-9\.]+$'
        ''')).scalar()
        
    sum_categorized_total = df["Total Partidas"].sum()
    sum_categorized_cod = df["Codificadas COVENIN"].sum()
    
    otras_total = total_db - sum_categorized_total
    otras_cod = codificadas_db - sum_categorized_cod
    otras_inc = otras_total - otras_cod
    
    df.loc[len(df)] = ["OTRAS / SIN CLASIFICAR", otras_total, otras_cod, otras_inc]
    
    # Sumatoria total global
    total_gral = df["Total Partidas"].sum()
    total_cod = df["Codificadas COVENIN"].sum()
    total_inc = df["Incompletas o S/C"].sum()
    
    df.loc[len(df)] = ["TOTAL GLOBAL (BD)", total_gral, total_cod, total_inc]
    
    csv_filename = "reporte_base_datos_cost360_v3.csv"
    df.to_csv(csv_filename, index=False, encoding='utf-8-sig')
    
    print(f"\nReporte generado con éxito en: {csv_filename}")
    print("\nResumen:")
    print(df.to_string(index=False))

if __name__ == '__main__':
    main()
