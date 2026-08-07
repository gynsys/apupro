from sqlalchemy import create_engine, text
from app.core.config import settings
import json

engine = create_engine(str(settings.DATABASE_URL))
with engine.connect() as conn:
    result = conn.execute(text("SELECT * FROM cost360_labor LIMIT 5;"))
    rows = [dict(r._mapping) for r in result]
    print(json.dumps(rows, indent=2))
