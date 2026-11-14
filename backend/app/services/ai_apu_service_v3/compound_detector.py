"""
Detector generico de N actividades en descripciones compuestas (Motor v3.0).

Un LLM ligero estructura la descripcion en actividades (sin precios, sin cuadrillas) y un
validador determinista revisa unidades, magnitudes y fracciones. No depende de ningun caso
particular: sirve para cualquier macro partida.
"""

import json
import unicodedata
from typing import Any, Callable, Dict, List, Optional

from app.core.logging import logger
from app.services.ai_apu_service_v3.compound_params import resolve_ferrous_pct
from app.services.ai_apu_service_v3.conversion_registry import MATERIAL_DENSITIES
from app.services.ai_apu_service_v3.schemas import ActivityScope, CompoundPlan
from app.services.llm_router import call_llm_json

# Unidad canonica -> magnitud que mide
_UNIT_TO_CARRIER: Dict[str, str] = {
    "ton": "mass",
    "kg": "mass",
    "m3": "volume",
    "gl": "lump",
    "m2": "area",
    "m": "length",
    "vje": "volume",
}

_DETECTOR_SYSTEM_PROMPT = """Eres un Ingeniero de Costos venezolano (Norma COVENIN 2000).
Recibes la descripcion de UNA partida compuesta de un pliego y debes decidir si integra varias
fases/sub-partidas constructivas distintas y estructurarlas sin solapamiento.
REGLAS ESTRICTAS:
1. CONSOLIDACION EN 2 A 5 SUB-PARTIDAS MAXIMO: Agrupa las tareas conexas que ejecuta una misma cuadrilla/frente (ej. "fragmentacion mecanica, manipulacion y corte especializado de escombros" va en UNA sola sub-partida; "separacion, acopio y carga de materiales ferrosos" va en UNA sola sub-partida).
2. PROHIBIDO REPETIR EL VERBO "DEMOLICION" EN LAS DEMAS SUB-PARTIDAS: Solo la sub-partida de demolicion lleva la palabra "DEMOLICION". Las demas deben iniciar con su accion propia (APUNTALAMIENTO..., FRAGMENTACION Y CORTE DE ESCOMBROS DE CONCRETO..., CARGA MECANICA DE ESCOMBROS NO FERROSOS..., SEPARACION, ACOPIO Y CARGA DE CHATARRA/ACERO FERROSO...) para no duplicar la demolicion en el buscador RAG.
3. NO inventes precios, cuadrillas ni rendimientos. Responde SOLO JSON valido."""


def _build_detector_prompt(user_description: str, master_unit: str) -> str:
    materials = ", ".join(sorted(MATERIAL_DENSITIES))
    return (
        f"DESCRIPCION DE LA PARTIDA:\n\"{user_description}\"\n"
        f"La partida se mide en: {master_unit}\n\n"
        "Separa las sub-partidas mutuamente excluyentes (entre 2 y 5 sub-partidas) en orden de ejecucion. "
        "Para cada una devuelve:\n"
        "- tag: identificador corto en MAYUSCULAS_CON_GUION_BAJO\n"
        "- description: descripcion tecnica COVENIN en MAYUSCULAS de esa fase especifica, SIN incluir la palabra "
        "'DEMOLICION' salvo en la sub-partida que demuele la estructura\n"
        "- unit: unidad NATURAL de computo de esa actividad segun COVENIN (ej. demolicion/excavacion/relleno/"
        "fragmentacion/carga en m3, pintura/apuntalamiento en m2, tuberia en m, acopio de metal en kg o ton). "
        "NO uses la unidad de la partida maestra por defecto; elige entre: ton, kg, m3, Gl, m2, m\n"
        "carga en m3, pintura en m2, tuberia en m, trabajos de acopio de metal en kg o ton). "
        "NO uses la unidad de la partida maestra por defecto; elige entre: ton, kg, m3, Gl, m2, m\n"
        f"- material: material que mueve o trabaja, uno de: {materials}\n"
        "- state: 'en_sitio' si se mide antes de demolerlo o excavarlo, 'suelto' si ya esta fragmentado/en camion\n"
        "- share_kind: 'all' si procesa todo el material, 'ferrous' si procesa solo la fraccion ferrosa/metalica, "
        "'non_ferrous' si procesa todo menos la fraccion ferrosa\n"
        "- order: entero desde 1\n"
        "Si la descripcion contiene una sola actividad, devuelve is_compound=false.\n\n"
        "JSON exacto:\n"
        "{\"is_compound\": true, \"activities\": [{\"tag\": \"X\", \"description\": \"...\", \"unit\": \"m3\", "
        "\"material\": \"escombro_mixto\", \"state\": \"suelto\", \"share_kind\": \"all\", \"order\": 1}]}"
    )


