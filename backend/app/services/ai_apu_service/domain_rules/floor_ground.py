import re
from typing import Any, Dict, List, Set
from app.core.logging import logger


def _enforce_floor_ground_equipment(result: Dict[str, Any], user_description: str) -> None:
    """
    Salvaguarda determinista de backend para trabajos a nivel de piso / suelo / pavimentos.

    Si la actividad constructiva se realiza sobre pisos, pavimentos, aceras, losas de fundación,
    radieres o suelo, y NO es un trabajo en altura explícito (torres, rapel, fachadas, techos):
    Purga automáticamente cualquier equipo o material de trabajo en altura heredado del APU base
    o propuesto erróneamente por el LLM:
    - Arneses de seguridad y líneas de vida (ARNES, LINEA DE VIDA, EQU-GEN-023, ARB010, SEG020, etc.)
    - Escaleras extensibles de torre o gran altura (ESCALERA EXTENSIBLE, 16 TRAMOS, SUB072, EQU-GEN-466)
    - Andamios tubulares (ANDAMIO, EQU-HER-014)
    """
    if not isinstance(result, dict) or not user_description:
        return

    partida_desc = str(result.get("partida", {}).get("description", "")) if isinstance(result.get("partida"), dict) else ""
    combined_text = f"{user_description} {partida_desc}".lower()

    # Indicadores de trabajo a ras de piso / suelo / pavimento
    floor_pattern = re.compile(
        r"\b(pisos?|pavimentos?|aceras?|radieres?|contrapisos?|sobrepisos?|losa(s)?\s+de\s+piso|losa(s)?\s+de\s+fundaci[oó]n|calzadas?|vialidad(es)?|brocales?|sub[- ]?base)\b",
        re.IGNORECASE
    )

    # Indicadores de trabajo en altura legítimo
    height_pattern = re.compile(
        r"\b(rapel|r[aá]pel|torres?|fachadas?|techos?|cubiertas?|cielorrasos?|postes?|aleros?|cornisas?|guindolas?|trabajos?\s+vertical(es)?|trabajo\s+en\s+altura)\b",
        re.IGNORECASE
    )

    is_floor = bool(floor_pattern.search(combined_text))
    is_legit_height = bool(height_pattern.search(user_description.lower()))

    # Solo purgar si es trabajo de piso y el usuario NO pidió expresamente trabajos de altura
    if not is_floor or is_legit_height:
        return

    # Patrones de equipos de trabajo en altura / arneses / escaleras extensibles
    height_equipment_pattern = re.compile(
        r"\b(arn[eé]s|l[ií]nea\s+de\s+vida|escalera\s+extensible|escalera\s+de\s+aluminio\s+16|escalera\s+16\s+tramos|andamio|silleta|guindola)\b",
        re.IGNORECASE
    )
    height_equipment_codes: Set[str] = {"EQU-GEN-023", "ARB010", "SUB072", "EQU-GEN-466", "EQU-HER-014", "SEG020", "SEG021"}

    purged_items: List[str] = []

    # 1. Purgar de equipments
    equipments = result.get("equipments")
    if isinstance(equipments, list):
        filtered_eq: List[Dict[str, Any]] = []
        for eq in equipments:
            if not isinstance(eq, dict):
                continue
            desc = str(eq.get("descripcion") or "").strip()
            cod = str(eq.get("codigo") or "").strip().upper()
            if height_equipment_pattern.search(desc) or cod in height_equipment_codes:
                purged_items.append(desc or cod)
            else:
                filtered_eq.append(eq)
        result["equipments"] = filtered_eq

    # 2. Purgar de materials por si el LLM los colocó allí
    materials = result.get("materials")
    if isinstance(materials, list):
        filtered_mat: List[Dict[str, Any]] = []
        for mat in materials:
            if not isinstance(mat, dict):
                continue
            desc = str(mat.get("descripcion") or "").strip()
            cod = str(mat.get("codigo") or "").strip().upper()
            if height_equipment_pattern.search(desc) or cod in height_equipment_codes:
                purged_items.append(desc or cod)
            else:
                filtered_mat.append(mat)
        result["materials"] = filtered_mat

    if purged_items:
        logger.info(
            "[FloorGroundEnforcement] Purgados equipos de altura en trabajo de piso: %s",
            purged_items
        )
        result.setdefault("notas_adaptacion", []).append(
            f"SEGURIDAD TÉCNICA: Se eliminaron equipos de trabajo en altura ({', '.join(purged_items)}) por incompatibilidad física con actividades a nivel de piso/pavimento."
        )
        pruning_trace = result.setdefault("debug_pruning_trace", {
            "insumos_purgados": [],
            "equipos_purgados": [],
            "advertencias_purgadas": [],
            "total_eliminados": 0
        })
        for item_desc in purged_items:
            pruning_trace["equipos_purgados"].append({
                "descripcion": item_desc,
                "codigo": None,
                "motivo": "Equipo de trabajo en altura incompatible con actividad a nivel de piso",
                "regla": "SEGURIDAD_ALTURA_PISO"
            })
        pruning_trace["total_eliminados"] = (
            len(pruning_trace["insumos_purgados"])
            + len(pruning_trace["equipos_purgados"])
            + len(pruning_trace["advertencias_purgadas"])
        )
