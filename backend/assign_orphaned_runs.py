import sys, os
from sqlalchemy import text

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from app.db.arko_base import arko_engine as engine

def assign():
    print("Buscando proyectos huérfanos...")
    with engine.begin() as conn:
        res = conn.execute(text("SELECT id FROM arko_users WHERE email = 'dramarielh@gmail.com'"))
        user_row = res.fetchone()
        if user_row:
            user_id = user_row[0]
            conn.execute(text(f"UPDATE losa_calculation_runs SET user_id = {user_id} WHERE user_id IS NULL"))
            print(f"✅ Se asignaron los proyectos antiguos al usuario dramarielh@gmail.com (ID: {user_id}).")
        else:
            print("❌ No se encontró el usuario dramarielh@gmail.com en la base de datos.")

if __name__ == "__main__":
    assign()
