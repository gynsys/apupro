import re
from typing import Any, Dict, List, Optional

from app.core.logging import logger
import app.services.parametric_contract_engine as pce
from app.services.parametric_contract_engine.taxonomy import EMPIRICAL_TAXONOMY


def is_surface_treatment(text: str) -> bool:
    """Detecta si la consulta corresponde a una actividad superficial o de acabado."""
    if not text:
        return False
    lower = text.lower()
    return bool(
        re.search(
            r"\b(pintura|pintar|pintad[oa]|esmalte|caucho|fondo|lavado|limpieza|hidrojet|"
            r"sellado|impermeabiliz|manto|impermeabilizaci[oó]n|revestimiento|friso|frisar|"
            r"tarrajeo|enlucido|estuco)\b",
            lower,
        )
    )


def is_demolition_action(text: str) -> bool:
    """Detecta si la consulta corresponde a demolición, picado o desmontaje."""
    if not text:
        return False
    lower = text.lower()
    return bool(
        re.search(
            r"\b(demolicion|demolición|demoler|picar|picado|tumbar|derribar|desmontaje|desmontar)\b",
            lower,
        )
    )


def evaluate_parametric_contract(query: str) -> Optional[Dict[str, Any]]:
    """
    Evalúa una consulta contra el Motor de Contratos Paramétricos Empíricos.

    Retorna un diccionario de aclaratoria estructurada si falta un parámetro crítico,
    o None si la consulta es técnicamente suficiente o si el motor está desactivado.
    """
    if not pce.ENABLE_PARAMETRIC_ENGINE:
        return None

    if not query or not isinstance(query, str) or len(query.strip()) < 3:
        return None

    clean = query.strip()
    lower = clean.lower()

    if is_demolition_action(lower):
        return None

    # 1. Losas de Concreto Estructural (excluyendo pinturas e impermeabilizaciones)
    if re.search(r"\blosa\b", lower) and not is_surface_treatment(lower):
        has_thickness = bool(re.search(r"\be\s*=\s*\d+|\b\d+\s*(cm|cms)\b|\bespesor\b", lower))
        if not has_thickness:
            cfg = EMPIRICAL_TAXONOMY["losas_concreto"]
            return {
                "status": "clarification_needed",
                "clarification_type": "parametric_specification_required",
                "_internal_code": "PARAMETRIC_ENGINE_MISSING_LOSA_ESPESOR",
                "clarification_message": "¿De qué espesor y resistencia es la losa de concreto?",
                "recommendation": "Selecciona la especificación técnica para estructurar el APU:",
                "questions": [cfg["pregunta"]],
                "options": cfg["chips_sugeridos"][:-1],
            }

    # 2. Sobrepisos y Nivelaciones
    if re.search(r"\b(sobrepiso|nivelaci[oó]n|afinado)\b", lower):
        has_thickness = bool(re.search(r"\be\s*=\s*\d+|\b\d+(\.\d+)?\s*(cm|cms)\b|\bespesor\b", lower))
        has_mix = bool(re.search(r"\b1:\d\b|\bconcreto\b|\bmortero\b", lower))
        if not has_thickness or not has_mix:
            cfg = EMPIRICAL_TAXONOMY["sobrepisos_nivelacion"]
            return {
                "status": "clarification_needed",
                "clarification_type": "parametric_specification_required",
                "_internal_code": "PARAMETRIC_ENGINE_MISSING_SOBREPISO_PARAMS",
                "clarification_message": "¿Qué espesor y dosificación de mortero tiene el sobrepiso?",
                "recommendation": "Selecciona la proporción y espesor requerido:",
                "questions": [cfg["pregunta"]],
                "options": cfg["chips_sugeridos"][:-1],
            }

    # 3. Paredes de Bloques / Mampostería (no demolición ni pintura pura)
    if re.search(r"\b(pared|muro|tabique|bloque)\b", lower) and not is_surface_treatment(lower):
        has_thickness = bool(re.search(r"\be\s*=\s*\d+|\b\d+\s*(cm|cms)\b|\b\d+x\d+x\d+\b", lower))
        if not has_thickness:
            cfg = EMPIRICAL_TAXONOMY["mamposteria_bloques"]
            return {
                "status": "clarification_needed",
                "clarification_type": "parametric_specification_required",
                "_internal_code": "PARAMETRIC_ENGINE_MISSING_BLOQUE_ESPESOR",
                "clarification_message": "¿De qué espesor y material es el bloque de la pared?",
                "recommendation": "Selecciona el espesor de pared requerido:",
                "questions": [cfg["pregunta"]],
                "options": cfg["chips_sugeridos"][:-1],
            }

    # 4. Tuberías y Válvulas
    if re.search(r"\b(tuberia|tubería|tubo|valvula|válvula)\b", lower):
        has_diam = bool(
            re.search(
                r"\bd\s*=\s*|\b\d+(\.\d+)?\s*(pulg|pulgadas?|\"|mm)\b|\b\d+\s*\/\s*\d+\s*(pulg|\"|mm)?\b|\b\d+\s*mm\b|\b(1\/2|3\/4|1|1-1\/2|2|3|4|6|8)\s*(pulg|\"|in)?\b|\bdiametro\b",
                lower,
            )
        )
        if not has_diam:
            cfg = EMPIRICAL_TAXONOMY["tuberias_sanitarias_hidraulicas"]
            return {
                "status": "clarification_needed",
                "clarification_type": "parametric_specification_required",
                "_internal_code": "PARAMETRIC_ENGINE_MISSING_TUBERIA_DIAMETRO",
                "clarification_message": "¿Qué diámetro nominal y material tiene la tubería?",
                "recommendation": "Selecciona el diámetro correspondiente:",
                "questions": [cfg["pregunta"]],
                "options": cfg["chips_sugeridos"][:-1],
            }

    # 5. Bombas y Equipos Hidroneumáticos
    if re.search(r"\b(bomba|electrobomba|motobomba)\b", lower):
        has_hp = bool(re.search(r"\b\d+([\.,]\d+)?\s*(hp|cv|kw)\b|\b(0\.5|1\.5|1\/2|3\/4)\s*hp\b", lower))
        if not has_hp:
            cfg = EMPIRICAL_TAXONOMY["equipos_bombeo"]
            return {
                "status": "clarification_needed",
                "clarification_type": "parametric_specification_required",
                "_internal_code": "PARAMETRIC_ENGINE_MISSING_BOMBA_POTENCIA",
                "clarification_message": "¿Qué potencia (HP) tiene la bomba o equipo?",
                "recommendation": "Selecciona la potencia estimada:",
                "questions": [cfg["pregunta"]],
                "options": cfg["chips_sugeridos"][:-1],
            }

    return None
