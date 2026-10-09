import re
import unicodedata
from typing import Any, Dict, List, Set
from app.core.logging import logger


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


def enforce_discordant_inputs_purging(
    result: Dict[str, Any],
    user_description: str,
    base_apu: Dict[str, Any]
) -> None:
    """
    Salvaguarda determinista de eliminación de discordancia de insumos y equipos:
    1. Regla Zero-Supply para Desmontajes / Demoliciones:
       - En actividades de desmontaje/retiro, purga cualquier material que represente
         el suministro del activo nuevo a desmontar o tuberías/cables de obra nueva.
    2. Poda de Equipos Sobredimensionados o Discordantes:
       - Si la actividad es liviana o mecánica simple (bomba <= 10 HP, puertas, artefactos),
         purga equipos de oxicorte y señoritas pesadas de 5 TON si el usuario no pidió corte térmico.
    3. Poda de Insumos de Disciplinas Ajenas heredados de la base:
       - Si la solicitud es hidráulica/bombas y la base era refrigeración/HVAC, purga
         refrigerantes, gases y accesorios de climatización.
    4. Deduplicación Estricta:
       - Elimina materiales, equipos y advertencias duplicadas en la salida.
    """
    if not result or not isinstance(result, dict):
        return

    desc_lower = (user_description or "").lower()
    is_removal = _is_removal_activity(user_description)

    # -------------------------------------------------------------------------
    # 1. PODA EN MATERIALES
    # -------------------------------------------------------------------------
    materials = result.get("materials", [])
    if isinstance(materials, list) and materials:
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
                continue

            # Si es DESMONTAJE: No debe comprarse el activo que se está desmontando
            if is_removal:
                is_asset_supply = any(bool(re.search(pat, mat_desc_upper)) for pat in ASSET_SUPPLY_PATTERNS)
                is_new_bulk_supply = bool(re.search(r"\b(CABLE\s+SUMERGIBLE|COLUMNA\s+DE\s+IMPULSION|TUBERIA\s+DE\s+IMPULSION)\b", mat_desc_upper))
                if is_asset_supply or is_new_bulk_supply:
                    logger.info("[DiscordantPruning] Purgado material de obra nueva en desmontaje: %s", mat_desc)
                    continue

            # Poda de gases de oxicorte para elementos livianos si no fue solicitado expresamente
            if is_lightweight and not explicit_cutting:
                if any(bool(re.search(pat, mat_desc_upper)) for pat in HEAVY_OXY_CUTTING_PATTERNS):
                    logger.info("[DiscordantPruning] Purgado material de oxicorte discordante en maniobra liviana: %s", mat_desc)
                    continue

            # Poda de gases refrigerantes si la partida no es de climatización/HVAC
            if not any(k in desc_lower for k in ["aire acondicionado", "refrigeracion", "chiller", "split", "fancoil"]):
                if re.search(r"\b(REFRIGERANTE|R-?22|R-?410|R-?134|GAS\s+REFRIGERANTE)\b", mat_desc_upper):
                    logger.info("[DiscordantPruning] Purgado insumo de refrigeración en partida no-HVAC: %s", mat_desc)
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
                continue

            # Poda de equipo de oxicorte en desmontaje de equipo liviano sin corte térmico
            if is_lightweight and not explicit_cutting:
                if re.search(r"\b(OXICORTE|EQUIPO\s+DE\s+OXICORTE|SOPLETE\s+DE\s+CORTE)\b", eq_desc_upper):
                    logger.info("[DiscordantPruning] Purgado equipo de oxicorte discordante en equipo liviano: %s", eq_desc)
                    continue

            # Poda de señorita de 5 TON si el equipo es liviano (<150 kg) a nivel de piso
            if is_lightweight and not is_deep_well:
                if re.search(r"\b(SENORITA\s+DE\s+CADENA|POLIPASTO)\s+DE\s+(CAPACIDAD\s*=\s*)?(?:5|10|15|20)\s*TON\b", eq_desc_upper):
                    logger.info("[DiscordantPruning] Purgada señorita de 5 TON sobredimensionada para maniobra liviana: %s", eq_desc)
                    continue

            seen_eq_keys.add(eq_key)
            clean_equipments.append(eq)

        result["equipments"] = clean_equipments

    # -------------------------------------------------------------------------
    # 3. DEDUPLICACIÓN Y FILTRADO DE ADVERTENCIAS
    # -------------------------------------------------------------------------
    advertencias = result.get("advertencias", [])
    if isinstance(advertencias, list) and advertencias:
        clean_advertencias: List[str] = []
        seen_adv_keys: Set[str] = set()

        for adv in advertencias:
            if not adv or not isinstance(adv, str):
                continue
            adv_strip = adv.strip()
            adv_key = _normalize_text_key(adv_strip)

            if adv_key in seen_adv_keys:
                continue

            # Si es desmontaje, purgar advertencias de activos suministrados
            if is_removal and any(k in adv_strip.upper() for k in ["BOMBA SUMERGIBLE", "BOMBA CENTRIFUGA", "TUBERÍA DE IMPULSIÓN", "TUBERIA DE IMPULSION", "CABLE SUMERGIBLE"]):
                continue

            seen_adv_keys.add(adv_key)
            clean_advertencias.append(adv_strip)

        result["advertencias"] = clean_advertencias

    # Actualizar conteos
    result["conteo_materiales"] = len(result.get("materials", []))
    result["conteo_equipos"] = len(result.get("equipments", []))
    result["conteo_mano_obra"] = len(result.get("labors", []))
