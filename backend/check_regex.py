import os
from sqlalchemy import create_engine, text

DATABASE_URL = "postgresql://apupro_user:apupro_password@apupro-db:5432/apupro_db"
engine = create_engine(DATABASE_URL)

with engine.connect() as conn:
    only_coded = conn.execute(text("SELECT COUNT(*) FROM cost360_items WHERE \"CovPar\" ~ '^[A-Za-z]{1,2}[\.\-]?[0-9\.]+$'")).scalar()
    print(f"Partidas con only_coded=True: {only_coded}")
