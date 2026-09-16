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

import os
import json
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

# Carga dinámica del léxico compilado desde las 17,408 partidas COVENIN de la base de datos
_LEXICON_PATH: str = os.path.join(os.path.dirname(__file__), "data", "construction_lexicon.json")
if os.path.exists(_LEXICON_PATH):
    try:
        with open(_LEXICON_PATH, "r", encoding="utf-8") as _f:
            _lex_data = json.load(_f)
            _CONSTRUCTION_ACTIONS.update(_lex_data.get("actions", []))
            _CONSTRUCTION_PHYSICAL_ELEMENTS.update(_lex_data.get("elements", []))
    except Exception as _e:
        logger.warning(f"No se pudo cargar construction_lexicon.json: {_e}")


def _spanish_ortho_normalize(w: str) -> str:
    """
    Normalización fonética y morfológica de variantes ortográficas comunes en español:
      - Betacismo: v <-> b (excabacion <-> excavacion, valdosas <-> baldosas)
      - Seseo: ce, ci, z -> s (excavasion <-> excavacion, seramica <-> ceramica)
      - Pérdida de s preconsonántica: nst -> nt, nsp -> np (contruccion <-> construccion, intalacion <-> instalacion)
      - Asimilación nasal: np -> mp, nb -> mb (inpermeabilizacion <-> impermeabilizacion)
      - Geminadas simplificadas: rr -> r, cc -> c (acareo <-> acarreo)
      - Desinencias participiales: eado -> iado (baceado <-> vaciado)
    """
    if not w:
        return ""
    w = w.lower().strip()
    nfkd = unicodedata.normalize("NFD", w)
    w = "".join(c for c in nfkd if unicodedata.category(c) != "Mn")

    w = w.replace("v", "b")
    w = re.sub(r"c(?=[ei])", "s", w)
    w = w.replace("z", "s")
    w = w.replace("nst", "nt").replace("nsp", "np")
    w = w.replace("np", "mp").replace("nb", "mb")
    w = w.replace("rr", "r").replace("cc", "c")
    w = re.sub(r"eado$", "iado", w)
    return w


# Mapas ortográficos fonéticos pre-computados (O(1) lookup para tolerancia a errores ortográficos)
_ACTION_ORTHO_MAP: Dict[str, str] = {_spanish_ortho_normalize(a): a for a in _CONSTRUCTION_ACTIONS}
_ELEMENT_ORTHO_MAP: Dict[str, str] = {_spanish_ortho_normalize(e): e for e in _CONSTRUCTION_PHYSICAL_ELEMENTS}

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


def _normalize_token(text_val: str) -> str:
    """Normaliza un token removiendo acentos y caracteres no alfanuméricos."""
    if not text_val:
        return ""
    nfkd = unicodedata.normalize("NFD", text_val.lower().strip())
    without_accents = "".join(c for c in nfkd if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]", "", without_accents)


def _matches_lexicon(
    word: str,
    lexicon: Set[str],
    ortho_map: Optional[Dict[str, str]] = None,
) -> bool:
    """
    Verifica si una palabra o su lema/plural pertenece al conjunto léxico,
    con soporte opcional de tolerancia fonética a errores ortográficos comunes.
    """
    if not word or len(word) < 3:
        return False

    # 1. Coincidencia exacta directa
    if word in lexicon:
        return True

    # 2. Desinencias de plurales en español
    if word.endswith("es") and len(word) > 4:
        if word[:-2] in lexicon or word[:-1] in lexicon:
            return True
    elif word.endswith("s") and len(word) > 3:
        if word[:-1] in lexicon:
            return True

    # 3. Tolerancia ortográfica fonética (O(1) lookup vía diccionario pre-computado)
    if ortho_map:
        norm = _spanish_ortho_normalize(word)
        if norm in ortho_map:
            return True
        if word.endswith("es") and len(word) > 4:
            if _spanish_ortho_normalize(word[:-2]) in ortho_map or _spanish_ortho_normalize(word[:-1]) in ortho_map:
                return True
        elif word.endswith("s") and len(word) > 3:
            if _spanish_ortho_normalize(word[:-1]) in ortho_map:
                return True

    return False


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


