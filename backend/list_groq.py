import requests
from app.db.models.llm_provider import LLMProvider
from app.crud.llm import decrypt_api_key
from app.db.base import SessionLocal
db = SessionLocal()
provider_groq = db.query(LLMProvider).filter(LLMProvider.provider_key == "groq").first()
api_key = decrypt_api_key(provider_groq.api_key_enc)
resp = requests.get('https://api.groq.com/openai/v1/models', headers={'Authorization': f'Bearer {api_key}'})
models = [m['id'] for m in resp.json().get('data', [])]
print(models)
