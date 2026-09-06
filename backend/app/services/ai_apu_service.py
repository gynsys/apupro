import json
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy.orm import Session
from app.core.logging import logger
from app.services.llm_router import call_llm_json
from app.db.models.cost360 import (
    CostItem,
    CostAPUMaterial,
    CostAPUEquipment,
    CostAPULabor,
    CostMaterial,
    CostEquipment,
    CostLabor,
)
from app.services.ai_search import ai_engine


# ---------------------------------------------------------------------------
# Prompt base reutilizable: reglas COVENIN, insumos, formato de salida
# ---------------------------------------------------------------------------
# ---------------------------------------------------------------------------
# Prompt base reutilizable: reglas COVENIN, insumos, formato de salida
# ---------------------------------------------------------------------------
_FORMATO_SALIDA = """
# FORMATO DE SALIDA OBLIGATORIO (JSON ESTRICTO)
Devuelve ÚNICAMENTE un JSON válido (sin texto extra, sin markdown adicional fuera del bloque JSON) según uno de estos 2 casos:

CASO 1: Si la solicitud es técnicamente comprensible y ejecutable, genera el APU completo:
{
    "status": "completed",
    "clarification_message": null,
    "options": [],
    "questions": [],
    "guia_redaccion": null,
    "partida": {
        "cod_par": "E313SC001",
        "description": "DESCRIPCIÓN TÉCNICA COMPLETA EN MAYÚSCULAS CON NORMATIVA COVENIN.",
        "unit": "m2",
        "quantity": 1.0,
        "performance": 10.5
    },
    "materials": [
        {"id":"m-1","codigo":"...","descripcion":"...","unidad":"...","cantidad":0.0,"desperdicio":5.0,"precio_unitario":0.0,"origen":"historico","nota_calculo":"..."}
    ],
    "equipments": [
        {"id":"e-1","codigo":"...","descripcion":"...","unidad":"día","cantidad":0.0,"depreciacion":1.0,"precio_unitario":0.0,"origen":"historico","nota_calculo":"..."}
    ],
    "labors": [
        {"id":"l-1","codigo":"...","descripcion":"...","unidad":"día","cantidad":0.0,"jornal":0.0,"bono":0.0,"origen":"historico","nota_calculo":"..."}
    ],
    "advertencias": ["lista de advertencias técnicas o notas al usuario"]
}

CASO 2: ÚNICAMENTE si la entrada es ininteligible, contradictoria o un disparate que no describe una actividad técnica de construcción:
{
    "status": "clarification_needed",
    "clarification_message": "No fue posible identificar una actividad constructiva ejecutable a partir de la descripción ingresada.",
    "options": [],
    "questions": [
        "1. Acción principal: ¿Es demolición, bote/transporte, suministro, instalación o construcción?",
        "2. Elemento constructivo: ¿Qué elemento exacto se va a intervenir (pared, losa, viga, piso, tubería)?",
        "3. Material o especificación: ¿Qué material, espesor o resistencia tiene (ej: concreto 210 kg/cm², mortero 1:4)?",
        "4. Entorno y alcance: ¿Se realiza de forma manual o con maquinaria? ¿Incluye acarreo y bote?"
    ],
    "guia_redaccion": "Estructura recomendada: [Acción] + [Elemento] + [Material/Especificación] + [Método o Ubicación]. Ejemplo: 'Construcción de pared de bloques de arcilla e=15 cm con mortero 1:4 en planta baja'.",
    "partida": null,
    "materials": [],
    "equipments": [],
    "labors": [],
    "advertencias": ["Entrada ambigua o no técnica rechazada para evitar generar un presupuesto con costos erróneos."]
}
"""

