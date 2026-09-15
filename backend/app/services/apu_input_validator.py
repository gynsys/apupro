"""
Servicio de Validación de Entrada del Pipeline APU — Capa 1.

Propósito:
    Interceptar entradas inválidas, abusivas o insuficientes ANTES de
    ejecutar el RAG o consumir tokens del LLM principal.

    Este módulo es completamente autónomo: no necesita red, base de datos
    ni LLM. Su costo de ejecución es cero tokens y < 1ms.

Veredictos posibles:
    - None          → La entrada pasa. Continuar con el pipeline.
    - "reject"      → Rechazar inmediatamente. Entrada abusiva, vacía o ilegible.
    - "clarification_needed" → La entrada es legible pero insuficiente para
                               generar un APU preciso. Pedir más información.

Integración:
    Llamar a `validate_apu_input(description)` al inicio del endpoint,
    justo después de obtener `raw_desc`. Si retorna algo distinto de None,
    devolver la respuesta al frontend sin seguir el pipeline.
"""

import math
import re
import unicodedata
from collections import Counter
from typing import Any, Dict, List, Optional, Set, Tuple

from app.core.logging import logger

# ---------------------------------------------------------------------------
# Constantes de configuración — Capa 1
# ---------------------------------------------------------------------------
_MIN_CHARS: int = 10
_MAX_CHARS: int = 500
_MIN_ENTROPY: float = 2.5
_MIN_VOWEL_RATIO: float = 0.20
_MAX_VOWEL_RATIO: float = 0.75
_MIN_LATIN_RATIO: float = 0.60
_REPETITION_UNIQUE_RATIO: float = 0.25

# ---------------------------------------------------------------------------
# Constantes de configuración — Capa 2 (RAG Signals con Gemini / Híbrido)
# ---------------------------------------------------------------------------
_RAG_MIN_OFF_TOPIC_SCORE: float = 0.32

_STOPWORDS: Set[str] = {
    "de", "en", "para", "con", "el", "la", "los", "las", "un", "una",
    "del", "al", "por", "y", "a", "sin", "no", "se", "su", "sus", "lo", "que", "es", "son", "o",
}

_CONSTRUCTION_ACTIONS: Set[str] = {
    "demolicion", "demoler", "tumbar", "derribar", "picar", "desmantelar",
    "construccion", "construir", "levantar", "fabricacion", "fabricar", "hechura",
    "instalacion", "instalar", "colocacion", "colocar", "montaje", "montar", "desmontaje", "desmontar",
    "suministro", "suministrar", "proveer", "dotacion",
    "excavacion", "excavar", "vaciado", "vaciar", "echar", "armado", "armar", "encofrado", "encofrar",
    "reparacion", "reparar", "mantenimiento", "adecuacion", "rehabilitacion",
    "impermeabilizacion", "impermeabilizar", "impermeabilizado",
    "pintura", "pintar", "friso", "frisar", "revoque", "revocar", "encamisado", "encamisar", "empaste", "empastar",
    "acarreo", "acarrear", "bote", "botar", "transporte", "transportar", "traslado", "trasladar",
    "limpieza", "limpiar", "nivelacion", "nivelar", "compactacion", "compactar", "replanteo", "replantear",
}

