"""
Módulo de Normalización y Diccionario de Sinónimos Técnicos de Construcción.

Permite expandir siglas comerciales y términos de obra coloquiales (PPR, PEAD, HG,
fc 210, Drywall, Bobcat, etc.) a sus correspondientes términos normativos COVENIN.
"""

import re
from typing import List, Tuple
from app.core.logging import logger

# Mapeos de términos: (patrón regex, término canónico extendido)
TECHNICAL_SYNONYMS: List[Tuple[str, str]] = [
    # 1. Tuberías, Conducciones y Fontanería
    (r"\b(PPR|PP-R|PP-RCT)\b", "POLIPROPILENO PPR"),
    (r"\b(HDPE|PEAD)\b", "POLIETILENO DE ALTA DENSIDAD PEAD"),
    (r"\bCPVC\b", "POLICLORURO DE VINILO CLORADO CPVC"),
    (r"\bPEX\b", "POLIETILENO RETICULADO PEX"),
    (r"\b(HG|FOGO|FO\.GO\.|F\.G\.)\b", "HIERRO GALVANIZADO HG"),
    (r"\b(HF|FOFO|FO\.FO\.|F\.F\.)\b", "HIERRO FUNDIDO HF"),
    (r"\b(NPT|ROSCA\s+NPT)\b", "JUNTA ROSCADA NPT"),
    (r"\b(BSP|ROSCA\s+GAS|ROSCA\s+BSP)\b", "JUNTA ROSCADA BSP ROSCA GAS"),
    (r"(\bW\.C\.|\bWC\b|\bWATER\s+CLOSET\b)", "PIEZA SANITARIA W.C. EXCUSADO INODORO"),
    (r"\b(LAVAMANOS|LAVABO)\b", "LAVAMANOS PIEZA SANITARIA"),
    (r"\b(CALENTADOR|TERMOTANQUE|BOILER)\b", "CALENTADOR DE AGUA TERMOTANQUE"),
    (r"\b(HIDRONEUMATICO|SISTEMA\s+HIDRONEUMATICO)\b", "SISTEMA HIDRONEUMATICO BOMBA DE AGUA"),
    (r"\b(CISTERNA|TANQUE\s+SUBTERRANEO)\b", "TANQUE SUBTERRANEO DE AGUA CISTERNA"),
    (r"\bTANQUE\s+ELEVADO\b", "TANQUE ELEVADO DE AGUA"),
    (r"\b(SIFON|TRAMPA\s+SIFONICA)\b", "SIFON TRAMPA SANITARIA"),
    (r"\b(BAJANTE|MONTANTE\s+DE\s+DESAGUE)\b", "TUBERIA VERTICAL BAJANTE DE AGUAS SERVIDAS"),
    (r"\b(AA\.CC\.|AACC)\b", "AGUAS CLARAS"),
    (r"\b(AA\.SS\.|AASS)\b", "AGUAS SERVIDAS"),
    (r"\b(AA\.NN\.|AANN)\b", "AGUAS NEGRAS"),
    (r"\b(AA\.LL\.|AALL)\b", "AGUAS DE LLUVIA"),
    (r"\bAGUA(S)?\s+FRIA(S)?\b", "AGUAS CLARAS AGUA FRIA"),
    (r"\bAGUA(S)?\s+BLANCA(S)?\b", "AGUAS CLARAS AGUAS BLANCAS"),
    (r"\bAGUA(S)?\s+POTABLE(S)?\b", "AGUAS CLARAS AGUA POTABLE"),
    (r"\bAGUA(S)?\s+CALIENTE(S)?\b", "AGUAS CLARAS AGUA CALIENTE"),
    (r"\bAGUA(S)?\s+NEGRA(S)?\b", "AGUAS SERVIDAS AGUAS NEGRAS"),
    (r"\bAGUA(S)?\s+RESIDUAL(ES)?\b", "AGUAS SERVIDAS AGUAS RESIDUALES"),
    (r"\bAGUA(S)?\s+DE\s+LLUVIA(S)?\b", "AGUAS DE LLUVIA AGUAS PLUVIALES"),
    (r"\bAGUA(S)?\s+PLUVIAL(ES)?\b", "AGUAS DE LLUVIA AGUAS PLUVIALES"),
    
    # 2. Concreto y Estructuras (Obras Civiles)
    (r"\b(CONCRETO\s+)?(F'?C\s*=?\s*210(\s*KG/?CM2)?|210\s*KG/?CM2)\b", "CONCRETO F'C 210 KG/CM2"),
    (r"\b(CONCRETO\s+)?(F'?C\s*=?\s*250(\s*KG/?CM2)?|250\s*KG/?CM2)\b", "CONCRETO F'C 250 KG/CM2"),
    (r"\b(CONCRETO\s+)?(F'?C\s*=?\s*280(\s*KG/?CM2)?|280\s*KG/?CM2)\b", "CONCRETO F'C 280 KG/CM2"),
    (r"\b(CONCRETO\s+POBRE|F'?C\s*=?\s*100(\s*KG/?CM2)?|100\s*KG/?CM2)\b", "CONCRETO SIMPLE F'C 100 KG/CM2"),
    (r"\b(CONCRETO\s+)?PREMEZCLADO\b", "CONCRETO PREMEZCLADO ELABORADO EN PLANTA MIXER"),
    (r"\b(CONCRETO\s+)?(HECHO\s+EN\s+OBRA|VACIADO\s+EN\s+OBRA|EN\s+SITIO|CON\s+TROMPO|CON\s+MEZCLADORA|MEZCLADO\s+CON\s+TROMPO)\b", "CONCRETO PREPARADO EN EL SITIO"),
    (r"\b(M-?150|MORTERO\s+150)\b", "MORTERO CEMENTO ARENA 1:4 RESISTENCIA 150 KG/CM2"),
    (r"\bCABILLA\s*#?\s*3\b", "ACERO DE REFUERZO CABILLAS DIAMETRO 3/8\" (9.5 MM)"),
    (r"\bCABILLA\s*#?\s*4\b", "ACERO DE REFUERZO CABILLAS DIAMETRO 1/2\" (12.7 MM)"),
    (r"\bCABILLA\s*#?\s*5\b", "ACERO DE REFUERZO CABILLAS DIAMETRO 5/8\" (15.9 MM)"),
    (r"\bCABILLA\s*#?\s*6\b", "ACERO DE REFUERZO CABILLAS DIAMETRO 3/4\" (19.1 MM)"),
    (r"\bCABILLA\s*#?\s*8\b", "ACERO DE REFUERZO CABILLAS DIAMETRO 1\" (25.4 MM)"),
    (r"\bESTRIBOS?\s*(DE\s*)?(3/8\"?|#3)\"?", "ACERO DE REFUERZO CABILLAS PARA ESTRIBOS D=3/8\""),
    (r"\b(FY\s*=?\s*4200(\s*KG/?CM2)?|GRADO\s+60)\b", "ACERO DE REFUERZO FY 4200 KG/CM2 GRADO 60"),
    (r"\b(TRUCKSON|ELECTROSOLDADA)\b", "MALLA ELECTROSOLDADA TRUCKSON"),
    (r"\bCONDUVEN\b", "PERFIL TUBULAR ESTRUCTURAL CONDUVEN"),
    (r"\b(SIKA\s*1)\b", "ADITIVO IMPERMEABILIZANTE SIKA 1"),
    (r"\b(SIKA\s*3)\b", "ADITIVO ACELERANTE SIKA 3"),
    (r"\bFORMALETA\b", "ENCOFRADO METALICO O DE MADERA"),
    (r"\bAPUNTALAMIENTO\b", "APUNTALAMIENTO METALICO O DE MADERA PARA ENCOFRADO"),
    
    # 3. Albañilería, Tabiquería y Acabados
    (r"\b(DRYWALL|DURLOCK|TABLAYESO|GYPLAC)\b", "TABIQUERIA LAMINA DE YESO DRYWALL"),
    (r"\b(PLYCEM|SUPERBOARD)\b", "LAMINA DE FIBROCEMENTO"),
    (r"\b(CARATEO|FRAGUA|BOQUILLA)\b", "CARATEO LECHADA DE CEMENTO PARA JUNTAS"),
    (r"\b(PEGA\s+PARA\s+CERAMICA|BONDEX|PEGACOLE)\b", "PEGA PARA CERAMICA BONDEX PEGACOLE MORTERO ADHESIVO"),
    (r"\b(TARRAJEO|REVOQUE|PAÑETE)\b", "FRISO MORTERO CEMENTO ARENA"),
    (r"\b(ESTUCO|PASTA\s+PROFESIONAL)\b", "PASTA PROFESIONAL PARA PAREDES / ESTUCO"),
    (r"\b(PINTURA\s+DE\s+CAUCHO|PINTURA\s+LATEX)\b", "PINTURA DE CAUCHO LATEX"),
    (r"\b(PINTURA\s+DE\s+ACEITE|ESMALTE\s+ALQUIDICO)\b", "PINTURA ESMALTE ALQUIDICO DE ACEITE"),
    (r"\b(EPOXICA|EPOXICO)\b", "PINTURA ESMALTE EPOXICA DE DOS COMPONENTES"),
    (r"\b(ALQUITRAN|MANTO\s+ASFALTICO)\b", "MANTO ASFALTICO IMPERMEABILIZANTE"),
    (r"\b(PERFIL\s+OMEGA|CANALETA\s+DRYWALL)\b", "PERFIL METALICO MONTANTE CANAL PARA DRYWALL"),
    
    # 4. Instalaciones Eléctricas
    (r"\b(EMT|CONDULET)\b", "TUBERIA METALICA ELECTRICA EMT"),
    (r"\b(CABLE\s+|CONDUCTOR\s+)?(THW|THHN|TTU)\b", "CABLE CONDUCTOR DE COBRE AISLADO"),
    (r"\b(CAJA\s+OCTOGONAL|CAJA\s+4X4)\b", "CAJA METALICA ELECTRICA OCTOGONAL 4X4"),
    (r"\b(CAJA\s+RECTANGULAR|CAJA\s+4X2)\b", "CAJA METALICA ELECTRICA RECTANGULAR 4X2"),
    (r"\b(PUNTO\s+(ELECTRICO\s+)?)?(TOMACORRIENTE|ENCHUFE)\b", "PUNTO ELECTRICO TOMACORRIENTE"),
    (r"\b(PUESTA\s+A\s+TIERRA|COPPERWELD|VARILLA\s+DE\s+TIERRA)\b", "SISTEMA DE PUESTA A TIERRA CON ELECTRODO DE COBRE COPPERWELD"),
    (r"\b(TABLERO\s+PRINCIPAL|SUBTABLERO)\b", "TABLERO ELECTRICO CON INTERRUPTORES TERMOMAGNETICOS"),
    (r"\bACOMETIDA\s+ELECTRICA\b", "ACOMETIDA ELECTRICA SUBTERRANEA O AEREA"),
    
    # 5. Maquinaria y Movimiento de Tierras
    (r"\b(PATROL|MOTONIVELADORA)\b", "MOTONIVELADORA PATROL"),
    (r"\b(PAYLOADER|PALA\s+CARGADORA)\b", "CARGADOR FRONTAL SOBRE RUEDAS PAYLOADER"),
    (r"\b(RETRO|RETROEXCAVADORA)\b", "RETROEXCAVADORA TRACTOR CON PALA"),
    (r"\bBOBCAT\b", "MINICARGADOR FRONTAL BOBCAT"),
    (r"\bVOLQUETA\b", "CAMION VOLTEO"),
    (r"\b(MIXER|CAMION\s+MIXER)\b", "CAMION HORMIGONERA MIXER"),
    (r"\bTROMPO\b", "MEZCLADORA DE CONCRETO TROMPO"),
    (r"\b(BAILARINA|CANGURO)\b", "COMPACTADOR DE IMPACTO PISON"),
    (r"\b(PATA\s+DE\s+CABRA|RODILLO\s+PATA\s+DE\s+CABRA)\b", "RODILLO COMPACTADOR PATA DE CABRA"),
    (r"\b(RODILLO\s+LISO|VIBROCOMPACTADOR)\b", "RODILLO VIBRATORIO LISO"),
    (r"\b(MARTILLO\s+DEMOLEDOR|MARTILLO\s+HIDRAULICO)\b", "MARTILLO DEMOLEDOR HIDRAULICO O NEUMATICO"),
    (r"\b(D6|D7|D8)\b", "TRACTOR DE ORUGAS BULLDOZER"),
    
    # 6. Topografía y Geotecnia
    (r"\b(ESTACION\s+TOTAL)\b", "EQUIPO DE TOPOGRAFIA ESTACION TOTAL"),
    (r"\bTEODOLITO\b", "TEODOLITO INSTRUMENTO TOPOGRAFICO"),
    (r"\b(NIVEL\s+TOPOGRAFICO|EQUIPO\s+DE\s+NIVEL)\b", "NIVEL OPTICO TOPOGRAFICO"),
    (r"\b(REPLANTEO|TRAZO\s+Y\s+REPLANTEO)\b", "TRAZO Y REPLANTEO TOPOGRAFICO CON ESTACAS"),
    (r"\b(ESTUDIO\s+DE\s+SUELOS?\s+(CON\s+)?)?(ENSAYO\s+)?SPT\b", "ESTUDIO DE SUELOS ENSAYO DE PENETRACION ESTANDAR SPT"),
    
    # 7. Seguridad y Protección de Obra
    (r"\b(EXTINTOR\s+PQS|EXTINTOR\s+CO2)\b", "EXTINTOR DE INCENDIOS POLVO QUIMICO SECO PQS O CO2"),
    (r"\b(SEÑALIZACION\s+VIAL|SEÑALIZACION\s+DE\s+SEGURIDAD)\b", "SEÑALIZACION PREVENTIVA DE SEGURIDAD INDUSTRIAL Y VIAL"),
    (r"\b(MALLA\s+DE\s+SEGURIDAD|CERRAMIENTO\s+PROVISIONAL)\b", "CERRAMIENTO PROVISIONAL CON MALLA O LONA DE SEGURIDAD"),
    (r"\bEPP\b", "EQUIPOS DE PROTECCION PERSONAL EPP"),
]

