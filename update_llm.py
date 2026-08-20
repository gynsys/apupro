from app.db.base import SessionLocal
from app.db.models.llm_provider import LLMProvider

db = SessionLocal()

# Update Groq model
groq = db.query(LLMProvider).filter_by(provider_key="groq").first()
if groq:
    groq.model_name = "llama-3.1-70b-versatile" # Let's try 3.1
    print(f"Updated Groq to {groq.model_name}")

# Update Gemini model
gemini = db.query(LLMProvider).filter_by(provider_key="gemini").first()
if gemini:
    gemini.model_name = "gemini-3.6-flash"
    print(f"Updated Gemini to {gemini.model_name}")

db.commit()
db.close()
