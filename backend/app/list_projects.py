import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.arko_base import ArkoSessionLocal
from app.db.models.arko import ArkoProject

db = ArkoSessionLocal()
projects = db.query(ArkoProject).all()
for p in projects:
    print(f"ID: {p.id}, SLUG: {p.slug}, NAME: {p.title}")
db.close()