_ACARREO_ACTION_STEMS: Set[str] = {
    "acarreo", "acarrear", "acareo", "acarear",
    "bote", "botar",
    "transporte", "transportar",
    "traslado", "trasladar",
}


def _has_acarreo_unit_or_context(text: str) -> bool:
    """
    Verifica si una consulta de acarreo o transporte especifica la unidad de medida,
    la distancia de traslado o el método/equipo empleado.
    """
    lower = text.lower()

    # 1. Unidades técnicas específicas de acarreo y transporte en COVENIN
    unit_patterns = [
        r"\bm3[\.\*x\s\-]*(m|km)\b",
        r"\b(sac|sc)[\.\*x\s\-]*m\b",
        r"\btf[\.\*x\s\-]*km\b",
        r"\bton[\.\*x\s\-]*km\b",
        r"\bkgf[\.\*x\s\-]*m\b",
        r"\bpza[\.\*x\s\-]*m\b",
        r"\b(vje|viajes?|fletes?)\b",
        r"\b(m3|m³|metros?\s+cubicos?)\b",
    ]
    if any(re.search(p, lower) for p in unit_patterns):
        return True

    # 2. Distancia explícita con valor numérico (ej: 20m, 30 metros, 5 km, 15 kilometros)
    dist_pattern = r"\b\d+(\.\d+)?\s*(m|mt|mts|metros?|km|kms|kilometros?)\b"
    if re.search(dist_pattern, lower):
        return True

    # 3. Métodos y equipos de acarreo / transporte
    transport_methods = {
        "carretilla", "carretillas",
        "camion", "camiones", "volteo", "volquete", "toronto", "dumper",
        "tobo", "tobos", "cuñete", "cuñetes", "balde", "baldes",
        "manual", "manualmente", "mecanico", "mecanizado",
    }
    if "a mano" in lower or "al hombro" in lower:
        return True

    words = re.findall(r"\b[a-záéíóúüñ]+\b", lower)
    if any(w in transport_methods for w in words):
        return True

    return False


def _is_primary_acarreo(query: str) -> bool:
    """
    Determina si la intención principal de la consulta es acarreo/transporte/bote de material.
    Retorna False si el acarreo es accesorio a una partida principal (ej: demolición o excavación).
    """
    lower = query.lower()
    acarreo_pos: List[int] = []
    for s in _ACARREO_ACTION_STEMS:
        for m in re.finditer(r"\b" + re.escape(s) + r"\b", lower):
            acarreo_pos.append(m.start())

    if not acarreo_pos:
        return False

    min_acarreo = min(acarreo_pos)

    # Identificar si otra acción constructiva principal apareció antes del término de acarreo
    for a in _CONSTRUCTION_ACTIONS:
        if a in _ACARREO_ACTION_STEMS:
            continue
        for m in re.finditer(r"\b" + re.escape(a) + r"\b", lower):
            if m.start() < min_acarreo:
                return False

    return True


