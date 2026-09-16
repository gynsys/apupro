import json
import re
from typing import Any, Dict, List, Optional, Tuple, Set
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.core.logging import logger
from app.db.base import get_db_session
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
from app.services.apu_labor_calibrator import calibrate_apu_crew_and_equipment


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
    "notas_adaptacion": ["Nota técnica interna de cómo se adaptó el APU desde la base para registro de depuración"],
    "advertencias": ["[PRECIO_REFERENCIAL] Solo advertencias comerciales sobre precios referenciales o cotizaciones necesarias para el cliente final"]
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
# REGLAS DE CODIFICACIÓN COVENIN (PARTIDAS ADAPTADAS O GENERADAS POR IA)
1. EL CÓDIGO DE LA PARTIDA NUNCA DEBE SER EL CÓDIGO DE LA PARTIDA BASE HISTÓRICA.
   - Una partida generada o adaptada por IA es una partida nueva/especial no tipificada en el tabulador original.
   - ESTÁ TERMINANTEMENTE PROHIBIDO asignar o conservar el código de la partida base (ej: 'XXX028', 'CCS086', etc.) en el campo `cod_par` de la partida adaptada.
2. Toda partida generada o adaptada por IA DEBE llevar obligatoriamente un código de Partida Especial (convención formal SC = Sin Código / No Tipificada):
   - Prefijo de sector y capítulo según la actividad (ej. E511 para instalaciones hidráulicas/bombas, E313 para estructuras de concreto, E411 para albañilería, etc.). Si se proporciona `covenin_prefix`, úsalo como raíz eliminando ceros sobrantes.
   - Seguido de 'SC' (Partida Especial / Sin Código).
   - Seguido de un correlativo de tres dígitos '001'.
   - Ejemplos obligatorios: 'E511SC001', 'E313SC001', 'E411SC001', 'C311SC001'.
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
- `depreciacion`: Factor diario de depreciación o factor horario del equipo.
  * En herramientas manuales y equipos propios (palas, carretillas, picos), conserva su factor de depreciación histórico (ejemplo: 0.01 = 1% diario).
  * Si es un equipo alquilado por día a tarifa neta al 100%, usa 1.0.
- `precio_unitario`: 
  * En materiales: Precio unitario en USD por la unidad de medida (PZA, m, m2, m3, etc.).
  * En equipos: PRECIO DE ADQUISICIÓN / COMPRA en USD del equipo o herramienta (ejemplo: pala $16.50, carretilla $35.00 a $50.00). La fórmula en el editor calcula: Total Día = Cantidad * Depreciación * Precio_Unitario. NUNCA coloques el costo diario ya depreciado en precio_unitario si la depreciación es menor a 1.0 (evita la doble depreciación).
- `jornal` y `bono`: Tarifas diarias de mano de obra en USD por jornada de 8 horas.
"""

_REGLAS_INSUMOS_PRECIOS = """
# REGLAS DE INSUMOS Y PRECIOS
1. Prioriza SIEMPRE insumos del catálogo provisto con sus precios históricos reales (`origen: "historico"`).
2. PRECIOS REFERENCIALES DE MERCADO PARA INSUMOS FALTANTES:
   - Si se requiere un insumo técnicamente indispensable que NO está en el catálogo provisto, agrégalo con `origen: "ia"`.
   - Asígnale un `precio_unitario` referencial estimado según valores de mercado actuales de la construcción en USD (NUNCA dejes precio 0.0).
   - En `advertencias`, agrega obligatoriamente una nota con el prefijo `[PRECIO_REFERENCIAL]` indicando el insumo y que dicho valor es un precio de mercado referencial estimado por la IA que se recomienda cotizar y validar con proveedores locales.
