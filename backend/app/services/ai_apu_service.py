import json
from typing import Any, Dict, List, Optional
from app.services.llm_router import call_llm_json


# ---------------------------------------------------------------------------
# Prompt base reutilizable: reglas COVENIN, insumos, formato de salida
# ---------------------------------------------------------------------------
_FORMATO_SALIDA = """
# FORMATO DE SALIDA OBLIGATORIO
Devuelve ÚNICAMENTE un JSON válido con esta estructura (sin texto extra antes o después):
{
    "status": "completed",
    "clarification_message": "mensaje si aplica, si no null",
    "options": [],
    "questions": [],
    "partida": {
        "cod_par": "E340000000",
        "description": "DESCRIPCIÓN TÉCNICA COMPLETA EN MAYÚSCULAS. INCLUYE MATERIALES, EQUIPOS Y MANO DE OBRA.",
        "unit": "m2",
        "quantity": 1.0,
        "performance": 10.5
    },
    "materials": [
        {"id":"m-1","codigo":"...","descripcion":"...","unidad":"...","cantidad":0.0,"desperdicio":5,"precio_unitario":0.0,"origen":"historico","nota_calculo":"..."}
    ],
    "equipments": [
        {"id":"e-1","codigo":"...","descripcion":"...","unidad":"día","cantidad":0.0,"depreciacion":1.0,"precio_unitario":0.0,"origen":"historico","nota_calculo":"..."}
    ],
    "labors": [
        {"id":"l-1","codigo":"...","descripcion":"...","unidad":"día","cantidad":0.0,"jornal":0.0,"bono":0.0,"origen":"historico","nota_calculo":"..."}
    ],
    "advertencias": ["lista de advertencias que generes"]
}
"""

_REGLAS_COVENIN = """
# REGLAS DE CODIFICACIÓN COVENIN
- El campo `cod_par` debe seguir la Norma COVENIN 2000:1992: 1 letra + 9 dígitos numéricos (total 10 caracteres).
- DEBE comenzar exactamente con el `covenin_prefix` indicado.
- Usa el `covenin_context` para elegir el subcódigo correcto; completa con ceros los dígitos restantes.
- Ejemplo correcto: E131110000 (letra E + 9 dígitos).
"""

_REGLAS_DESCRIPCION = """
# DESCRIPCIÓN DE LA PARTIDA
En el campo `description` de `partida`, NO copies la solicitud del usuario literalmente.
MEJORA Y EXPANDE para crear una descripción técnica profesional completa, en MAYÚSCULAS,
similar a las normas de medición de ingeniería civil.
Incluye: características del material, método de ejecución, qué incluye/excluye, unidad de medida.
"""

_REGLAS_ORIGEN = """
# CAMPO "origen" (OBLIGATORIO en cada insumo)
- "historico": cantidad tomada del APU base sin ajustes mayores.
- "ia": cantidad estimada/ajustada por ti, o insumo añadido por criterio técnico.
"""


def generate_apu_with_ai(payload_llm: Dict[str, Any], history: list = None) -> Dict[str, Any]:
    """
    Generación de APU usando el flujo clásico de preprocesamiento estadístico.
    Se usa cuando NO hay una partida base seleccionada por el usuario.
    """
    if payload_llm.get("modo") == "incongruencia_matematica":
        return {
            "status": "clarification_needed",
            "clarification_message": (
                "Lo que buscas no tiene relación con las categorías COVENIN seleccionadas. "
                "Por favor, corrige tu descripción o cambia la categoría."
            ),
            "options": [],
            "questions": [],
        }

    history_text = ""
    if history:
        history_text = "\n# HISTORIAL DE CONVERSACIÓN\n"
        for msg in history:
            role = "USUARIO" if msg.get("role") == "user" else "SISTEMA/IA"
            history_text += f"{role}: {msg.get('content')}\n"

    prompt = f"""
# ROL
Eres un Ingeniero Civil especialista en Análisis de Precios Unitarios (APU).
Recibes un payload con rendimientos históricos calculados a partir de partidas similares
reales de la base de datos, un catálogo de insumos filtrado y advertencias.
Tu trabajo es construir un APU técnico y completo basándote estrictamente en esta data.

# REGLAS DE CLARIFICACIÓN (¡MUY IMPORTANTE!)
Dirígete SIEMPRE al usuario en segunda persona ("Tu solicitud", "Estás pidiendo").

1. **Incongruencia Total (PRIORIDAD 1):** Si la solicitud NO corresponde lógicamente con
   el `covenin_context`, prohíbete generar el APU. Informa al usuario y pídele que corrija.
2. **Falta de datos críticos:** Si faltan datos clave (espesor, material, dimensiones),
   haz 1-3 preguntas de clarificación. No inventes datos críticos.
3. **Confirmación de partidas históricas:** Si `partidas_encontradas > 0` y la descripción
   no es exactamente una de ellas, devuelve `status: "clarification_needed"` con las
   partidas históricas como `options` para que el usuario confirme.
4. Si el usuario ya respondió (ver historial), genera el APU directamente con `status: "completed"`.

# PAYLOAD DEL SISTEMA (datos históricos y catálogo)
{json.dumps(payload_llm, ensure_ascii=False)}
{history_text}

# REGLAS DE INTERPRETACIÓN
1. Si hay múltiples unidades en `rendimientos_historicos_por_unidad_partida`, elige la más lógica.
2. Usa `cantidad_promedio` como base para cada insumo.
3. Ajusta proporcionalmente si la solicitud difiere de las partidas históricas.
4. Insumos "obligatorio: true" (presencia > 70%) DEBEN incluirse.
5. Insumos "opcional" (presencia < 30%) solo si son estrictamente necesarios.
6. Si necesitas un insumo no listado, agrégalo con origen "ia" y explica en `nota_calculo`.

# REGLAS DE INSUMOS
- USA ÚNICAMENTE insumos del catálogo provisto.
- PROHIBIDO inventar precios. Si no existe el insumo exacto, usa el sustituto más cercano.
- Cada sustitución DEBE anotarse en `advertencias`.

{_REGLAS_COVENIN}
{_REGLAS_DESCRIPCION}
{_REGLAS_ORIGEN}
{_FORMATO_SALIDA}
"""
    result = call_llm_json(prompt, use_case="cost360")
    if "advertencias" not in result:
        result["advertencias"] = []

    result["debug_preprocesamiento"] = payload_llm

    if result.get("status") == "clarification_needed":
        return result

    if payload_llm.get("advertencias_preprocesamiento"):
        result["advertencias"].extend(payload_llm["advertencias_preprocesamiento"])

    return result


