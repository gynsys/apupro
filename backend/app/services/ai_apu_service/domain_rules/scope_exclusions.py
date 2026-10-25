import re
from typing import Any, Dict, List, Tuple
from app.core.logging import logger


# ---------------------------------------------------------------------------
# Detección determinista de actividades que NO llevan materiales en sus APUs
# ---------------------------------------------------------------------------
_NO_MATERIAL_EXCLUSIONS: List[str] = [
    r"\bno\s+incluye?\s+(el\s+)?suministro\b",
    r"\bsin\s+suministro\b",
    r"\bno\s+incluye?\s+material\b",
    r"\bsin\s+materiales?\b",
    r"\bexcluye?\s+(el\s+)?suministro\b",
    r"\bexcluye?\s+(los?\s+)?materiales?\b",
    r"\bsolo\s+mano\s+de\s+obra\b",
    r"\bunicamente\s+mano\s+de\s+obra\b",
    r"\bsolo\s+instalaci[oó]n\b",
]

_NO_MATERIAL_STARTS: List[str] = [
    r"^(demolici[oó]n|demoler)\b",
    r"^(desmantelamiento|desmantelar)\b",
    r"^(desmonte|desmontar|desmontaje)\b",
    r"^(retiro|retirar)\b",
    r"^(remoci[oó]n|remover)\b",
    r"^(picado|picoteo|picar)\b",
    r"^(raspado|raspar|rasqueteo|rasquetear)\b",
    r"^(ranurado|ranurar)\b",
    r"^(desinstalaci[oó]n|desinstalar)\b",
    r"^(excavaci[oó]n|excavar)\b",
    r"^(acarreo|acarrear)\b",
    r"^(carga\s+a\s+mano|carga\s+con\s+equipo|cargar|cargue)\b",
    r"^(descarga|descargar|descargue)\b",
    r"^(transporte\s+y\s+bote|bote\s+de\s+escombros?|bote\s+de\s+basura|desalojo\s+de\s+escombros?)\b",
    r"^(compactaci[oó]n|compactar)\b",
    r"^(perfilado|perfilar)\b",
    r"^(nivelaci[oó]n\s+y\s+compactaci[oó]n|conformaci[oó]n\s+y\s+nivelaci[oó]n|nivelaci[oó]n\s+de\s+terreno)\b",
    r"^(trazado|trazar|replanteo|replantear)\b",
    r"^(supervisi[oó]n|supervisar|inspecci[oó]n)\b",
    r"^(prueba\s+de\s+estanqueidad|prueba\s+hidrost[aá]tica|ensayo|pruebas?\s+de\s+carga)\b",
    r"^(limpieza\s+general|limpieza\s+de\s+la\s+obra|limpieza\s+final|desmalezamiento)\b",
    r"^(preparaci[oó]n\s+de\s+(la\s+)?superficie.*(limpieza|moho|hongos?|lija))\b",
    r"^(lijado|lijar)\b",
    r"^(pulido|pulitura|desbaste)\b",
    r"^(resanado|resane)\s+(puntual|superficial|de\s+grietas?)\b",
]

_NO_MATERIAL_ANYWHERE: List[str] = [
    r"\b(demolici[oó]n|demoler)\b",
    r"\b(desmantelamiento|desmantelar)\b",
    r"\b(desmonte|desmontar|desmontaje)\b",
    r"\b(remoci[oó]n|remover)\b",
    r"\b(desinstalaci[oó]n|desinstalar)\b",
    r"\b(picado\s+de|picoteo\s+de)\b",
    r"\b(acarreo\s+a\s+mano|acarreo\s+vertical|acarreo\s+horizontal|acarrear\s+a\s+mano)\b",
    r"\b(bote\s+de\s+escombros?|bote\s+de\s+basura|transporte\s+y\s+bote)\b",
    r"\b(limpieza\s+general\s+de\s+la\s+obra|limpieza\s+final)\b",
    r"\b(prueba\s+de\s+estanqueidad|prueba\s+hidrost[aá]tica)\b",
    r"\b(trazado\s+y\s+replanteo)\b",
]