3. MATRIZ OBLIGATORIA DE COMPATIBILIDAD FUNCIONAL EN 7 FAMILIAS (¡CRÍTICO!):
   Para CADA insumo del APU base, evalúa si su aplicación física coincide con la solicitada. Si hay incompatibilidad funcional, QUEDA TERMINANTEMENTE PROHIBIDO conservar el insumo histórico; DEBES sustituirlo por el adecuado con `origen: "ia"`, precio referencial estimado en USD y emitir `[PRECIO_REFERENCIAL]`:
   a) BOMBAS Y EQUIPOS HIDRÁULICOS:
      - Pozo Profundo / Agua Limpia: REQUIERE bomba tipo lapicero/multietapa en acero inoxidable. PROHIBIDO usar bombas de aguas negras, achique o trituradoras tipo Flygt.
      - Aguas Negras / Residuales: REQUIERE bomba de achique para sólidos con impulsor inatascable/vórtex. PROHIBIDO usar bombas de agua limpia o lapicero.
      - Sistema Hidroneumático: REQUIERE bomba centrífuga horizontal o vertical de presión acoplada a pulmón/tanque.
      - CONTROL DE ESCALA Y POTENCIA (¡CRÍTICO!): Si la descripción técnica no pide explícitamente escala industrial (>15 HP), QUEDA TERMINANTEMENTE PROHIBIDO seleccionar o heredar del catálogo bombas industriales pesadas (>15 HP / >$3,000 como bombas sumergibles de 30 HP a $12,000+). Si la potencia exacta no vino fijada, adopta la escala comercial/residencial estándar (2 a 3 HP, costo referencial $600-$1,200), agrégala con origen "ia" y emite advertencia con prefijo `[PRECIO_REFERENCIAL]`.
   b) TUBERÍAS Y CONDUCCIÓN DE FLUIDOS:
      - Agua a Presión: REQUIERE PVC Presión (ASTM D-2241), CPVC o PPR Termofusión. PROHIBIDO usar tubería de desagüe, sanitaria o ventilación (Norma 656, pared delgada).
      - Conducción Sanitaria / Pluvial: Flujo por gravedad en PVC sanitario. PROHIBIDO usar tubería de presión de alto costo.
   c) CABLES Y CONDUCTORES ELÉCTRICOS:
      - Pozo / Inmersión Continua: REQUIERE cable sumergible plano o redondo de goma vulcanizada. PROHIBIDO cable convencional de ducto (THW/THHN) sumergido sin protección.
   d) VÁLVULAS Y ACCESORIOS:
      - Columna de Impulsión / Bombeo: REQUIERE válvula de retención (check) vertical para evitar golpe de ariete. No sustituir por válvula de compuerta común.
   e) CONCRETOS Y MEZCLAS:
      - Vaciado Manual o Puntual (< 4 m³ o espacio confinado): REQUIERE trompo mezclador (1 saco) y herramientas menores. PROHIBIDO camión mixer o bomba pluma si el acceso o escala es manual.
   f) TABLEROS ELÉCTRICOS:
      - Motores y Fuerza: REQUIERE contactor, relé térmico y guardamotor en caja adecuada. PROHIBIDO tablero residencial de alumbrado (NLAB) para motores trifásicos.
      - CONTROL DE ESCALA: No seleccionar tableros industriales o subestaciones mayores a 42 circuitos a menos que se solicite expresamente.
   g) IMPERMEABILIZACIÓN:
      - Manto Asfáltico: El insumo activo impermeabilizante es el manto termosoldado (3 o 4 mm). La pintura asfáltica es solo imprimación previa, nunca el impermeabilizante principal.
4. EXCLUSIONES DE ALCANCE:
   - Si el usuario indica explícitamente que NO incluye un componente (ejemplo: 'no incluye cable submarino', 'sin excavación', 'sin flete', 'sin tablero'), simplemente exclúyelo de la lista de insumos y refléjalo en la descripción técnica: '(NO INCLUYE ...)'.
   - NO agregues advertencias sobre exclusiones de alcance, el analista de costos ya lo conoce.
5. NUNCA MENCIONES LA PARTIDA BASE EN 'ADVERTENCIAS':
   - ESTÁ TERMINANTEMENTE PROHIBIDO escribir en 'advertencias' qué APU o código se usó de base histórica. Las advertencias son EXCLUSIVAS para precios referenciales estimados ([PRECIO_REFERENCIAL]).
