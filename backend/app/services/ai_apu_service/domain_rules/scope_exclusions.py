import re
from typing import Any, Dict, List
from app.core.logging import logger


def _enforce_scope_exclusions(result: Dict[str, Any], user_description: str) -> None:
    """
    Salvaguarda determinista de exclusiones de alcance explícitas.

    El LLM a veces ignora instrucciones como "no incluye suministro de materiales"
    y de todas formas agrega materiales. Esta función detecta esas frases en la
    descripción del usuario y limpia la sección correspondiente del resultado,
    INDEPENDIENTEMENTE de lo que el LLM haya decidido.

    Modifica `result` in-place. No retorna nada.
    """
    if not user_description or not isinstance(result, dict):
        return

    desc_lower = user_description.lower()

    # --- EXCLUSIÓN DE MATERIALES / SUMINISTRO ---
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
    if any(re.search(pat, desc_lower) for pat in excl_materiales):
        if result.get("materials"):
            logger.info(
                "[ScopeExclusion] Descripción indica exclusión de materiales. "
                "Eliminando %d materiales del resultado LLM.",
                len(result["materials"])
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
                    "motivo": "Material excluido por instrucción explícita del usuario",
                    "regla": "EXCLUSION_ALCANCE_MATERIALES"
                })
            result["materials"] = []
            result.setdefault("notas_adaptacion", []).append(
                "EXCLUSIÓN DE ALCANCE: Materiales/suministro eliminados por instrucción explícita del usuario."
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
                "[ScopeExclusion] Descripción indica exclusión de mano de obra. "
                "Eliminando %d obreros del resultado LLM.",
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
                "[ScopeExclusion] Descripción indica exclusión de equipos. "
                "Eliminando %d equipos del resultado LLM.",
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
