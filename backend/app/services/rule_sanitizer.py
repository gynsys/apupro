"""
Rule-based material description sanitizer.
No LLM needed - fast, free, and deterministic.

FAMILIAS REDISEÑADAS (v2) - Más granulares y correctas:
Principio: misma familia = mismo mercado, mismos proveedores, precios se mueven juntos
"""
import re
from typing import List, Dict


# ---------------------------------------------------------------------------
# MAPA DE FAMILIAS - ORDEN IMPORTA: más específico primero
# ---------------------------------------------------------------------------
FAMILY_RULES = [
    # ── CEMENTOS ──────────────────────────────────────────────────────────
    ("CEMENTO PORTLAND",        ["CEMENTO PORTLAND", "CEMENT PORTLAND", "CEMENTO TIPO I",
                                  "CEMENTO TIPO II", "CEMENTO TIPO V", "CEMENTO BLANCO"]),
    ("CEMENTO (GENERAL)",       ["CEMENTO", "PORTLAND"]),

    # ── CAL ───────────────────────────────────────────────────────────────
    ("CAL",                     ["CAL HIDRATADA", "CAL VIVA", "CAL APAGADA", " CAL "]),

    # ── YESO / DRYWALL ────────────────────────────────────────────────────
    ("YESO / DRYWALL",          ["YESO", "DRY WALL", "DRYWALL", "PLACA DE YESO",
                                  "LAMINA DE YESO", "PLANCHA DE YESO", "CIELO RASO"]),

    # ── ACERO DE REFUERZO ─────────────────────────────────────────────────
    ("ACERO DE REFUERZO",       ["CABILLA", "VARILLA CORRUGADA", "BARRA CORRUGADA",
                                  "ACERO DE REFUERZO", "ACERO CORRUGADO", "VARILLA ACERO"]),

    # ── PERFILES METÁLICOS ────────────────────────────────────────────────
    ("PERFILES METÁLICOS",      ["ANGULO", "ÁNGULO", "PLATINA", "CANAL LAMINADO",
                                  "VIGA LAMINADA", "PERFIL LAMINADO", "CORREA",
                                  "TUBO ESTRUCTURAL", "TUBO CUADRADO", "TUBO RECTANGULAR"]),

    # ── ARENA ─────────────────────────────────────────────────────────────
    ("ARENA",                   ["ARENA LAVADA", "ARENA GRUESA", "ARENA FINA",
                                  "ARENA DE RIO", "ARENA RIO", "ARENA NATURAL"]),

    # ── PIEDRA / AGREGADO GRUESO ──────────────────────────────────────────
    ("PIEDRA PICADA",           ["PIEDRA PICADA", "PIEDRA TRITURADA", "GRAVA",
                                  "GRAVEL", "AGREGADO GRUESO", "CASCAJO"]),

    # ── ARENA/PIEDRA GENERAL ──────────────────────────────────────────────
    ("ÁRIDOS",                  ["MATERIAL SELECTO", "RELLENO COMPACTADO",
                                  "TIERRA VEGETAL", "MATERIAL DE RELLENO"]),

    # ── BLOQUE DE ARCILLA ─────────────────────────────────────────────────
    ("BLOQUE DE ARCILLA",       ["BLOQUE DE ARCILLA", "BLOQUE CERAMICO", "LADRILLO",
                                  "TABIQUE CERAMICO", "LADRILLO REFRACTARIO"]),

    # ── BLOQUE DE CONCRETO ────────────────────────────────────────────────
    ("BLOQUE DE CONCRETO",      ["BLOQUE DE CONCRETO", "BLOQUE DE HORMIGON",
                                  "BLOQUE GRIS", "BLOQUETON", "ADOQUIN"]),

    # ── MADERA ASERRADA ───────────────────────────────────────────────────
    ("MADERA ASERRADA",         ["TABLA DE MADERA", "TABLON", "VIGUETA DE MADERA",
                                  "MADERA ASERRADA", "PIEZAS DE MADERA", "CUARTÓN",
                                  "CUARTON", "LISTÓN"]),

    # ── TABLEROS DE MADERA ────────────────────────────────────────────────
    ("TABLEROS DE MADERA",      ["TRIPLAY", "CONTRACHAPADO", "MACHIMBRADO",
                                  "MDF", "OSB", "MADERA PRENSADA", "ROBLE",
                                  "TABLERO DE MADERA"]),

    # ── PORCELANATO ───────────────────────────────────────────────────────
    ("PORCELANATO",             ["PORCELANATO", "PORCELANICO", "GRES PORCELANICO"]),

    # ── CERÁMICA ──────────────────────────────────────────────────────────
    ("CERÁMICA",                ["CERAMICA", "CERÁMICA", "AZULEJO", "MOSAICO",
                                  "BALDOSA CERAMICA"]),

    # ── PINTURA CAUCHO ────────────────────────────────────────────────────
    ("PINTURA CAUCHO",          ["PINTURA CAUCHO", "PINTURA LATEX", "CAUCHO INTERIOR",
                                  "CAUCHO EXTERIOR", "PINTURA CAUCHO INT",
                                  "PINTURA CAUCHO EXT"]),

    # ── PINTURA ESMALTE ───────────────────────────────────────────────────
    ("PINTURA ESMALTE",         ["PINTURA ESMALTE", "ESMALTE ALKIDICO",
                                  "ESMALTE SINTETICO", "PINTURA ACEITE",
                                  "ESMALTE ANTICORROSIVO"]),

    # ── IMPERMEABILIZANTES ────────────────────────────────────────────────
    ("IMPERMEABILIZANTE",       ["IMPERMEABILIZANTE", "IMPERMEABLE", "SBS",
                                  "MEMBRANA ASFALTICA", "SIKA", "MORTERO IMPERMEABILIZ",
                                  "ADITIVO IMPERMEABLE", "MORTERO HIDROFUGO"]),

    # ── MORTEROS Y PEGAMENTOS ────────────────────────────────────────────
    ("MORTEROS Y ADHESIVOS",    ["MORTERO", "PEGAMENTO", "ADHESIVO", "PEGA PORCELANATO",
                                  "PEGA CERAMICA", "MASTIQUE", "PASTA PROFESIONAL",
                                  "BONDEX", "PORTER", "FRAGUA", "JUNTA"]),

    # ── TUBERÍAS PVC ──────────────────────────────────────────────────────
    ("TUBERÍAS PVC",            ["TUBO PVC", "TUBERIA PVC", "ACCESORIO PVC",
                                  "CODO PVC", "TEE PVC", "UNION PVC",
                                  "REDUCCION PVC", "TAPÓN PVC"]),

    # ── CONDUCTORES COBRE ─────────────────────────────────────────────────
    ("CONDUCTOR COBRE",         ["CABLE COBRE", "CONDUCTOR COBRE", "THHN", "THWN",
                                  "CABLE AWG", "CONDUCTOR AWG", " AWG ",
                                  "CABLE ELECTRICO", "CONDUCTOR ELECTRICO"]),

    # ── CONDUCTORES ALUMINIO ──────────────────────────────────────────────
    ("CONDUCTOR ALUMINIO",      ["CABLE ALUMINIO", "CONDUCTOR ALUMINIO",
                                  "CABLE AL", "CONDUCTOR AL"]),

    # ── TABLEROS / BREAKERS ───────────────────────────────────────────────
    ("TABLEROS ELÉCTRICOS",     ["TABLERO ELECTRICO", "PANEL ELECTRICO",
                                  "CENTRO DE CARGA", "BREAKER", "INTERRUPTOR",
                                  "DISYUNTOR", "FLIPON"]),

    # ── LUMINARIAS / ILUMINACIÓN ──────────────────────────────────────────
    ("ILUMINACIÓN",             ["LUMINARIA", "LAMPARA", "BOMBILLO", "LED",
                                  "FLUORESCENTE", "FOCO", "REFLECTOR"]),

    # ── EQUIPOS MECÁNICOS ────────────────────────────────────────────────
    ("EQUIPOS MECÁNICOS",       ["BOMBA DE AGUA", "BOMBA CENTRIFUGA", "MOTOR ELECTRICO",
                                  "VENTILADOR", "EXTRACTOR", "COMPRESOR", "GENERADOR"]),

    # ── SANITARIOS ────────────────────────────────────────────────────────
    ("SANITARIOS Y ACCESORIOS", ["INODORO", "LAVAMANOS", "LAVABO", "DUCHA",
                                  "GRIFO", "LLAVE DE PASO", "VÁLVULA", "VALVULA",
                                  "REGISTRO", "SANITARIO"]),

    # ── PINTURAS GENERAL ──────────────────────────────────────────────────
    ("PINTURAS (GENERAL)",      ["PINTURA", "BARNIZ", "SELLADOR", "DILUYENTE",
                                  "THINNER", "ANTICORROSIVO", "FONDO EPOXIDO"]),

    # ── OTROS ─────────────────────────────────────────────────────────────
    ("GENERAL",                 []),  # Fallback
]


