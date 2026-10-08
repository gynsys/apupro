import re
from typing import Any, Dict, List, Set
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.core.logging import logger
from app.db.models.cost360 import CostItem
from app.services.ai_apu_service.rag_context.base_apu_fetcher import fetch_base_apu_for_prompt
from app.services.ai_apu_service.rag_context.pruning import _prune_apu_for_prompt


SECONDARY_ACTIVITY_PATTERNS: Dict[str, Dict[str, Any]] = {
    "bote_transporte": {
        "pattern": r"\b(bote|transporte|acarreo|botadero|escombros?)\b",
        "search_keywords": "transporte bote escombros camión volteo",
        "key_insumo_pattern": r"\b(camion|volqueta|volteo|cami[oó]n|flete)\b",
        "insumo_types": ["equipos"],
    },
    "friso_revoque": {
        "pattern": r"\b(friso|frisad[oa]|revoque|pañete|enlucido)\b",
        "search_keywords": "friso mortero acabado paredes",
        "key_insumo_pattern": r"\b(mortero|cemento|arena|frisat|pañet|enlucid|frisad)\b",
        "insumo_types": ["materiales", "mano_obra"],
    },
    "pintura": {
        "pattern": r"\b(pintura|pintad[oa]|esmalte)\b",
        "search_keywords": "pintura caucho esmalte paredes",
        "key_insumo_pattern": r"\b(pintura|esmalte|caucho|solvente|rodillo|brocha|pintor)\b",
        "insumo_types": ["materiales", "mano_obra"],
    },
    "acero_malla": {
        "pattern": r"\b(malla|electrosoldada|truckson|cabillas?|acero de refuerzo)\b",
        "search_keywords": "malla electrosoldada acero refuerzo",
        "key_insumo_pattern": r"\b(malla|electrosoldada|truckson|cabilla|acero|alambre)\b",
        "insumo_types": ["materiales"],
    },
    "machones_dinteles": {
        "pattern": r"\b(machon(es)?|dintel(es)?|viga(s)? de corona)\b",
        "search_keywords": "machones dinteles concreto arriostramiento",
        "key_insumo_pattern": r"\b(machon|dintel|viga corona|concreto|encofrad)\b",
        "insumo_types": ["materiales", "equipos"],
    },
    "encofrado": {
        "pattern": r"\b(encofrado|formaleta|apuntalamiento)\b",
        "search_keywords": "encofrado madera metalico",
        "key_insumo_pattern": r"\b(encofrad|formaleta|tablon|madera|puntale)\b",
        "insumo_types": ["materiales", "equipos"],
    },
    "impermeabilizacion": {
        "pattern": r"\b(impermeabilizad[oa]|manto asfaltico|impermeabilizante)\b",
        "search_keywords": "impermeabilizacion manto asfaltico",
        "key_insumo_pattern": r"\b(manto|impermeable|asfaltic|emulsion|sikaflex)\b",
        "insumo_types": ["materiales"],
    },
    "demolicion": {
        "pattern": r"\b(demolicion|demolici[oó]n|demolid[oa]|pica|tumbar|repicad[oa]|escarificad[oa]|escarificaci[oó]n)\b",
        "search_keywords": "demolicion pica",
        "key_insumo_pattern": r"\b(pica|mazo|combo|demoled|compresor|martillo)\b",
        "insumo_types": ["equipos", "mano_obra"],
    },
    "escarificacion_picado": {
        "pattern": r"\b(escarificad[oa]|escarificaci[oó]n|picad[oa]|repicad[oa]|cincelad[oa]|desconchado)\b",
        "search_keywords": "repicado friso",
        "key_insumo_pattern": r"\b(repicad|picad|cincel|martillo|rotomartillo|demoled|compresor|escarific)\b",
        "insumo_types": ["equipos", "mano_obra"],
    },
    "rapel_trabajos_verticales": {
        "pattern": r"\b(rapel|r[aá]pel|cuerdas?|silletas?|gu[ií]ndolas?|trabajos?\s+vertical(es)?|trabajo\s+suspendido)\b",
        "search_keywords": "rapel fachadas",
        "key_insumo_pattern": r"\b(rapel|silleta|arn[eé]s|cuerda|linea de vida|l[ií]nea de vida|seg020|seg021)\b",
        "insumo_types": ["equipos"],
    },
    "hidrojet_lavado": {
        "pattern": r"\b(hidrojet|hidrolavad[oa]|hidrolavadora|lavado\s+a\s+presi[oó]n|lavado\s+con\s+presi[oó]n)\b",
        "search_keywords": "hidrojet",
        "key_insumo_pattern": r"\b(hidrojet|hidrolavad|presi[oó]n|bomba)\b",
        "insumo_types": ["equipos", "mano_obra"],
    },
    "soldadura_metalica": {
        "pattern": r"\b(soldadura|soldad[oa]|electrodos?|oxiacetilen[oa])\b",
        "search_keywords": "soldadura",
        "key_insumo_pattern": r"\b(soldad|electrodo|oxiacetilen|careta|generador)\b",
        "insumo_types": ["materiales", "equipos", "mano_obra"],
    },
    "limpieza_desmanchado": {
        "pattern": r"\b(limpieza|desmanchad[oa]|desengrase|qu[ií]mico\s+de\s+limpieza)\b",
        "search_keywords": "limpieza superficies",
        "key_insumo_pattern": r"\b(limpieza|desmanch|qu[ií]mic|cepillo|acido)\b",
        "insumo_types": ["materiales", "mano_obra", "equipos"],
    },
    "excavacion": {
        "pattern": r"\b(excavacion|excavaci[oó]n|excavad[oa]|zanja)\b",
        "search_keywords": "excavacion zanja",
        "key_insumo_pattern": r"\b(excavad|retroexcavad|pala|zanja|pico)\b",
        "insumo_types": ["equipos", "mano_obra"],
    },
    "tratamiento_oxido_fondo": {
        "pattern": r"\b(fondo\s+anticorrosivo|anticorrosiv[oa]|desoxidad[oa]|remoci[oó]n\s+de\s+[oó]xido|eliminar\s+[oó]xido|minio|minio\s+de\s+plomo)\b",
        "search_keywords": "fondo anticorrosivo",
        "key_insumo_pattern": r"\b(fondo|anticorrosiv|minio|desoxidad|solvente|thinner|brocha|cepillo)\b",
        "insumo_types": ["materiales", "mano_obra"],
    },
    "sellado_juntas": {
        "pattern": r"\b(sellado|sellad[oa]|silic[oó]n|poliuretano|calafateo|junta\s+de\s+dilataci[oó]n)\b",
        "search_keywords": "sellado juntas",
        "key_insumo_pattern": r"\b(silic|poliuretano|sellad|pistola|cordon|fondo)\b",
        "insumo_types": ["materiales", "mano_obra"],
    },
    "pruebas_hidrostaticas": {
        "pattern": r"\b(prueba\s+hidrost[aá]tica|prueba\s+de\s+presi[oó]n|desinfecci[oó]n\s+de\s+tuber[ií]a)\b",
        "search_keywords": "prueba hidrostatica tuberia",
        "key_insumo_pattern": r"\b(bomba\s+de\s+prueba|man[oó]metro|prueba|presi[oó]n)\b",
        "insumo_types": ["equipos", "mano_obra"],
    },
}


