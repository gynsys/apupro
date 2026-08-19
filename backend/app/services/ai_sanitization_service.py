import json
from typing import Dict, List, Any
from app.services.llm_router import call_llm_json

_SANITIZATION_PROMPT = """
Eres un experto ingeniero civil y analista de datos de costos de construcción.
Tu tarea es sanear y estandarizar descripciones sucias de materiales de una base de datos.

REGLAS DE SANEAMIENTO:
1. Elimina abreviaturas extrañas, errores ortográficos y formatos inconsistentes.
2. Estandariza la unidad a su notación correcta métrica o comercial (ej: kg, m, m2, m3, pza, saco, cuñete).
3. Asigna este material a una "Familia de Material" (ej: "Aceros", "Cementos", "Pinturas", "Agregados", "Cables").
4. Genera una descripción 'limpia' y profesional.

Devuelve ÚNICAMENTE un JSON válido con esta estructura:
{
    "results": [
        {
            "original_code": "MAT-001",
            "clean_description": "CEMENTO PORTLAND GRIS TIPO I",
            "clean_unit": "saco 42.5kg",
            "family": "Cementos y Derivados",
            "confidence": 0.95
        }
    ]
}
"""

def sanitize_materials_batch(materials_batch: List[Dict[str, str]], override_prompt: str = None) -> Dict[str, Any]:
    """
    Toma un lote de materiales [{ 'code': '...', 'description': '...', 'unit': '...' }]
    y utiliza el LLM para devolver descripciones saneadas y clasificadas en familias.
    """
    
    # Preparar el payload para el LLM
    prompt_text = override_prompt if override_prompt else _SANITIZATION_PROMPT
    
    input_data = json.dumps(materials_batch, ensure_ascii=False, indent=2)
    prompt_text += f"\n\nMATERIALES A SANEAR:\n{input_data}"
    
    try:
        response = call_llm_json(prompt_text)
        return response
    except Exception as e:
        return {"error": str(e)}
