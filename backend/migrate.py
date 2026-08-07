import os
import sys

# Add backend dir to pythonpath
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import text
from app.db.base import engine

def run():
    print("Running migration...")
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE budgets ADD COLUMN material_inflation FLOAT DEFAULT 0.0"))
            print("Added material_inflation")
        except Exception as e:
            print("material_inflation error:", e)

        try:
            conn.execute(text("ALTER TABLE budgets ADD COLUMN labor_inflation FLOAT DEFAULT 0.0"))
            print("Added labor_inflation")
        except Exception as e:
            print("labor_inflation error:", e)

        try:
            conn.execute(text("ALTER TABLE budgets ADD COLUMN equipment_inflation FLOAT DEFAULT 0.0"))
            print("Added equipment_inflation")
        except Exception as e:
            print("equipment_inflation error:", e)
            
        conn.commit()

if __name__ == "__main__":
    run()