_CONSTRUCTION_PHYSICAL_ELEMENTS: Set[str] = {
    "pared", "paredes", "muro", "muros", "tabique", "tabiques", "bloque", "bloques", "ladrillo", "ladrillos",
    "piso", "pisos", "pavimento", "pavimentos", "acera", "aceras", "brocal", "brocales",
    "techo", "techos", "cubierta", "cubiertas", "cielo", "cielorraso", "machimbrado",
    "losa", "losas", "viga", "vigas", "columna", "columnas", "zapata", "zapatas", "fundacion", "fundaciones",
    "machon", "machones", "dintel", "dinteles", "pedestal", "pedestales",
    "concreto", "hormigon", "cemento", "mortero", "adobe", "arena", "piedra", "ripio",
    "tuberia", "tuberias", "tubo", "tubos", "punto", "puntos",
    "aguas", "blancas", "servidas", "negras", "lluvia", "pluvial", "sanitaria", "sanitarias",
    "bomba", "bombas", "valvula", "valvulas", "tanque", "tanques", "fregadero", "lavamanos", "inodoro", "ducha", "batea",
    "cable", "cables", "conductor", "conductores", "tablero", "tableros", "tomacorriente", "tomacorrientes", "interruptor", "interruptores",
    "luminaria", "luminarias", "lampara", "lamparas", "acometida", "transformador", "caja", "canalizacion",
    "puerta", "puertas", "ventana", "ventanas", "vidrio", "vidrios", "reja", "rejas", "porton", "portones",
    "drywall", "yeso", "teja", "tejas", "manto", "ceramica", "porcelanato", "granito", "caico",
    "zanja", "zanjas", "terreno", "tierra", "roca", "talud", "escombro", "escombros", "asfalto",
    "acero", "cabilla", "cabillas", "malla", "perfil", "correa",
    "baño", "cocina", "sala", "fachada", "cuarto",
}

# Patrones de inyección SQL compilados una sola vez al cargar el módulo
_SQL_PATTERNS: List[re.Pattern] = [
    re.compile(p, re.IGNORECASE) for p in [
        r"\bSELECT\b", r"\bINSERT\b", r"\bUPDATE\b", r"\bDELETE\b",
        r"\bDROP\b", r"\bUNION\b", r"\bEXEC\b", r"\b1\s*=\s*1\b",
        r"\bTRUNCATE\b", r"\bALTER\b",
    ]
]

# Patrones HTML/JS/template injection
_HTML_PATTERNS: List[re.Pattern] = [
    re.compile(p, re.IGNORECASE) for p in [
        r"<script",
        r"</script>",
        r"<[a-z][a-z0-9]*\b[^>]*>",
        r"\$\{\{",
        r"\}\}",
    ]
]

# Patrones de prompt injection
_PROMPT_INJECTION_PATTERNS: List[re.Pattern] = [
    re.compile(p, re.IGNORECASE) for p in [
        r"ignora\s+(todas\s+)?(tus\s+)?instrucciones",
        r"nuevo\s+rol",
        r"eres\s+un\s+asistente\s+sin\s+restricciones",
        r"</?(system|user|assistant)>",
        r"prompt\s+del\s+sistema",
        r"forget\s+(all\s+)?previous\s+instructions",
        r"jailbreak",
        r"dan\s+mode",
    ]
]


# ---------------------------------------------------------------------------
# Helpers internos
# ---------------------------------------------------------------------------

def _shannon_entropy(text: str) -> float:
    """Entropía de Shannon sobre los caracteres del texto (mide variedad léxica)."""
    if not text:
        return 0.0
    freq = Counter(text.lower())
    total = len(text)
    return -sum((c / total) * math.log2(c / total) for c in freq.values())


def _latin_char_ratio(text: str) -> float:
    """
    Ratio de caracteres del bloque Unicode 'Latin' sobre el total de
    caracteres no-espacio. Incluye vocales acentuadas del español.
    """
    no_space = re.sub(r"\s", "", text)
    if not no_space:
        return 0.0

    latin_count = 0
    for ch in no_space:
        name = unicodedata.name(ch, "")
        cat = unicodedata.category(ch)
        if cat in ("Ll", "Lu", "Lt", "Lm") and "LATIN" in name:
            latin_count += 1
        elif ch in "áéíóúüñÁÉÍÓÚÜÑ":
            latin_count += 1
        elif ch.isdigit() or ch in ".,;:-()[]{}'\"/":
            # Números y puntuación común no penalizan
            latin_count += 1

    return latin_count / len(no_space)


