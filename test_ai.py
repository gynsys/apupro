import sys
sys.path.append('/app')
from app.services.llm_router import _call_gemini, _load_providers, call_llm_json

try:
    providers = _load_providers("ai_apu_generator")
    print(f"Providers: {providers}")
    if not providers:
        print("No providers found!")
    else:
        res = call_llm_json("Crea una partida para muro de ladrillo", "ai_apu_generator")
        print(f"Result: {res}")
except Exception as e:
    import traceback
    traceback.print_exc()