_SUPPLY_VERBS: List[str] = [
    r"\bsuministro\b", r"\bs/i\b", r"\bs/c\b", r"\bs/t/c\b", r"\bs/t/i\b",
    r"\bconstrucci[oó]n\b", r"\bconfecci[oó]n\b", r"\bfabricaci[oó]n\b",
    r"\bcolocaci[oó]n\b", r"\baplicaci[oó]n\b", r"\baplicar\b",
    r"\breparaci[oó]n\b", r"\breparar\b", r"\brehabilitaci[oó]n\b", r"\brehabilitar\b",
    r"\bfriso\b", r"\bmortero\b", r"\bconcreto\b", r"\bpintura\b",
    r"\bencamisado\b", r"\bimpermeabilizaci[oó]n\b", r"\brevestimiento\b"
]


def is_labor_only_activity(desc: str) -> Tuple[bool, str]:
    """
    Determina si una partida constructiva es estrictamente de mano de obra y equipo,
    y por tanto NUNCA debe contener insumos de materiales en su APU.
    """
    if not desc or not isinstance(desc, str):
        return False, ""

    desc_clean = desc.strip().lower()

    # 1. Reglas explícitas de exclusión
    for ex in _NO_MATERIAL_EXCLUSIONS:
        if re.search(ex, desc_clean):
            return True, "Exclusión explícita de materiales en descripción técnica"

    # 2. Si la partida COMIENZA por una acción de desincorporación, demolición o servicio
    for start_pat in _NO_MATERIAL_STARTS:
        if re.search(start_pat, desc_clean):
            if re.search(r"\by\s+(construcci[oó]n|suministro|colocaci[oó]n|reemplazo\s+con\s+suministro)\b", desc_clean):
                return False, ""
            return True, "Actividad técnica sin materiales (demolición, remoción, excavación, acarreo, servicio o prueba)"

    # 3. Acciones en cualquier parte del texto si no hay suministro
    for any_pat in _NO_MATERIAL_ANYWHERE:
        if re.search(any_pat, desc_clean):
            has_supply = any(re.search(sup, desc_clean) for sup in _SUPPLY_VERBS)
            if not has_supply:
                return True, "Acción de servicio/desincorporación sin suministro de materiales"

    return False, ""


