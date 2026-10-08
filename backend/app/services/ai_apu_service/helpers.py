import re
from typing import Any, Dict, Set


COMMON_CONSTRUCTION_TERMS: Set[str] = {
    "construccion", "suministro", "instalacion", "colocacion", "demolicion",
    "excavacion", "transporte", "limpieza", "bomba", "concreto", "tubo",
    "tuberia", "muro", "viga", "acero", "cable", "pared", "piso", "techo",
    "pintura", "friso", "bloque", "madera", "puerta", "ventana", "reparacion",
    "mantenimiento", "vaciado", "armado", "bancarrote", "acometida", "tablero",
    "carga", "bote", "nivelacion", "compactacion", "replanteo", "impermeabilizacion"
}


def _safe_float(value: Any, default: float = 0.0) -> float:
    """
    Convierte cualquier valor a float de forma segura.
    Maneja strings con coma decimal ('7,5' -> 7.5) que algunos LLMs generan.
    """
    if value is None:
        return default
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        cleaned = value.strip().replace(",", ".")
        try:
            return float(cleaned)
        except ValueError:
            return default
    return default


def _sanitize_llm_numbers(result: Dict[str, Any]) -> None:
    """
    Normaliza in-place todos los campos numéricos del resultado LLM.
    Evita errores ValueError: could not convert string to float: '7,5'
    cuando DeepSeek devuelve números con coma decimal en lugar de punto.
    Modifica `result` directamente, no retorna nada.
    """
    if not isinstance(result, dict):
        return

    num_fields_material: Set[str] = {"cantidad", "desperdicio", "precio_unitario"}
    num_fields_equip: Set[str] = {"cantidad", "depreciacion", "precio_unitario"}
    num_fields_labor: Set[str] = {"cantidad", "jornal", "bono"}
    partida_num_fields: Set[str] = {"performance", "quantity"}

    partida = result.get("partida")
    if isinstance(partida, dict):
        for f in partida_num_fields:
            if f in partida:
                partida[f] = _safe_float(partida[f])
        if "performance" in partida:
            partida["performance"] = max(0.01, float(partida.get("performance") or 1.0))
        if "quantity" in partida:
            partida["quantity"] = max(0.0001, float(partida.get("quantity") or 1.0))

    for mat in result.get("materials", []):
        if isinstance(mat, dict):
            for f in num_fields_material:
                if f in mat:
                    mat[f] = _safe_float(mat[f])
            if "cantidad" in mat:
                mat["cantidad"] = max(0.0, float(mat.get("cantidad") or 0.0))

    for eq in result.get("equipments", []):
        if isinstance(eq, dict):
            for f in num_fields_equip:
                if f in eq:
                    eq[f] = _safe_float(eq[f])
            if "cantidad" in eq:
                eq["cantidad"] = max(0.0, float(eq.get("cantidad") or 0.0))

    for lab in result.get("labors", []):
        if isinstance(lab, dict):
            for f in num_fields_labor:
                if f in lab:
                    lab[f] = _safe_float(lab[f])
            if "cantidad" in lab:
                lab["cantidad"] = max(0.0, float(lab.get("cantidad") or 0.0))


def is_code_input(text: str) -> bool:
    """
    Determina si la entrada del usuario es un código, nomenclatura o identificador solitario
    (ej: E11102235, CMT050, E111120000, E.111.120.000, E111 S/C, 12345) en vez de una descripción técnica de obra.
    """
    if not text or not isinstance(text, str):
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