def _check_parametric_missing_specification(
    query: str,
) -> Optional[Tuple[str, str, str, List[str]]]:
    """
    Verifica si una consulta involucra una familia constructiva paramétrica crítica
    (bombas, paredes de bloques, losas, pavimentos, excavaciones, concertinas, tuberías, etc.)
    y carece de su parámetro físico, dimensional o de capacidad esencial.

    Retorna una tupla (veredicto, mensaje, codigo_interno, opciones) si falta el parámetro,
    o None si la especificación es suficiente o no aplica.
    """
    lower = query.lower()
    is_demolition = bool(
        re.search(r"\b(demolicion|demoler|picar|tumbar|derribar|desmontaje|desmontar)\b", lower)
    )

    # 1. Bomba / Equipo Hidráulico
    if re.search(r"\b(bomba|bombas|electrobomba|electrobombas|motobomba|motobombas)\b", lower):
        has_hp_or_flow = bool(
            re.search(
                r"\b\d+([\.,]\d+)?\s*(hp|cv|kw|lps|gpm)\b|\b(0\.5|1\.5|1\/2|3\/4)\s*hp\b",
                lower,
            )
        )
        if not has_hp_or_flow:
            return (
                "clarification_needed",
                "¿Qué potencia (HP, kW) o caudal tiene la bomba?",
                "RAG_PARAMETRIC_MISSING_BOMBA",
                [],
            )

    # 2. Concertina de Seguridad
    if re.search(r"\b(concertina|concertinas)\b", lower):
        has_diam = bool(
            re.search(
                r"\b(30|45|60|75|90|150)\s*(cm|pulg|\"|mm)?\b|\b\d+(\.\d+)?\s*(cm|pulg|\"|mm)\b|\b(12|18|24|36)\s*(pulg|\")\b|\b\d+\s*\/\s*\d+\s*(pulg|\")?\b",
                lower,
            )
        )
        if not has_diam:
            return (
                "clarification_needed",
                "¿Qué diámetro tiene la concertina de seguridad? (Ej: 30 cm / 12\", 45 cm / 18\", 60 cm / 24\")",
                "RAG_PARAMETRIC_MISSING_CONCERTINA",
                [],
            )

    # 3. Paredes de Bloques / Muros (no demolición)
    has_wall = bool(re.search(r"\b(pared|paredes|muro|muros|tabique|tabiques)\b", lower))
    has_block = bool(re.search(r"\b(bloque|bloques|ladrillo|ladrillos|arcilla)\b", lower))
    if has_wall and has_block and not is_demolition:
        has_thickness = bool(
            re.search(
                r"\be\s*=\s*\d+|\b\d+\s*(cm|cms)\b|\b\d+x\d+x\d+\b|\b(10|12|15|20)\s*(cm|cms)\b",
                lower,
            )
        )
        if not has_thickness:
            return (
                "clarification_needed",
                "¿De qué espesor o medida es el bloque de la pared? (Ej: e=10 cm, e=12 cm, e=15 cm, e=20 cm)",
                "RAG_PARAMETRIC_MISSING_PARED",
                [],
            )

    # 4. Losa de Concreto / Techo / Entrepiso (no demolición)
    if re.search(r"\b(losa|losas)\b", lower) and not is_demolition:
        has_thickness = bool(
            re.search(r"\be\s*=\s*\d+|\b\d+\s*(cm|cms)\b|\bespesor\b", lower)
        )
        if not has_thickness:
            return (
                "clarification_needed",
                "¿De qué espesor es la losa de concreto? (Ej: e=15 cm, e=20 cm, e=25 cm, e=30 cm)",
                "RAG_PARAMETRIC_MISSING_LOSA",
                [],
            )

    # 5. Pavimento / Acera / Brocal (no demolición)
    if re.search(r"\b(pavimento|pavimentos|acera|aceras)\b", lower) and not is_demolition:
        has_thickness = bool(
            re.search(r"\be\s*=\s*\d+|\b\d+\s*(cm|cms)\b|\bespesor\b", lower)
        )
        if not has_thickness:
            return (
                "clarification_needed",
                "¿Qué espesor tiene el pavimento o acera? (Ej: e=10 cm, e=15 cm, e=20 cm)",
                "RAG_PARAMETRIC_MISSING_PAVIMENTO",
                [],
            )

    # 6. Excavación (profundidad o método)
    if re.search(r"\b(excavaci[oó]n|excavaciones|excavar|excabaci[oó]n|excabaciones|excabar)\b", lower):
        has_depth = bool(
            re.search(r"\b(hasta\s*\d+(\.\d+)?\s*m|profundidad|\d+(\.\d+)?\s*m|\d+\s*metros?)\b", lower)
        )
        has_method = bool(
            re.search(
                r"\b(a\s*mano|manual|manualmente|a\s*maquina|mecanic[ao]|retroexcavadora|jumbo|tractor)\b",
                lower,
            )
        )
        if not has_depth and not has_method:
            return (
                "clarification_needed",
                "¿Qué profundidad tiene la excavación y con qué método se ejecutará? (Ej: hasta 1.50 m a mano, 1.50 a 3.00 m a máquina)",
                "RAG_PARAMETRIC_MISSING_EXCAVACION",
                [],
            )

    # 7. Tubería / Válvula (no demolición)
    if re.search(r"\b(tuberia|tuberias|tubo|tubos|valvula|valvulas)\b", lower) and not is_demolition:
        has_diam = bool(
            re.search(
                r"\bd\s*=\s*|\b\d+(\.\d+)?\s*(pulg|pulgadas?|\"|mm)\b|\b\d+\s*\/\s*\d+\s*(pulg|\"|mm)?\b|\b\d+\s*mm\b|\b(1\/2|3\/4|1|1-1\/2|2|3|4|6)\s*(pulg|\"|in)?\b|\bdiametro\b",
                lower,
            )
        )
        if not has_diam:
            return (
                "clarification_needed",
                "¿Qué diámetro tiene la tubería o válvula? (Ej: 1/2\", 3/4\", 1\", 2\", 3\", 4\")",
                "RAG_PARAMETRIC_MISSING_TUBERIA",
                [],
            )

    # 8. Transformador
    if re.search(r"\b(transformador|transformadores)\b", lower):
        has_kva = bool(re.search(r"\b\d+([\.,]\d+)?\s*(kva|k\.?v\.?a\.?|mva)\b", lower))
        if not has_kva:
            return (
                "clarification_needed",
                "¿Qué capacidad en kVA tiene el transformador? (Ej: 15 kVA, 25 kVA, 37.5 kVA, 50 kVA, 75 kVA)",
                "RAG_PARAMETRIC_MISSING_TRANSFORMADOR",
                [],
            )

    # 9. Tablero Eléctrico
    if re.search(r"\b(tablero|tableros)\b", lower):
        has_circuits = bool(re.search(r"\b\d+\s*(circuitos?|ctos?|polos?|fases?)\b", lower))
        if not has_circuits:
            return (
                "clarification_needed",
                "¿Cuántos circuitos o polos tiene el tablero eléctrico? (Ej: 8 circuitos, 12 circuitos, 18 circuitos, 24 circuitos, 42 circuitos)",
                "RAG_PARAMETRIC_MISSING_TABLERO",
                [],
            )

    # 10. Cable / Conductor
    if re.search(r"\b(cable|cables|conductor|conductores)\b", lower) and re.search(r"\b(cobre|aluminio|thw|thhn|tw|tt|electrico|electricos|sumergible)\b", lower):
        has_gauge = bool(
            re.search(
                r"\b(n[°º\.]?\s*\d+|\d+\s*awg|\d+\s*mcm|\d+(\.\d+)?\s*mm2|calibre\s*#?\s*\d+)\b",
                lower,
            )
        )
        if not has_gauge:
            return (
                "clarification_needed",
                "¿Qué calibre o sección tiene el conductor eléctrico? (Ej: #14 AWG, #12 AWG, #10 AWG, #8 AWG, 2.5 mm²)",
                "RAG_PARAMETRIC_MISSING_CABLE",
                [],
            )

    # 11. Tanque de Agua
    if re.search(r"\b(tanque|tanques)\b", lower):
        has_volume = bool(re.search(r"\b\d+([\.,]\d+)?\s*(lts?|litros?|m3|m³|gal|galones?)\b", lower))
        if not has_volume:
            return (
                "clarification_needed",
                "¿De qué capacidad o volumen es el tanque de agua? (Ej: 500 lts, 1000 lts, 1500 lts, 2000 lts, 5000 lts)",
                "RAG_PARAMETRIC_MISSING_TANQUE",
                [],
            )

    # 12. Aire Acondicionado
    if re.search(r"\b(aire\s+acondicionado|aires\s+acondicionados|split|fancoil|chiller)\b", lower):
        has_btu = bool(re.search(r"\b\d+([\.,]\d+)?\s*(btu|ton|tr)\b", lower))
        if not has_btu:
            return (
                "clarification_needed",
                "¿Qué capacidad frigorífica tiene el aire acondicionado? (Ej: 12000 BTU, 18000 BTU, 24000 BTU, 36000 BTU)",
                "RAG_PARAMETRIC_MISSING_AIRE",
                [],
            )

    return None