"""



COMMON_CONSTRUCTION_TERMS: Set[str] = {
    "construccion", "suministro", "instalacion", "colocacion", "demolicion",
    "excavacion", "transporte", "limpieza", "bomba", "concreto", "tubo",
    "tuberia", "muro", "viga", "acero", "cable", "pared", "piso", "techo",
    "pintura", "friso", "bloque", "madera", "puerta", "ventana", "reparacion",
    "mantenimiento", "vaciado", "armado", "bancarrote", "acometida", "tablero",
    "carga", "bote", "nivelacion", "compactacion", "replanteo", "impermeabilizacion"
}


def is_code_input(text: str) -> bool:
    """
    Determina si la entrada del usuario es un código, nomenclatura o identificador solitario
    (ej: E11102235, CMT050, E111120000, E.111.120.000, E111 S/C, 12345) en vez de una descripción técnica de obra.
    """
    if not text:
        return False
    raw = text.strip()
    tokens = raw.split()
    if not tokens:
        return False

    # 1 solo token (palabra/cadena sin espacios)
    if len(tokens) == 1:
        # Si contiene dígitos, es un código o nomenclatura alfanumérica
        if any(c.isdigit() for c in raw):
            return True
        # Si es un token corto que no es un término constructivo reconocido
        clean_word = re.sub(r'[^A-Za-z]', '', raw).lower()
        if len(raw) <= 8 and clean_word not in COMMON_CONSTRUCTION_TERMS:
            return True
        return False

    # 2 o 3 tokens: e.g. 'E111 S/C', 'E.111 000', 'PARTIDA 123'
    if len(tokens) <= 3:
        clean = re.sub(r'[^A-Za-z0-9]', '', raw)
        has_digits = any(c.isdigit() for c in clean)
        has_terms = any(re.sub(r'[^A-Za-z]', '', t).lower() in COMMON_CONSTRUCTION_TERMS for t in tokens)
        if has_digits and not has_terms and len(raw) <= 20:
            return True

    # Patrón típico COVENIN con o sin puntuación (ej: E11102235, U12345, C-1234)
    clean_no_punct = re.sub(r'[\s\-_./]', '', raw)
    if re.match(r'^[A-Za-z]{1,4}\d{3,12}$', clean_no_punct):
        return True

    return False


def _normalize_equipment_prices(result: Dict[str, Any], base_apu: Optional[Dict[str, Any]] = None) -> None:
    """
    Normaliza y asegura que los precios unitarios y factores de depreciación de los equipos
    no sufran doble depreciación y mantengan coherencia con la fórmula del editor APU:
    Total Día = Cantidad * Depreciación * Precio_Unitario.
    """
    if not result or not isinstance(result, dict) or "equipments" not in result:
        return

    equipments = result.get("equipments")
    if not isinstance(equipments, list):
        return

    # Mapeo de equipos base históricos por código y descripción
    base_eq_map: Dict[str, Dict[str, Any]] = {}
    if base_apu and isinstance(base_apu, dict) and "equipos" in base_apu:
        for eq in base_apu.get("equipos", []):
            if isinstance(eq, dict):
                cod = str(eq.get("codigo", "")).strip().upper()
                if cod:
                    base_eq_map[cod] = eq
                desc = str(eq.get("descripcion", "")).strip().upper()
                if desc:
                    base_eq_map[desc] = eq

    for eq_item in equipments:
        if not isinstance(eq_item, dict):
            continue

        cod = str(eq_item.get("codigo", "")).strip().upper()
        desc = str(eq_item.get("descripcion", "")).strip().upper()

        # 1. Si coincide con un equipo histórico del APU base, anclar precio y depreciación exactos
        base_match = base_eq_map.get(cod) or base_eq_map.get(desc)
        if base_match:
            base_price = float(base_match.get("precio_unitario") or 0.0)
            base_deprec = float(base_match.get("depreciacion") or 1.0)
            if base_price > 0:
                eq_item["precio_unitario"] = round(base_price, 2)
            if base_deprec > 0:
                eq_item["depreciacion"] = base_deprec
            if base_match.get("codigo"):
                eq_item["codigo"] = base_match["codigo"]
            continue

        # 2. Si es un equipo nuevo agregado por IA (ej. carretilla, pala nueva, etc.)
        deprec = float(eq_item.get("depreciacion") or 1.0)
        pu = float(eq_item.get("precio_unitario") or 0.0)

        # Si el LLM puso depreciación menor a 0.05 (ej: 0.01) pero un precio unitario diminuto (< 1.50)
        # significa que colocó el costo diario en lugar del valor de adquisición (provocando doble depreciación)
        if 0 < deprec < 0.05 and 0 < pu < 2.0:
            eq_item["precio_unitario"] = round(pu / deprec, 2)
        elif pu > 0 and deprec <= 0:
            eq_item["depreciacion"] = 1.0


_RECONCILE_STOPWORDS: Set[str] = {
    "DE", "LA", "EL", "EN", "PARA", "CON", "UN", "UNA", "Y", "O", "A", "LOS", "LAS",
    "DEL", "AL", "E", "POR", "SIN", "SOBRE", "TIPO", "USO", "CAPACIDAD", "ESTANDAR",
    "MANUAL", "ALBAÑILERIA", "ALBANILERIA", "USOS", "VARIOS", "GENERAL"
}


def _execute_equipment_reconciliation(result: Dict[str, Any], db: Session) -> None:
    """
    Ejecuta la búsqueda y normalización de equipos contra cost360_equipment.
    """
    equipments = result.get("equipments")
    if not isinstance(equipments, list) or not equipments:
        return

    reconciled_terms: List[str] = []

    for eq in equipments:
        if not isinstance(eq, dict):
            continue

        is_ia = (eq.get("origen") == "ia")
        no_cod = (not eq.get("codigo") or str(eq.get("codigo")).startswith("e-ia-"))
        zero_price = (float(eq.get("precio_unitario") or 0.0) <= 0.0)

        if is_ia or no_cod or zero_price:
            desc = str(eq.get("descripcion", "")).strip()
            clean = re.sub(r'[^A-Z0-9\s]', ' ', desc.upper())
            tokens = [w for w in clean.split() if len(w) >= 3 and w not in _RECONCILE_STOPWORDS]
            if not tokens:
                continue

            row = None
            if len(tokens) >= 2:
                sql2 = text("""
                    SELECT "CodEqu", ref_code, "Descri", "CosDia", precio, deprec_factor
                    FROM cost360_equipment
                    WHERE "Descri" ILIKE :kw1 AND "Descri" ILIKE :kw2
                    ORDER BY 
                        CASE WHEN "Descri" ILIKE :kw_exact THEN 1 ELSE 2 END,
                        length("Descri") ASC
                    LIMIT 1;
                """)
                row = db.execute(sql2, {
                    "kw1": f"%{tokens[0]}%",
                    "kw2": f"%{tokens[1]}%",
                    "kw_exact": f"%{desc[:15]}%"
                }).fetchone()

            if not row:
                sql1 = text("""
                    SELECT "CodEqu", ref_code, "Descri", "CosDia", precio, deprec_factor
                    FROM cost360_equipment
                    WHERE "Descri" ILIKE :kw1
                    ORDER BY length("Descri") ASC
                    LIMIT 1;
                """)
                row = db.execute(sql1, {"kw1": f"%{tokens[0]}%"}).fetchone()

            if row:
                matched_cod = row.CodEqu or row.ref_code
                matched_desc = row.Descri
                matched_price = float(row.precio or 0.0)
                matched_deprec = float(row.deprec_factor or 1.0)
                matched_cosdia = float(row.CosDia or 0.0)

                if matched_price <= 0 and matched_cosdia > 0 and matched_deprec > 0:
                    matched_price = round(matched_cosdia / matched_deprec, 2)

                eq["codigo"] = matched_cod
                eq["descripcion"] = matched_desc
                eq["precio_unitario"] = matched_price
                eq["depreciacion"] = matched_deprec
                eq["origen"] = "historico"
                reconciled_terms.append(tokens[0].lower())
                reconciled_terms.append(matched_desc.lower())

    # Sanitizar advertencias: purgar cualquier [PRECIO_REFERENCIAL] cuyos insumos
    # ya cuenten con precios de catálogo de la base de datos o hayan sido eliminados.
    if "advertencias" in result and isinstance(result["advertencias"], list):
        current_eq_descs = [str(e.get("descripcion", "")).lower() for e in equipments if isinstance(e, dict) and e.get("origen") == "ia"]
        current_mat_descs = [str(m.get("descripcion", "")).lower() for m in result.get("materials", []) if isinstance(m, dict) and m.get("origen") == "ia"]
        active_ia_descs = current_eq_descs + current_mat_descs

        clean_adv: List[str] = []
        for adv in result["advertencias"]:
            adv_str = str(adv)
            if "[precio_referencial]" in adv_str.lower():
                if any(term in adv_str.lower() for term in reconciled_terms):
                    continue
                quoted = re.findall(r"'([^']+)'", adv_str)
                if quoted:
                    insumo_name = quoted[0].lower()
                    if not any(insumo_name in act or act in insumo_name for act in active_ia_descs):
                        continue
                elif not active_ia_descs:
                    continue
            clean_adv.append(adv)
        result["advertencias"] = clean_adv


def reconcile_equipment_with_database(result: Dict[str, Any], db: Optional[Session] = None) -> None:
    """
    Reconcilia los equipos del APU con el catálogo certificado de Costbase (cost360_equipment).
    Si un equipo tiene origen 'ia' o precio referencial estimado, busca en la BD el equipo real para:
    1. Asignar el código oficial de la BD (CodEqu o ref_code).
    2. Asignar la descripción estándar certificada.
    3. Asignar el precio de compra y factor de depreciación oficiales de la BD.
    4. Cambiar 'origen' a 'historico'.
    5. Purgar las advertencias de [PRECIO_REFERENCIAL] asociadas a dicho equipo.
    """
    if not result or not isinstance(result, dict) or "equipments" not in result:
        return

    if db is not None:
        _execute_equipment_reconciliation(result, db)
    else:
        try:
            with get_db_session() as session:
                _execute_equipment_reconciliation(result, session)
        except Exception as exc:
            logger.error("Error al reconciliar equipos con base de datos: %s", exc, exc_info=True)


def generate_apu_with_ai(payload_llm: Dict[str, Any], history: Optional[List[Dict[str, Any]]] = None, db: Optional[Session] = None) -> Dict[str, Any]:
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
        result["options"] = []
        return result

    if payload_llm.get("advertencias_preprocesamiento"):
        result["advertencias"].extend(payload_llm["advertencias_preprocesamiento"])

    _normalize_equipment_prices(result)
    calibrate_apu_crew_and_equipment(result)
    reconcile_equipment_with_database(result, db)

    return result


def generate_apu_with_ai_from_base(
    base_apu: Dict[str, Any],
    complementary_apus: Optional[List[Dict[str, Any]]] = None,
    user_description: str = "",
    covenin_prefix: str = "",
    covenin_context: str = "",
    smart_answers: Optional[Dict[str, str]] = None,
    history: Optional[List[Dict]] = None,
    db: Optional[Session] = None,
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
4. ELIMINA o SUSTITUYE los insumos que no aplican aplicando rigurosamente la MATRIZ OBLIGATORIA DE COMPATIBILIDAD FUNCIONAL EN 7 FAMILIAS (bombas, tuberías, cables, válvulas, concretos, tableros, impermeabilizaciones). Si el equipo o material principal de la base es incompatible, NO uses el insumo histórico. Reemplázalo por el insumo correcto con origen "ia", precio referencial de mercado en USD y emite la advertencia `[PRECIO_REFERENCIAL]`.
5. AJUSTA cantidades cuando la nueva partida lo requiera (ej: distinta área, espesor, proporción).
   Marca los insumos ajustados como `"origen": "ia"` y explica el ajuste en `nota_calculo`.
6. AUTO-FUSIÓN: Si la descripción del usuario exige algo que falta en la Base (ej. Bote de material, Pintura, Andamios, Encofrado) pero que sí existe en las Partidas Complementarias, "róbalo" e intégralo conservando sus precios históricos.
7. AGREGA insumos nuevos que la nueva partida requiera estrictamente y no estén ni en la base ni en las complementarias. Márcalos como `"origen": "ia"`, asígnales un precio unitario referencial estimado de mercado en USD (nunca 0.0) y agrega una advertencia con el prefijo `[PRECIO_REFERENCIAL]`.
8. NUNCA alteres los precios unitarios de los insumos del APU base ni de las complementarias. Son precios reales de la BD.
9. Registra SIEMPRE en `notas_adaptacion` (para el log técnico de depuración) que el APU fue adaptado desde la partida base [{base_apu.get('codpar', 'N/A')}], qué insumos se podaron y la justificación del rendimiento.
10. El campo `advertencias` es EXCLUSIVAMENTE para alertas de precios referenciales de mercado estimados por IA con el prefijo `[PRECIO_REFERENCIAL]` (cuando un insumo indispensable no existe en el catálogo histórico o cuando se sustituyó un equipo o material incompatible de la base).
    - NUNCA agregues advertencias sobre exclusiones de alcance (`[ALCANCE]`); el analista de costos ya conoce el alcance solicitado.
    - NUNCA menciones qué partida o código se utilizó como base histórica en `advertencias`.
    - Las notas de adaptación interna van EXCLUSIVAMENTE en `notas_adaptacion`, jamás en `advertencias`.


# CRITERIO DE CLARIFICACIÓN VS GENERACIÓN (OBLIGATORIO EVALUAR ANTES DE GENERAR)

GENERA el APU (status: "completed") SOLO SI la descripción cumple LOS TRES CRITERIOS:
  C1. Contiene al menos UNA acción constructiva, aunque sea implícita o en jerga (demoler, instalar, construir, vaciar, revestir, frizar, tumbar, echar, etc.)
  C2. Contiene al menos UN elemento constructivo específico sobre el que se actúa (pared, tubería, losa, piso, zanja, columna, etc.)
  C3. La combinación C1+C2 es físicamente ejecutable y no contradictoria.

IMPORTANTE — Tolerancia al orden y al lenguaje informal:
  - El orden de las palabras NO importa. "terreno excavacion a mano" es equivalente a "excavacion a mano en terreno".
  - La jerga venezolana de obra ES válida: "tumbar" = demoler, "frizar" = aplicar friso, "echar concreto" = vaciar concreto.
  - Una descripción fragmentada o telegráfica (ej: "pared bloque 15 mortero 1:4") puede ser suficiente si C1 y C2 se infieren.

SOLICITA CLARIFICACIÓN (status: "clarification_needed") SI Y SOLO SI:
  - Falta C1: no hay ninguna acción constructiva identificable ni implícita.
  - Falta C2: hay acción pero sin elemento constructivo (ej: solo "demolicion", "instalacion", "pintura").
  - C3 falla: la combinación es un absurdo físico o una contradicción insalvable.
  - La descripción es irrelevante para el dominio construcción (comida, geografía, entretenimiento, etc.).

CUANDO solicites clarificación, responde con "options": []. ESTÁ TERMINANTEMENTE PROHIBIDO inventar o adivinar opciones o partidas alternativas no solicitadas. Limítate a explicar qué información técnica falta en questions y clarification_message.

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
    if "notas_adaptacion" not in result:
        result["notas_adaptacion"] = []

    if result.get("status") == "clarification_needed":
        result["options"] = []

    _normalize_equipment_prices(result, base_apu)
    calibrate_apu_crew_and_equipment(result, base_apu)
    reconcile_equipment_with_database(result, db)

    result["debug_base_apu"] = base_apu
    result["prompt_enviado_al_llm"] = prompt

    return result


INCOMPATIBLE_POLARITY_RULES: List[Tuple[Set[str], Set[str], float]] = [
    # 1. Agua Limpia / Pozo Profundo VS Aguas Negras / Residuales / Achique / Cloacas
    (
        {"pozo", "pozo profundo", "agua limpia", "agua potable", "lapicero", "hidroneumatico"},
        {"aguas negras", "aguas residuales", "aguas servidas", "achique", "cloaca", "drenaje pluvial", "aguas de lluvia"},
        0.25
    ),
    # 2. Tuberías a Presión / Agua Blanca VS Tuberías Sanitarias / Desagüe / Ventilación
    (
        {"presion", "aduccion", "distribucion", "astm d-2241", "ppr", "termofusion", "agua blanca"},
        {"ventilacion", "sanitaria", "desague", "bajante", "norma 656", "aguas servidas"},
        0.25
    ),
    # 3. Trabajo Manual / Espacio Confinado / Reparación Puntual VS Maquinaria Pesada
    (
        {"a mano", "manual", "con carretilla", "espacio confinado", "en sotano", "reparacion puntual"},
        {"retroexcavadora", "payloader", "tractor", "jumbo", "camion roquero", "planta de concreto", "camion mixer"},
        0.30
    ),
    # 4. Cable Sumergible de Pozo VS Cable Eléctrico Convencional en Ducto
    (
        {"cable submarino", "cable sumergible", "pozo profundo"},
        {"conduit", "embutido en tuberia", "en bandeja"},
        0.20
    ),
    # 5. Fuerza / Motores Trifásicos VS Alumbrado / Tomacorrientes Monofásicos
    (
        {"fuerza", "motor", "ccm", "arrancador", "bomba trifasica"},
        {"alumbrado", "iluminacion", "tomacorriente", "tablero nlab"},
        0.20
    )
]


def _apply_polarity_penalties(query_text: str, item_desc: str, current_score: float) -> float:
    """
    Aplica penalizaciones cruzadas si la consulta del usuario y la descripción del ítem
    pertenecen a polos técnicos opuestos e incompatibles.
    """
    if not query_text or not item_desc:
        return current_score

    q_lower = query_text.lower()
    i_lower = item_desc.lower()

    for polo_a, polo_b, penalty in INCOMPATIBLE_POLARITY_RULES:
        q_has_a = any(t in q_lower for t in polo_a)
        q_has_b = any(t in q_lower for t in polo_b)
        i_has_a = any(t in i_lower for t in polo_a)
        i_has_b = any(t in i_lower for t in polo_b)

        if q_has_a and not q_has_b and i_has_b and not i_has_a:
            current_score = max(0.0, current_score - penalty)
        elif q_has_b and not q_has_a and i_has_a and not i_has_b:
            current_score = max(0.0, current_score - penalty)

    return current_score


def get_dynamic_candidates(
    db: Session,
    description: str,
    covenin_prefix: str = "",
    limit: int = 15,
) -> Tuple[List[Dict[str, Any]], float]:
    """
    Recupera las partidas más similares desde el Cerebro RAG Híbrido,
    considerando el material técnico y filtrando opcionalmente por prefijo.
    Aplica penalizaciones cruzadas a candidatos con incompatibilidad funcional polar.
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
        
        # Aplicar penalización de polaridad técnica (Polos Opuestos)
        scored_candidates = []
        for i, score in candidates_with_scores[:limit]:
            if i in item_map:
                it = item_map[i]
                adjusted_score = _apply_polarity_penalties(description, it.Descri or "", score)
                scored_candidates.append({"item": it, "score": round(adjusted_score, 3)})

        # Re-ordenar por el score ajustado para priorizar candidatos afines
        scored_candidates.sort(key=lambda x: x["score"], reverse=True)
        best_adjusted = scored_candidates[0]["score"] if scored_candidates else best_score
        return scored_candidates, best_adjusted
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
                "codigo": mat.ref_code or mat.CodMat,
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
                "codigo": eq.ref_code or eq.CodEqu,
                "descripcion": eq.Descri,
                "cantidad": rel.CanIns,
                "depreciacion": getattr(rel, "Deprec", 1.0) or 1.0,
                "precio_unitario": round(
                    eq.precio if (getattr(eq, "precio", None) is not None and eq.precio > 0)
                    else ((eq.CosDia or 0.0) / (getattr(rel, "Deprec", 1.0) or 1.0) if (getattr(rel, "Deprec", 1.0) or 1.0) > 0 else (eq.CosDia or 0.0)),
                    2
                ),
            }
            for rel, eq in eq_rows
        ],
        "mano_obra": [
            {
                "codigo": mo.ref_code or mo.CodMan,
                "descripcion": mo.Descri,
                "cantidad": rel.CanIns,
                "jornal": mo.Jornal or 0.0,
                "bono": mo.Bono or 0.0,
            }
            for rel, mo in mo_rows
            if mo.Descri and str(mo.Descri).lower() != "nan" and str(mo.CodMan).lower() != "nan" and not str(mo.CodMan).startswith("DESCRIPCION")
        ],
    }


