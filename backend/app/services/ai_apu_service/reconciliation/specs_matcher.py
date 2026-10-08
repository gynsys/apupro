import re
from typing import Dict, Optional, Set, Tuple


_RECONCILE_STOPWORDS: Set[str] = {
    "DE", "LA", "EL", "EN", "PARA", "CON", "UN", "UNA", "Y", "O", "A", "LOS", "LAS",
    "DEL", "AL", "E", "POR", "SIN", "SOBRE", "TIPO", "USO", "CAPACIDAD", "ESTANDAR",
    "MANUAL", "ALBAÑILERIA", "ALBANILERIA", "USOS", "VARIOS", "GENERAL", "INCLUYE",
    "SEGUN", "SEGÚN", "D=", "E="
}

_ACCESSORY_PREFIXES: Set[str] = {
    "ANCLAJE", "SOPORTE", "BASE", "TAPA", "MARCO", "ABRAZADERA", "PERNO",
    "TORNILLO", "KIT", "JUEGO", "MESA", "SILLA", "TABLERO", "CAJA",
    "GABINETE", "VALVULA", "FLOTANTE", "CONEXION", "NIPLE"
}


def _extract_technical_specs(text_str: str) -> Dict[str, Set[str]]:
    """
    Extrae especificaciones técnicas clave (HP, pulgadas/diámetro, kVA, BTU, mm, galones)
    para evitar reconciliaciones incompatibles (ej. 1 HP vs 2 HP, 1" vs 2", 15 kVA vs 50 kVA).
    """
    clean = text_str.upper()
    specs: Dict[str, Set[str]] = {
        "hp": set(),
        "inches": set(),
        "kva": set(),
        "btu": set(),
        "mm": set(),
        "gallons": set(),
    }

    # HP (ej. 1 HP, 0.5 HP, 2 HP, 1/2 HP, 3/4 HP)
    for m in re.finditer(r'(?:^|[^0-9A-Z])(\d+(?:[.,]\d+)?|\d+/\d+)\s*(?:HP|C\.?P\.?)(?:\b|$|[^0-9A-Z])', clean):
        specs["hp"].add(m.group(1).replace(",", "."))

    # Pulgadas (ej. 1", 2", 1/2", 3/4", 1 1/2", 1-1/2")
    for m in re.finditer(r'(?:^|[^0-9A-Z])(\d+/\d+|\d+(?:[.,]\d+)?)\s*(?:"|\'\'|PULG|PULGADAS)(?:\b|$|[^0-9A-Z])', clean):
        specs["inches"].add(m.group(1).replace(",", "."))

    # kVA
    for m in re.finditer(r'(?:^|[^0-9A-Z])(\d+(?:[.,]\d+)?)\s*KVA(?:\b|$|[^0-9A-Z])', clean):
        specs["kva"].add(m.group(1).replace(",", "."))

    # BTU
    for m in re.finditer(r'(?:^|[^0-9A-Z])(\d+(?:[.,]\d+)?)\s*(?:BTU|TR|TON)(?:\b|$|[^0-9A-Z])', clean):
        specs["btu"].add(m.group(1).replace(",", "."))

    # Milímetros (diámetros o medidas)
    for m in re.finditer(r'(?:^|[^0-9A-Z])(\d+)\s*MM(?:\b|$|[^0-9A-Z])', clean):
        specs["mm"].add(m.group(1))

    # Galones
    for m in re.finditer(r'(?:^|[^0-9A-Z])(\d+)\s*(?:GAL|GALONES|GLN)(?:\b|$|[^0-9A-Z])', clean):
        specs["gallons"].add(m.group(1))

    return specs


def _has_technical_spec_conflict(specs_a: Dict[str, Set[str]], specs_b: Dict[str, Set[str]]) -> bool:
    """
    Determina si dos descripciones tienen especificaciones incompatibles explícitas
    (ej: una dice 1 HP y la otra 2 HP, o una dice 1" y la otra 2").
    """
    for key in ("hp", "inches", "kva", "btu", "mm", "gallons"):
        vals_a = specs_a.get(key, set())
        vals_b = specs_b.get(key, set())
        if vals_a and vals_b and not (vals_a & vals_b):
            return True
    return False


def _has_primary_noun_conflict(desc_query: str, desc_candidate: str) -> bool:
    """
    Evita que un accesorio o parte secundaria sea confundido con el equipo principal
    (ej: que 'ANCLAJE P/TANQUES' haga match con 'TANQUE HIDRONEUMATICO',
     o que 'MESA DE REUNION' haga match con 'UNIONES').
    """
    clean_q = re.sub(r'[^A-Z0-9\s]', ' ', desc_query.upper())
    clean_c = re.sub(r'[^A-Z0-9\s]', ' ', desc_candidate.upper())

    tokens_q = [w for w in clean_q.split() if len(w) >= 3 and w not in _RECONCILE_STOPWORDS]
    tokens_c = [w for w in clean_c.split() if len(w) >= 3 and w not in _RECONCILE_STOPWORDS]

    if not tokens_q or not tokens_c:
        return False

    first_q = tokens_q[0]
    first_c = tokens_c[0]

    # Si el candidato empieza con un accesorio (ANCLAJE, SOPORTE, BASE, TAPA) y la consulta no lo pidió:
    if first_c in _ACCESSORY_PREFIXES and first_c not in tokens_q and first_q not in _ACCESSORY_PREFIXES:
        return True

    # Si el candidato empieza con una categoría ajena (ej. MESA) y la consulta busca conexiones/uniones:
    if first_c == "MESA" and "MESA" not in tokens_q:
        return True

    return False