def validate_rag_signals(
    query: str,
    candidates: Optional[List[Dict[str, Any]]] = None,
) -> Optional[Tuple[str, str, str, List[str]]]:
    """
    Capa 2: Validación de Ambigüedad y Dominio vía RAG Híbrido (Gemini Embeddings + Léxico).

    Analiza las señales estadísticas y semánticas de la consulta y de los candidatos recuperados por el RAG
    para detectar:
      1. Consultas fuera del dominio de construcción (sin acción ni elemento constructivo, o score RAG < 0.32).
      2. Consultas que solo contienen una acción constructiva sin elemento ("demolicion", "instalacion").
      3. Consultas que solo contienen un elemento constructivo sin acción ("tuberia").
      4. Consultas de acarreo/transporte que carecen de unidad de medida, distancia o método.

    Returns:
        None si la consulta es técnicamente suficiente para proceder a la generación.
        Tuple (veredicto, mensaje, codigo_interno, opciones) si debe detenerse:
            - veredicto: "reject" o "clarification_needed"
            - mensaje: Explicación para el usuario.
            - codigo_interno: Código para auditoría ("RAG_OFF_TOPIC", "RAG_AMBIGUOUS_ACTION_ONLY", "RAG_ACARREO_MISSING_UNIT", etc.)
            - opciones: Lista de descripciones sugeridas (forzada a [] para cero adivinanzas engañosas).
    """
    clean_query = re.sub(r"[^\w\s]", " ", query.lower())
    raw_tokens = clean_query.split()
    tokens = [_normalize_token(t) for t in raw_tokens]
    tokens = [t for t in tokens if t and t not in _STOPWORDS and len(t) > 2]

    has_action = any(_matches_lexicon(t, _CONSTRUCTION_ACTIONS, _ACTION_ORTHO_MAP) for t in tokens)
    has_element = any(_matches_lexicon(t, _CONSTRUCTION_PHYSICAL_ELEMENTS, _ELEMENT_ORTHO_MAP) for t in tokens)

    # ── CHECK 1: Sin Acción ni Elemento Constructivo (Off-Topic léxico inmediato) ──
    # Si la consulta no tiene ni una sola acción ni un solo elemento de construcción:
    # Ej: "carro corre duro", "la moto corre mucho", "ayer comi hamburguesa"
    if not has_action and not has_element:
        logger.info("Query rejected by Capa 2 (no construction action or element): %.80s", query)
        return (
            "reject",
            (
                "La solicitud ingresada no corresponde a una actividad de construcción u obras civiles reconocible en el catálogo. "
                "Por favor describe una partida de obra (ej: excavación, vaciado de concreto, albañilería, tuberías, instalaciones)."
            ),
            "RAG_OFF_TOPIC",
            [],
        )

    # ── CHECK 2: Ambigüedad Léxica y Falta de Elemento Constructivo ───
    if len(tokens) <= 3:
        # Caso 2.1: Acción sola sin elemento ("demolicion", "instalacion", "suministro", "acarreo", "reparacion", "pintura")
        if has_action and not has_element:
            logger.info("Query stopped by Capa 2 RAG (action without element): %.80s", query)
            return (
                "clarification_needed",
                (
                    "La descripción es demasiado breve para generar un APU preciso. "
                    "Por favor describe la actividad con al menos el elemento constructivo y la acción a ejecutar. "
                    "Ejemplo: 'Demolición de pared de bloques de arcilla, incluye acarreo de escombros'."
                ),
                "RAG_AMBIGUOUS_ACTION_ONLY",
                [],  # Cero adivinanzas: no mostrar alternativas aleatorias/absurdas
            )

        # Caso 2.2: Elemento solo sin acción técnica ("tuberia", "losa de techo", "pared de bloques")
        if has_element and not has_action and len(tokens) <= 2:
            logger.info("Query stopped by Capa 2 RAG (element without action): %.80s", query)
            return (
                "clarification_needed",
                (
                    "La descripción es demasiado breve para generar un APU preciso. "
                    "Por favor describe la actividad con al menos el elemento constructivo y la acción a ejecutar. "
                    "Ejemplo: 'Suministro e instalación de tubería PVC 1/2 pulgada para aguas blancas'."
                ),
                "RAG_AMBIGUOUS_ELEMENT_ONLY",
                [],  # Cero adivinanzas
            )

    # ── CHECK 2.3: Validación de Unidad en Acarreo / Transporte ──────
    if _is_primary_acarreo(query):
        if not _has_acarreo_unit_or_context(query):
            logger.info("Acarreo query missing unit/distance intercepted by Capa 2: %.80s", query)
            return (
                "clarification_needed",
                (
                    "Las partidas de acarreo y transporte dependen directamente de la unidad de medida y la distancia "
                    "(m3.m para acarreo interno por metro lineal, m3 para volumen fijo, m3xkm para camión volteo por km, "
                    "sac.m para sacos por metro, o vje para viaje). Por favor indica la unidad, distancia o método de traslado."
                ),
                "RAG_ACARREO_MISSING_UNIT",
                [],  # Cero adivinanzas: no mostrar alternativas engañosas
            )

    # ── CHECK 2.4: Validación de Parámetros Técnicos Críticos (Cero Improvisación) ──
    parametric_check = _check_parametric_missing_specification(query)
    if parametric_check is not None:
        logger.info("Parametric query missing dimension intercepted by Capa 2 [%s]: %.80s", parametric_check[2], query)
        return parametric_check

    # ── CHECK 3: Evaluación de Candidatos RAG (si fueron proporcionados) ──
    if candidates is not None:
        if not candidates:
            return (
                "reject",
                (
                    "No se identificó ninguna actividad o partida constructiva afín a la solicitud ingresada. "
                    "Este sistema está diseñado exclusivamente para presupuestos y análisis de precios unitarios (APU) de obras civiles."
                ),
                "RAG_NO_CANDIDATES",
                [],
            )

        top_score = candidates[0].get("score", 0.0)
        if top_score < _RAG_MIN_OFF_TOPIC_SCORE:
            logger.info("Query rejected by Capa 2 RAG score (score=%.3f < %.2f): %.80s", top_score, _RAG_MIN_OFF_TOPIC_SCORE, query)
            return (
                "reject",
                (
                    "La solicitud ingresada no corresponde a una actividad de construcción u obras civiles reconocible en el catálogo. "
                    "Por favor describe una partida de obra (ej: excavación, vaciado de concreto, albañilería, tuberías, instalaciones)."
                ),
                "RAG_OFF_TOPIC",
                [],
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
) -> Dict[str, Any]:
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
    if codigo == "RAG_ACARREO_MISSING_UNIT":
        return {
            "status": "clarification_needed",
            "clarification_message": mensaje,
            "recommendation": "Indica la unidad de acarreo o la distancia para generar un APU preciso.",
            "options": [],
            "questions": [
                "1. Unidad de medida: ¿En qué unidad deseas computar? (m3.m: interno por metro lineal, m3: volumen fijo en sitio, m3xkm: volteo por km, sac.m: sacos por metro, o vje: viaje)",
                "2. Distancia o método: ¿Cuál es la distancia aproximada (ej: 30m, 10 km) o medio de transporte (carretilla a mano, camión volteo 7m3)?",
            ],
            "guia_redaccion": (
                "Estructura recomendada: Acarreo de [Material] en [Unidad/Método] a [Distancia]. "
                "Ejemplo: 'Acarreo de escombros a mano en carretilla a 30m (m3.m)' o 'Acarreo en camión volteo a 15 km (m3xkm)'."
            ),
            "partida": None,
            "materials": [],
            "equipments": [],
            "labors": [],
            "advertencias": [],
            "_internal_code": codigo,
        }

    if codigo.startswith("RAG_PARAMETRIC_MISSING_"):
        return {
            "status": "clarification_needed",
            "clarification_message": mensaje,
            "recommendation": "Indica este parámetro técnico para seleccionar o construir el APU con el costo exacto.",
            "options": [],
            "questions": [mensaje],
            "guia_redaccion": f"Estructura recomendada: agrega la especificación técnica requerida a tu descripción ({mensaje}).",
            "partida": None,
            "materials": [],
            "equipments": [],
            "labors": [],
            "advertencias": [],
            "_internal_code": codigo,
        }

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
            "recommendation": "Te recomendamos utilizar el Asistente Guiado para estructurar tu descripción paso a paso.",
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

    # clarification_needed
    return {
        "status": "clarification_needed",
        "clarification_message": mensaje,
        "recommendation": "Te recomendamos utilizar el Asistente Guiado para estructurar tu descripción paso a paso.",
        "options": [],
        "questions": questions,
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