_REGLAS_COVENIN = """
# REGLAS DE CODIFICACIÓN COVENIN Y PARTIDAS ESPECIALES NO TIPIFICADAS (CONVENCIÓN SC)
1. Si la partida proviene de una partida base histórica existente, conserva su código `cod_par` oficial.
2. Si la partida es NUEVA, ADAPTADA o GENERADA POR IA, debe seguir la convención formal de presupuestos y licitaciones en Venezuela para partidas no tipificadas en el tabulador (convención SC = Sin Código / Partida Especial):
   - Prefijo de sector y capítulo según la actividad (ej. E1010 para obras preliminares, E313 para estructuras de concreto, E411 para albañilería, E511 para instalaciones, etc.). Si se proporciona `covenin_prefix`, úsalo como raíz eliminando ceros sobrantes.
   - Seguido de 'SC' (que indica formalmente Partida Especial / Sin Código COVENIN).
   - Seguido de un correlativo de tres dígitos '001'.
   - Ejemplos obligatorios: 'E1010SC001', 'E313SC001', 'E411SC001', 'C311SC001'.
   - PROHIBIDO inventar códigos puramente numéricos falsos que simulen ser normas oficiales tipificadas.
"""

_REGLAS_DESCRIPCION = """
# DESCRIPCIÓN DE LA PARTIDA
En el campo `description` de `partida`, NO copies la solicitud del usuario literalmente.
MEJORA Y EXPANDE para crear una descripción técnica profesional completa, en MAYÚSCULAS,
siguiendo las especificaciones de las normas COVENIN de construcción.
Estructura: [ACCIÓN TÉCNICA] + [ELEMENTO ESPECÍFICO] + [MATERIALES Y ESPECIFICACIÓN] + [ALCANCES Y CONDICIONES].
"""

_REGLAS_ORIGEN = """
# CAMPO "origen" (OBLIGATORIO en cada insumo)
- "historico": insumo y precio tomados del catálogo/partida base.
- "ia": insumo técnico indispensable agregado o ajustado por ti que no estaba disponible en el catálogo.
"""

_REGLAS_EQUIPOS_ESCALA = """
# REGLA ESTRICTA DE MAQUINARIA Y ESCALA DE OBRA (¡CRÍTICO!)
1. PROPORCIONALIDAD DE ESCALA: Los equipos deben corresponder estrictamente al volumen, acceso y magnitud de la obra.
2. PROHIBICIÓN DE MAQUINARIA PESADA EN TRABAJOS MANUALES O CONFINADOS: Si la descripción indica o implica trabajo 'a mano', 'manual', 'en sótano', 'reparación puntual', 'espacio confinado', 'acarreo interno' o 'equipo liviano', QUEDA TERMINANTEMENTE PROHIBIDO incluir maquinaria pesada (tractores, retroexcavadoras, payloader, jumbo, camiones roqueros, etc.). Usa únicamente herramientas menores o equipos manuales ligeros.
3. INCLUSIÓN OBLIGATORIA DE EQUIPOS LIVIANOS EN ACARREO O TRABAJO MANUAL: Si la actividad implica movimiento, carga, acarreo o transporte manual de materiales, tierra, escombros o piedras, DEBES INCLUIR obligatoriamente equipos manuales de apoyo (ej: CARRETILLA, pala, pico, etc.) en la sección de equipos, incluso si el APU base histórico venía sin equipos.
4. PROHIBIDO SALTO DE CATEGORÍA DE EQUIPO:
   - Está PROHIBIDO sustituir un trompo mezclador (1 saco / equipo liviano) por un camión mixer premezclado o planta de concreto.
   - Está PROHIBIDO sustituir un camión grúa liviano (o polipasto) por una grúa telescópica de 50-100 toneladas para izajes menores.
   - Si el catálogo no tiene el equipo liviano adecuado, AGRÉGALO con origen "ia", asígnale una tarifa diaria referencial estimada de mercado en USD (nunca 0.0) y emite una advertencia con el prefijo `[PRECIO_REFERENCIAL]`.
"""

_REGLAS_NUMERICAS = """
# DEFINICIONES NUMÉRICAS Y UNIDADES
- `performance` (Rendimiento): Cantidad de la unidad_medida producida por la cuadrilla completa en 1 jornada diaria de 8 horas (ej: 12.5 m3/día).
  * Si tienes partidas históricas de referencia, el rendimiento DEBE estar anclado a ellas o en el rango de los rendimientos históricos provistos.
  * No inventes rendimientos ilógicos o desproporcionados.
- `desperdicio`: Número que representa el porcentaje de merma del material (ejemplo: 5.0 representa 5%, 10.0 representa 10%).
- `depreciacion`: Factor horario del equipo (ejemplo: 1.0 para el 100% del costo diario).
- `jornal` y `bono`: Tarifas diarias de mano de obra en USD por jornada de 8 horas.
- `precio_unitario`: Precio en USD de la unidad del insumo.
"""