def _normalize_unit(unit_str: Optional[str]) -> str:
    """
    Normaliza strings de unidades de medida (ej: 'MTS' -> 'm', 'm³' -> 'm3', 'sacos' -> 'saco').
    """
    if not unit_str or not isinstance(unit_str, str):
        return ""
    u = unit_str.strip().lower()
    u = re.sub(r'[\.²³]', lambda m: {'²': '2', '³': '3', '.': ''}.get(m.group(0), ''), u)
    u = u.replace(" ", "")

    synonyms: Dict[str, str] = {
        "m": "m", "ml": "m", "mts": "m", "metro": "m", "metros": "m",
        "m2": "m2", "mts2": "m2", "mt2": "m2",
        "m3": "m3", "mts3": "m3", "mt3": "m3",
        "kg": "kg", "kgs": "kg", "kilogramo": "kg", "kilogramos": "kg", "kilo": "kg", "kilos": "kg", "kgf": "kg",
        "ton": "ton", "tonelada": "ton", "toneladas": "ton", "tn": "ton",
        "saco": "saco", "sacos": "saco", "sc": "saco", "bto": "saco", "bulto": "saco", "bultos": "saco",
        "l": "l", "lt": "l", "lts": "l", "litro": "l", "litros": "l",
        "gal": "gal", "gln": "gal", "galon": "gal", "galones": "gal",
        "cunete": "cunete", "cuñete": "cunete", "cunetes": "cunete", "cuñetes": "cunete",
        "und": "und", "unid": "und", "unidad": "und", "unidades": "und", "pza": "und", "piezas": "und", "pieza": "und",
        "rollo": "rollo", "rollos": "rollo", "rll": "rollo",
        "caja": "caja", "cajas": "caja",
        "par": "par", "pares": "par",
        "jgo": "jgo", "juego": "jgo", "juegos": "jgo", "kit": "jgo",
        "pto": "pto", "punto": "pto", "puntos": "pto",
        "dia": "dia", "día": "dia", "dias": "dia", "días": "dia",
        "mes": "mes", "meses": "mes",
        "vje": "vje", "viaje": "vje", "viajes": "vje", "flete": "vje",
    }
    return synonyms.get(u, u)


def _convert_material_quantity(
    qty: float,
    from_unit_raw: str,
    to_unit_raw: str,
    mat_desc: str
) -> Tuple[Optional[float], bool]:
    """
    Convierte una cantidad de material entre dos unidades compatibles.
    Retorna (nueva_cantidad, True) si son compatibles y se pudo convertir.
    Retorna (None, False) si son dimensionalmente incompatibles (ej: m2 vs kg).
    """
    u_from = _normalize_unit(from_unit_raw)
    u_to = _normalize_unit(to_unit_raw)
    desc_upper = (mat_desc or "").upper()

    if not u_from or not u_to:
        return qty, True

    if u_from == u_to:
        return qty, True

    # 1. Cemento (saco = 42.5 kg)
    if "CEMENTO" in desc_upper:
        if u_from == "kg" and u_to == "saco":
            return round(qty / 42.5, 4), True
        if u_from == "saco" and u_to == "kg":
            return round(qty * 42.5, 4), True

    # 2. Yeso o Cal (saco = 20 kg)
    if "YESO" in desc_upper or "CAL" in desc_upper:
        if u_from == "kg" and u_to == "saco":
            return round(qty / 20.0, 4), True
        if u_from == "saco" and u_to == "kg":
            return round(qty * 20.0, 4), True

    # 3. Peso general (ton <-> kg)
    if u_from == "kg" and u_to == "ton":
        return round(qty / 1000.0, 4), True
    if u_from == "ton" and u_to == "kg":
        return round(qty * 1000.0, 4), True

    # 4. Volumen general (m3 <-> l)
    if u_from == "l" and u_to == "m3":
        return round(qty / 1000.0, 4), True
    if u_from == "m3" and u_to == "l":
        return round(qty * 1000.0, 4), True

    # 5. Pinturas y líquidos (cuñete = 5 galones, 1 galón = 3.785 L, cuñete = 18.925 L)
    if any(k in desc_upper for k in ["PINTURA", "ESMALTE", "FONDO", "SOLVENTE", "THINNER", "BARNIZ", "IMPERMEABILIZANTE", "EMULSION", "ADHESIVO", "RESINA"]):
        if u_from == "gal" and u_to == "cunete":
            return round(qty / 5.0, 4), True
        if u_from == "cunete" and u_to == "gal":
            return round(qty * 5.0, 4), True
        if u_from == "l" and u_to == "gal":
            return round(qty / 3.785, 4), True
        if u_from == "gal" and u_to == "l":
            return round(qty * 3.785, 4), True
        if u_from == "l" and u_to == "cunete":
            return round(qty / 18.925, 4), True
        if u_from == "cunete" and u_to == "l":
            return round(qty * 18.925, 4), True

    # 6. Alambre / Manguera / Tubería en rollos típicos (sin especificación clara de longitud)
    if "ROLLO" in u_to or "ROLLO" in u_from:
        return None, False

    # 7. Unidades discretas equivalentes (und / pza)
    if u_from == "und" and u_to == "und":
        return qty, True

    # Incompatibilidad dimensional detectada (ej: m2 vs kg, m3 vs und, m vs kg)
    return None, False
