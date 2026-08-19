import sys
import os

# Asegurar que importamos app correctamente
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.db.base import engine
from app.db.models.market import Base

def upgrade_db():
    print("Creating new market tables if they don't exist...")
    Base.metadata.create_all(bind=engine)
    print("Market tables created.")
    
    print("Adding columns to cost360_materials...")
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE cost360_materials ADD COLUMN family_id VARCHAR"))
        except Exception as e:
            print(f"Column family_id might already exist or error: {e}")
            
        try:
            conn.execute(text("ALTER TABLE cost360_materials ADD COLUMN market_indicator_id VARCHAR"))
        except Exception as e:
            print(f"Column market_indicator_id might already exist or error: {e}")
            
        try:
            conn.execute(text("ALTER TABLE cost360_materials ADD COLUMN market_factor FLOAT DEFAULT 1.0"))
        except Exception as e:
            print(f"Column market_factor might already exist or error: {e}")
            
        conn.commit()
    print("Database upgraded successfully.")

if __name__ == "__main__":
    upgrade_db()