_REGLAS_INSUMOS_PRECIOS = """
# REGLAS DE INSUMOS Y PRECIOS
1. Prioriza SIEMPRE insumos del catálogo provisto con sus precios históricos reales (`origen: "historico"`).
2. PRECIOS REFERENCIALES DE MERCADO PARA INSUMOS FALTANTES:
   - Si se requiere un insumo técnicamente indispensable que NO está en el catálogo provisto, agrégalo con `origen: "ia"`.
   - Asígnale un `precio_unitario` referencial estimado según valores de mercado actuales de la construcción en USD (NUNCA dejes precio 0.0).
   - En `advertencias`, agrega obligatoriamente una nota con el prefijo `[PRECIO_REFERENCIAL]` indicando el insumo y que dicho valor es un precio de mercado referencial estimado por la IA que se recomienda cotizar y validar con proveedores locales.
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
                "La descripción ingresada no tiene relación técnica reconocible con la categoría COVENIN seleccionada. "
                "Por favor, revisa la descripción técnica o ajusta la categoría."
            ),
            "options": [],
            "questions": [
                "1. ¿Qué actividad constructiva específica deseas presupuestar?",
                "2. ¿Cuál es el elemento principal a intervenir?",
                "3. ¿Qué materiales y especificaciones técnicas aplican?",
                "4. ¿En qué unidad de medida se computa la partida?"
            ],
            "guia_redaccion": "Estructura recomendada: [Acción] + [Elemento] + [Material/Especificación] + [Método o Ubicación].",
            "partida": None,
            "materials": [],
            "equipments": [],
            "labors": [],
            "advertencias": ["Incongruencia técnica detectada entre la descripción y el contexto COVENIN."]
        }

    history_text = ""
    if history:
        history_text = "\n# HISTORIAL DE CONVERSACIÓN\n"
        for msg in history:
            role = "USUARIO" if msg.get("role") == "user" else "SISTEMA/IA"
            history_text += f"{role}: {msg.get('content')}\n"

    prompt = f"""
# ROL
Eres un Ingeniero Civil especialista en Análisis de Precios Unitarios (APU) bajo normativa venezolana COVENIN.
Recibes un payload con rendimientos históricos calculados a partir de partidas similares reales de la base de datos,
un catálogo de insumos filtrado y advertencias. Tu trabajo es estructurar un APU técnico, robusto y profesional.

# CRITERIO DE CLARIFICACIÓN VS GENERACIÓN
- Si la solicitud es inteligible y describe una actividad de construcción válida (aunque sea breve o le falte algún detalle secundario), DEBES GENERAR EL APU con `status: "completed"`. Asume la hipótesis técnica más estándar según la práctica COVENIN y documenta cualquier suposición en `advertencias`.
- ÚNICAMENTE si la entrada es ininteligible, una secuencia de palabras sin sentido constructivo ("casa caucho tumbar", caracteres aleatorios) o una contradicción física insalvable, responde con `status: "clarification_needed"` siguiendo el CASO 2 del formato de salida.

# PAYLOAD DEL SISTEMA (datos históricos y catálogo)
{json.dumps(payload_llm, ensure_ascii=False)}
{history_text}

# REGLAS DE INTERPRETACIÓN
1. Si hay múltiples unidades en `rendimientos_historicos_por_unidad_partida`, elige la más lógica para la actividad.
2. Usa `cantidad_promedio` como base para cada insumo.
3. Insumos con presencia alta (> 70%) en las partidas históricas deben conservarse si aplican a la partida.
4. Ancla el rendimiento al promedio de las partidas históricas más similares.

