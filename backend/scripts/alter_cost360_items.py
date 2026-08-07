import os
import sys

# Ensure backend directory is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from sqlalchemy import create_engine, text
from app.core.config import settings

def alter_table():
    engine = create_engine(str(settings.DATABASE_URL))
    
    commands = [
        "ALTER TABLE cost360_items ADD COLUMN IF NOT EXISTS disciplina VARCHAR;",
        "ALTER TABLE cost360_items ADD COLUMN IF NOT EXISTS diametro_pulg VARCHAR;",
        "ALTER TABLE cost360_items ADD COLUMN IF NOT EXISTS resistencia_fc FLOAT;",
        "ALTER TABLE cost360_items ADD COLUMN IF NOT EXISTS material VARCHAR;",
        "ALTER TABLE cost360_items ADD COLUMN IF NOT EXISTS preparacion VARCHAR;",
        "ALTER TABLE cost360_items ADD COLUMN IF NOT EXISTS desc_limpia VARCHAR;"
    ]
    
    with engine.connect() as conn:
        for cmd in commands:
            print(f"Executing: {cmd}")
            conn.execute(text(cmd))
        conn.commit()
        print("Schema update for cost360_items completed successfully.")

if __name__ == "__main__":
    alter_table()
