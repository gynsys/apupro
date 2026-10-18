import re
import unicodedata
from typing import Any, Dict, List, Set, Tuple
from app.core.logging import logger
from app.services.apu_labor_calibrator import deduplicate_labor_items, normalize_labor_role_key


def _strip_accents(s: str) -> str:
    """Elimina tildes y diacríticos para comparación técnica insensible a acentos."""
    if not s:
        return ""
    nfkd = unicodedata.normalize('NFKD', s)
    return ''.join(c for c in nfkd if not unicodedata.combining(c))


REMOVAL_KEYWORDS: List[str] = [
    r"\bdesmontaje\b",
    r"\bdemolici[oó]n\b",
    r"\bretiro\b",
    r"\bdesinstalaci[oó]n\b",
    r"\bextracci[oó]n\b",
    r"\bdesmantelamiento\b",
    r"\bdesarme\b",
    r"\bdesconexi[oó]n\b"
]

HEAVY_OXY_CUTTING_PATTERNS: List[str] = [
    r"\bOXICORTE\b",
    r"\bEQUIPO\s+DE\s+OXICORTE\b",
    r"\bCILINDRO\s+DE\s+OXIGENO\b",
    r"\bOXIGENO\s+INDUSTRIAL\b",
    r"\bACETILENO\s+INDUSTRIAL\b",
    r"\bCILINDRO\s+DE\s+ACETILENO\b"
]

ASSET_SUPPLY_PATTERNS: List[str] = [
    r"\bBOMBA\s+SUMERGIBLE\b",
    r"\bBOMBA\s+CENTRIFUGA\b",
    r"\bBOMBA\s+DE\s+AGUA\b",
    r"\bELECTROBOMBA\b",
    r"\bMOTOBOMBA\b",
    r"\bCOMPRESOR\b",
    r"\bTRANSFORMADOR\b",
    r"\bGRUPO\s+ELECTROGENO\b",
    r"\bPLANTA\s+ELECTRICA\b",
    r"\bUNIDAD\s+SPLIT\b",
    r"\bCONDENSADORA\b",
    r"\bEVAPORADORA\b",
    r"\bCHILLER\b",
    r"\bFANCOIL\b",
    r"\bAIRE\s+ACONDICIONADO\b",
    r"\bTABLERO\s+ELECTRICO\b",
    r"\bSUBESTACION\b",
    r"\bASCENSOR\b",
    r"\bMONTACARGAS\b"
]


def _is_removal_activity(user_description: str) -> bool:
    """Verifica si la solicitud es una actividad de desmontaje, demolición o retiro."""
    if not user_description or not isinstance(user_description, str):
        return False
    desc_clean = user_description.lower()
    return any(bool(re.search(pat, desc_clean)) for pat in REMOVAL_KEYWORDS)


def _normalize_text_key(text: str) -> str:
    """Normaliza una cadena para comparación y deduplicación estricta."""
    if not text:
        return ""
    clean = re.sub(r'[^A-Za-z0-9]', '', str(text).upper())
    return clean


_PIPE_ACTIVITY_PATTERNS: List[str] = [
    r"\bTUBERIA(S)?\b",
    r"\bTUBO(S)?\s+(?:DE\s+)?(?:PVC|CPVC|PPR|POLIPROPILENO|PEAD|POLIETILENO|HG|HIERRO\s+GALVANIZADO|ACERO\s+GALVANIZADO|HIERRO\s+FUNDIDO|HF|COBRE|CONDUIT|EMT)\b",
    r"\bCONDUIT\b",
    r"\bTUBERIA\s+EMT\b",
    r"\bAGUAS\s+CLARAS\b",
    r"\bAGUAS\s+BLANCAS\b",
    r"\bAGUAS\s+SERVIDAS\b",
    r"\bAGUAS\s+NEGRAS\b",
    r"\bAGUAS\s+RESIDUALES\b",
    r"\bCANALIZACION(ES)?\s+ELECTRICA(S)?\b",
]

_STRUCTURAL_STEEL_EXCLUSIONS: List[str] = [
    r"\bTUBO(S)?\s+ESTRUCTURAL(ES)?\b",
    r"\bCONDUVEN\b",
    r"\bCERCHA(S)?\b",
    r"\bBARANDA(S)?\b",
    r"\bREJA(S)?\b",
    r"\bPORTON(ES)?\b",
    r"\bESCALERA(S)?\s+METALICA(S)?\b",
]


def is_pipe_or_conduit_activity(text_input: str) -> bool:
    """
    Determina de forma global si una descripción corresponde a una partida de instalación,
    reparación o suministro de tuberías (hidrosanitarias, aguas claras/servidas, gas, incendio,
    climatización o canalizaciones eléctricas), excluyendo herrería/tubos estructurales.
    """
    if not text_input or not isinstance(text_input, str):
        return False
    up = _strip_accents(text_input).upper()
    if any(re.search(pat, up) for pat in _STRUCTURAL_STEEL_EXCLUSIONS):
        return False
    return any(re.search(pat, up) for pat in _PIPE_ACTIVITY_PATTERNS)


