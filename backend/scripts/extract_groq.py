import os
import sys
from pathlib import Path

# Add the parent directory of app to the Python path
sys.path.append(str(Path(__file__).parent.parent))

from app.db.base import SessionLocal
from app.db.models.llm_provider import LLMProvider
from app.crud.llm import decrypt_api_key

def extract():
    db = SessionLocal()
    try:
        groq = db.query(LLMProvider).filter(LLMProvider.provider_key == 'groq').first()
        if groq:
            print('GROQ_API_KEY=' + decrypt_api_key(groq.api_key_enc))
        else:
            print('Groq not found')
    finally:
        db.close()

if __name__ == "__main__":
    extract()
