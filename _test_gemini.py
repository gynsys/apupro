from app.db.base import SessionLocal
from app.db.models.llm_provider import LLMProvider
from app.crud.llm import decrypt_api_key
import google.generativeai as genai

db = SessionLocal()
providers = db.query(LLMProvider).all()
print("=== Providers ===")
for p in providers:
    key = decrypt_api_key(p.api_key_enc) if p.api_key_enc else "NO KEY"
    print(f"  {p.display_name}: model={p.model_name}, key_prefix={key[:15]}..., active={p.is_active}")

# Test key
gemini = db.query(LLMProvider).filter(LLMProvider.provider_key == "gemini").first()
if gemini:
    key = decrypt_api_key(gemini.api_key_enc)
    print(f"\nTesting key: {key[:15]}...")
    genai.configure(api_key=key)
    for model_name in ["gemini-2.5-flash", "gemini-2.5-flash-preview-05-20", "gemini-2.0-flash-exp", "gemini-1.5-flash-002", "gemini-1.5-flash-latest"]:
        try:
            m = genai.GenerativeModel(model_name)
            r = m.generate_content("Di OK")
            print(f"  SUCCESS: {model_name}")
            # Save working model
            gemini.model_name = model_name
            db.commit()
            print(f"  SAVED to DB: {model_name}")
            break
        except Exception as e:
            print(f"  FAIL {model_name}: {str(e)[:80]}")

db.close()
