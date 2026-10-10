import re
from typing import Any, Dict, List, Set
from app.core.logging import logger


def _enforce_rapel_and_height_equipment(result: Dict[str, Any], user_description: str) -> None:
    """
    Salvaguarda determinista de seguridad para trabajos a rapel / trabajos verticales en altura.

    Si la descripción del usuario indica trabajos a rapel, cuerdas o trabajos verticales:
    1. Purga automáticamente cualquier andamio tubular o de marco que el LLM o la partida base
       hayan heredado erróneamente (son incompatibles y redundantes con trabajo vertical de suspensión).
    2. Garantiza la presencia obligatoria de los equipos oficiales de rapel del catálogo:
       - SEG020: EQUIPO DE RAPEL P/FACHADAS C/LINEA DE VI (tarifa de catálogo diaria: 0.55055, depreciación: 1.0)
       - SEG021: EQUIPO DE APOYO Y TABLA P/PINTAR RAPEL F (silleta de trabajo suspendido: 0.6056, depreciación: 1.0)
    """
    if not user_description or not isinstance(result, dict):
        return

    desc_lower = user_description.lower()
    rapel_pattern = re.compile(
        r"\b(rapel|r[aá]pel|cuerdas?|silletas?|gu[ií]ndolas?|trabajos?\s+vertical(es)?|trabajo\s+suspendido)\b",
        re.IGNORECASE
    )
    if not rapel_pattern.search(desc_lower):
        return

    equipments = result.get("equipments")
    if not isinstance(equipments, list):
        equipments = []
        result["equipments"] = equipments

    # 1. Purgar andamios tubulares / de marco
    scaffold_pattern = re.compile(
        r"\b(andamio\s+tubular|andamio\s+de\s+un\s+cuerpo|andamio\s+de\s+marco|andamio\s+modular|EQU-HER-014)\b",
        re.IGNORECASE
    )
    purged_scaffolds: List[str] = []
    filtered_equipments: List[Dict[str, Any]] = []
    for eq in equipments:
        if not isinstance(eq, dict):
            continue
        cod = str(eq.get("codigo") or "").strip().upper()
        desc = str(eq.get("descripcion") or "").strip()
        if scaffold_pattern.search(desc) or cod == "EQU-HER-014":
            purged_scaffolds.append(desc or cod)
        else:
            filtered_equipments.append(eq)

    if purged_scaffolds:
        logger.info(
            "[RapelEnforcement] Eliminados andamios incompatibles con rapel: %s",
            purged_scaffolds
        )
        result["equipments"] = filtered_equipments
        result.setdefault("notas_adaptacion", []).append(
            f"SEGURIDAD TÉCNICA: Se eliminaron andamios tubulares ({', '.join(purged_scaffolds)}) por incompatibilidad con el método de trabajo a rapel."
        )
        pruning_trace = result.setdefault("debug_pruning_trace", {
            "insumos_purgados": [],
            "equipos_purgados": [],
            "advertencias_purgadas": [],
            "total_eliminados": 0
        })
        for item_desc in purged_scaffolds:
            pruning_trace["equipos_purgados"].append({
                "descripcion": item_desc,
                "codigo": None,
                "motivo": "Andamio tubular incompatible con método de trabajo suspendido a rapel",
                "regla": "SEGURIDAD_RAPEL_SUSPENSION"
            })
        pruning_trace["total_eliminados"] = (
            len(pruning_trace["insumos_purgados"])
            + len(pruning_trace["equipos_purgados"])
            + len(pruning_trace["advertencias_purgadas"])
        )

    # Purgar andamios de materiales si el LLM los colocó erróneamente allí
    materials = result.get("materials")
    if isinstance(materials, list):
        result["materials"] = [
            m for m in materials
            if not (isinstance(m, dict) and (scaffold_pattern.search(str(m.get("descripcion") or "")) or str(m.get("codigo") or "").strip().upper() == "EQU-HER-014"))
        ]

    # 2. Verificar e inyectar equipos de rapel oficiales si faltan
    existing_codes: Set[str] = {str(eq.get("codigo") or "").strip().upper() for eq in result["equipments"] if isinstance(eq, dict)}
    existing_descs = " ".join(str(eq.get("descripcion") or "").lower() for eq in result["equipments"] if isinstance(eq, dict))

    has_seg020 = "SEG020" in existing_codes or "equipo de rapel" in existing_descs
    has_seg021 = "SEG021" in existing_codes or ("tabla" in existing_descs and "rapel" in existing_descs) or "silleta" in existing_descs

    injected: List[str] = []
    if not has_seg020:
        result["equipments"].append({
            "codigo": "SEG020",
            "descripcion": "EQUIPO DE RAPEL P/FACHADAS C/LINEA DE VI",
            "unidad": "día",
            "cantidad": 1.0,
            "depreciacion": 1.0,
            "precio_unitario": 0.55055,
            "origen": "historico",
            "nota_calculo": "Equipo de rapel y línea de vida para trabajos verticales suspendidos (catálogo oficial SEG020)."
        })
        injected.append("SEG020 (Equipo de Rapel c/Línea de Vida)")

    if not has_seg021:
        result["equipments"].append({
            "codigo": "SEG021",
            "descripcion": "EQUIPO DE APOYO Y TABLA P/PINTAR RAPEL F",
            "unidad": "día",
            "cantidad": 1.0,
            "depreciacion": 1.0,
            "precio_unitario": 0.6056,
            "origen": "historico",
            "nota_calculo": "Silleta / tabla de apoyo para operario en trabajo suspendido a rapel (catálogo oficial SEG021)."
        })
        injected.append("SEG021 (Silleta / Tabla de Apoyo)")

    if injected:
        logger.info("[RapelEnforcement] Inyectados equipos oficiales de rapel: %s", injected)
        result.setdefault("notas_adaptacion", []).append(
            f"SEGURIDAD TÉCNICA: Se incorporaron los equipos normativos de rapel ({', '.join(injected)}) indispensables para la ejecución vertical."
        )
