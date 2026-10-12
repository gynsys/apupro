import re
from typing import Any, Dict, List, Optional


# Mapeo de normalización de artefactos de Excel a pulgadas reales de fontanería
FRACTION_CORRECTIONS: Dict[str, str] = {
    "1-feb": "1/2",
    "3-abr": "3/4",
    "1-abr": "1 1/4",
    "5-ago": "5/8",
}


def normalize_dimension_string(raw: str) -> str:
    """Corrige artefactos de fechas de Excel en pulgadas."""
    if not raw or not isinstance(raw, str):
        return ""
    clean = raw.strip()
    for bad, good in FRACTION_CORRECTIONS.items():
        clean = re.sub(re.escape(bad), good, clean, flags=re.IGNORECASE)
    return clean


# Taxonomía Maestra Empírica derivada de las 17.343 partidas de CostBase
EMPIRICAL_TAXONOMY: Dict[str, Dict[str, Any]] = {
    "concreto_estructural": {
        "nombre": "Concreto Estructural (Vaciado)",
        "disciplina": "ESTRUCTURAS",
        "keywords": ["concreto", "vaciado", "losa", "viga", "columna", "zapata", "pedestal", "muro armado"],
        "unidades_validas": ["m3", "m²", "m2", "ml", "m"],
        "parametro_critico": "resistencia_fc",
        "pregunta": "Defina la Resistencia del Concreto (f'c)\nSeleccione la resistencia de diseño requerida:",
        "chips_sugeridos": [
            "Concreto f'c=210 kg/cm²",
            "Concreto f'c=250 kg/cm²",
            "Concreto f'c=280 kg/cm²",
            "Concreto f'c=300 kg/cm²",
            "Concreto f'c=350 kg/cm²",
            "Concreto pobre f'c=150 kg/cm²",
            "Omitir"
        ]
    },
    "losas_concreto": {
        "nombre": "Losas de Concreto y Techos",
        "disciplina": "ESTRUCTURAS",
        "keywords": ["losa", "techo", "entrepiso", "nervada", "maciza"],
        "unidades_validas": ["m2", "m²", "m3"],
        "parametro_critico": "resistencia_y_espesor",
        "pregunta": "Defina la Resistencia y Espesor de la Losa\nSeleccione la resistencia del concreto y el espesor de la losa:",
        "chips_sugeridos": [
            "Concreto f'c=210 kg/cm² e=10 cm",
            "Concreto f'c=210 kg/cm² e=15 cm",
            "Concreto f'c=210 kg/cm² e=20 cm",
            "Concreto f'c=250 kg/cm² e=15 cm",
            "Concreto f'c=250 kg/cm² e=20 cm",
            "Concreto f'c=250 kg/cm² e=25 cm",
            "Concreto f'c=280 kg/cm² e=20 cm",
            "Omitir"
        ]
    },
    "sobrepisos_nivelacion": {
        "nombre": "Sobrepisos y Nivelación de Pisos",
        "disciplina": "ACABADOS",
        "keywords": ["sobrepiso", "afinado", "nivelacion", "nivelación", "mortero de piso"],
        "unidades_validas": ["m2", "m²"],
        "parametro_critico": "dosificacion_y_espesor",
        "pregunta": "Defina la Dosificación y Espesor del Sobrepiso\nSeleccione la proporción del mortero y el espesor:",
        "chips_sugeridos": [
            "Mortero cemento-arena 1:3 e=2.5 cm",
            "Mortero cemento-arena 1:3 e=3.0 cm",
            "Mortero cemento-arena 1:4 e=3.0 cm",
            "Mortero cemento-arena 1:3 e=4.0 cm",
            "Mortero cemento-arena 1:4 e=5.0 cm",
            "Concreto f'c=150 kg/cm² e=5.0 cm",
            "Omitir"
        ]
    },
    "mamposteria_bloques": {
        "nombre": "Paredes de Bloques y Mampostería",
        "disciplina": "ACABADOS",
        "keywords": ["pared", "muro", "tabique", "bloque", "ladrillo"],
        "unidades_validas": ["m2", "m²"],
        "parametro_critico": "espesor_bloque",
        "pregunta": "Defina el Tipo y Espesor de Bloque\nSeleccione el material y espesor de la pared:",
        "chips_sugeridos": [
            "Bloque de arcilla e=10 cm",
            "Bloque de arcilla e=15 cm",
            "Bloque de arcilla e=20 cm",
            "Bloque de concreto e=10 cm",
            "Bloque de concreto e=15 cm",
            "Bloque de concreto e=20 cm",
            "Ladrillo macizo de arcilla",
            "Bloque calado de ventilación",
            "Omitir"
        ]
    },
    "tuberias_sanitarias_hidraulicas": {
        "nombre": "Tuberías y Válvulas",
        "disciplina": "INSTALACIONES HIDRÁULICAS",
        "keywords": ["tuberia", "tubería", "tubo", "valvula", "válvula", "plomeria", "plomería", "drenaje"],
        "unidades_validas": ["m", "ml", "pza", "und"],
        "parametro_critico": "diametro_y_material",
        "pregunta": "Defina el Diámetro y Material de la Tubería\nSeleccione el diámetro nominal y material:",
        "chips_sugeridos": [
            'Tubería PVC 1/2"',
            'Tubería PVC 3/4"',
            'Tubería PVC 1"',
            'Tubería PVC 2"',
            'Tubería PVC 3"',
            'Tubería PVC 4"',
            'Tubería de acero HG 1/2"',
            'Tubería de cobre 1/2"',
            'Tubería PVC 6"',
            'Omitir'
        ]
    },
    "pinturas_acabados": {
        "nombre": "Pinturas y Recubrimientos",
        "disciplina": "ACABADOS",
        "keywords": ["pintura", "pintar", "esmalte", "fondo", "satinado", "anticorrosivo"],
        "unidades_validas": ["m2", "m²", "pza", "und"],
        "parametro_critico": "tipo_pintura",
        "pregunta": "Defina el Tipo de Pintura o Acabado\nSeleccione la pintura o recubrimiento a aplicar:",
        "chips_sugeridos": [
            "Pintura de caucho clase A",
            "Pintura de caucho clase B",
            "Esmalte sintético alquídico",
            "Fondo anticorrosivo alquídico",
            "Fondo cromato de zinc",
            "Pintura impermeabilizante elastomérica",
            "Pintura epóxica de alto tráfico",
            "Pintura reflectiva de aluminio",
            "Omitir"
        ]
    },
    "impermeabilizaciones": {
        "nombre": "Impermeabilización de Techos y Losas",
        "disciplina": "ACABADOS",
        "keywords": ["manto", "impermeabilizacion", "impermeabilización", "primer asfáltico", "asfalto"],
        "unidades_validas": ["m2", "m²"],
        "parametro_critico": "tipo_manto",
        "pregunta": "Defina el Sistema de Impermeabilización\nSeleccione el manto o membrana a utilizar:",
        "chips_sugeridos": [
            "Manto asfáltico 3 mm",
            "Manto asfáltico 4 mm",
            "Manto con foil de aluminio",
            "Membrana líquida elastomérica",
            "Primer imprimador asfáltico",
            "Pintura reflectiva de aluminio",
            "Omitir"
        ]
    },
    "movimiento_tierras_excavacion": {
        "nombre": "Movimiento de Tierras y Excavación",
        "disciplina": "MOVIMIENTO DE TIERRAS",
        "keywords": ["excavacion", "excavación", "zanja", "bote", "acarreo", "vaciado en zanja"],
        "unidades_validas": ["m3", "m3.m", "m3xkm", "m3.km"],
        "parametro_critico": "profundidad_y_metodo",
        "pregunta": "Defina la Profundidad y Método de Excavación\nSeleccione el rango de profundidad y método:",
        "chips_sugeridos": [
            "Hasta 1.50 m (a mano)",
            "Hasta 1.50 m (a máquina)",
            "De 1.50 a 3.00 m (a máquina)",
            "Mayor a 3.00 m (a máquina)",
            "En zanjas hasta 1.50 m a mano",
            "Omitir"
        ]
    },
    "instalaciones_electricas": {
        "nombre": "Instalaciones Eléctricas (Cables y Tableros)",
        "disciplina": "INSTALACIONES ELÉCTRICAS",
        "keywords": ["cable", "conductor", "tablero", "breaker", "acometida", "circuito"],
        "unidades_validas": ["m", "ml", "pza", "und", "pto"],
        "parametro_critico": "calibre_o_circuitos",
        "pregunta": "Defina el Calibre o Capacidad Eléctrica\nSeleccione el calibre del cable o número de circuitos:",
        "chips_sugeridos": [
            "Calibre #14 AWG THHN",
            "Calibre #12 AWG THHN",
            "Calibre #10 AWG THHN",
            "Calibre #8 AWG THHN",
            "Calibre #6 AWG TTU",
            "Calibre #4 AWG TTU",
            "Calibre 2/0 AWG TTU",
            "Tablero 12 circuitos",
            "Tablero 18 circuitos",
            "Tablero 24 circuitos",
            "Omitir"
        ]
    },
    "equipos_bombeo": {
        "nombre": "Equipos de Bombeo e Hidroneumáticos",
        "disciplina": "INSTALACIONES HIDRÁULICAS",
        "keywords": ["bomba", "electrobomba", "motobomba", "hidroneumatico", "hidroneumático"],
        "unidades_validas": ["pza", "und", "jgo"],
        "parametro_critico": "potencia_hp",
        "pregunta": "Defina la Potencia del Equipo (HP)\nSeleccione la potencia del motor o bomba:",
        "chips_sugeridos": [
            "Potencia 0.5 HP",
            "Potencia 1 HP",
            "Potencia 1.5 HP",
            "Potencia 2 HP",
            "Potencia 3 HP",
            "Potencia 5 HP",
            "Potencia 7.5 HP",
            "Potencia 10 HP",
            "Omitir"
        ]
    }
}


def find_family_for_prompt(accion: str, elemento: str) -> Optional[Tuple[str, Dict[str, Any]]]:
    """Identifica la familia constructiva a partir de la acción y elemento ingresados."""
    if not accion and not elemento:
        return None

    combined = f"{accion or ''} {elemento or ''}".lower()

    # Excepción explícita para acabados en losas/techos
    if re.search(r"\b(pintur|esmalte|fondo)\b", combined):
        return "pinturas_acabados", EMPIRICAL_TAXONOMY["pinturas_acabados"]

    if re.search(r"\b(manto|impermeabiliz)\b", combined):
        return "impermeabilizaciones", EMPIRICAL_TAXONOMY["impermeabilizaciones"]

    if re.search(r"\b(sobrepiso|nivelaci[oó]n|afinado)\b", combined):
        return "sobrepisos_nivelacion", EMPIRICAL_TAXONOMY["sobrepisos_nivelacion"]

    for key, data in EMPIRICAL_TAXONOMY.items():
        for kw in data["keywords"]:
            if re.search(r"\b" + re.escape(kw) + r"\b", combined):
                return key, data

    return None