_COMPILED_SYNONYMS: List[Tuple[re.Pattern, str]] = [
    (re.compile(pattern, re.IGNORECASE), replacement)
    for pattern, replacement in TECHNICAL_SYNONYMS
]

# Reglas de normalización de espaciado técnico-dimensional
DIMENSION_SPACING_RULES: List[Tuple[str, str]] = [
    # 1. Fracciones o enteros/decimales seguidos de pulgadas: 1/2", 1 1/2", 3/4 pulg, 2"
    (r'(?i)(\b\d+(?:[.,]\d+)?\s*[-/]\s*\d+|\b\d+(?:[.,]\d+)?)\s*(["”]|pulg(?:adas?)?|plg\b)', r'\1 "'),
    # 2. Milímetros, centímetros, metros
    (r'(?i)(\b\d+(?:[.,]\d+)?)\s*(mm|cm|mts?|ml)\b', r'\1 \2'),
    # 3. Resistencia concreto kg/cm2, kgf/cm2, mpa, psi
    (r'(?i)(\b\d+(?:[.,]\d+)?)\s*(kg/?cm2|kgf/?cm2|mpa|psi|bar)\b', r'\1 \2'),
    # 4. Presión nominal PN y SDR: PN16 -> PN 16, SDR11 -> SDR 11
    (r'(?i)\b(pn|sdr)\s*(\d+(?:[.,]\d+)?)\b', r'\1 \2'),
    # 5. Eléctrico: V, KV, A, AMP, HP, KW, KVA, HZ
    (r'(?i)(\b\d+(?:[.,]\d+)?)\s*(v|kv|volt(?:ios?)?|a|amp(?:erios?)?|hp|kw|kva|hz)\b', r'\1 \2'),
    # 6. Calibre AWG: 12awg -> 12 awg
    (r'(?i)(\b\d+)\s*(awg)\b', r'\1 \2'),
    # 7. Peso: kg, ton, gr
    (r'(?i)(\b\d+(?:[.,]\d+)?)\s*(kg|ton|tn|gr)\b', r'\1 \2'),
    # 8. Área y volumen: m2, m3
    (r'(?i)(\b\d+(?:[.,]\d+)?)\s*(m2|m²|m3|m³)\b', r'\1 \2'),
    # 9. Dimensiones compuestas triples y dobles con unidades compartidas
    (r'(?i)\b(\d+(?:\s*[-/]\s*\d+)?)\s*[xX]\s*(\d+(?:\s*[-/]\s*\d+)?)\s*[xX]\s*(\d+(?:\s*[-/]\s*\d+)?)\s*(?:pulg(?:adas?)?|plg|[\"”])\b', r'\1" x \2" x \3"'),
    (r'(?i)\b(\d+(?:\s*[-/]\s*\d+)?)\s*[xX]\s*(\d+(?:\s*[-/]\s*\d+)?)\s*(?:pulg(?:adas?)?|plg|[\"”])\b', r'\1" x \2"'),
    (r'(?i)\b(\d+(?:[.,]\d+)?)\s*[xX]\s*(\d+(?:[.,]\d+)?)\s*[xX]\s*(\d+(?:[.,]\d+)?)\s*mm\b', r'\1 mm x \2 mm x \3 mm'),
    (r'(?i)\b(\d+(?:[.,]\d+)?)\s*[xX]\s*(\d+(?:[.,]\d+)?)\s*mm\b', r'\1 mm x \2 mm'),
    (r'(?i)\b(\d+(?:[.,]\d+)?)\s*[xX]\s*(\d+(?:[.,]\d+)?)\s*[xX]\s*(\d+(?:[.,]\d+)?)\s*cm\b', r'\1 cm x \2 cm x \3 cm'),
    (r'(?i)\b(\d+(?:[.,]\d+)?)\s*[xX]\s*(\d+(?:[.,]\d+)?)\s*cm\b', r'\1 cm x \2 cm'),
    (r'(?i)\b(\d+)\s*[xX]\s*(\d+)\s*[xX]\s*(\d+(?:[.,]\d+)?)\b', r'\1 x \2 x \3'),
    (r'(?i)\b(\d+)\s*[xX]\s*(\d+)\b', r'\1 x \2'),
]

