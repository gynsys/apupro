import sys
import os
from sqlalchemy import text

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from app.db.arko_base import arko_engine as engine

def apply_migration():
    print("Iniciando migración de la base de datos...")
    with engine.begin() as conn:
        # Check if user_id column already exists
        check_query = text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='losa_calculation_runs' and column_name='user_id';
        """)
        
        # SQLite uses PRAGMA table_info
        if "sqlite" in str(engine.url):
            result = conn.execute(text("PRAGMA table_info(losa_calculation_runs)")).fetchall()
            if any(row[1] == 'user_id' for row in result):
                print("La columna 'user_id' ya existe en 'losa_calculation_runs' (SQLite).")
                return
            else:
                print("Aplicando migración SQLite...")
                conn.execute(text("ALTER TABLE losa_calculation_runs ADD COLUMN user_id INTEGER REFERENCES arko_users(id)"))
                print("Migración completada con éxito.")
                return

        result = conn.execute(check_query).fetchone()
        
        if result:
            print("La columna 'user_id' ya existe en 'losa_calculation_runs'.")
        else:
            print("Aplicando migración PostgreSQL...")
            conn.execute(text("ALTER TABLE losa_calculation_runs ADD COLUMN user_id INTEGER REFERENCES arko_users(id)"))
            conn.execute(text("CREATE INDEX ix_losa_calculation_runs_user_id ON losa_calculation_runs(user_id)"))
            print("Migración completada con éxito.")

if __name__ == "__main__":
    apply_migration()