# ---------------------------------------------------------------------------
# Unit normalization
# ---------------------------------------------------------------------------
UNIT_MAP = {
    r'\bM3\b': 'm³', r'\bm3\b': 'm³', r'\bM2\b': 'm²', r'\bm2\b': 'm²',
    r'\bKGS\b': 'kg', r'\bKgs\b': 'kg', r'\bKG\b': 'kg', r'\bKGS\.\b': 'kg',
    r'\bLTS\b': 'lt', r'\bLts\b': 'lt', r'\bLT\b': 'lt',
    r'\bGLS\b': 'gal', r'\bGls\b': 'gal', r'\bGAL\b': 'gal',
    r'\bUND\b': 'und', r'\bUnd\b': 'und', r'\bUN\b': 'und',
    r'\bMTS\b': 'm', r'\bMts\b': 'm', r'\bMM\b': 'mm', r'\bCM\b': 'cm',
    r'\bPLG\b': 'plg', r'\bPZA\b': 'pza', r'\bPZAS\b': 'pzas', r'\bPCS\b': 'pzas',
}

# Words always uppercase
ALWAYS_UPPER = {'PVC', 'HDPE', 'PPR', 'ABS', 'ASTM', 'AISI', 'ISO', 'AWG',
                'EMT', 'IMC', 'THHN', 'THWN', 'LED', 'MDF', 'OSB', 'SBS', 'APP'}