{_REGLAS_EQUIPOS_ESCALA}
{_REGLAS_INSUMOS_PRECIOS}
{_REGLAS_NUMERICAS}
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
    complementary_apus: Optional[List[Dict[str, Any]]] = None,
    user_description: str = "",
    covenin_prefix: str = "",
    covenin_context: str = "",
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
    
    comp_text = ""
    if complementary_apus:
        comp_text = "\n# PARTIDAS COMPLEMENTARIAS DE APOYO\n"
        comp_text += "Si la solicitud del usuario incluye elementos que NO están en el APU BASE (ej. andamios, transporte, bote), puedes 'robar' insumos, equipos o rendimientos de estas partidas complementarias.\n\n"
        for i, comp in enumerate(complementary_apus):
            comp_text += f"## Complementaria {i+1} [{comp.get('codpar', 'N/A')}]\n"
            comp_text += json.dumps(comp, ensure_ascii=False, indent=2)
            comp_text += "\n"

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
{comp_text}
{history_text}

# INSTRUCCIONES DE ADAPTACIÓN
1. El APU base es para una partida SIMILAR, no idéntica. Tu trabajo es adaptarlo para "{user_description}".
2. ANCLAJE DE RENDIMIENTO: Conserva como ancla principal el rendimiento (`performance`) del APU base [{base_apu.get('rendimiento') or base_apu.get('performance') or base_apu.get('RenPar') or 'N/A'}]. Solo ajústalo si la geometría, altura o complejidad de la nueva partida lo justifica de forma evidente, y explica el motivo en notas.
3. CONSERVA todos los insumos que sigan siendo relevantes para la nueva partida. Márcalos como `"origen": "historico"`.
4. ELIMINA los insumos que claramente no aplican a la nueva partida.
5. AJUSTA cantidades cuando la nueva partida lo requiera (ej: distinta área, espesor, proporción).
   Marca los insumos ajustados como `"origen": "ia"` y explica el ajuste en `nota_calculo`.
6. AUTO-FUSIÓN: Si la descripción del usuario exige algo que falta en la Base (ej. Bote de material, Pintura, Andamios, Encofrado) pero que sí existe en las Partidas Complementarias, "róbalo" e intégralo conservando sus precios históricos.
7. AGREGA insumos nuevos que la nueva partida requiera estrictamente y no estén ni en la base ni en las complementarias. Márcalos como `"origen": "ia"`, asígnales un precio unitario referencial estimado de mercado en USD (nunca 0.0) y agrega una advertencia con el prefijo `[PRECIO_REFERENCIAL]`.
8. NUNCA alteres los precios unitarios de los insumos del APU base ni de las complementarias. Son precios reales de la BD.
9. Agrega SIEMPRE una advertencia indicando que el APU fue adaptado desde la partida base [{base_apu.get('codpar', 'N/A')}].

# CRITERIO DE CLARIFICACIÓN VS GENERACIÓN
- Si la solicitud es inteligible y describe una actividad técnica razonable, DEBES GENERAR EL APU con `status: "completed"`. Asume la hipótesis técnica más lógica basada en el APU base.
- ÚNICAMENTE si la entrada es ininteligible, una secuencia de palabras incoherentes ("casa caucho tumbar") o una contradicción física insalvable, responde con `status: "clarification_needed"` siguiendo el CASO 2 del formato de salida.