_COMPILED_SPACING_RULES: List[Tuple[re.Pattern, str]] = [
    (re.compile(pat), rep) for pat, rep in DIMENSION_SPACING_RULES
]


def normalize_dimension_spacing(text: str) -> str:
    """
    Normaliza el espaciado entre magnitudes numéricas y unidades de ingeniería
    (ej. '20mm' -> '20 mm', '1/2"' -> '1/2 "', '210kg/cm2' -> '210 kg/cm2')
    para garantizar coincidencia exacta en PostgreSQL FTS (tsvector/tsquery).
    """
    if not text or not isinstance(text, str):
        return ""

    try:
        res = text
        for pattern, rep in _COMPILED_SPACING_RULES:
            res = pattern.sub(rep, res)
        return res
    except Exception as exc:
        logger.error("Error al normalizar espaciado dimensional en texto '%s': %s", text, exc, exc_info=True)
        return text


def expand_technical_synonyms(query: str) -> str:
    """
    Expande siglas técnicas, términos comerciales y normaliza espaciado dimensional
    dentro de una consulta de usuario para maximizar el recall en RAG y FTS.
    """
    if not query or not isinstance(query, str):
        return ""

    try:
        # Paso 1: Normalización de espaciado numérico-dimensional
        expanded = normalize_dimension_spacing(query)

        # Paso 2: Expansión de sinónimos técnicos COVENIN
        for pattern, replacement in _COMPILED_SYNONYMS:
            if pattern.search(expanded):
                if replacement.lower() not in expanded.lower():
                    expanded = pattern.sub(replacement, expanded)
        return expanded
    except Exception as exc:
        logger.error("Error al expandir sinónimos técnicos en query '%s': %s", query, exc, exc_info=True)
        return query