SECONDARY_ACTIVITY_PATTERNS: Dict[str, Dict[str, Any]] = {
    "bote_transporte": {
        "pattern": r"\b(bote|transporte|acarreo|botadero|escombros?)\b",
        "search_keywords": "transporte bote escombros camión volteo",
    },
    "friso_revoque": {
        "pattern": r"\b(friso|frisad[oa]|revoque|pañete|enlucido)\b",
        "search_keywords": "friso mortero acabado paredes",
    },
    "pintura": {
        "pattern": r"\b(pintura|pintad[oa]|esmalte)\b",
        "search_keywords": "pintura caucho esmalte paredes",
    },
    "acero_malla": {
        "pattern": r"\b(malla|electrosoldada|truckson|cabillas?|acero de refuerzo)\b",
        "search_keywords": "malla electrosoldada acero refuerzo",
    },
    "machones_dinteles": {
        "pattern": r"\b(machon(es)?|dintel(es)?|viga(s)? de corona)\b",
        "search_keywords": "machones dinteles concreto arriostramiento",
    },
    "encofrado": {
        "pattern": r"\b(encofrado|formaleta|apuntalamiento)\b",
        "search_keywords": "encofrado madera metalico",
    },
    "impermeabilizacion": {
        "pattern": r"\b(impermeabilizad[oa]|manto asfaltico|impermeabilizante)\b",
        "search_keywords": "impermeabilizacion manto asfaltico",
    },
    "demolicion": {
        "pattern": r"\b(demolicion|demolid[oa]|pica|tumbar)\b",
        "search_keywords": "demolicion pica",
    },
    "excavacion": {
        "pattern": r"\b(excavacion|excavad[oa]|zanja)\b",
        "search_keywords": "excavacion zanja",
    },
}


