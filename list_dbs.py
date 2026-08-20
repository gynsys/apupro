from app.db.base import SessionLocal
from app.db.models.cost360_database import Cost360Database

db = SessionLocal()
for d in db.query(Cost360Database).all():
    print(f"ID: {d.id} | Nombre: {d.name} | Activa: {d.is_active}")
