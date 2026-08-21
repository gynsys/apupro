
import os
from sqlalchemy import create_engine, text
from pprint import pprint

db_url = os.environ.get('DATABASE_URL', 'postgresql://apupro_user:4pu_Pr0_2024!@apupro_db:5432/apupro_db')
engine = create_engine(db_url)

with engine.connect() as conn:
    query = "excavacion a mano para banqueo"
    # Test plainto_tsquery and ts_rank
    sql = '''
        SELECT "CodPar", "Descri", ts_rank(to_tsvector('spanish', "Descri"), plainto_tsquery('spanish', :query)) as rank
        FROM public.cost360_items
        WHERE "CovPar" NOT LIKE '% S/C%'
          AND to_tsvector('spanish', "Descri") @@ plainto_tsquery('spanish', :query)
        ORDER BY rank DESC
        LIMIT 10
    '''
    res = conn.execute(text(sql), {"query": query}).fetchall()
    print(f"--- Search: {query} ---")
    for r in res:
        print(f"[{r.rank:.4f}] {r.CodPar}: {r.Descri}")
        
    query2 = "excavacion a mano"
    res2 = conn.execute(text(sql), {"query": query2}).fetchall()
    print(f"\n--- Search: {query2} ---")
    for r in res2:
        print(f"[{r.rank:.4f}] {r.CodPar}: {r.Descri}")
