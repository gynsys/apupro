from sqlalchemy import create_engine, text
import sys

engine = create_engine('postgresql://apupro_user:apupro_password@costbase.arko360.net:5440/apupro_db')
with engine.connect() as conn:
    print("--- Análisis de Duplicados (Mejorado) ---")
    
    # regex para códigos tipo E411011010 o C.110800300
    # [A-Z]\.?[0-9]{9}
    
    duplicates_query = conn.execute(text('''
        SELECT "CovPar", COUNT("CodPar") as cant, ARRAY_AGG("CodPar" ORDER BY "CodPar") as codigos
        FROM cost360_items
        WHERE "CovPar" ~ '^[A-Za-z]\.?[0-9]{8,10}$'
        GROUP BY "CovPar"
        HAVING COUNT("CodPar") > 1
        ORDER BY cant DESC
    '''))
    
    dup_rows = duplicates_query.fetchall()
    
    total_covpar_duplicados = len(dup_rows)
    total_partidas_a_eliminar = sum(row[1] - 1 for row in dup_rows)
    
    print(f"Total de códigos COVENIN reales repetidos: {total_covpar_duplicados}")
    print(f"Total de referencias que serían ELIMINADAS: {total_partidas_a_eliminar}")
    
    print("\nEjemplos:")
    for i in range(min(5, len(dup_rows))):
        covpar = dup_rows[i][0]
        codigos = dup_rows[i][2]
        print(f"  COVENIN: {covpar} -> Se quedan: {codigos[0]}, Se van: {', '.join(codigos[1:])}")
