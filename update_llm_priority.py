from app.db.base import SessionLocal
from app.db.models.llm_provider import LLMProvider

db = SessionLocal()

# Set Gemini to Priority 1
gemini = db.query(LLMProvider).filter_by(provider_key="gemini").first()
if gemini:
    gemini.priority = 1
    gemini.model_name = "gemini-3.6-flash"
    
# Set Groq to inactive (model deprecated)
groq = db.query(LLMProvider).filter_by(provider_key="groq").first()
if groq:
    groq.is_active = False

db.commit()
db.close()
