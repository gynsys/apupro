import os
import sys

# Ensure backend folder is in PYTHONPATH
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.db.arko_base import arko_engine
from sqlalchemy import text

def run():
    print("Iniciando actualización de la base de datos...")
    with arko_engine.connect() as conn:
        try:
            # Add column to arko_admins
            conn.execute(text("ALTER TABLE arko_admins ADD COLUMN is_email_verified BOOLEAN DEFAULT FALSE"))
            print("Columna is_email_verified añadida a arko_admins.")
            
            # Set existing admins to True so they don"t get locked out
            conn.execute(text("UPDATE arko_admins SET is_email_verified = TRUE"))
            print("Admins existentes actualizados a is_email_verified = TRUE.")
        except Exception as e:
            print(f"Nota (arko_admins): {e}")

        try:
            # Add column to arko_users
            conn.execute(text("ALTER TABLE arko_users ADD COLUMN is_email_verified BOOLEAN DEFAULT FALSE"))
            print("Columna is_email_verified añadida a arko_users.")
            
            # Set existing users to True so they don"t get locked out
            conn.execute(text("UPDATE arko_users SET is_email_verified = TRUE"))
            print("Usuarios existentes actualizados a is_email_verified = TRUE.")
        except Exception as e:
            print(f"Nota (arko_users): {e}")
            
        conn.commit()
        
    print("Actualización finalizada.")

if __name__ == "__main__":
    run()
