
import os
from sqlalchemy import create_engine, text

db_url = os.environ.get('DATABASE_URL', 'postgresql://apupro_user:4pu_Pr0_2024!@apupro_db:5432/apupro_db')
engine = create_engine(db_url)

with engine.connect() as conn:
    # Check the frontend only_coded regex on CovPar
    res = conn.execute(text(r'''
        SELECT count(*) FROM public.cost360_items 
        WHERE "CovPar" ~ '^[A-Za-z]{1,2}[\.\-]?[0-9\.]+$'
    '''))
    print("Frontend only_coded regex on public:", res.scalar())

    schemas = ['public', 'temp_m', 'temp_u']
    total = 0
    for s in schemas:
        c = conn.execute(text(rf'''
            SELECT count(*) FROM "{s}"."cost360_items" 
            WHERE "CovPar" ~ '^[A-Za-z]{{1,2}}[\.\-]?[0-9\.]+$'
        ''')).scalar()
        total += c
    print("Frontend only_coded regex (all schemas):", total)
