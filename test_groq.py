import os
import requests
from app.crud.llm import decrypt_api_key
from app.db.base import SessionLocal
from app.db.models.llm_provider import LLMProvider

db = SessionLocal()
groq_prov = db.query(LLMProvider).filter_by(provider_key="groq").first()
if groq_prov:
    api_key = decrypt_api_key(groq_prov.api_key_enc)
    headers = {"Authorization": f"Bearer {api_key}"}
    resp = requests.get(f"{groq_prov.base_url}/models", headers=headers)
    print(resp.status_code)
    try:
        print(resp.json())
    except:
        print(resp.text)