def _enforce_scope_exclusions(result: Dict[str, Any], user_description: str) -> None:
    """
    Salvaguarda determinista de exclusiones de alcance explícitas y actividades sin materiales.
    Modifica `result` in-place.
    """
    if not user_description or not isinstance(result, dict):
        return

    desc_lower = user_description.lower()

    # --- EXCLUSIÓN DE MATERIALES / SUMINISTRO EXPLÍCITA O POR ACTIVIDAD TÉCNICA ---
    is_lo, lo_reason = is_labor_only_activity(user_description)
    excl_materiales: List[str] = [
        r"\bno\s+incluye?\s+(el\s+)?suministro\b",
        r"\bsin\s+suministro\b",
        r"\bno\s+incluye?\s+(los?\s+)?materiales?\b",
        r"\bsin\s+materiales?\b",
        r"\bno\s+incluye?\s+material\b",
        r"\bexcluye?\s+(el\s+)?suministro\b",
        r"\bexcluye?\s+(los?\s+)?materiales?\b",
        r"\bsolo\s+(mano\s+de\s+obra|m\.?o\.?)\b",
        r"\b(únicamente|unicamente|solo)\s+instalaci[oó]n\b",
    ]
    should_purge_materials = is_lo or any(re.search(pat, desc_lower) for pat in excl_materiales)

    if should_purge_materials:
        if result.get("materials"):
            logger.info(
                "[ScopeExclusion] Actividad sin materiales detectada (%s). Eliminando %d materiales del resultado.",
                lo_reason or "Exclusión explícita", len(result["materials"])
            )
            pruning_trace = result.setdefault("debug_pruning_trace", {
                "insumos_purgados": [],
                "equipos_purgados": [],
                "advertencias_purgadas": [],
                "total_eliminados": 0
            })
            for m in result["materials"]:
                pruning_trace["insumos_purgados"].append({
                    "descripcion": m.get("descripcion") if isinstance(m, dict) else str(m),
                    "codigo": m.get("codigo") if isinstance(m, dict) else None,
                    "motivo": f"Material excluido por norma técnica: {lo_reason or 'Instrucción explícita'}",
                    "regla": "EXCLUSION_ALCANCE_MATERIALES"
                })
            result["materials"] = []
            result.setdefault("notas_adaptacion", []).append(
                f"EXCLUSIÓN DE MATERIALES: La actividad ({lo_reason or 'exclusión explícita'}) es estrictamente de mano de obra y equipos."
            )

    # --- EXCLUSIÓN DE MANO DE OBRA ---
    excl_mo: List[str] = [
        r"\bno\s+incluye?\s+(la\s+)?mano\s+de\s+obra\b",
        r"\bsin\s+mano\s+de\s+obra\b",
        r"\bexcluye?\s+(la\s+)?mano\s+de\s+obra\b",
        r"\bno\s+incluye?\s+m\.?o\.?\b",
        r"\bsolo\s+(suministro|materiales?)\b",
    ]
    if any(re.search(pat, desc_lower) for pat in excl_mo):
        if result.get("labors"):
            logger.info(
                "[ScopeExclusion] Descripción indica exclusión de mano de obra. Eliminando %d obreros del resultado.",
                len(result["labors"])
            )
            pruning_trace = result.setdefault("debug_pruning_trace", {
                "insumos_purgados": [],
                "equipos_purgados": [],
                "advertencias_purgadas": [],
                "total_eliminados": 0
            })
            for l in result["labors"]:
                pruning_trace["insumos_purgados"].append({
                    "descripcion": l.get("descripcion") if isinstance(l, dict) else str(l),
                    "codigo": l.get("codigo") if isinstance(l, dict) else None,
                    "motivo": "Mano de obra excluida por instrucción explícita del usuario",
                    "regla": "EXCLUSION_ALCANCE_MANO_OBRA"
                })
            result["labors"] = []
            result.setdefault("notas_adaptacion", []).append(
                "EXCLUSIÓN DE ALCANCE: Mano de obra eliminada por instrucción explícita del usuario."
            )

    # --- EXCLUSIÓN DE EQUIPOS ---
    excl_eq: List[str] = [
        r"\bno\s+incluye?\s+(los?\s+)?equipos?\b",
        r"\bsin\s+equipos?\b",
        r"\bexcluye?\s+(los?\s+)?equipos?\b",
    ]
    if any(re.search(pat, desc_lower) for pat in excl_eq):
        if result.get("equipments"):
            logger.info(
                "[ScopeExclusion] Descripción indica exclusión de equipos. Eliminando %d equipos del resultado.",
                len(result["equipments"])
            )
            pruning_trace = result.setdefault("debug_pruning_trace", {
                "insumos_purgados": [],
                "equipos_purgados": [],
                "advertencias_purgadas": [],
                "total_eliminados": 0
            })
            for eq in result["equipments"]:
                pruning_trace["equipos_purgados"].append({
                    "descripcion": eq.get("descripcion") if isinstance(eq, dict) else str(eq),
                    "codigo": eq.get("codigo") if isinstance(eq, dict) else None,
                    "motivo": "Equipo excluido por instrucción explícita del usuario",
                    "regla": "EXCLUSION_ALCANCE_EQUIPOS"
                })
            result["equipments"] = []
            result.setdefault("notas_adaptacion", []).append(
                "EXCLUSIÓN DE ALCANCE: Equipos eliminados por instrucción explícita del usuario."
            )

    if "debug_pruning_trace" in result:
        pt = result["debug_pruning_trace"]
        pt["total_eliminados"] = len(pt.get("insumos_purgados", [])) + len(pt.get("equipos_purgados", [])) + len(pt.get("advertencias_purgadas", []))