def _vowel_ratio(text: str) -> float:
    """Ratio de vocales sobre total de letras (sin espacios)."""
    no_space = re.sub(r"\s", "", text.lower())
    if not no_space:
        return 0.0
    vowels = sum(1 for c in no_space if c in "aeiouáéíóúü")
    letters = sum(1 for c in no_space if c.isalpha())
    return vowels / max(letters, 1)


def _is_repetitive(text: str) -> bool:
    """
    True si el texto es altamente repetitivo: menos del 25% de las
    palabras son únicas. Detecta spam como 'demolicion ' * 50.
    """
    words = text.lower().split()
    if len(words) < 5:
        return False
    unique_ratio = len(set(words)) / len(words)
    return unique_ratio < _REPETITION_UNIQUE_RATIO


def _is_json_payload(text: str) -> bool:
    """Detecta si el usuario envía JSON crudo en lugar de texto natural."""
    stripped = text.strip()
    return (stripped.startswith("{") and stripped.endswith("}")) or \
           (stripped.startswith("[") and stripped.endswith("]"))


def _has_pattern(text: str, patterns: List[re.Pattern]) -> bool:
    return any(p.search(text) for p in patterns)


# ---------------------------------------------------------------------------
# Función pública principal
# ---------------------------------------------------------------------------

