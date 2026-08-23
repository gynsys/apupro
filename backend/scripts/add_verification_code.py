import os
import sys

# Ensure backend folder is in PYTHONPATH
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.db.arko_base import arko_engine
from sqlalchemy import text

def run():
    print("Iniciando actualización de la base de datos (verification_code)...")
    with arko_engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE arko_admins ADD COLUMN verification_code VARCHAR(10) DEFAULT NULL"))
            print("Columna verification_code añadida a arko_admins.")
        except Exception as e:
            print(f"Nota (arko_admins): {e}")

        try:
            conn.execute(text("ALTER TABLE arko_users ADD COLUMN verification_code VARCHAR(10) DEFAULT NULL"))
            print("Columna verification_code añadida a arko_users.")
        except Exception as e:
            print(f"Nota (arko_users): {e}")
            
        conn.commit()
        
    print("Actualización finalizada.")

if __name__ == "__main__":
    run()