{_REGLAS_EQUIPOS_ESCALA}
{_REGLAS_INSUMOS_PRECIOS}
{_REGLAS_NUMERICAS}
{_REGLAS_COVENIN}
{_REGLAS_DESCRIPCION}
{_REGLAS_ORIGEN}
{_FORMATO_SALIDA}
"""
    result = call_llm_json(prompt, use_case="cost360")
    if "advertencias" not in result:
        result["advertencias"] = []

    result["debug_base_apu"] = base_apu
    result["prompt_enviado_al_llm"] = prompt

    return result


def get_dynamic_candidates(
    db: Session,
    description: str,
    covenin_prefix: str = "",
    limit: int = 15,
) -> Tuple[List[Dict[str, Any]], float]:
    """
    Recupera las partidas más similares desde el Cerebro RAG Híbrido,
    considerando el material técnico y filtrando opcionalmente por prefijo.
    """
    if not description or not isinstance(description, str):
        return [], 0.0

    try:
        if not getattr(ai_engine, "is_loaded", False):
            ai_engine.load_brain()
            
        hybrid_results = ai_engine.hybrid_search(db, description, limit=limit * 3)
        if not hybrid_results:
            return [], 0.0
            
        best_score = hybrid_results[0]["score"]
        
        tipo_obra = covenin_prefix[0] if covenin_prefix else ""
        prefixes = [covenin_prefix] if covenin_prefix else []
        
        candidates_with_scores: List[Tuple[str, float]] = []
        
        for result in hybrid_results:
            item_id = result["id"]
            score = result["score"]
            
            is_strict = any(item_id.startswith(p) for p in prefixes) if prefixes else False
            is_family = item_id.startswith(tipo_obra) if tipo_obra else False
            
            if is_strict:
                score += 0.15
            elif is_family:
                score += 0.05
                
            if score >= 0.30:
                candidates_with_scores.append((item_id, score))
                
        candidates_with_scores.sort(key=lambda x: x[1], reverse=True)
        final_ids = [c[0] for c in candidates_with_scores[:limit]]
            
        if not final_ids:
            return [], best_score
            
        items = db.query(CostItem).filter(CostItem.CodPar.in_(final_ids)).all()
        item_map = {i.CodPar: i for i in items}
        sorted_items = [
            {"item": item_map[i], "score": round(score, 3)}
            for i, score in candidates_with_scores[:limit]
            if i in item_map
        ]
        return sorted_items, best_score
    except Exception as exc:
        logger.error("Error en get_dynamic_candidates: %s", exc, exc_info=True)
        return [], 0.0


def fetch_base_apu_for_prompt(db: Session, codpar: str) -> Dict[str, Any]:
    """
    Recupera los datos completos del APU de una partida histórica para
    pasarlos al LLM como base de adaptación.
    """
    if not codpar or not isinstance(codpar, str):
        return {}

    item = db.query(CostItem).filter(CostItem.CodPar == codpar).first()
    if not item:
        return {}

    mat_rows = (
        db.query(CostAPUMaterial, CostMaterial)
        .join(CostMaterial, CostAPUMaterial.CodIns == CostMaterial.CodMat)
        .filter(CostAPUMaterial.CodPar == codpar)
        .all()
    )
    eq_rows = (
        db.query(CostAPUEquipment, CostEquipment)
        .join(CostEquipment, CostAPUEquipment.CodIns == CostEquipment.CodEqu)
        .filter(CostAPUEquipment.CodPar == codpar)
        .all()
    )
    mo_rows = (
        db.query(CostAPULabor, CostLabor)
        .join(CostLabor, CostAPULabor.CodIns == CostLabor.CodMan)
        .filter(CostAPULabor.CodPar == codpar)
        .all()
    )

    return {
        "codpar": item.CodPar,
        "covenin": item.CovPar,
        "descripcion": item.Descri,
        "unidad": item.UniPar,
        "rendimiento": item.RenPar or 1.0,
        "materiales": [
            {
                "codigo": mat.CodMat,
                "descripcion": mat.Descri,
                "unidad": mat.UniMat,
                "cantidad": rel.CanIns,
                "desperdicio": getattr(rel, "Desper", 0.0) or 0.0,
                "precio_unitario": mat.CosMat or 0.0,
            }
            for rel, mat in mat_rows
        ],
        "equipos": [
            {
                "codigo": eq.CodEqu,
                "descripcion": eq.Descri,
                "cantidad": rel.CanIns,
                "depreciacion": getattr(rel, "Deprec", 1.0) or 1.0,
                "precio_diario": eq.CosDia or 0.0,
            }
            for rel, eq in eq_rows
        ],
        "mano_obra": [
            {
                "codigo": mo.CodMan,
                "descripcion": mo.Descri,
                "cantidad": rel.CanIns,
                "jornal": mo.Jornal or 0.0,
                "bono": mo.Bono or 0.0,
            }
            for rel, mo in mo_rows
            if mo.Descri and str(mo.Descri).lower() != "nan" and str(mo.CodMan).lower() != "nan" and not str(mo.CodMan).startswith("DESCRIPCION")
        ],
    }