def validate_apu_input(description: str) -> Optional[Tuple[str, str, str]]:
    """
    Valida la descripción del usuario antes de ejecutar el pipeline APU.

    Ejecuta todas las verificaciones de la Capa 1 en orden de menor a mayor
    costo computacional, retornando en el primer fallo encontrado.

    Args:
        description: Texto ingresado por el usuario tal cual llegó al endpoint.

    Returns:
        None si la entrada es válida y debe continuar el pipeline.

        Tuple (veredicto, mensaje_usuario, codigo_interno) si debe detenerse:
            - veredicto: "reject" o "clarification_needed"
            - mensaje_usuario: Texto legible para mostrar al usuario.
            - codigo_interno: Código de log para diagnóstico interno.
    """
    # Normalizar whitespace antes de evaluar
    text = re.sub(r"\s+", " ", (description or "").strip())

    # ── CHECK 1: Vacío o solo espacios ────────────────────────────────
    if not text:
        return (
            "reject",
            "La descripción no puede estar vacía.",
            "EMPTY_INPUT",
        )

    # ── CHECK 2: Longitud máxima (anti-abuso / truncamiento de tokens) ─
    if len(text) > _MAX_CHARS:
        return (
            "clarification_needed",
            (
                f"La descripción ingresada es demasiado extensa ({len(text)} caracteres). "
                f"Por favor resúmela en máximo {_MAX_CHARS} caracteres con la información técnica esencial."
            ),
            "TOO_LONG",
        )

    # ── CHECK 3: Solo números o símbolos sin palabras ─────────────────
    if re.fullmatch(r"[\d\s\W]+", text):
        return (
            "reject",
            "La descripción debe contener palabras técnicas, no solo números o símbolos.",
            "NO_WORDS",
        )

    # ── CHECK 4: Inyección SQL ────────────────────────────────────────
    if _has_pattern(text, _SQL_PATTERNS):
        logger.warning("SQL injection attempt detected in APU input: %.80s", text)
        return (
            "reject",
            "La descripción contiene caracteres o patrones no válidos para una partida de obra.",
            "SQL_INJECTION",
        )

    # ── CHECK 5: Inyección HTML / JS / Template ───────────────────────
    if _has_pattern(text, _HTML_PATTERNS):
        logger.warning("HTML/template injection attempt in APU input: %.80s", text)
        return (
            "reject",
            "La descripción contiene etiquetas o patrones no válidos para una partida de obra.",
            "HTML_INJECTION",
        )

    # ── CHECK 6: Prompt injection ─────────────────────────────────────
    if _has_pattern(text, _PROMPT_INJECTION_PATTERNS):
        logger.warning("Prompt injection attempt in APU input: %.80s", text)
        return (
            "reject",
            "La descripción contiene instrucciones no válidas para el sistema.",
            "PROMPT_INJECTION",
        )

    # ── CHECK 7: JSON payload directo ─────────────────────────────────
    if _is_json_payload(text):
        logger.warning("JSON payload submitted as APU description: %.80s", text)
        return (
            "reject",
            "Por favor ingresa una descripción técnica en texto, no un objeto JSON.",
            "JSON_PAYLOAD",
        )

    # ── CHECK 8: Longitud mínima ──────────────────────────────────────
    if len(text) < _MIN_CHARS:
        return (
            "clarification_needed",
            (
                "La descripción es demasiado breve para generar un APU preciso. "
                "Por favor describe la actividad con al menos el elemento constructivo y la acción a ejecutar. "
                "Ejemplo: 'Demolición de pared de bloques de arcilla, incluye acarreo de escombros'."
            ),
            "TOO_SHORT",
        )

    # ── CHECK 9: Ratio de caracteres latinos ──────────────────────────
    # Detecta textos en otros alfabetos (cirílico, árabe, chino, etc.)
    latin_ratio = _latin_char_ratio(text)
    if latin_ratio < _MIN_LATIN_RATIO:
        logger.info("Non-latin input rejected (ratio=%.2f): %.80s", latin_ratio, text)
        return (
            "reject",
            "La descripción debe estar escrita en español con caracteres del alfabeto latino.",
            "NON_LATIN_ALPHABET",
        )

    # ── CHECK 10: Entropía de Shannon ─────────────────────────────────
    # Baja entropía = texto muy repetitivo o sin variedad de caracteres (gibberish)
    entropy = _shannon_entropy(text)
    if entropy < _MIN_ENTROPY:
        return (
            "reject",
            (
                "La descripción parece no contener información técnica válida. "
                "Por favor escribe una descripción de la actividad constructiva."
            ),
            "LOW_ENTROPY",
        )

    # ── CHECK 11: Ratio de vocales ────────────────────────────────────
    # El español tiene entre 20% y 75% de vocales. Fuera de ese rango = gibberish
    v_ratio = _vowel_ratio(text)
    if v_ratio < _MIN_VOWEL_RATIO or v_ratio > _MAX_VOWEL_RATIO:
        return (
            "reject",
            (
                "La descripción parece no contener texto en español válido. "
                "Por favor describe la actividad constructiva con palabras técnicas."
            ),
            "ABNORMAL_VOWEL_RATIO",
        )

    # ── CHECK 12: Texto altamente repetitivo ──────────────────────────
    if _is_repetitive(text):
        return (
            "clarification_needed",
            (
                "La descripción repite la misma palabra o frase varias veces. "
                "Por favor escribe una descripción técnica completa indicando "
                "qué se va a hacer, sobre qué elemento y con qué especificaciones."
            ),
            "REPETITIVE_TEXT",
        )

    # Pasó todos los controles
    return None


# ===========================================================================
# CAPA 2: Validación de Ambigüedad y Dominio vía RAG Híbrido (Gemini Embeddings)
# ===========================================================================

def _extract_distinct_options(candidates: List[Dict[str, Any]], max_options: int = 4) -> List[str]:
    """
    Extrae descripciones técnicas limpias y diversas de los candidatos del RAG
    para ofrecerlas como opciones en el asistente interactivo.
    """
    options: List[str] = []
    seen: Set[str] = set()

    for c in candidates[:15]:
        item = c.get("item")
        if item is not None and hasattr(item, "Descri"):
            raw_desc = getattr(item, "Descri", "")
        elif isinstance(c, dict):
            raw_desc = c.get("descripcion") or c.get("desc") or c.get("description") or ""
        else:
            raw_desc = ""

        if not raw_desc:
            continue

        # Cortar en el primer punto si es muy larga
        parts = raw_desc.split(".")
        clean = parts[0].strip()
        if len(clean) > 90:
            clean = clean[:90].rsplit(" ", 1)[0].strip()

        clean_formatted = clean.capitalize()
        norm_key = re.sub(r"[^\w]", "", clean_formatted.lower())[:30]

        if norm_key not in seen and len(clean_formatted) >= 12:
            seen.add(norm_key)
            options.append(clean_formatted)
            if len(options) >= max_options:
                break

    return options


