"""
Detector generico de N actividades en descripciones compuestas (Motor v3.0).

Un LLM ligero estructura la descripcion en actividades (sin precios, sin cuadrillas) y un
validador determinista revisa unidades, magnitudes y fracciones. No depende de ningun caso
particular: sirve para cualquier macro partida.
"""

import json
import re
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
1. CONSOLIDACION EN 2 A 6 SUB-PARTIDAS MAXIMO: Agrupa las tareas conexas que ejecuta una misma cuadrilla/frente (ej. "apuntalamiento temporal y desconexion/retiro previo de instalaciones" o por separado; "fragmentacion mecanica, manipulacion y corte especializado de escombros" va en UNA sola sub-partida). NUNCA fusiones la "separacion, acopio y carga de materiales ferrosos" (share_kind: "ferrous") con la "carga mecanica de escombros no ferrosos" (share_kind: "non_ferrous", unit: "m3"), ya que procesan fracciones y materiales distintos.
2. PROHIBIDO REPETIR EL VERBO "DEMOLICION" EN LAS DEMAS SUB-PARTIDAS: Solo la sub-partida de demolicion lleva la palabra "DEMOLICION". Las demas deben iniciar con su accion propia (APUNTALAMIENTO..., FRAGMENTACION MECANICA Y CORTE CON OXICORTE DE ESCOMBROS..., CARGA CON EQUIPO PESADO CARGADOR PAYLOADER DE ESCOMBROS NO FERROSOS..., SEPARACION, CORTE CON OXICORTE, ACOPIO Y CARGA DE MATERIALES FERROSOS...) para no duplicar la demolicion en el buscador RAG.
3. PROHIBIDO ADIVINAR ANTE AMBIGÜEDADES TECNICAS (ACLARATORIA OBLIGATORIA): Si una sub-partida tiene una ambigüedad técnica porque el usuario NO especificó su material definitorio, sistema constructivo o método (ej. dice "apuntalamiento temporal de seguridad" sin indicar si es con puntales metálicos telescópicos, perfiles de acero o puntales de madera), PROHIBIDO escribir disyuntivas como "METALICO O DE MADERA" o asumir uno al azar. En ese caso, llena "ambiguity_question" con la pregunta clara para el usuario y "ambiguity_options" con 2 a 4 opciones técnicas concretas. Si el usuario YA especificó el material/método en su texto, deja "ambiguity_question": null y "ambiguity_options": [].
4. PROPAGACION EXPLICITA DE EQUIPOS PESADOS Y OXICORTE: Cuando la partida involucra medios mecánicos, fragmentación en el suelo, corte especializado o carga mecánica, especifica explícitamente la maquinaria de obra civil en la descripción de cada sub-partida (RETROEXCAVADORA CON MARTILLO HIDRAULICO para fragmentar concreto en el suelo, EQUIPO DE OXICORTE para corte especializado de cabillas/perfiles y separación de ferrosos, CARGADOR FRONTAL PAYLOADER / EQUIPO PESADO para carga mecánica de escombros).
5. NO inventes precios, cuadrillas ni rendimientos. Responde SOLO JSON valido."""


def _build_detector_prompt(user_description: str, master_unit: str) -> str:
    materials = ", ".join(sorted(MATERIAL_DENSITIES))
    return (
        f"DESCRIPCION DE LA PARTIDA:\n\"{user_description}\"\n"
        f"La partida se mide en: {master_unit}\n\n"
        "Separa las sub-partidas mutuamente excluyentes (entre 2 y 6 sub-partidas) en orden de ejecucion. "
        "Para cada una devuelve:\n"
        "- tag: identificador corto en MAYUSCULAS_CON_GUION_BAJO\n"
        "- description: descripcion tecnica COVENIN en MAYUSCULAS de esa fase especifica, SIN incluir la palabra "
        "'DEMOLICION' salvo en la sub-partida que demuele la estructura, e incluyendo los equipos pesados propios "
        "(ej. RETROEXCAVADORA CON MARTILLO, EQUIPO DE OXICORTE, CARGADOR PAYLOADER) cuando aplique\n"
        "- unit: unidad NATURAL de computo de esa actividad segun COVENIN (ej. demolicion/excavacion/relleno/"
        "fragmentacion/carga en m3, pintura/apuntalamiento en m2, tuberia en m, acopio de metal en kg o ton). "
        "NO uses la unidad de la partida maestra por defecto; elige entre: ton, kg, m3, Gl, m2, m\n"
        f"- material: material que mueve o trabaja, uno de: {materials}\n"
        "- state: 'en_sitio' si se mide antes de demolerlo o excavarlo, 'suelto' si ya esta fragmentado/en camion\n"
        "- share_kind: 'all' si procesa todo el material, 'ferrous' si procesa solo la fraccion ferrosa/metalica, "
        "'non_ferrous' si procesa todo menos la fraccion ferrosa\n"
        "- order: entero desde 1\n"
        "- ambiguity_question: pregunta al usuario si falta definir el material o sistema de esa sub-partida (o null si está claro)\n"
        "- ambiguity_options: lista de 2 a 4 opciones concretas si hay ambiguity_question (o [] si está claro)\n"
        "Si la descripcion contiene una sola actividad, devuelve is_compound=false.\n\n"
        "JSON exacto:\n"
        "{\"is_compound\": true, \"activities\": [{\"tag\": \"X\", \"description\": \"...\", \"unit\": \"m3\", "
        "\"material\": \"escombro_mixto\", \"state\": \"suelto\", \"share_kind\": \"all\", \"order\": 1, "
        "\"ambiguity_question\": null, \"ambiguity_options\": []}]}"
    )


def _normalize_unit_key(unit: str) -> str:
    nfkd = unicodedata.normalize("NFKD", str(unit or "").strip().lower().replace("³", "3"))
    clean = "".join(ch for ch in nfkd if not unicodedata.combining(ch))
    aliases = {"t": "ton", "tn": "ton", "tm": "ton", "tonelada": "ton", "toneladas": "ton", "kgf": "kg", "sg": "gl"}
    return aliases.get(clean, clean)


def _norm_ascii_upper(text: str) -> str:
    nfkd = unicodedata.normalize("NFKD", str(text or ""))
    return "".join(ch for ch in nfkd if not unicodedata.combining(ch)).upper()


def _share_for(kind: str, pct: float) -> float:
    if kind == "ferrous":
        return pct / 100.0
    if kind == "non_ferrous":
        return 1.0 - pct / 100.0
    return 1.0


def _enrich_and_check_ambiguity(
    desc: str,
    material: str,
    user_description: str,
    llm_question: Optional[str],
    llm_options: List[str],
) -> tuple[str, str, Optional[str], List[str]]:
    """
    Aplica reglas deterministas generales sobre cada sub-actividad detectada:
    1. Si existe ambigüedad de material/sistema (ej. apuntalamiento sin especificar puntales metálicos,
       acero estructural o madera en el prompt del usuario), exige aclaratoria y limpia invenciones del LLM.
    2. Si el usuario ya especificó la opción en su descripción (o respuesta de aclaratoria), limpia la
       ambigüedad e inyecta la especificación real en la descripción de la sub-partida.
    3. Propaga explícitamente el régimen de maquinaria pesada (retroexcavadora con martillo, oxicorte,
       cargador frontal Payloader) cuando la actividad corresponde a fragmentación, corte o carga mecánica.
    """
    d_up = _norm_ascii_upper(desc)
    u_up = _norm_ascii_upper(user_description)
    question = (llm_question or "").strip() or None
    options = [str(o).strip() for o in (llm_options or []) if str(o).strip()]

    # --- 1. Regla general para Apuntalamiento / Entibado / Sostenimiento ---
    if re.search(r"\b(?:APUNTAL|ENTIBAD|ACODAL|SOSTENIMIENTO)\w*\b", d_up):
        has_metallic_in_user = bool(
            re.search(
                r"\b(?:PUNTAL(?:ES)?\s+METALIC\w*|TELESCOPIC\w*|PUNTAL(?:ES)?\s+DE\s+HIERRO|PUNTAL(?:ES)?\s+DE\s+ACERO|APUNTALAMIENTO\s+(?:CON\s+PUNTAL\w*\s+)?METALIC\w*)\b",
                u_up,
            )
        )
        has_steel_profiles_in_user = bool(
            re.search(
                r"\b(?:CON\s+PERFIL(?:ES)?\s+(?:ESTRUCTURAL(?:ES)?|METALIC\w*|DE\s+ACERO)|APUNTAL\w*\s+(?:TEMPORAL\s+(?:DE\s+SEGURIDAD\s+)?)?(?:CON|DE|MEDIANTE)\s+PERFIL(?:ES)?)\b",
                u_up,
            )
        )
        has_wood_in_user = bool(
            re.search(
                r"\b(?:PUNTAL(?:ES)?\s+DE\s+MADERA|APUNTALAMIENTO\s+(?:TEMPORAL\s+(?:DE\s+SEGURIDAD\s+)?)?(?:CON|DE)\s+(?:PUNTALES\s+DE\s+)?MADERA|ENTIBADO\s+DE\s+MADERA|CON\s+PUNTALES\s+DE\s+MADERA)\b",
                u_up,
            )
        )

        # Limpiar disyuntivas inventadas por el LLM
        d_clean = re.sub(
            r"\b(?:METALIC[OA]S?\s+O\s+DE\s+MADERA|DE\s+MADERA\s+O\s+METALIC[OA]S?)\b",
            "",
            desc.upper(),
            flags=re.IGNORECASE,
        )
        d_clean = re.sub(r"\s{2,}", " ", d_clean).strip()

        if has_metallic_in_user:
            question = None
            options = []
            material = "acero_estructural"
            if not re.search(r"\bPUNTAL(?:ES)?\b", _norm_ascii_upper(d_clean)):
                d_clean = (
                    f"{d_clean} CON PUNTALES METALICOS TELESCOPICOS DE HIERRO "
                    "(APUNTALAMIENTO Y SOSTENIMIENTO DE ELEMENTOS ESTRUCTURALES)"
                )
            desc = d_clean
        elif has_steel_profiles_in_user:
            question = None
            options = []
            material = "acero_estructural"
            if "PERFIL" not in _norm_ascii_upper(d_clean):
                d_clean = f"{d_clean} CON PERFILES ESTRUCTURALES DE ACERO"
            desc = d_clean
        elif has_wood_in_user:
            question = None
            options = []
            if "MADERA" not in _norm_ascii_upper(d_clean):
                d_clean = f"{d_clean} CON PUNTALES DE MADERA"
            desc = d_clean
        elif bool(user_description and user_description.strip()):
            # El usuario envió descripción de obra pero no especificó el tipo de apuntalamiento -> exigir aclaratoria
            d_clean = re.sub(r"\b(?:METALIC[OA]S?|DE\s+MADERA)\b", "", d_clean, flags=re.IGNORECASE)
            d_clean = re.sub(r"\s{2,}", " ", d_clean).strip()
            desc = d_clean
            question = (
                question
                or "¿Qué sistema o material se utilizará para el apuntalamiento temporal de seguridad?"
            )
            if not options:
                options = [
                    "Con puntales metálicos telescópicos",
                    "Con perfiles estructurales de acero",
                    "Con puntales de madera",
                ]

    # --- 2. Detección general de disyuntivas indecisas en cualquier otra actividad ---
    elif re.search(r"\b(?:METALIC[OA]S?\s+O\s+DE\s+MADERA|MANUAL\s+O\s+MECANIC[OA]|A\s+MANO\s+O\s+A\s+MAQUINA)\b", d_up):
        if not question:
            question = f"Se detectó una ambigüedad técnica en la actividad '{desc}'. ¿Cuál método o material aplica?"
            options = options or ["Por medios mecánicos (maquinaria pesada)", "Por medios manuales"]

    # --- 3. Propagación determinista de maquinaria pesada y oxicorte en actividades mecánicas ---
    d_up_now = _norm_ascii_upper(desc)
    is_macro_mechanical = bool(
        re.search(r"\b(?:MECANIC\w*|MAQUINARIA|RETROEXCAVADORA|PAYLOADER|CARGADOR|MARTILLO)\b", u_up)
    )
    is_explicit_manual = bool(re.search(r"\b(?:A\s+MANO|MANUAL(?:MENTE)?)\b", d_up_now))

    # 3a. Fragmentación y corte de escombros en el suelo
    if (
        re.search(r"\b(?:FRAGMENTACION|TRITURACION|REPICA\w*)\b", d_up_now)
        or (re.search(r"\bCORTE\b", d_up_now) and re.search(r"\b(?:ESCOMBRO\w*|CONCRETO)\b", d_up_now))
    ) and not is_explicit_manual:
        additions: List[str] = []
        if not re.search(r"\b(?:RETROEXCAVADORA|MARTILLO)\b", d_up_now):
            additions.append("CON RETROEXCAVADORA CON MARTILLO HIDRAULICO")
        if re.search(r"\b(?:CORTE|ACERO|CABILLA\w*|ARMADO|ESPECIALIZADO)\b", d_up_now + " " + u_up) and "OXICORTE" not in d_up_now:
            additions.append("Y CORTE DE ACERO/CABILLAS CON EQUIPO DE OXICORTE")
        if additions:
            desc = f"{desc.strip()} {' '.join(additions)}"

    # 3b. Carga mecánica de escombros / material demolido
    elif (
        re.search(r"\bCARGA\b", d_up_now)
        and re.search(r"\b(?:ESCOMBRO\w*|MATERIAL\w*|DEMOLICION\w*|NO\s+FERROSO\w*)\b", d_up_now)
        and not re.search(r"\b(?:FERROSO\w*\s+Y|CHATARRA|SEPARACION)\b", d_up_now)
        and (is_macro_mechanical or "MECANIC" in d_up_now)
        and not is_explicit_manual
    ):
        if not re.search(r"\b(?:PAYLOADER|CARGADOR|RETROEXCAVADOR\w*|EQUIPO\s+PESADO)\b", d_up_now):
            desc = (
                f"{desc.strip()} CON EQUIPO PESADO (CARGADOR FRONTAL / PAYLOADER O RETROEXCAVADORA)"
            )

    # 3c. Separación, corte, acopio y carga de materiales ferrosos / chatarra
    elif (
        re.search(r"\b(?:FERROSO\w*|CHATARRA|PERFIL(?:ES)?\s+METALIC\w*|ACERO\s+DE\s+REFUERZO)\b", d_up_now)
        and re.search(r"\b(?:SEPARACION|ACOPIO|CARGA|CLASIFICACION|CORTE|REMOCION)\b", d_up_now)
        and not is_explicit_manual
    ):
        additions_f: List[str] = []
        if "OXICORTE" not in d_up_now:
            additions_f.append("INCLUYE CORTE CON EQUIPO DE OXICORTE")
        if not re.search(r"\b(?:PAYLOADER|CARGADOR|RETROEXCAVADOR\w*|EQUIPO\s+PESADO)\b", d_up_now):
            additions_f.append("Y CARGA MECANICA CON EQUIPO PESADO")
        if additions_f:
            desc = f"{desc.strip()} {' '.join(additions_f)}"

    return desc.strip().upper(), material, question, options


def validate_detected_activities(
    raw: Dict[str, Any],
    ferrous_pct: float,
    master_unit: str = "ton",
    user_description: str = "",
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

        raw_q = item.get("ambiguity_question")
        raw_opts = item.get("ambiguity_options") if isinstance(item.get("ambiguity_options"), list) else []
        final_desc, final_mat, final_q, final_opts = _enrich_and_check_ambiguity(
            desc=desc,
            material=material,
            user_description=user_description,
            llm_question=str(raw_q) if raw_q else None,
            llm_options=raw_opts,
        )

        d_check = _norm_ascii_upper(final_desc)
        if re.search(r"\bNO\s+FERROSO\w*\b", d_check):
            kind = "non_ferrous"
        elif re.search(r"\b(?:FERROSO\w*|CHATARRA|PERFIL(?:ES)?\s+METALIC\w*)\b", d_check) and re.search(
            r"\b(?:SEPARACION|ACOPIO|CLASIFICACION|CORTE)\b", d_check
        ):
            kind = "ferrous"
            if final_mat not in ("acero", "acero_estructural", "chatarra"):
                final_mat = "chatarra"

        activities.append(
            ActivityScope(
                tag=tag,
                description=final_desc,
                share=_share_for(kind, ferrous_pct),
                order=int(item.get("order") or idx + 1),
                unit=unit,
                carrier=carrier,  # type: ignore[arg-type]
                material=final_mat,
                state=state,  # type: ignore[arg-type]
                share_kind=kind,  # type: ignore[arg-type]
                ambiguity_question=final_q,
                ambiguity_options=final_opts,
            )
        )

    # Si el pliego solicita tanto manejo de ferrosos como carga mecánica de escombros no ferrosos y el LLM
    # omitió o fusionó la sub-partida volumétrica de carga de escombros, restituirla determinísticamente.
    u_up = _norm_ascii_upper(user_description)
    has_ferrous_act = any(a.share_kind == "ferrous" for a in activities)
    has_rubble_load_act = any(
        a.share_kind != "ferrous"
        and "CARGA" in a.description
        and not re.search(r"\b(?:DEMOLICION|FRAGMENTACION|APUNTALAMIENTO)\b", a.description)
        for a in activities
    )
    if (
        has_ferrous_act
        and not has_rubble_load_act
        and re.search(r"\bCARGA\s+(?:MECANICA\s+)?DE\s+ESCOMBROS\b", u_up)
    ):
        next_order = max((a.order for a in activities), default=0) + 1
        activities.append(
            ActivityScope(
                tag="CARGA_MECANICA_ESCOMBROS_NO_FERROSOS",
                description=(
                    "CARGA MECANICA DE ESCOMBROS NO FERROSOS SOBRE CAMIONES CON EQUIPO PESADO "
                    "(CARGADOR FRONTAL / PAYLOADER O RETROEXCAVADORA), EXCLUYE EL TRANSPORTE EXTERNO"
                ),
                share=_share_for("non_ferrous", ferrous_pct),
                order=next_order,
                unit="m3",
                carrier="volume",
                material="escombro_concreto",
                state="suelto",
                share_kind="non_ferrous",
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
    return validate_detected_activities(raw, pct, master_unit, user_description=user_description)
