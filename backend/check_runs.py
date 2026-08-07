import sys, os
from sqlalchemy import text

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from app.db.arko_base import arko_engine as engine

def check():
    with engine.begin() as conn:
        res = conn.execute(text("SELECT id, nombre_proyecto, user_id FROM losa_calculation_runs"))
        runs = res.fetchall()
        print("Losa Calculation Runs in DB:")
        for r in runs:
            print(f"ID: {r[0]} | Proyecto: {r[1]} | User ID: {r[2]}")
            
        res2 = conn.execute(text("SELECT id, email FROM arko_users"))
        users = res2.fetchall()
        print("\nUsuarios en DB:")
        for u in users:
            print(f"ID: {u[0]} | Email: {u[1]}")

if __name__ == "__main__":
    check()
