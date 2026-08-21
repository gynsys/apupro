
import os
from sqlalchemy import create_engine, text

db_url = os.environ.get('DATABASE_URL', 'postgresql://apupro_user:4pu_Pr0_2024!@apupro_db:5432/apupro_db')
engine = create_engine(db_url)

with engine.connect() as conn:
    print("Iniciando particion de base de datos...")
    
    # 1. Crear la tabla de incompletos/basura
    conn.execute(text('''
        CREATE TABLE IF NOT EXISTS public.cost360_items_incompletos (
            LIKE public.cost360_items INCLUDING ALL
        )
    '''))
    
    # 2. Contar partidas validas e incompletas
    valid_condition = '("CodPar" ~ \'^[A-Za-z][0-9]{8,10}$\' OR "CodPar" ~ \'^HC.*\')'
    
    res_valid = conn.execute(text(f'SELECT count(*) FROM public.cost360_items WHERE {valid_condition}'))
    valid_count = res_valid.scalar()
    
    res_invalid = conn.execute(text(f'SELECT count(*) FROM public.cost360_items WHERE NOT {valid_condition}'))
    invalid_count = res_invalid.scalar()
    
    print(f"Partidas que se conservaran (validas): {valid_count}")
    print(f"Partidas que se moveran (basura/incompletas): {invalid_count}")
    
    if invalid_count > 0:
        # 3. Mover a la nueva tabla
        print("Moviendo partidas incompletas...")
        conn.execute(text(f'''
            INSERT INTO public.cost360_items_incompletos
            SELECT * FROM public.cost360_items WHERE NOT {valid_condition}
            ON CONFLICT ("CodPar") DO NOTHING
        '''))
        
        # 4. Eliminar de la tabla principal
        print("Eliminando partidas incompletas de la tabla principal...")
        conn.execute(text(f'''
            DELETE FROM public.cost360_items WHERE NOT {valid_condition}
        '''))
        conn.commit()
        
    print("Particion completada.")