def classify_pipe_mounting_condition(text_input: str) -> str:
    """
    Clasifica de forma global la condición de montaje constructivo de una tubería:
    - 'AMBIGUA_EMBUTIDA_ENTERRADA': cuando el texto contiene la cláusula dual 'EMBUTIDA O ENTERRADA'.
    - 'ENTERRADA': enterrada, subterránea, en zanja, bajo tierra, excavación de zanja.
    - 'SUPERFICIAL_COLGANTE': colgante, suspendida, fijada a la superficie, superficial, a la vista, adosada, aérea.
    - 'EMBUTIDA': embutida, empotrada, en pared, en muro, en tabique, en losa, regata, ranurado, en interiores.
    - 'NO_ESPECIFICADA': cuando no menciona condición explícita de montaje.
    """
    if not text_input or not isinstance(text_input, str):
        return "NO_ESPECIFICADA"

    up = _strip_accents(text_input).upper()

    if re.search(r"\b(?:EMBUTIDA\s+O\s+ENTERRADA|ENTERRADA\s+O\s+EMBUTIDA|EMBUTIDO\s+O\s+ENTERRADO)\b", up):
        return "AMBIGUA_EMBUTIDA_ENTERRADA"

    has_buried = bool(re.search(
        r"\b(?:ENTERRAD[OA]S?|SUBTERRANE[OA]S?|EN\s+ZANJA|BAJO\s+TIERRA|RED\s+EXTERIOR\s+ENTERRADA|BANCADA\s+SUBTERRANEA)\b",
        up,
    ))
    has_exposed_hanging = bool(re.search(
        r"\b(?:COLGANTE(S)?|SUSPENDID[OA]S?|FIJAD[OA]S?\s+A\s+LA\s+SUPERFICIE|SUPERFICIAL(ES)?|A\s+LA\s+VISTA|ADOSAD[OA]S?|SOBRE\s+PARED|AERE[OA]S?|EN\s+BANDEJA)\b",
        up,
    ))
    has_embedded = bool(re.search(
        r"\b(?:EMBUTID[OA]S?|EMPOTRAD[OA]S?|EN\s+PARED(ES)?|EN\s+MURO(S)?|EN\s+TABIQUE(S)?|EN\s+LOSA|REGATA(S)?|RANURADO|EN\s+INTERIOR(ES)?|INTERIOR(ES)?)\b",
        up,
    ))

    if has_buried and not has_embedded and not has_exposed_hanging:
        return "ENTERRADA"
    if has_exposed_hanging and not has_buried:
        return "SUPERFICIAL_COLGANTE"
    if has_embedded and not has_buried:
        return "EMBUTIDA"
    if has_buried and has_embedded:
        return "AMBIGUA_EMBUTIDA_ENTERRADA"

    return "NO_ESPECIFICADA"


def resolve_effective_pipe_mounting(user_description: str, base_description: str = "") -> str:
    """
    Resuelve la modalidad efectiva de montaje de tubería combinando la solicitud del usuario
    con la partida base y desambiguando el término dual 'EMBUTIDA O ENTERRADA':
    - Si el usuario especifica 'ENTERRADA', 'EMBUTIDA' o 'SUPERFICIAL_COLGANTE', prevalece la del usuario.
    - Si el usuario no especifica condición y la base es 'AMBIGUA_EMBUTIDA_ENTERRADA', se desambigua a
      'EMBUTIDA' (a menos que el usuario mencione excavación, zanja, movimiento de tierra o exteriores).
    """
    user_mode = classify_pipe_mounting_condition(user_description)
    if user_mode in ("ENTERRADA", "EMBUTIDA", "SUPERFICIAL_COLGANTE"):
        return user_mode

    up_user = _strip_accents(user_description or "").upper()
    if re.search(r"\b(?:EXCAVACION|ZANJA|EXTERIOR(ES)?|URBANISMO|CALLE|ACERA|VIALIDAD)\b", up_user):
        return "ENTERRADA"

    base_mode = classify_pipe_mounting_condition(base_description)
    if base_mode in ("ENTERRADA", "EMBUTIDA", "SUPERFICIAL_COLGANTE"):
        return base_mode

    return "EMBUTIDA"


# Patrones de equipos exclusivos de zanja / movimiento de tierra / topografía vial y albañilería gruesa
_TRENCH_AND_TOPOGRAPHY_EQUIPMENT_PATTERNS: List[str] = [
    r"\bCARRETILLA\b",
    r"\bCINTA\s+METRICA\s+(?:T/|P/|PARA\s+)?TOPOGRAFO\b",
    r"\bCINTA\s+METRICA\s+(?:DE\s+)?(?:LARGO\s*=\s*)?(?:25|30|50|100)\s*M(?:TS|T)?\b",
    r"\bESCUADRA\s+METALICA\s+(?:DE\s+)?ALUMINIO\b",
    r"\bPICO\s+CON\s+CABO\b",
    r"\bPALA\s+(?:REDONDA|CUADRADA|CON\s+CABO)\b",
    r"\bCOMPACTADOR\b",
    r"\bVIBROCOMPACTADOR\b",
    r"\bRETROEXCAVADORA\b",
]

# Patrones de equipos exclusivos de montaje aéreo / colgante / fijación en altura
_HANGING_AND_SURFACE_EQUIPMENT_PATTERNS: List[str] = [
    r"\bANDAMIO\s+TUBULAR\b",
    r"\bESCALERA\s+TIPO\s+TIJERA\b",
    r"\bPISTOLA\s+DE\s+FIJACION\b",
]

# Patrones de materiales exclusivos de suspensión / fijación aérea o superficial
# Patrones de materiales exclusivos de suspensión / fijación aérea o superficial
_HANGING_SUPPORT_MATERIAL_PATTERNS: List[str] = [
    r"\bABRAZADERA(S)?\s+(?:COLGANTE|METALICA|DE\s+HIERRO|GALVANIZADA|TIPO\s+PERA|TIPO\s+OMEGA|PARA\s+TUBERIA)\b",
    r"\bRIEL(ES)?\s+UNISTRU[TD]\b",
    r"\bBARRA(S)?\s+ROSCADA(S)?\b",
    r"\bTIRANTE(S)?\s+ROSCADO(S)?\b",
]


_FINE_MIX_PATTERN = re.compile(
    r"\bMORTERO\b|\bARENA\s*(?:-|/|Y|E|\+)\s*CEMENTO\b|\bCEMENTO\s*(?:-|/|Y|E|\+)\s*ARENA\b"
)
_COARSE_CONCRETE_PATTERN = re.compile(r"\b(?:CONCRETO|HORMIGON|PIEDRA\s+PICADA|GRAVA|GRANZA)\b")
_MANUAL_MIXING_PATTERN = re.compile(
    r"\b(?:HECH[OA]|ELABORAD[OA]|PREPARAD[OA]|MEZCLAD[OA])\s+(?:A\s+MANO|MANUAL(?:MENTE)?)\b"
    r"|\bMEZCLA\s+MANUAL\b|\bMANUALMENTE\b|\bA\s+MANO\b"
)