def _extract_surgical_insumos(
    comp_apu: Dict[str, Any],
    act_config: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Extrae SOLO los insumos relevantes para la actividad accesoria faltante.

    En lugar de enviar el APU complementario completo (cuadrilla entera, todos los materiales),
    filtra solo los insumos cuyo nombre coincide con `key_insumo_pattern` de la actividad.

    Ejemplo: para `bote_transporte`, solo extrae el equipo "Camión de volteo",
    ignorando cuadrilla de albañiles, escaleras, etc. que ya están en la base.

    Retorna un dict con estructura igual a la salida de `_prune_apu_for_prompt` pero
    con solo los insumos quirúrgicos. Retorna {} si no encuentra ninguno.
    """
    if not comp_apu or not act_config:
        return {}

    key_pat = act_config.get("key_insumo_pattern")
    insumo_types: List[str] = act_config.get("insumo_types", ["materiales", "equipos", "mano_obra"])

    if not key_pat:
        return {}

    mat_keys: List[str] = ["codigo", "descripcion", "unidad", "cantidad", "precio_unitario"]
    eq_keys: List[str] = ["codigo", "descripcion", "cantidad", "depreciacion", "precio_unitario"]
    mo_keys: List[str] = ["codigo", "descripcion", "cantidad", "jornal", "bono"]

    def _filter_insumos(insumos: List[Dict[str, Any]], keys: List[str]) -> List[Dict[str, Any]]:
        filtered_result: List[Dict[str, Any]] = []
        for ins in insumos:
            if not isinstance(ins, dict):
                continue
            desc = str(ins.get("descripcion") or "").upper()
            if re.search(key_pat, desc, re.IGNORECASE):
                cleaned: Dict[str, Any] = {}
                for k in keys:
                    v = ins.get(k)
                    if v is None:
                        continue
                    if isinstance(v, float):
                        v = round(v, 6 if k == "depreciacion" else 4)
                        if v == 0.0 and k not in ("precio_unitario", "jornal", "bono", "depreciacion"):
                            continue
                    if isinstance(v, str) and not v.strip():
                        continue
                    cleaned[k] = v
                if cleaned:
                    filtered_result.append(cleaned)
        return filtered_result

    surgical: Dict[str, Any] = {
        "codpar":      comp_apu.get("codpar"),
        "descripcion": comp_apu.get("descripcion"),
        "unidad":      comp_apu.get("unidad"),
        "rendimiento": round(float(comp_apu.get("rendimiento") or 1.0), 4),
    }

    if "materiales" in insumo_types:
        mats = _filter_insumos(comp_apu.get("materiales", []), mat_keys)
        if mats:
            surgical["materiales"] = mats

    if "equipos" in insumo_types:
        eqs = _filter_insumos(comp_apu.get("equipos", []), eq_keys)
        if eqs:
            surgical["equipos"] = eqs

    if "mano_obra" in insumo_types:
        mos = _filter_insumos(comp_apu.get("mano_obra", []), mo_keys)
        if mos:
            surgical["mano_obra"] = mos

    # Validar que al menos un tipo de insumo fue extraído
    has_insumos = any(
        surgical.get(t) for t in ("materiales", "equipos", "mano_obra")
    )
    if not has_insumos:
        logger.debug(
            "[SurgicalExtract] No se encontraron insumos clave para '%s' en APU %s. Patrón: %s",
            act_config.get('search_keywords', ''),
            comp_apu.get('codpar'),
            key_pat
        )
        return {}

    return surgical


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
                    'AND length("Descri") >= 20 '
                    'ORDER BY length("Descri") ASC LIMIT 1'
                )
                row = db.execute(sql, {"kw1": f"%{kw}%", "kw2": f"%{kw2}%", "base_cod": base_cod}).fetchone()
                if not row and kw != kw2:
                    sql_single = text(
                        'SELECT "CodPar" FROM cost360_items '
                        'WHERE "Descri" ILIKE :kw1 '
                        'AND "CodPar" != :base_cod '
                        'AND length("Descri") >= 20 '
                        'ORDER BY length("Descri") ASC LIMIT 1'
                    )
                    row = db.execute(sql_single, {"kw1": f"%{kw}%", "base_cod": base_cod}).fetchone()
                if row:
                    matched_item = db.query(CostItem).filter(CostItem.CodPar == row.CodPar).first()
            except Exception as e_search:
                logger.error("Error buscando partida complementaria para %s: %s", act_name, e_search, exc_info=True)

        if matched_item:
            matched_cod = str(matched_item.CodPar).upper()
            matched_cov = str(matched_item.CovPar or "")[:4].upper()
            comp_apu = fetch_base_apu_for_prompt(db, matched_item.CodPar)
            if comp_apu:
                # Inyección quirúrgica — solo los insumos relevantes para la actividad faltante
                surgical_apu = _extract_surgical_insumos(comp_apu, act_config)
                if surgical_apu:
                    selected_apus.append(surgical_apu)
                else:
                    # Fallback: APU completo podado si no hay insumos clave identificables
                    selected_apus.append(_prune_apu_for_prompt(comp_apu))
                used_cods.add(matched_cod)
                if matched_cov:
                    used_cov_prefixes.add(matched_cov)

    return selected_apus
