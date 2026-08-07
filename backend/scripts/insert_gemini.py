import os
import sys
from pathlib import Path

# Add the parent directory of app to the Python path
sys.path.append(str(Path(__file__).parent.parent))

from app.db.arko_base import get_arko_db
from app.db.models.llm_provider import LLMProvider
from app.crud.llm import encrypt_api_key, create_provider

def insert_gemini():
    db = next(get_arko_db())
    try:
        # Check if already exists
        existing = db.query(LLMProvider).filter(LLMProvider.provider_key == "gemini").first()
        if existing:
            print("Gemini provider already exists.")
            return

        api_key = os.environ.get("GEMINI_API_KEY", "AIzaSyC0BCk40pQYge-VJ_7SsXE5fXcj_pvDv70")
        
        provider_data = {
            "provider_key": "gemini",
            "display_name": "Google Gemini 1.5 Flash",
            "api_key_enc": encrypt_api_key(api_key),
            "model_name": "gemini-1.5-flash",
            "is_active": True,
            "priority": 1,
            "use_case": "all",
            "extra_params": {"temperature": 0.7, "max_tokens": 2048}
        }
        create_provider(db, provider_data)
        print("Successfully inserted Gemini provider.")
    finally:
        db.close()

if __name__ == "__main__":
    insert_gemini()
