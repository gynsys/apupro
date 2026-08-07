from sqlalchemy import create_engine, text
from app.core.config import settings

engine = create_engine(str(settings.DATABASE_URL))
with engine.connect() as conn:
    conn.execute(text("ALTER TABLE budgets ADD COLUMN IF NOT EXISTS labor_bonus FLOAT DEFAULT 0.0;"))
    conn.commit()
    print("Added labor_bonus column successfully.")