def is_explicit_mortar_without_coarse_concrete(text_input: str) -> bool:
    """
    Determina si la solicitud del usuario especifica explícitamente una mezcla fina de arena-cemento
    (mortero, 'mezcla arena-cemento', 'arena y cemento') SIN agregado grueso, y NO solicita concreto
    ni piedra picada/grava.
    """
    if not text_input or not isinstance(text_input, str):
        return False
    up = _strip_accents(text_input).upper()
    return bool(_FINE_MIX_PATTERN.search(up)) and not bool(_COARSE_CONCRETE_PATTERN.search(up))


def is_manual_mixing_requested(text_input: str) -> bool:
    """
    Determina si el usuario pidió explícitamente elaborar la mezcla a mano
    ('hecha manualmente', 'mezcla manual', 'a mano'): sin mezcladora ni operador de mezcladora.
    """
    if not text_input or not isinstance(text_input, str):
        return False
    return bool(_MANUAL_MIXING_PATTERN.search(_strip_accents(text_input).upper()))



def enforce_discordant_inputs_purging(
    result: Dict[str, Any],
    user_description: str,
    base_apu: Dict[str, Any]
) -> None:
    """
    Salvaguarda determinista de eliminación de discordancia de insumos, equipos y mano de obra:
    1. Regla Zero-Supply para Desmontajes / Demoliciones:
       - En actividades de desmontaje/retiro, purga cualquier material que represente
         el suministro del activo nuevo a desmontar o tuberías/cables de obra nueva.
    2. Poda Global por Modalidad de Instalación de Tubería (EMBUTIDA vs ENTERRADA vs SUPERFICIAL/COLGANTE):
       - Si la tubería es EMBUTIDA o SUPERFICIAL/COLGANTE (o en interiores sin excavación),
         purga carretillas, cintas métricas de topógrafo de 25-50m, escuadras de albañilería y equipos de zanja.
       - Si la tubería es ENTERRADA, purga andamios, escaleras, pistolas de fijación y abrazaderas colgantes.
       - Si la tubería es estrictamente EMBUTIDA, purga abrazaderas colgantes y equipos de fijación superficial.
    3. Respeto Estricto a Mortero de Arena-Cemento vs Concreto con Agregado Grueso:
       - Cuando el usuario pide explícitamente mortero (sin concreto), purga piedra picada y vibrador de inmersión,
         preservando el acero de refuerzo y encofrado en elementos que trabajan a flexión (ej. dinteles).
    4. Poda de Equipos Sobredimensionados o de Disciplinas Ajenas y Deduplicación Estricta.
    """
    if not result or not isinstance(result, dict):
        return

    pruning_trace = result.setdefault("debug_pruning_trace", {
        "insumos_purgados": [],
        "equipos_purgados": [],
        "mano_obra_purgada": [],
        "advertencias_purgadas": [],
        "total_eliminados": 0
    })
    pruning_trace.setdefault("mano_obra_purgada", [])

    desc_lower = (user_description or "").lower()
    desc_upper = _strip_accents(user_description or "").upper()
    base_desc = str((base_apu or {}).get("descripcion") or (base_apu or {}).get("description") or "")
    is_removal = _is_removal_activity(user_description)
    is_mortar_only = is_explicit_mortar_without_coarse_concrete(user_description)
    is_manual_mix = is_manual_mixing_requested(user_description)
    is_indoor_work = bool(re.search(r"\bEN\s+INTERIOR(ES)?\b", desc_upper)) and not bool(
        re.search(r"\bCARRETILLA\b", desc_upper)
    )
    explicit_mixer = bool(re.search(r"\b(?:MEZCLADORA|TROMPO)\b", desc_upper))

    is_pipe_task = is_pipe_or_conduit_activity(user_description) or is_pipe_or_conduit_activity(base_desc)
    pipe_mounting_mode = resolve_effective_pipe_mounting(user_description, base_desc) if is_pipe_task else "NO_APLICA"
    explicit_earthwork_or_masonry = bool(re.search(
        r"\b(?:EXCAVACION|ZANJA|BOTE\s+DE|ESCOMBRO|DEMOLICION|CONCRETO|MORTERO|RELLENO|COMPACTACION|ACARREO\s+EN\s+CARRETILLA)\b",
        desc_upper,
    ))
    explicit_height_or_scaffold = bool(re.search(
        r"\b(?:ANDAMIO|ALTURA|COLGANTE|SUSPENDID[OA]|EN\s+TECHO|BAJO\s+LOSA|AERE[OA])\b",
        desc_upper,
    ))
    is_labor_only = bool(re.search(
        r"\b(?:SOLO\s+MANO\s+DE\s+OBRA|UNICAMENTE\s+MANO\s+DE\s+OBRA|SIN\s+MATERIALES?|SOLO\s+MANO\s+OBRA)\b",
        desc_upper,
    ))
    is_civil_or_flooring = bool(re.search(
        r"\b(?:sobrepiso|contrapiso|concreto|vaciado|losa|pavimento|pared|bloque|mamposteria|friso|revoque|dintel|machon|zapata|mortero|radier|acera|brocal)\b",
        desc_lower,
    ))
    explicit_painting = bool(re.search(
        r"\b(?:pintura|pintar|esmalte|caucho|fondo\s+antialcalino|pasta\s+profesional|barniz|encamisado)\b",
        desc_lower,
    ))
    explicit_plumbing = bool(re.search(
        r"\b(?:tuberia|tubo|ppr|cpvc|aguas\s+blancas|aguas\s+negras|aguas\s+servidas|plomeria|griferia|sanitari[ao])\b",
        desc_lower,
    ))
    explicit_electrical = bool(re.search(
        r"\b(?:electric(?:o|a|idad)|conduit|emt|cable|tablero|breaker|tomacorriente|iluminacion)\b",
        desc_lower,
    ))

    # -------------------------------------------------------------------------
    # 1. PODA EN MATERIALES
    # -------------------------------------------------------------------------
    materials = result.get("materials", [])
    if isinstance(materials, list) and materials:
        if is_labor_only:
            for mat in materials:
                if not isinstance(mat, dict):
                    continue
                mat_desc = str(mat.get("descripcion", "")).strip()
                logger.info("[DiscordantPruning] Purgado material (%s) en partida de SOLO MANO DE OBRA", mat_desc)
                pruning_trace["insumos_purgados"].append({
                    "descripcion": mat_desc,
                    "codigo": mat.get("codigo"),
                    "motivo": "Partida solicitada expresamente como 'Solo mano de obra' (sin suministro de materiales)",
                    "regla": "SOLO_MANO_DE_OBRA",
                })
            result["materials"] = []
            materials = []

        clean_materials: List[Dict[str, Any]] = []
        seen_mat_keys: Set[str] = set()

        # Determinar si el usuario solicitó explícitamente oxicorte o corte con soplete
        explicit_cutting = bool(re.search(r"\b(oxicorte|corte\s+con\s+soplete|soplete|corte\s+termico)\b", desc_lower))
        is_lightweight = bool(re.search(r"\b([1-9]|10)\s*(hp|caballos?|cv)\b", desc_lower)) or any(
            k in desc_lower for k in ["bomba centrifuga", "bomba periferica", "bomba sumergible", "puerta", "ventana", "mueble"]
        )

        for mat in materials:
            if not isinstance(mat, dict):
                continue

            mat_desc = str(mat.get("descripcion", "")).strip()
            mat_desc_upper = _strip_accents(mat_desc).upper()
            mat_key = _normalize_text_key(mat_desc)

            # Deduplicación
            if mat_key and mat_key in seen_mat_keys:
                logger.info("[DiscordantPruning] Eliminado material duplicado: %s", mat_desc)
                pruning_trace["insumos_purgados"].append({
                    "descripcion": mat_desc,
                    "codigo": mat.get("codigo"),
                    "motivo": "Material duplicado",
                    "regla": "DEDUPLICACION"
                })
                continue

            # Si es DESMONTAJE: No debe comprarse el activo que se está desmontando
            if is_removal:
                is_asset_supply = any(bool(re.search(pat, mat_desc_upper)) for pat in ASSET_SUPPLY_PATTERNS)
                is_new_bulk_supply = bool(re.search(r"\b(CABLE\s+SUMERGIBLE|COLUMNA\s+DE\s+IMPULSION|TUBERIA\s+DE\s+IMPULSION)\b", mat_desc_upper))
                if is_asset_supply or is_new_bulk_supply:
                    logger.info("[DiscordantPruning] Purgado material de obra nueva en desmontaje: %s", mat_desc)
                    pruning_trace["insumos_purgados"].append({
                        "descripcion": mat_desc,
                        "codigo": mat.get("codigo"),
                        "motivo": "Suministro de obra nueva incompatible con desmontaje/retiro",
                        "regla": "ZERO_SUPPLY_DESMONTAJE"
                    })
                    continue

            # Poda de agregado grueso (piedra picada / grava) cuando el usuario exige explícitamente MORTERO
            if is_mortar_only:
                if re.search(
                    r"\b(?:PIEDRA\s+PICADA|GRAVA\s+PICADA|GRANZA\s+PARA\s+CONCRETO|FLETE\s*/\s*TRANSPORTE\s+DE\s+AGREGADOS|TRANSPORTE\s+URBANO\s+DE\s+CEMENTO)\b",
                    mat_desc_upper,
                ):
                    logger.info(
                        "[DiscordantPruning] Purgado agregado grueso/flete de concreto (%s) en partida explícita de mortero",
                        mat_desc,
                    )
                    pruning_trace["insumos_purgados"].append({
                        "descripcion": mat_desc,
                        "codigo": mat.get("codigo"),
                        "motivo": "Agregado grueso de concreto incompatible con especificación explícita de mortero de arena-cemento",
                        "regla": "MORTERO_SIN_AGREGADO_GRUESO",
                    })
                    continue

            # Poda por modalidad de tubería: si es EMBUTIDA o ENTERRADA, no lleva soportes/abrazaderas colgantes
            if is_pipe_task and pipe_mounting_mode in ("EMBUTIDA", "ENTERRADA"):
                if any(bool(re.search(pat, mat_desc_upper)) for pat in _HANGING_SUPPORT_MATERIAL_PATTERNS):
                    logger.info(
                        "[DiscordantPruning] Purgado soporte/abrazadera aérea en tubería %s: %s",
                        pipe_mounting_mode,
                        mat_desc,
                    )
                    pruning_trace["insumos_purgados"].append({
                        "descripcion": mat_desc,
                        "codigo": mat.get("codigo"),
                        "motivo": f"Elemento de fijación superficial/colgante incompatible con tubería {pipe_mounting_mode}",
                        "regla": f"TUBERIA_{pipe_mounting_mode}_SIN_SOPORTE_AEREO",
                    })
                    continue

            # Poda de gases de oxicorte para elementos livianos si no fue solicitado expresamente
            if is_lightweight and not explicit_cutting:
                if any(bool(re.search(pat, mat_desc_upper)) for pat in HEAVY_OXY_CUTTING_PATTERNS):
                    logger.info("[DiscordantPruning] Purgado material de oxicorte discordante en maniobra liviana: %s", mat_desc)
                    pruning_trace["insumos_purgados"].append({
                        "descripcion": mat_desc,
                        "codigo": mat.get("codigo"),
                        "motivo": "Gases de oxicorte en maniobra liviana sin corte térmico solicitado",
                        "regla": "OXICORTE_DISCORDANTE"
                    })
                    continue

            # Poda de gases refrigerantes si la partida no es de climatización/HVAC
            if not any(k in desc_lower for k in ["aire acondicionado", "refrigeracion", "chiller", "split", "fancoil"]):
                if re.search(r"\b(REFRIGERANTE|R-?22|R-?410|R-?134|GAS\s+REFRIGERANTE)\b", mat_desc_upper):
                    logger.info("[DiscordantPruning] Purgado insumo de refrigeración en partida no-HVAC: %s", mat_desc)
                    pruning_trace["insumos_purgados"].append({
                        "descripcion": mat_desc,
                        "codigo": mat.get("codigo"),
                        "motivo": "Insumo de refrigeración en partida no perteneciente a HVAC",
                        "regla": "DISCIPLINA_AJENA_HVAC"
                    })
                    continue

            # Poda de tuberías de concreto, alcantarillado o drenaje pesado en partidas de pisos y acabados
            is_floor_finish = any(f in desc_lower for f in ["piso", "sobrepiso", "pavimento", "acera", "revestimiento de piso", "requemado", "afinado", "friso", "mortero de piso"])
            if is_floor_finish:
                if re.search(r"\b(TUBO\s+DE\s+CONCRETO|TUBERIA\s+DE\s+CONCRETO|JUNTA\s+GOMA|ALCANTARILLA|DRENAJE\s+PLUVIAL|COLECTOR)\b", mat_desc_upper):
                    logger.info("[DiscordantPruning] Purgada tubería pesada/subterránea discordante en piso/acabado: %s", mat_desc)
                    pruning_trace["insumos_purgados"].append({
                        "descripcion": mat_desc,
                        "codigo": mat.get("codigo"),
                        "motivo": "Tubería pesada o elemento de alcantarillado incompatible con partida de piso o acabado",
                        "regla": "DISCIPLINA_AJENA_PISOS"
                    })
                    continue

            # Poda de tuberías eléctricas y rieles unistrut en partidas sanitarias/agua potable
            is_sanitary_water = any(k in desc_lower for k in ["ppr", "polipropileno", "cpvc", "agua potable", "aguas blancas", "aguas claras", "plomeria", "fontaneria", "sanitaria", "sanitarias", "termofusion"])
            if is_sanitary_water:
                if re.search(r"\b(TUBO\s+PVC\s+ELECTRICIDAD|CONDUIT|UNISTRU[TD]|CONDULET|CAJETIN|TABLERO\s+ELECTRICO|BREAKER|CABLE\s+THW|TUBERIA\s+ELECTRICA)\b", mat_desc_upper):
                    logger.info("[DiscordantPruning] Purgado material eléctrico discordante en partida de agua potable/sanitaria: %s", mat_desc)
                    pruning_trace["insumos_purgados"].append({
                        "descripcion": mat_desc,
                        "codigo": mat.get("codigo"),
                        "motivo": "Material de canalización eléctrica incompatible con partida de agua potable/sanitaria",
                        "regla": "DISCIPLINA_AJENA_SANITARIAS"
                    })
                    continue

            # Poda de materiales de pintura en partidas de obra civil sin pintura solicitada
            if is_civil_or_flooring and not explicit_painting:
                if re.search(r"\b(?:PINTURA|ESMALTE|FONDO\s+ANTIALCALINO|FONDO\s+ANTICORROSIVO|FONDO\s+DE\s+HERRERIA|PASTA\s+PROFESIONAL|BARNIZ|OLEO|THINNER|TINNER|SOLVENTE\s+PARA\s+PINTURA)\b", mat_desc_upper):
                    logger.info("[DiscordantPruning] Purgado material de pintura discordante en obra civil: %s", mat_desc)
                    pruning_trace["insumos_purgados"].append({
                        "descripcion": mat_desc,
                        "codigo": mat.get("codigo"),
                        "motivo": "Material de acabado/pintura incompatible con partida de obra civil/albañilería sin pintura solicitada",
                        "regla": "MATERIAL_DISCORDANTE_PINTURA",
                    })
                    continue

            seen_mat_keys.add(mat_key)
            clean_materials.append(mat)

        result["materials"] = clean_materials

    # -------------------------------------------------------------------------
    # 2. PODA EN EQUIPOS
    # -------------------------------------------------------------------------
    equipments = result.get("equipments", [])
    if isinstance(equipments, list) and equipments:
        clean_equipments: List[Dict[str, Any]] = []
        seen_eq_keys: Set[str] = set()

        explicit_cutting = bool(re.search(r"\b(oxicorte|corte\s+con\s+soplete|soplete|corte\s+termico)\b", desc_lower))
        is_lightweight = bool(re.search(r"\b([1-9]|10)\s*(hp|caballos?|cv)\b", desc_lower)) or any(
            k in desc_lower for k in ["bomba centrifuga", "bomba periferica", "puerta", "ventana", "mueble"]
        )
        is_deep_well = bool(re.search(r"\b(pozo\s+profundo|pozo\s+tubular|bomba\s+sumergible)\b", desc_lower))

        for eq in equipments:
            if not isinstance(eq, dict):
                continue

            eq_desc = str(eq.get("descripcion", "")).strip()
            eq_desc_upper = _strip_accents(eq_desc).upper()
            eq_key = _normalize_text_key(eq_desc)

            # Deduplicación
            if eq_key and eq_key in seen_eq_keys:
                logger.info("[DiscordantPruning] Eliminado equipo duplicado: %s", eq_desc)
                pruning_trace["equipos_purgados"].append({
                    "descripcion": eq_desc,
                    "codigo": eq.get("codigo"),
                    "motivo": "Equipo duplicado",
                    "regla": "DEDUPLICACION"
                })
                continue

            # Poda de mezcladora/trompo cuando el usuario pidió elaborar la mezcla manualmente
            if is_manual_mix and not explicit_mixer and re.search(r"\b(?:MEZCLADORA|TROMPO|REVOLVEDORA)\b", eq_desc_upper):
                logger.info("[DiscordantPruning] Purgada mezcladora (%s) con mezcla manual solicitada", eq_desc)
                pruning_trace["equipos_purgados"].append({
                    "descripcion": eq_desc,
                    "codigo": eq.get("codigo"),
                    "motivo": "Mezcladora incompatible con elaboración manual de la mezcla solicitada por el usuario",
                    "regla": "MEZCLA_MANUAL_SIN_MEZCLADORA",
                })
                continue

            # Poda de vibrador de concreto (y trompo pesado si es interior) cuando la partida es explícitamente de MORTERO
            if is_mortar_only:
                if re.search(r"\bVIBRADOR\b", eq_desc_upper):
                    logger.info("[DiscordantPruning] Purgado vibrador de concreto (%s) en partida de mortero", eq_desc)
                    pruning_trace["equipos_purgados"].append({
                        "descripcion": eq_desc,
                        "codigo": eq.get("codigo"),
                        "motivo": "Vibrador de inmersión para concreto incompatible con partida de mortero de arena-cemento",
                        "regla": "MORTERO_SIN_VIBRADOR_CONCRETO",
                    })
                    continue
                if is_indoor_work and not explicit_mixer and re.search(r"\b(?:MEZCLADORA|TROMPO)\b", eq_desc_upper):
                    logger.info("[DiscordantPruning] Purgada mezcladora industrial (%s) en partida de mortero en interiores", eq_desc)
                    pruning_trace["equipos_purgados"].append({
                        "descripcion": eq_desc,
                        "codigo": eq.get("codigo"),
                        "motivo": "Mezcladora pesada de concreto sobredimensionada para mortero de arena-cemento en interiores",
                        "regla": "MORTERO_INTERIORES_SIN_TROMPO_PESADO",
                    })
                    continue

            # Poda de carretilla en trabajos explícitamente en interiores (sin acarreo en carretilla solicitado)
            if is_indoor_work and re.search(r"\bCARRETILLA\b", eq_desc_upper):
                logger.info("[DiscordantPruning] Purgada carretilla (%s) en trabajo en interiores", eq_desc)
                pruning_trace["equipos_purgados"].append({
                    "descripcion": eq_desc,
                    "codigo": eq.get("codigo"),
                    "motivo": "Carretilla incompatible con trabajo en interiores (acarreo manual en tobos)",
                    "regla": "INTERIORES_SIN_CARRETILLA",
                })
                continue

            # Poda Global por Modalidad de Instalación de Tuberías (EMBUTIDA vs ENTERRADA vs SUPERFICIAL/COLGANTE)
            if is_pipe_task:
                # Caso A: Tubería EMBUTIDA o SUPERFICIAL/COLGANTE (no enterrada) -> purgar carretilla, cinta de topógrafo 50m, escuadra de albañilería y equipos de zanja
                if pipe_mounting_mode in ("EMBUTIDA", "SUPERFICIAL_COLGANTE") and not explicit_earthwork_or_masonry:
                    if any(bool(re.search(pat, eq_desc_upper)) for pat in _TRENCH_AND_TOPOGRAPHY_EQUIPMENT_PATTERNS):
                        logger.info(
                            "[DiscordantPruning] Purgado equipo de zanja/topografía/acarreo (%s) en tubería modalidad %s",
                            eq_desc,
                            pipe_mounting_mode,
                        )
                        pruning_trace["equipos_purgados"].append({
                            "descripcion": eq_desc,
                            "codigo": eq.get("codigo"),
                            "motivo": f"Equipo de excavación/topografía/acarreo incompatible con tubería {pipe_mounting_mode} sin movimiento de tierra",
                            "regla": f"TUBERIA_{pipe_mounting_mode}_SIN_EQUIPO_ZANJA",
                        })
                        continue

                # Si es estrictamente EMBUTIDA y no solicitó altura/andamio/colgante -> purgar equipos de fijación aérea/colgante
                if pipe_mounting_mode == "EMBUTIDA" and not explicit_height_or_scaffold:
                    if any(bool(re.search(pat, eq_desc_upper)) for pat in _HANGING_AND_SURFACE_EQUIPMENT_PATTERNS):
                        logger.info(
                            "[DiscordantPruning] Purgado equipo de montaje aéreo/superficial (%s) en tubería EMBUTIDA",
                            eq_desc,
                        )
                        pruning_trace["equipos_purgados"].append({
                            "descripcion": eq_desc,
                            "codigo": eq.get("codigo"),
                            "motivo": "Equipo de fijación aérea/colgante incompatible con tubería embutida",
                            "regla": "TUBERIA_EMBUTIDA_SIN_EQUIPO_COLGANTE",
                        })
                        continue

                # Caso B: Tubería ENTERRADA -> purgar andamios, escaleras de tijera y pistolas de fijación en techo/pared
                if pipe_mounting_mode == "ENTERRADA" and not explicit_height_or_scaffold:
                    if any(bool(re.search(pat, eq_desc_upper)) for pat in _HANGING_AND_SURFACE_EQUIPMENT_PATTERNS):
                        logger.info(
                            "[DiscordantPruning] Purgado equipo de montaje en altura/superficie (%s) en tubería ENTERRADA",
                            eq_desc,
                        )
                        pruning_trace["equipos_purgados"].append({
                            "descripcion": eq_desc,
                            "codigo": eq.get("codigo"),
                            "motivo": "Equipo de montaje aéreo/superficial incompatible con tubería enterrada en zanja",
                            "regla": "TUBERIA_ENTERRADA_SIN_EQUIPO_ALTURA",
                        })
                        continue

            # Poda de equipo de oxicorte en desmontaje de equipo liviano sin corte térmico
            if is_lightweight and not explicit_cutting:
                if re.search(r"\b(OXICORTE|EQUIPO\s+DE\s+OXICORTE|SOPLETE\s+DE\s+CORTE)\b", eq_desc_upper):
                    logger.info("[DiscordantPruning] Purgado equipo de oxicorte discordante en equipo liviano: %s", eq_desc)
                    pruning_trace["equipos_purgados"].append({
                        "descripcion": eq_desc,
                        "codigo": eq.get("codigo"),
                        "motivo": "Equipo de oxicorte discordante en maniobra liviana",
                        "regla": "OXICORTE_DISCORDANTE"
                    })
                    continue

            # Poda de señorita de 5 TON si el equipo es liviano (<150 kg) a nivel de piso
            if is_lightweight and not is_deep_well:
                if re.search(r"\b(SENORITA\s+DE\s+CADENA|POLIPASTO)\s+DE\s+(CAPACIDAD\s*=\s*)?(?:5|10|15|20)\s*TON\b", eq_desc_upper):
                    logger.info("[DiscordantPruning] Purgada señorita de 5 TON sobredimensionada para maniobra liviana: %s", eq_desc)
                    pruning_trace["equipos_purgados"].append({
                        "descripcion": eq_desc,
                        "codigo": eq.get("codigo"),
                        "motivo": "Señorita de 5 TON sobredimensionada para maniobra liviana",
                        "regla": "EQUIPO_SOBREDIMENSIONADO"
                    })
                    continue

            # Poda de maquinaria pesada de corte de cabilla en partidas de pisos y acabados
            is_floor_finish = any(f in desc_lower for f in ["piso", "sobrepiso", "pavimento", "acera", "revestimiento de piso", "requemado", "afinado", "friso", "mortero de piso"])
            if is_floor_finish:
                if re.search(r"\b(CORTADORA\s+(?:AUTOMATICA\s+)?DE\s+CABILLA|DOBLADORA\s+DE\s+CABILLA|CIZALLA\s+HIDRAULICA)\b", eq_desc_upper):
                    logger.info("[DiscordantPruning] Purgado equipo de corte de acero pesado discordante en piso/acabado: %s", eq_desc)
                    pruning_trace["equipos_purgados"].append({
                        "descripcion": eq_desc,
                        "codigo": eq.get("codigo"),
                        "motivo": "Equipo de corte de cabilla industrial incompatible con partida de piso o acabado",
                        "regla": "EQUIPO_DISCORDANTE_PISOS"
                    })
                    continue

            # Poda de equipo de tubería eléctrica en partidas de agua potable/sanitarias
            is_sanitary_water = any(k in desc_lower for k in ["ppr", "polipropileno", "cpvc", "agua potable", "aguas blancas", "aguas claras", "plomeria", "fontaneria", "sanitaria", "sanitarias", "termofusion"])
            if is_sanitary_water:
                if re.search(r"\b(EQUIPO\s+PARA\s+TUBERIA\s+ELECTRICA|DOBLADORA\s+DE\s+CONDUIT|TERRAJA\s+ELECTRICA|ROSCADORA\s+ELECTRICA)\b", eq_desc_upper):
                    logger.info("[DiscordantPruning] Purgado equipo eléctrico discordante en partida de agua potable/sanitaria: %s", eq_desc)
                    pruning_trace["equipos_purgados"].append({
                        "descripcion": eq_desc,
                        "codigo": eq.get("codigo"),
                        "motivo": "Equipo de tubería eléctrica incompatible con partida de agua potable/sanitaria",
                        "regla": "EQUIPO_DISCORDANTE_SANITARIAS"
                    })
                    continue

            # Poda de herramientas de pintura en obras civiles / albañilería / sobrepiso sin pintura solicitada
            if is_civil_or_flooring and not explicit_painting:
                if re.search(r"\b(?:BROCHA|RODILLO|ESPATULA|PISTOLA\s+DE\s+PINTAR|BANDEJA\s+PARA\s+PINTURA|EXTENSI[OÓ]N\s+PARA\s+RODILLO|LIJADORA\s+DE\s+PARED)\b", eq_desc_upper):
                    logger.info("[DiscordantPruning] Purgada herramienta de pintura discordante en obra civil: %s", eq_desc)
                    pruning_trace["equipos_purgados"].append({
                        "descripcion": eq_desc,
                        "codigo": eq.get("codigo"),
                        "motivo": "Herramienta/equipo de pintura incompatible con partida de sobrepiso/concreto/albañilería",
                        "regla": "EQUIPO_DISCORDANTE_PINTURA",
                    })
                    continue

            seen_eq_keys.add(eq_key)
            clean_equipments.append(eq)

        # Garantizar que nunca quede la lista de equipos vacía tras podar herramientas de zanja
        if not clean_equipments and equipments:
            clean_equipments.append({
                "id": "e-ia-herramientas-menores",
                "codigo": "HER001",
                "descripcion": "HERRAMIENTAS MENORES",
                "unidad": "día",
                "cantidad": 1.0,
                "depreciacion": 0.05,
                "precio_unitario": 15.0,
                "origen": "historico",
                "nota_calculo": "Dotación de herramientas menores manuales para la cuadrilla de instalación.",
            })

        result["equipments"] = clean_equipments

    labors_key = "labors" if "labors" in result else ("labor" if "labor" in result else "labors")
    labors = result.get(labors_key, [])
    if isinstance(labors, list) and labors:
        clean_labors, purged_labors = deduplicate_labor_items(labors)
        if purged_labors:
            for pl in purged_labors:
                p_desc = str(pl.get("descripcion") or "").strip()
                logger.info("[DiscordantPruning] Eliminado cargo de mano de obra duplicado por doble tabulador: %s", p_desc)
                pruning_trace["mano_obra_purgada"].append({
                    "descripcion": p_desc,
                    "codigo": pl.get("codigo"),
                    "motivo": "Oficio duplicado en doble tabulador (se conserva una sola línea con salario integral vigente)",
                    "regla": "DEDUPLICACION_MANO_OBRA_TABULADOR",
                })

        # Si no hay mezcladora/trompo en equipos y es partida de mortero, purgar maquinista de concreto huérfano
        has_active_mixer = any(
            re.search(r"\b(?:MEZCLADORA|TROMPO)\b", _strip_accents(str(e.get("descripcion") or "")).upper())
            for e in result.get("equipments", [])
            if isinstance(e, dict)
        )
        if (is_mortar_only or is_manual_mix) and not has_active_mixer:
            retained_labors: List[Dict[str, Any]] = []
            for l_item in clean_labors:
                l_up = _strip_accents(str(l_item.get("descripcion") or "")).upper()
                if "MAQUINISTA DE CONCRETO" in l_up:
                    pruning_trace["mano_obra_purgada"].append({
                        "descripcion": str(l_item.get("descripcion") or ""),
                        "codigo": l_item.get("codigo"),
                        "motivo": "Maquinista de concreto sin mezcladora activa en partida de mortero",
                        "regla": "OPERADOR_SIN_EQUIPO_MEZCLADORA",
                    })
                else:
                    retained_labors.append(l_item)
            clean_labors = retained_labors

        # Poda de oficios de pintura en obras civiles / albañilería / sobrepisos
        if is_civil_or_flooring and not explicit_painting:
            retained_labors = []
            for l_item in clean_labors:
                l_up = _strip_accents(str(l_item.get("descripcion") or "")).upper()
                if re.search(r"\b(?:PINTOR|MAESTRO\s+PINTOR|AYUDANTE\s+PINTOR)\b", l_up):
                    logger.info("[DiscordantPruning] Purgado oficio de pintura (%s) en partida de obra civil", l_up)
                    pruning_trace["mano_obra_purgada"].append({
                        "descripcion": str(l_item.get("descripcion") or ""),
                        "codigo": l_item.get("codigo"),
                        "motivo": "Oficio de pintura incompatible con partida de obra civil/albañilería/sobrepiso sin pintura solicitada",
                        "regla": "MANO_OBRA_DISCORDANTE_PINTURA",
                    })
                else:
                    retained_labors.append(l_item)
            clean_labors = retained_labors

            # Si tras podar oficios la cuadrilla se quedó sin oficial calificado de albañilería
            has_civil_craftsman = any(
                re.search(r"\b(?:ALBA[NÑ]IL|MAESTRO\s+DE\s+OBRA|CARPINTERO|CABILLERO)\b", _strip_accents(str(l.get("descripcion") or "")).upper())
                for l in clean_labors
            )
            if not has_civil_craftsman and clean_labors:
                clean_labors.insert(0, {
                    "id": "mo-ia-albanil-1ra",
                    "codigo": "MO-ALB01",
                    "descripcion": "ALBAÑIL DE 1RA",
                    "unidad": "día",
                    "cantidad": 1.0,
                    "jornal": 18.0,
                    "bono": 0.0,
                    "origen": "historico",
                    "nota_calculo": "Oficial albañil requerido para ejecución técnica de sobrepiso/albañilería tras poda de oficio discordante.",
                })

        # Poda de oficios de plomería en obras civiles puras sin instalaciones sanitarias
        if is_civil_or_flooring and not explicit_plumbing:
            retained_labors = []
            for l_item in clean_labors:
                l_up = _strip_accents(str(l_item.get("descripcion") or "")).upper()
                if re.search(r"\b(?:PLOMERO|MAESTRO\s+PLOMERO|TUBERO\s+SANITARIO)\b", l_up):
                    pruning_trace["mano_obra_purgada"].append({
                        "descripcion": str(l_item.get("descripcion") or ""),
                        "codigo": l_item.get("codigo"),
                        "motivo": "Oficio de plomería incompatible con obra civil sin instalaciones sanitarias",
                        "regla": "MANO_OBRA_DISCORDANTE_PLOMERIA",
                    })
                else:
                    retained_labors.append(l_item)
            clean_labors = retained_labors

        # Poda de oficios de electricidad en obras civiles puras sin instalaciones eléctricas
        if is_civil_or_flooring and not explicit_electrical:
            retained_labors = []
            for l_item in clean_labors:
                l_up = _strip_accents(str(l_item.get("descripcion") or "")).upper()
                if re.search(r"\b(?:ELECTRICISTA|MAESTRO\s+ELECTRICISTA|LINIERO)\b", l_up):
                    pruning_trace["mano_obra_purgada"].append({
                        "descripcion": str(l_item.get("descripcion") or ""),
                        "codigo": l_item.get("codigo"),
                        "motivo": "Oficio de electricidad incompatible con obra civil sin instalaciones eléctricas",
                        "regla": "MANO_OBRA_DISCORDANTE_ELECTRICIDAD",
                    })
                else:
                    retained_labors.append(l_item)
            clean_labors = retained_labors

        # Poda de oficios de obra civil en partidas exclusivas de pintura
        if explicit_painting and not is_civil_or_flooring:
            retained_labors = []
            for l_item in clean_labors:
                l_up = _strip_accents(str(l_item.get("descripcion") or "")).upper()
                if re.search(r"\b(?:ALBA[NÑ]IL|CABILLERO|CARPINTERO\s+DE\s+OBRA|PLOMERO|ELECTRICISTA)\b", l_up):
                    pruning_trace["mano_obra_purgada"].append({
                        "descripcion": str(l_item.get("descripcion") or ""),
                        "codigo": l_item.get("codigo"),
                        "motivo": "Oficio ajeno incompatible con partida exclusiva de pintura",
                        "regla": "MANO_OBRA_DISCORDANTE_PINTURA_PURA",
                    })
                else:
                    retained_labors.append(l_item)
            clean_labors = retained_labors

        result[labors_key] = clean_labors
        if "labor" in result and labors_key != "labor":
            result["labor"] = clean_labors

    # -------------------------------------------------------------------------
    # 3. DEDUPLICACIÓN Y FILTRADO DE ADVERTENCIAS
    # -------------------------------------------------------------------------
    advertencias = result.get("advertencias", [])
    if isinstance(advertencias, list) and advertencias:
        clean_advertencias: List[str] = []
        seen_adv_keys: Set[str] = set()
        purged_mat_names = [
            str(pm.get("descripcion") or "").upper()
            for pm in pruning_trace.get("insumos_purgados", [])
            if isinstance(pm, dict) and pm.get("descripcion")
        ]

        for adv in advertencias:
            if not adv or not isinstance(adv, str):
                continue
            adv_strip = adv.strip()
            adv_key = _normalize_text_key(adv_strip)

            if adv_key in seen_adv_keys:
                continue

            # Si es desmontaje, purgar advertencias de activos suministrados
            if is_removal and any(k in adv_strip.upper() for k in ["BOMBA SUMERGIBLE", "BOMBA CENTRIFUGA", "TUBERÍA DE IMPULSIÓN", "TUBERIA DE IMPULSION", "CABLE SUMERGIBLE"]):
                pruning_trace["advertencias_purgadas"].append({
                    "advertencia": adv_strip,
                    "motivo": "Advertencia de activo suministrado purgada en desmontaje",
                    "regla": "ZERO_SUPPLY_DESMONTAJE"
                })
                continue

            if purged_mat_names and any(pm_name in adv_strip.upper() for pm_name in purged_mat_names):
                pruning_trace["advertencias_purgadas"].append({
                    "advertencia": adv_strip,
                    "motivo": "Advertencia asociada a insumo discordante purgado",
                    "regla": "INSUMO_DISCORDANTE_PURGADO",
                })
                continue

            seen_adv_keys.add(adv_key)
            clean_advertencias.append(adv_strip)

        result["advertencias"] = clean_advertencias

    # Actualizar conteos y totales en pruning_trace
    pruning_trace["total_eliminados"] = (
        len(pruning_trace["insumos_purgados"])
        + len(pruning_trace["equipos_purgados"])
        + len(pruning_trace["mano_obra_purgada"])
        + len(pruning_trace["advertencias_purgadas"])
    )
    result["debug_pruning_trace"] = pruning_trace
    result["conteo_materiales"] = len(result.get("materials", []))
    result["conteo_equipos"] = len(result.get("equipments", []))
    result["conteo_mano_obra"] = len(result.get("labors", []))