def validate_rag_signals(
    query: str,
    candidates: List[Dict[str, Any]],
) -> Optional[Tuple[str, str, str, List[str]]]:
    """
    Capa 2: Validación de Ambigüedad y Dominio vía RAG Híbrido (Gemini Embeddings + Léxico).

    Analiza las señales estadísticas y semánticas de los candidatos recuperados por el RAG
    para detectar:
      1. Consultas fuera del dominio de construcción (off-topic, score < 0.32).
      2. Consultas que solo contienen una acción constructiva sin elemento ("demolicion", "instalacion").
      3. Consultas que solo contienen un elemento constructivo sin acción ("tuberia").

    Returns:
        None si la consulta es técnicamente suficiente para proceder a la generación.
        Tuple (veredicto, mensaje, codigo_interno, opciones) si debe detenerse:
            - veredicto: "reject" o "clarification_needed"
            - mensaje: Explicación para el usuario.
            - codigo_interno: Código para auditoría ("RAG_OFF_TOPIC", "RAG_AMBIGUOUS_ACTION_ONLY", etc.)
            - opciones: Lista de hasta 4 descripciones extraídas de los mejores candidatos RAG.
    """
    # ── CHECK 1: Off-Topic / Fuera de Dominio ─────────────────────────
    if not candidates:
        return (
            "reject",
            "No se identificó ninguna actividad o partida constructiva afín a la solicitud ingresada. "
            "Este sistema está diseñado exclusivamente para presupuestos y análisis de precios unitarios (APU) de obras civiles.",
            "RAG_NO_CANDIDATES",
            [],
        )

    top_score = candidates[0].get("score", 0.0)
    if top_score < _RAG_MIN_OFF_TOPIC_SCORE:
        logger.info("Query rejected by Capa 2 RAG score (score=%.3f < %.2f): %.80s", top_score, _RAG_MIN_OFF_TOPIC_SCORE, query)
        return (
            "reject",
            "La solicitud ingresada no corresponde a una actividad de construcción u obras civiles reconocible en el catálogo. "
            "Por favor describe una partida de obra (ej: excavación, vaciado de concreto, albañilería, tuberías, instalaciones).",
            "RAG_OFF_TOPIC",
            [],
        )

    # ── CHECK 2: Ambigüedad Léxica y Falta de Elemento Constructivo ───
    clean_query = re.sub(r"[^\w\s]", " ", query.lower())
    tokens = [t for t in clean_query.split() if t not in _STOPWORDS and len(t) > 2]

    has_action = any(t in _CONSTRUCTION_ACTIONS for t in tokens)
    has_element = any(t in _CONSTRUCTION_PHYSICAL_ELEMENTS for t in tokens)

    # Si la consulta tiene 3 palabras clave o menos:
    if len(tokens) <= 3:
        # Caso 2.1: Acción sola sin elemento ("demolicion", "instalacion", "reparacion", "pintura")
        if has_action and not has_element:
            options = _extract_distinct_options(candidates)
            logger.info("Query stopped by Capa 2 RAG (action without element): %.80s", query)
            return (
                "clarification_needed",
                (
                    f"La descripción ingresada ('{query}') indica una acción técnica pero no especifica "
                    "sobre qué elemento constructivo se ejecutará (ej: pared, piso, losa, tubería). "
                    "Por favor selecciona una de las siguientes opciones o añade el elemento a tu descripción:"
                ),
                "RAG_AMBIGUOUS_ACTION_ONLY",
                options,
            )

        # Caso 2.2: Elemento solo sin acción técnica ("tuberia", "losa de techo", "pared de bloques")
        if has_element and not has_action and len(tokens) <= 2:
            options = _extract_distinct_options(candidates)
            logger.info("Query stopped by Capa 2 RAG (element without action): %.80s", query)
            return (
                "clarification_needed",
                (
                    f"La descripción ingresada ('{query}') menciona un elemento constructivo pero no indica "
                    "la actividad a ejecutar (ej: suministro e instalación, demolición, construcción, reparación). "
                    "Por favor selecciona una de las siguientes opciones o añade la acción técnica:"
                ),
                "RAG_AMBIGUOUS_ELEMENT_ONLY",
                options,
            )

    # Pasó todas las verificaciones de la Capa 2
    return None


