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
    payload = {
        "model": "llama3-70b-8192",
        "messages": [{"role": "system", "content": "Return json please."}, {"role": "user", "content": "hello"}],
        "response_format": {"type": "json_object"}
    }
    resp = requests.post(f"{groq_prov.base_url}/chat/completions", headers=headers, json=payload)
    print(resp.status_code)
    try:
        print(resp.json())
    except:
        print(resp.text)
