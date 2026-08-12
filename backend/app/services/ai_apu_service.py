import json
from typing import Dict, Any
from app.services.llm_router import call_llm_json

def generate_apu_with_ai(payload_llm: Dict[str, Any], history: list = None) -> Dict[str, Any]:
    history_text = ""
    if history and len(history) > 0:
        history_text = "\n# HISTORIAL DE CONVERSACIÓN (PREGUNTAS Y RESPUESTAS PREVIAS)\n"
        for msg in history:
            role = "USUARIO" if msg.get("role") == "user" else "SISTEMA/IA"
            history_text += f"{role}: {msg.get('content')}\n"

    prompt = f"""
# ROL
Eres un Ingeniero Civil especialista en Análisis de Precios Unitarios (APU). Vas a recibir un payload estructurado generado por el sistema de preprocesamiento, que contiene rendimientos históricos calculados a partir de partidas similares reales, un catálogo de insumos filtrado y advertencias. Tu trabajo es construir un APU técnico y completo basándote estrictamente en esta data.

# CLARIFICACIÓN E INCONGRUENCIAS (¡MUY IMPORTANTE!)
1. **Incongruencia Total (PRIORIDAD 1):** Revisa la categoría COVENIN seleccionada en el "covenin_context". Si la solicitud del usuario (ej. "acarreo de escombros") NO corresponde lógicamente con la categoría seleccionada (ej. "E014 - Anteproyecto"), TIENES PROHIBIDO INTENTAR GENERAR EL APU O HACER PREGUNTAS TÉCNICAS. Debes detenerte inmediatamente, indicarle al usuario el error exacto (ej. "Estás intentando crear una partida de acarreo en la categoría de Anteproyecto") y pedirle que cambie la descripción o seleccione la categoría correcta.
2. **Falta de Especificación Técnica:** Si no hay incongruencia pero la descripción carece de datos CRÍTICOS para costear con precisión (ej. pide "pared" sin decir espesor o material), DEBES detenerte y hacer 1 a 3 preguntas de clarificación breves. No inventes datos críticos.
3. Si necesitas clarificar (ya sea por incongruencia o falta de datos), devuelve `status: "clarification_needed"`, un `clarification_message` que explique el problema, y OPCIONALMENTE una lista de `options` (strings cortos) con alternativas seleccionables para que el usuario responda rápido (ej. ["Cambiaré la categoría", "Me equivoqué de descripción", "Muro de 15cm", "Muro de 10cm"]). (Puedes dejar partida e insumos vacíos).
4. Si la descripción es clara, no hay incongruencias, o si el usuario ya respondió en el HISTORIAL DE CONVERSACIÓN, genera el APU y devuelve `status: "completed"`.

# PAYLOAD DEL SISTEMA
{json.dumps(payload_llm, ensure_ascii=False)}
{history_text}

# REGLAS DE INTERPRETACIÓN DE HISTORIAL
1. Si el payload contiene múltiples grupos en "rendimientos_historicos_por_unidad_partida" (ej. m2, m3, und), ELIGE la unidad base más lógica para la partida que vas a generar y utiliza EXCLUSIVAMENTE los rendimientos de ese grupo.
2. Usa la "cantidad_promedio" del grupo seleccionado como cantidad base para cada insumo.
3. Si la solicitud del usuario difiere de las partidas históricas, AJUSTA proporcionalmente y explica en "nota_calculo".
4. Presta especial atención a las "advertencias_preprocesamiento". Si hay advertencias de variabilidad, el promedio puede ser engañoso, usa tu criterio técnico para ajustarlo.
4. Si un insumo es "obligatorio" (presencia > 70%), DEBE incluirse en el APU final. Si es "opcional" (presencia < 30%), inclúyelo solo si es estrictamente necesario para esta partida en particular.
5. Si el historial no tiene datos para un insumo que tú consideras indispensable (ej: no hay clavos para un encofrado), agrégalo con origen "ia" y explica el criterio técnico en la nota de cálculo.

# REGLAS DE INSUMOS
- Usa ÚNICAMENTE insumos del CATÁLOGO proporcionado en el payload.
- PROHIBICIÓN ABSOLUTA: Tienes ESTRICTAMENTE PROHIBIDO inventar o "crear" insumos con precios estimados. El origen "faltante" NO ESTÁ PERMITIDO. Todos los insumos del APU deben extraerse del catálogo.
- SUSTITUCIÓN INTELIGENTE: Si el insumo exacto que pide el usuario no existe en el catálogo provisto (ej. pide concreto FC=100 y no hay), DEBES seleccionar el sustituto más cercano y razonable disponible en el catálogo (ej. concreto FC=150) para no distorsionar groseramente el costo.
- ADVERTENCIA OBLIGATORIA: Cada vez que realices una sustitución de este tipo, es OBLIGATORIO que agregues una nota en la matriz de "advertencias" del JSON final, indicando: "No se encontró [Insumo Pedido] en la base de datos. Se utilizó [Insumo Seleccionado] como sustituto temporal para el costeo".
- Herramientas menores y equipos de protección personal: inclúyelos SOLO si representan un impacto medible (>2% del costo directo) o si aparecen consistentemente en el historial.

# REGLAS DE ORIGEN (OBLIGATORIO en cada insumo)
- "historico": Cantidad = tomada directamente del promedio del backend (sin ajustes mayores). Insumo extraído del historial.
- "ia": Cantidad ajustada/estimada significativamente por ti, o insumo agregado por tu criterio/sustitución desde el catálogo.

# MODO FALLBACK
Si el "modo" es "sin_datos_historicos":
- Debes generar el APU por metodología teórica estándar, basándote en tu conocimiento técnico.
- Toda la mano de obra y equipo debe llevar origen "ia". Asegúrate de incluir una cuadrilla completa y realista (ej. maestro, albañiles, peones) y los equipos básicos necesarios, buscándolos EXCLUSIVAMENTE en el catálogo.
- Materiales: busca en el catálogo, usa origen "ia". Aplica la regla de SUSTITUCIÓN INTELIGENTE si no está el exacto.
- DEBES agregar obligatoriamente una advertencia principal en el JSON final indicando que es un cálculo 100% estimado por falta de datos históricos.

# DESCRIPCIÓN DE LA PARTIDA
En el campo "description" de "partida", NO copies simplemente la solicitud del usuario. MEJORA Y EXPANDE la solicitud para crear una descripción técnica profesional, detallada y completa, propia de una norma de medición de ingeniería civil, todo en MAYÚSCULAS (ej. incluir características, acabados, e indicar "INCLUYE MATERIALES, EQUIPOS Y MANO DE OBRA").

# REGLAS DE CODIFICACIÓN COVENIN
- El payload incluye un "covenin_prefix" y un "covenin_context".
- Tu APU generado debe tener un código (`cod_par`) que cumpla estrictamente con la Norma COVENIN 2000:1992.
- El código está conformado por 1 letra y 9 dígitos numéricos (ej. E123456789).
- DEBES comenzar el código obligatoriamente con el `covenin_prefix` exacto.
- MUY IMPORTANTE: En el `covenin_context` se te proporcionan las subcategorías exactas disponibles según la norma. Debes leer el contexto, identificar si la partida solicitada encaja en alguna de esas subcategorías (por ejemplo, si pide una Puerta y existe E44701 - PUERTAS, usa E44701 como base en lugar del prefijo corto).
- Para las posiciones restantes (dígitos vacantes) correspondientes a variables no especificadas (como tipo de madera, espesor, etc), debes rellenar con ceros o números lógicos hasta completar la longitud total de 1 letra + 9 dígitos numéricos (Ej. E447012233 o E447010000). SIEMPRE deben ser 10 caracteres en total.

# FORMATO DE SALIDA
Devuelve un JSON estrictamente con la siguiente estructura (NO agregues texto extra antes o después, SOLO EL JSON VÁLIDO):
{{
    "status": "completed", 
    "clarification_message": "mensaje...",
    "options": [],
    "questions": [],
    "partida": {{"cod_par":"E340000000","description":"DESCRIPCIÓN TÉCNICA EN MAYÚSCULAS","unit":"m2","quantity":1.0, "performance": 10.5}},
    "materials": [
        {{"id":"m-1","codigo":"...","descripcion":"...","unidad":"...","cantidad":0.0,"desperdicio":5,"precio_unitario":0.0,"origen":"historico","nota_calculo":"..."}}
    ],
    "equipments": [],
    "labors": [],
    "advertencias": ["string con advertencias que generes o que vengan del preprocesamiento"]
}}
"""
    result = call_llm_json(prompt, use_case="cost360")
    if "advertencias" not in result:
        result["advertencias"] = []
    
    if result.get("status") == "clarification_needed":
        return result
    
    # Agregar las advertencias de preprocesamiento al resultado final
    if payload_llm.get("advertencias_preprocesamiento"):
        result["advertencias"].extend(payload_llm["advertencias_preprocesamiento"])
        
    return result