# ---------------------------------------------------------------------------
# Helper para construir la respuesta HTTP desde el veredicto
# ---------------------------------------------------------------------------

def build_rejection_response(
    veredicto: str,
    mensaje: str,
    codigo: str,
    rag_candidates: Optional[list] = None,
) -> dict:
    """
    Construye la respuesta JSON estándar del pipeline cuando la Capa 1 o Capa 2
    rechaza o solicita clarificación.

    Args:
        veredicto: "reject" o "clarification_needed".
        mensaje: Texto para mostrar al usuario.
        codigo: Código interno para logs (no se expone al usuario).
        rag_candidates: Lista opcional de candidatas del RAG (dicts o strings)
                        para ofrecer opciones concretas en el mensaje de clarificación.

    Returns:
        Dict con la estructura de respuesta estándar del pipeline APU.
    """
    options: List[str] = []
    if rag_candidates and veredicto == "clarification_needed":
        # Ofrecer las top candidatas del RAG como opciones concretas
        for candidate in rag_candidates[:4]:
            if isinstance(candidate, str):
                options.append(candidate)
            elif isinstance(candidate, dict):
                desc = candidate.get("descripcion") or candidate.get("desc") or candidate.get("description", "")
                if desc:
                    options.append(desc.capitalize())

    questions = [
        "1. Accion principal: Que actividad deseas presupuestar (demolicion, construccion, instalacion)?",
        "2. Elemento constructivo: Sobre que elemento se actua (pared, tuberia, losa, piso)?",
        "3. Material o especificacion: Que material o resistencia tiene (bloque, PVC 1/2\", concreto 210 kg/cm2)?",
        "4. Metodo y alcance: Se realiza a mano o con maquinaria? Incluye acarreo, bote o transporte?",
    ]

    if veredicto == "reject":
        return {
            "status": "clarification_needed",
            "clarification_message": mensaje,
            "options": [],
            "questions": questions,
            "guia_redaccion": (
                "Estructura recomendada: [Accion] + [Elemento] + [Material/Especificacion] + [Metodo]. "
                "Ejemplo: 'Demolicion de ceramica en paredes interiores, incluye acarreo de escombros'."
            ),
            "partida": None,
            "materials": [],
            "equipments": [],
            "labors": [],
            "advertencias": [],
            "_internal_code": codigo,
        }

    # clarification_needed con opciones del RAG
    return {
        "status": "clarification_needed",
        "clarification_message": mensaje,
        "options": options,
        "questions": questions if not options else [],
        "guia_redaccion": (
            "Estructura recomendada: [Accion] + [Elemento] + [Material/Especificacion] + [Metodo]. "
            "Ejemplo: 'Excavacion a mano en terreno blando para zanjas 0.60x0.80m, incluye bote'."
        ),
        "partida": None,
        "materials": [],
        "equipments": [],
        "labors": [],
        "advertencias": [],
        "_internal_code": codigo,
    }
