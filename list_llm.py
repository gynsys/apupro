from app.db.base import SessionLocal
from app.db.models.llm_provider import LLMProvider

db = SessionLocal()
for p in db.query(LLMProvider).all():
    print({k: v for k, v in p.__dict__.items() if not k.startswith('_')})