def _normalize_unit_key(unit: str) -> str:
    nfkd = unicodedata.normalize("NFKD", str(unit or "").strip().lower().replace("³", "3"))
    clean = "".join(ch for ch in nfkd if not unicodedata.combining(ch))
    aliases = {"t": "ton", "tn": "ton", "tm": "ton", "tonelada": "ton", "toneladas": "ton", "kgf": "kg", "sg": "gl"}
    return aliases.get(clean, clean)


def _share_for(kind: str, pct: float) -> float:
    if kind == "ferrous":
        return pct / 100.0
    if kind == "non_ferrous":
        return 1.0 - pct / 100.0
    return 1.0


def validate_detected_activities(
    raw: Dict[str, Any],
    ferrous_pct: float,
    master_unit: str = "ton",
) -> CompoundPlan:
    """Valida y normaliza la salida del LLM. Descarta actividades invalidas."""
    if not isinstance(raw, dict) or not raw.get("is_compound"):
        return CompoundPlan(is_compound=False, master_unit=master_unit, ferrous_pct=ferrous_pct)

    activities: List[ActivityScope] = []
    seen_tags: set[str] = set()
    for idx, item in enumerate(raw.get("activities") or []):
        if not isinstance(item, dict):
            continue
        unit = _normalize_unit_key(str(item.get("unit") or ""))
        carrier = _UNIT_TO_CARRIER.get(unit)
        desc = str(item.get("description") or "").strip()
        tag = str(item.get("tag") or f"ACTIVIDAD_{idx + 1}").strip().upper()
        if carrier is None or len(desc) < 5 or tag in seen_tags:
            logger.error("[V3 Compound] Actividad descartada por invalida: %s", json.dumps(item, ensure_ascii=False))
            continue
        seen_tags.add(tag)
        material = str(item.get("material") or "escombro_mixto").strip().lower()
        state = str(item.get("state") or "suelto").strip().lower()
        kind = str(item.get("share_kind") or "all").strip().lower()
        if kind not in ("all", "ferrous", "non_ferrous"):
            kind = "all"
        if state not in ("en_sitio", "suelto"):
            state = "suelto"
        activities.append(
            ActivityScope(
                tag=tag,
                description=desc.upper(),
                share=_share_for(kind, ferrous_pct),
                order=int(item.get("order") or idx + 1),
                unit=unit,
                carrier=carrier,  # type: ignore[arg-type]
                material=material,
                state=state,  # type: ignore[arg-type]
                share_kind=kind,  # type: ignore[arg-type]
            )
        )

    if len(activities) < 2:
        return CompoundPlan(is_compound=False, master_unit=master_unit, ferrous_pct=ferrous_pct)
    activities.sort(key=lambda a: a.order)
    return CompoundPlan(is_compound=True, master_unit=master_unit, ferrous_pct=ferrous_pct, activities=activities)


def detect_compound_activities(
    user_description: str,
    ferrous_pct: Optional[float] = None,
    master_unit: str = "ton",
    llm_call: Callable[..., Dict[str, Any]] = call_llm_json,
) -> CompoundPlan:
    """
    Detecta y estructura las actividades de una macro partida. Si el LLM falla, devuelve un plan
    no compuesto (el motor sigue por el flujo normal) y deja el error en el log.
    """
    if not user_description or not isinstance(user_description, str) or not user_description.strip():
        raise ValueError("user_description es obligatorio y debe ser una cadena no vacia")

    pct = resolve_ferrous_pct(ferrous_pct)
    try:
        raw = llm_call(
            prompt=_build_detector_prompt(user_description, master_unit),
            use_case="cost360",
            system_prompt=_DETECTOR_SYSTEM_PROMPT,
        )
    except Exception as exc:
        logger.error("[V3 Compound] Fallo el LLM del detector: %s", exc, exc_info=True)
        return CompoundPlan(is_compound=False, master_unit=master_unit, ferrous_pct=pct)
    return validate_detected_activities(raw, pct, master_unit)
