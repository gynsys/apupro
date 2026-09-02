import sys
sys.path.append('/app')
from app.db.base import SessionLocal
from app.db.models.cost360_database import Cost360Database
db = SessionLocal()
for d in db.query(Cost360Database).all():
    print(f"{d.id}, {d.owner_id}, {d.is_master}, {d.is_published}")
