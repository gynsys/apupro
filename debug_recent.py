from app.db.session import SessionLocal
from app.db.models.budget import Budget
db = SessionLocal()
print([(b.id, b.name[:30], str(b.created_at)) for b in db.query(Budget).order_by(Budget.created_at.desc()).limit(5)])
