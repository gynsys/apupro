import google.generativeai as genai
import os
import sys
api_key = os.environ.get('GEMINI_API_KEY')
if not api_key:
    from app.core.config import settings
    api_key = settings.GEMINI_API_KEY
genai.configure(api_key=api_key)
print([m.name for m in genai.list_models() if 'generateContent' in m.supported_generation_methods])