def generate_apu_with_ai_from_base(
    base_apu: Dict[str, Any],
    user_description: str,
    covenin_prefix: str,
    covenin_context: str,
    smart_answers: Optional[Dict[str, str]] = None,
    history: Optional[List[Dict]] = None,
) -> Dict[str, Any]:
    """
    Generación de APU usando una partida base seleccionada por el usuario
    a través del Smart Selector. El LLM ADAPTA el APU base, no lo inventa.

    Este modo:
    - Proporciona al LLM el APU completo de la partida histórica (insumos, precios, cantidades reales)
    - Le pide ADAPTAR (no crear desde cero)
    - Reduce drásticamente el riesgo de alucinaciones
    """
    history_text = ""
    if history:
        history_text = "\n# HISTORIAL DE CONVERSACIÓN\n"
        for msg in history:
            role = "USUARIO" if msg.get("role") == "user" else "SISTEMA/IA"
            history_text += f"{role}: {msg.get('content')}\n"

    answers_text = ""
    if smart_answers:
        answers_text = "\n# CARACTERÍSTICAS SELECCIONADAS POR EL USUARIO (respuestas del asistente)\n"
        for qid, answer in smart_answers.items():
            answers_text += f"- {answer}\n"

    base_json = json.dumps(base_apu, ensure_ascii=False, indent=2) if base_apu else "No disponible"

    prompt = f"""
# ROL
Eres un Ingeniero Civil especialista en Análisis de Precios Unitarios (APU).
El sistema ha seleccionado una partida histórica de la base de datos como BASE DE ADAPTACIÓN.
Tu tarea es ADAPTAR ese APU base para la nueva partida solicitada por el usuario.
NO debes inventar desde cero. Usa los insumos, precios y cantidades del APU base como referencia principal.

# SOLICITUD DEL USUARIO
Descripción: {user_description}
Categoría COVENIN: {covenin_context}
Prefijo COVENIN: {covenin_prefix}
{answers_text}

# APU BASE SELECCIONADO (partida histórica real de la base de datos)
{base_json}
{history_text}

# INSTRUCCIONES DE ADAPTACIÓN
1. El APU base es para una partida SIMILAR, no idéntica. Tu trabajo es adaptarlo para "{user_description}".
2. CONSERVA todos los insumos que sigan siendo relevantes para la nueva partida. Márcalos como `"origen": "historico"`.
3. ELIMINA los insumos que claramente no aplican a la nueva partida.
4. AJUSTA cantidades cuando la nueva partida lo requiera (ej: distinta área, espesor, complejidad).
   Marca los insumos ajustados como `"origen": "ia"` y explica el ajuste en `nota_calculo`.
5. AGREGA insumos nuevos que la nueva partida requiera y no estén en la base. Márcalos como `"origen": "ia"`.
6. NUNCA cambies los precios unitarios de los insumos del APU base. Son precios reales de la BD.
7. Si detectas una incongruencia grave entre el APU base y la solicitud, indícalo en `advertencias`.
8. Agrega SIEMPRE una advertencia indicando que el APU fue adaptado desde la partida base [{base_apu.get('codpar', 'N/A')}].

# FALTA DE DATOS
Si la descripción del usuario es ambigua o le faltan datos críticos para adaptar correctamente,
devuelve `status: "clarification_needed"` con las preguntas específicas que necesitas.
Si tienes suficiente información, genera el APU y devuelve `status: "completed"`.

{_REGLAS_COVENIN}
{_REGLAS_DESCRIPCION}
{_REGLAS_ORIGEN}
{_FORMATO_SALIDA}
"""
    result = call_llm_json(prompt, use_case="cost360")
    if "advertencias" not in result:
        result["advertencias"] = []

    result["debug_base_apu"] = base_apu

    return result