def select_relevant_complementary_apus(
    db: Session,
    user_description: str,
    base_apu: Dict[str, Any],
    candidates: List[Dict[str, Any]],
    max_complementary: int = 2,
) -> List[Dict[str, Any]]:
    """
    Selecciona de forma inteligente partidas complementarias solo si son estrictamente necesarias.

    1. Si la solicitud del usuario es una actividad simple y pura (sin actividades accesorias compuestas),
       y la partida base ya cubre la necesidad principal, retorna [] (CERO complementarias).
    2. Si el usuario pide actividades adicionales ('con bote', 'frisada', 'con pintura', 'con malla')
       que NO están presentes en la descripción de la partida base:
       - Identifica qué actividad accesoria falta.
       - Busca entre los candidatos (o en la BD) una partida específica que cubra esa actividad faltante.
       - Garantiza que las complementarias sean de familias/capítulos COVENIN distintos (diversidad).
    """
    if not user_description or not isinstance(user_description, str) or not base_apu:
        return []

    base_desc = str(base_apu.get("descripcion") or "").upper()
    base_cod = str(base_apu.get("codpar") or "").upper()
    base_cov_prefix = str(base_apu.get("covenin") or "")[:4].upper()
    user_upper = user_description.upper()

    # Detectar qué actividades secundarias exige el usuario
    unmet_activities: List[str] = []
    for act_name, config in SECONDARY_ACTIVITY_PATTERNS.items():
        if re.search(config["pattern"], user_upper, re.IGNORECASE):
            # Si el usuario lo pidió, verificar si la partida base ya lo incluye
            if not re.search(config["pattern"], base_desc, re.IGNORECASE):
                unmet_activities.append(act_name)

    # REGLA DE ORO: Si no hay actividades accesorias faltantes, CERO complementarias
    if not unmet_activities:
        return []

    # Si hay actividades faltantes, buscar la mejor candidata para cada una
    selected_apus: List[Dict[str, Any]] = []
    used_cov_prefixes: Set[str] = {base_cov_prefix} if base_cov_prefix else set()
    used_cods: Set[str] = {base_cod}

    for act_name in unmet_activities[:max_complementary]:
        act_config = SECONDARY_ACTIVITY_PATTERNS[act_name]
        act_pattern = act_config["pattern"]

        matched_item = None
        # Buscar primero entre los candidatos recuperados por el RAG
        for c in candidates:
            item = c.get("item")
            if not item:
                continue
            item_cod = str(item.CodPar).upper()
            item_desc = str(item.Descri).upper()
            item_cov = str(item.CovPar or "")[:4].upper()

            if item_cod in used_cods:
                continue
            if item_cov and item_cov in used_cov_prefixes:
                continue

            if re.search(act_pattern, item_desc, re.IGNORECASE):
                matched_item = item
                break

        # Si no está en candidatos inmediatos, buscar directamente en BD una partida representativa
        if not matched_item:
            try:
                kw = act_config["search_keywords"].split()[0]
                kw2 = act_config["search_keywords"].split()[1] if len(act_config["search_keywords"].split()) > 1 else kw
                sql = text(
                    'SELECT "CodPar" FROM cost360_items '
                    'WHERE "Descri" ILIKE :kw1 AND "Descri" ILIKE :kw2 '
                    'AND "CodPar" != :base_cod '
                    'ORDER BY length("Descri") ASC LIMIT 1'
                )
                row = db.execute(sql, {"kw1": f"%{kw}%", "kw2": f"%{kw2}%", "base_cod": base_cod}).fetchone()
                if row:
                    matched_item = db.query(CostItem).filter(CostItem.CodPar == row.CodPar).first()
            except Exception as e_search:
                logger.error(f"Error buscando partida complementaria para {act_name}: {e_search}", exc_info=True)

        if matched_item:
            matched_cod = str(matched_item.CodPar).upper()
            matched_cov = str(matched_item.CovPar or "")[:4].upper()
            comp_apu = fetch_base_apu_for_prompt(db, matched_item.CodPar)
            if comp_apu:
                selected_apus.append(comp_apu)
                used_cods.add(matched_cod)
                if matched_cov:
                    used_cov_prefixes.add(matched_cov)

    return selected_apus
