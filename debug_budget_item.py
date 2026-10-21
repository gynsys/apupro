import sys, json
from app.db.session import SessionLocal
from app.db.models.budget import Budget
from app.schemas.budget import Budget as BudgetSchema

db = SessionLocal()
for bid in ['0efa568a-ec0d-4714-b0c5-cf0fde507b33', 'dc7d17bd-415c-4a02-9feb-1645e714cda8']:
    b = db.query(Budget).filter(Budget.id == bid).first()
    if b:
        # serialize with Pydantic like FastAPI does
        data = BudgetSchema.model_validate(b).model_dump(mode='json')
        with open(f'/root/budget_{bid[:8]}.json', 'w') as f:
            json.dump(data, f)
        print(f"Dumped budget {bid[:8]}")
