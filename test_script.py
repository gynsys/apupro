import sys
sys.path.append('/app')
from app.db.base import SessionLocal
from app.crud.crud_cost360 import get_items_paginated
db = SessionLocal()
total, items = get_items_paginated(db, search='E411011010', limit=10)
print(f"Total returned: {len(items)}")
for i in items:
    print(i.CodPar, i.Descri[:50])
