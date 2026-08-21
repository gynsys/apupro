
import os
from sqlalchemy import create_engine, text

db_url = os.environ.get('DATABASE_URL', 'postgresql://apupro_user:4pu_Pr0_2024!@apupro_db:5432/apupro_db')
engine = create_engine(db_url)

with engine.connect() as conn:
    res = conn.execute(text('''
        SELECT "CodPar" FROM public.cost360_items LIMIT 50
    '''))
    print("Muestra de CodPar:")
    for row in res.fetchall():
        print(row[0])
