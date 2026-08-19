from app.db.base import SessionLocal
from app.db.models.llm_provider import LLMProvider
from app.crud.llm import decrypt_api_key
import google.generativeai as genai

db = SessionLocal()
gemini = db.query(LLMProvider).filter(LLMProvider.provider_key == "gemini").first()
if not gemini:
    print("ERROR: No gemini provider found")
    db.close()
    exit()

print(f"Model: {gemini.model_name}")
api_key = decrypt_api_key(gemini.api_key_enc)
print(f"Key prefix: {api_key[:10]}...")

genai.configure(api_key=api_key)

# Try different models
for model_name in ["gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-1.5-flash-latest", "gemini-1.5-pro-latest"]:
    try:
        m = genai.GenerativeModel(model_name)
        r = m.generate_content("Di 'OK'")
        print(f"SUCCESS with model: {model_name} -> {r.text[:30]}")
        # Update DB with working model
        gemini.model_name = model_name
        db.commit()
        print(f"SAVED model {model_name} to DB")
        break
    except Exception as e:
        print(f"FAILED {model_name}: {str(e)[:100]}")

db.close()
