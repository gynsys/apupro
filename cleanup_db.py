import sys
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

engine = create_engine('postgresql://apupro_user:apupro_password@costbase.arko360.net:5440/apupro_db')
Session = sessionmaker(bind=engine)
session = Session()

try:
    print("--- Iniciando Depuración de Duplicados ---")
    
    # 1. Obtener los CovPar duplicados válidos
    query = text('''
        SELECT "CovPar", ARRAY_AGG("CodPar" ORDER BY "CodPar") as codigos
        FROM cost360_items
        WHERE "CovPar" ~ '^[A-Za-z]\.?[0-9]{8,10}$'
        GROUP BY "CovPar"
        HAVING COUNT("CodPar") > 1
    ''')
    
    duplicates = session.execute(query).fetchall()
    
    total_borrados = 0
    total_insumos_borrados = 0
    
    for row in duplicates:
        covpar = row[0]
        codigos = row[1]
        
        # El primero se queda (ordenado alfabéticamente)
        # ej: EAA001, GMV022, TOR376 -> Se queda EAA001
        se_queda = codigos[0]
        se_van = codigos[1:]
        
        # Para cada partida a borrar, limpiar sus dependencias
        for cod_borrar in se_van:
            # Borrar insumos
            r1 = session.execute(text('DELETE FROM cost360_apu_materials WHERE "CodPar" = :cod'), {"cod": cod_borrar})
            r2 = session.execute(text('DELETE FROM cost360_apu_equipment WHERE "CodPar" = :cod'), {"cod": cod_borrar})
            r3 = session.execute(text('DELETE FROM cost360_apu_labor WHERE "CodPar" = :cod'), {"cod": cod_borrar})
            
            total_insumos_borrados += r1.rowcount + r2.rowcount + r3.rowcount
            
            # Borrar la partida en sí
            r4 = session.execute(text('DELETE FROM cost360_items WHERE "CodPar" = :cod'), {"cod": cod_borrar})
            total_borrados += r4.rowcount
            
    # Commit changes
    session.commit()
    
    print(f"\nDEPURACIÓN EXITOSA.")
    print(f"Total de partidas eliminadas (CodPar): {total_borrados}")
    print(f"Total de relaciones de insumos eliminadas: {total_insumos_borrados}")
    
except Exception as e:
    session.rollback()
    print(f"Error durante la depuración: {e}")
finally:
    session.close()