# Words always lowercase
ALWAYS_LOWER = {'de', 'del', 'la', 'las', 'el', 'los', 'y', 'e', 'o', 'u',
                'a', 'en', 'con', 'por', 'para', 'sin', 'entre', 'sobre',
                'p', 'x'}


def _detect_family(description: str) -> str:
    """Detect material family using ordered priority rules."""
    desc = " " + description.upper() + " "  # add spaces for word boundary matching

    for family_name, keywords in FAMILY_RULES:
        if not keywords:
            return family_name  # fallback
        for kw in keywords:
            if kw.upper() in desc:
                return family_name
    return "GENERAL"


def _normalize_whitespace(text: str) -> str:
    return re.sub(r'\s+', ' ', text).strip()


def _apply_unit_map(text: str) -> str:
    for pattern, replacement in UNIT_MAP.items():
        text = re.sub(pattern, replacement, text, flags=re.IGNORECASE)
    return text


def _smart_title_case(text: str) -> str:
    words = text.split()
    result = []
    for i, word in enumerate(words):
        clean = word.strip('.,;:()-/')
        if clean.upper() in ALWAYS_UPPER:
            result.append(clean.upper())
        elif clean.lower() in ALWAYS_LOWER and i > 0:
            result.append(clean.lower())
        else:
            result.append(word.capitalize())
    return ' '.join(result)


def _remove_weird_chars(text: str) -> str:
    text = re.sub(r'[^\w\s\-\.\,\(\)\%\/\°\#\+\'\"\³\²\"]', ' ', text)
    return text


def sanitize_single(description: str) -> Dict[str, str]:
    if not description:
        return {'clean_description': '', 'family': 'GENERAL'}

    text = description
    text = _normalize_whitespace(text)
    text = _remove_weird_chars(text)
    text = _normalize_whitespace(text)
    text = _apply_unit_map(text)
    text = _smart_title_case(text)
    text = _normalize_whitespace(text)

    # Detect family from ORIGINAL (raw text more reliable)
    family = _detect_family(description)

    return {'clean_description': text, 'family': family}


def sanitize_batch_rules(materials: List[Dict[str, str]]) -> List[Dict[str, str]]:
    results = []
    for mat in materials:
        mat_id = mat.get('id', '')
        original = mat.get('description', '')
        sanitized = sanitize_single(original)
        results.append({
            'id': mat_id,
            'original': original,
            'clean': sanitized['clean_description'],
            'family': sanitized['family'],
            'method': 'rules'
        })
    return results
