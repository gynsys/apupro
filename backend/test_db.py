import sys
sys.path.append('c:/Users/pablo/Documents/apupro_platform/backend')
from app.db.base import SessionLocal
from app.db.models.cost360_database import Cost360Database
db = SessionLocal()
dbs = db.query(Cost360Database).all()
for d in dbs:
    print(f'ID: {d.id}, Name: {d.name}, Owner: {d.owner_id}')
