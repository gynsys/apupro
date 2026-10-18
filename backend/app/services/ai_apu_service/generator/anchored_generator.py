import json
import re
import time
from typing import Any, Dict, List, Optional, Set, Tuple
from sqlalchemy.orm import Session
from app.services.llm_router import call_llm_json
from app.services.apu_labor_calibrator import calibrate_apu_crew_and_equipment
from app.services.ai_search import detect_materials, _strip_accents_upper
from app.services.synonyms_service import expand_technical_synonyms
from app.services.ai_apu_service.helpers import _sanitize_llm_numbers
from app.services.ai_apu_service.prompts import _APU_SYSTEM_PROMPT
from app.services.ai_apu_service.domain_rules.scope_exclusions import _enforce_scope_exclusions
from app.services.ai_apu_service.domain_rules.safety_height import _enforce_rapel_and_height_equipment
from app.services.ai_apu_service.domain_rules.floor_ground import _enforce_floor_ground_equipment
from app.services.ai_apu_service.domain_rules.material_conflicts import _enforce_primary_materials_mutual_exclusion
from app.services.ai_apu_service.domain_rules.deep_well import _enforce_deep_well_dimensions
from app.services.ai_apu_service.domain_rules.discordant_pruning import (
    _HANGING_AND_SURFACE_EQUIPMENT_PATTERNS,
    _TRENCH_AND_TOPOGRAPHY_EQUIPMENT_PATTERNS,
    enforce_discordant_inputs_purging,
    is_explicit_mortar_without_coarse_concrete,
    is_manual_mixing_requested,
    is_pipe_or_conduit_activity,
    resolve_effective_pipe_mounting,
)
from app.services.ai_apu_service.domain_rules.structural_requirements import (
    align_description_with_requested_mix,
    enforce_fine_mix_plausibility,
    enforce_reinforcement_for_structural_elements,
)
from app.services.ai_apu_service.domain_rules.sanitize_partida import (
    _sanitize_partida_description,
    infer_covenin_prefix,
)
from app.services.ai_apu_service.reconciliation.equipment import (
    _normalize_equipment_prices,
    reconcile_equipment_with_database,
)
from app.services.ai_apu_service.reconciliation.materials import (
    reconcile_materials_with_database,
    _enforce_base_apu_material_heritage,
)
from app.services.ai_apu_service.reconciliation.labor import reconcile_labor_with_database
from app.services.ai_apu_service.rag_context.pruning import _prune_apu_for_prompt
from app.services.ai_apu_service.rag_context.candidates import (
    INCOMPATIBLE_POLARITY_RULES,
    TECHNICAL_DISCIPLINE_CLUSTERS,
    extract_technical_disciplines,
)

_PRIMARY_SYSTEM_CATEGORIES: Tuple[str, ...] = (
    "tuberia",
    "mamposteria",
    "elemento_constructivo_civil",
    "pisos_revestimiento",
    "cubiertas_techos",
    "carpinteria_cerramientos",
    "cercas_perimetrales",
    "conductores_electricos",
    "impermeabilizacion",
)

_UNIT_EQUIVALENCE_GROUPS: Tuple[Set[str], ...] = (
    {"m", "ml", "mts", "mt", "metro", "metros", "metro lineal", "metros lineales"},
    {"m2", "mt2", "mts2", "metro cuadrado", "metros cuadrados"},
    {"m3", "mt3", "mts3", "metro cubico", "metros cubicos"},
    {"und", "unid", "u", "unidad", "pza", "pieza"},
    {"kg", "kgf", "kilo", "kilos", "kilogramo", "kilogramos"},
    {"ton", "tonf", "t", "tf", "tonelada", "toneladas"},
    {"pto", "ptos", "punto", "puntos"},
    {"gl", "sg", "global", "suma global"},
)


def _are_units_physically_equivalent(u1: str, u2: str) -> bool:
    """
    Determina si dos cadenas de unidad representan exactamente la misma magnitud física
    (ej. 'ml' y 'm' son ambas metro lineal; 'und' y 'pza' son unidades discretas).
    """
    c1 = _strip_accents_upper(u1 or "").lower().strip()
    c2 = _strip_accents_upper(u2 or "").lower().strip()
    if c1 == c2:
        return True
    for grp in _UNIT_EQUIVALENCE_GROUPS:
        if c1 in grp and c2 in grp:
            return True
    return False


def evaluate_specialty_and_system_coherence(
    user_description: str,
    base_apu: Optional[Dict[str, Any]],
) -> Tuple[bool, str]:
    """
    Evalúa el Contrato de Coherencia de Especialidad y Sistema Constructivo entre
    la solicitud del usuario (D_user, M_user) y la partida base (D_base, M_base).
    Retorna (es_coherente, motivo_desanclaje).
    """
    if not user_description or not isinstance(user_description, str):
        return True, ""
    if not base_apu or not isinstance(base_apu, dict):
        return True, ""

    base_desc = str(base_apu.get("descripcion") or base_apu.get("description") or "").strip()
    if not base_desc:
        return True, ""

    u_exp = expand_technical_synonyms(user_description)
    b_exp = expand_technical_synonyms(base_desc)
    u_lower = _strip_accents_upper(u_exp).lower()
    b_lower = _strip_accents_upper(b_exp).lower()

    # 1. Coherencia de Disciplina Tecnológica (D_user vs D_base)
    u_disciplines: Set[str] = extract_technical_disciplines(u_exp)
    b_disciplines: Set[str] = extract_technical_disciplines(b_exp)
    if u_disciplines and b_disciplines and not (u_disciplines & b_disciplines):
        return (
            False,
            f"Divergencia de disciplina tecnológica: solicitada={sorted(u_disciplines)} vs base={sorted(b_disciplines)}",
        )

    # 2. Reglas de Polaridad Funcional Opuesta Severa
    for polo_a, polo_b, penalty in INCOMPATIBLE_POLARITY_RULES:
        if penalty < 0.40:
            continue
        u_has_a = any(t in u_lower for t in polo_a)
        u_has_b = any(t in u_lower for t in polo_b)
        b_has_a = any(t in b_lower for t in polo_a)
        b_has_b = any(t in b_lower for t in polo_b)
        if (u_has_a and not u_has_b and b_has_b and not b_has_a) or (
            u_has_b and not u_has_a and b_has_a and not b_has_b
        ):
            return (
                False,
                "Polaridad funcional opuesta entre la especialidad solicitada y la partida base",
            )

    # 3. Coherencia de Sistema Material Constructivo (M_user vs M_base)
    u_mats = detect_materials(u_exp)
    b_mats = detect_materials(b_exp)
    for cat in _PRIMARY_SYSTEM_CATEGORIES:
        u_set = u_mats.get(cat, set())
        b_set = b_mats.get(cat, set())
        if u_set and b_set and not (u_set & b_set):
            return (
                False,
                f"Divergencia de familia material en '{cat}': solicitado={sorted(u_set)} vs base={sorted(b_set)}",
            )

    return True, ""


def apply_specialty_coherence_contract_to_base(
    pruned_base: Dict[str, Any],
    user_description: str,
) -> Tuple[Dict[str, Any], bool, str]:
    """
    Aplica determinísticamente el Principio 3 (Desanclaje Automático por Contrato Abstracto):
    Si la disciplina o familia material de la base (D_base) no coincide con la solicitada (D_user),
    revoca automáticamente el ancla de materiales y equipos específicos antes de construir el prompt,
    conservando únicamente la escala de rendimiento, cuadrilla y herramientas menores porcentuales.
    Asimismo:
    - Si es una partida de tubería, filtra preventivamente los equipos de la base que no
       correspondan a la condición de montaje (EMBUTIDA vs ENTERRADA vs SUPERFICIAL_COLGANTE).
    - Si la solicitud especifica mortero de arena-cemento (sin concreto grueso), filtra preventivamente
       la piedra picada y el vibrador de inmersión, preservando el acero de refuerzo en elementos a flexión.
    """
    if not pruned_base or not isinstance(pruned_base, dict):
        return {}, True, ""

    is_coherent, reason = evaluate_specialty_and_system_coherence(user_description, pruned_base)
    if not is_coherent:
        decoupled: Dict[str, Any] = dict(pruned_base)
        decoupled["materiales"] = []
        decoupled["equipos"] = [
            eq for eq in pruned_base.get("equipos", [])
            if isinstance(eq, dict) and "HERRAMIENTAS" in str(eq.get("descripcion", "")).upper()
        ]
        # Purgar mano de obra especializada discordante perteneciente a la especialidad ajena de la base
        base_desc = str(pruned_base.get("descripcion") or pruned_base.get("description") or "")
        u_disciplines = extract_technical_disciplines(expand_technical_synonyms(user_description))
        b_disciplines = extract_technical_disciplines(expand_technical_synonyms(base_desc))
        base_labors = pruned_base.get("mano_obra", [])
        if isinstance(base_labors, list):
            generic_labors: List[Dict[str, Any]] = []
            for mo in base_labors:
                if not isinstance(mo, dict):
                    continue
                mo_desc = _strip_accents_upper(str(mo.get("descripcion") or ""))
                is_discordant_specialist = False
                if "PINTURAS_Y_RECUBRIMIENTOS" in b_disciplines and "PINTURAS_Y_RECUBRIMIENTOS" not in u_disciplines:
                    if re.search(r"\b(?:PINTOR|MAESTRO\s+PINTOR)\b", mo_desc):
                        is_discordant_specialist = True
                if "INSTALACIONES_SANITARIAS_AGUA" in b_disciplines and "INSTALACIONES_SANITARIAS_AGUA" not in u_disciplines:
                    if re.search(r"\b(?:PLOMERO|MAESTRO\s+PLOMERO|TUBERO)\b", mo_desc):
                        is_discordant_specialist = True
                if "CANALIZACIONES_E_INSTALACIONES_ELECTRICAS" in b_disciplines and "CANALIZACIONES_E_INSTALACIONES_ELECTRICAS" not in u_disciplines:
                    if re.search(r"\b(?:ELECTRICISTA|MAESTRO\s+ELECTRICISTA|LINIERO)\b", mo_desc):
                        is_discordant_specialist = True
                if not is_discordant_specialist:
                    generic_labors.append(mo)
            decoupled["mano_obra"] = generic_labors
        return decoupled, False, reason

    u_up = _strip_accents_upper(user_description or "")
    is_mortar_only = is_explicit_mortar_without_coarse_concrete(user_description)
    is_manual_mix = is_manual_mixing_requested(user_description)
    is_indoor = bool(re.search(r"\bEN\s+INTERIOR(ES)?\b", u_up)) and not bool(re.search(r"\bCARRETILLA\b", u_up))
    explicit_mixer = bool(re.search(r"\b(?:MEZCLADORA|TROMPO)\b", u_up))

    filtered_base: Dict[str, Any] = dict(pruned_base)
    if is_mortar_only or is_indoor or is_manual_mix:
        if is_mortar_only and isinstance(filtered_base.get("materiales"), list):
            filtered_base["materiales"] = [
                m for m in filtered_base["materiales"]
                if isinstance(m, dict)
                and not re.search(
                    r"\b(?:PIEDRA\s+PICADA|GRAVA\s+PICADA|GRANZA\s+PARA\s+CONCRETO|FLETE\s*/\s*TRANSPORTE\s+DE\s+AGREGADOS|TRANSPORTE\s+URBANO\s+DE\s+CEMENTO)\b",
                    _strip_accents_upper(str(m.get("descripcion") or "")),
                )
            ]
        if isinstance(filtered_base.get("equipos"), list):
            clean_m_eqs: List[Dict[str, Any]] = []
            for eq in filtered_base["equipos"]:
                if not isinstance(eq, dict):
                    continue
                eq_up = _strip_accents_upper(str(eq.get("descripcion") or ""))
                if is_mortar_only and re.search(r"\bVIBRADOR\b", eq_up):
                    continue
                if is_manual_mix and not explicit_mixer and re.search(r"\b(?:MEZCLADORA|TROMPO|REVOLVEDORA)\b", eq_up):
                    continue
                if is_mortar_only and is_indoor and not explicit_mixer and re.search(r"\b(?:MEZCLADORA|TROMPO)\b", eq_up):
                    continue
                if is_indoor and re.search(r"\bCARRETILLA\b", eq_up):
                    continue
                clean_m_eqs.append(eq)
            filtered_base["equipos"] = clean_m_eqs
        if (is_mortar_only or is_manual_mix) and isinstance(filtered_base.get("mano_obra"), list):
            has_mixer = any(
                re.search(r"\b(?:MEZCLADORA|TROMPO)\b", _strip_accents_upper(str(e.get("descripcion") or "")))
                for e in filtered_base.get("equipos", [])
                if isinstance(e, dict)
            )
            if not has_mixer:
                filtered_base["mano_obra"] = [
                    mo for mo in filtered_base["mano_obra"]
                    if isinstance(mo, dict)
                    and "MAQUINISTA DE CONCRETO" not in _strip_accents_upper(str(mo.get("descripcion") or ""))
                ]

    base_desc = str(filtered_base.get("descripcion") or filtered_base.get("description") or "")
    if is_pipe_or_conduit_activity(user_description) or is_pipe_or_conduit_activity(base_desc):
        pipe_mode = resolve_effective_pipe_mounting(user_description, base_desc)
        explicit_earthwork = bool(re.search(
            r"\b(?:EXCAVACION|ZANJA|BOTE\s+DE|ESCOMBRO|DEMOLICION|CONCRETO|MORTERO|RELLENO|COMPACTACION)\b",
            u_up,
        ))
        explicit_height = bool(re.search(
            r"\b(?:ANDAMIO|ALTURA|COLGANTE|SUSPENDID[OA]|EN\s+TECHO|BAJO\s+LOSA|AERE[OA])\b",
            u_up,
        ))
        raw_eqs = filtered_base.get("equipos", [])
        clean_eqs: List[Dict[str, Any]] = []
        for eq in raw_eqs:
            if not isinstance(eq, dict):
                continue
            eq_up = _strip_accents_upper(str(eq.get("descripcion") or ""))
            if pipe_mode in ("EMBUTIDA", "SUPERFICIAL_COLGANTE") and not explicit_earthwork:
                if any(bool(re.search(pat, eq_up)) for pat in _TRENCH_AND_TOPOGRAPHY_EQUIPMENT_PATTERNS):
                    continue
            if pipe_mode in ("EMBUTIDA", "ENTERRADA") and not explicit_height:
                if any(bool(re.search(pat, eq_up)) for pat in _HANGING_AND_SURFACE_EQUIPMENT_PATTERNS):
                    continue
            clean_eqs.append(eq)
        filtered_base["equipos"] = clean_eqs
        return filtered_base, True, ""

    return filtered_base, True, ""


def generate_apu_with_ai_from_base(
    base_apu: Dict[str, Any],
    complementary_apus: Optional[List[Dict[str, Any]]] = None,
    user_description: str = "",
    covenin_prefix: str = "",
    covenin_context: str = "",
    smart_answers: Optional[Dict[str, str]] = None,
    history: Optional[List[Dict[str, Any]]] = None,
    requested_unit: Optional[str] = None,
    execution_days: Optional[float] = None,
    db: Optional[Session] = None,
    deep_well_depth: Optional[float] = None,
) -> Dict[str, Any]:
    """
    Generación de APU usando una partida base seleccionada por el usuario
    a través del Smart Selector. El LLM ADAPTA el APU base, no lo inventa.

    Este modo:
    - Proporciona al LLM el APU completo de la partida histórica (insumos, precios, cantidades reales)
    - Si detecta divergencia de disciplina o sistema material (D_base != D_user), revoca
      automáticamente el ancla de materiales y equipos específicos (Principio 3).
    """
    history_text = ""
    if history:
        history_text = "\n# HISTORIAL DE CONVERSACIÓN\n"
        for msg in history:
            role = "USUARIO" if msg.get("role") == "user" else "SISTEMA/IA"
            history_text += f"{role}: {msg.get('content')}\n"

    answers_text = ""
    if smart_answers:
        answers_text = "\n# CARACTERÍSTICAS SELECCIONADAS POR EL USUARIO (respuestas del asistente)\n"
        for _, answer in smart_answers.items():
            answers_text += f"- {answer}\n"

    pruned_base = _prune_apu_for_prompt(base_apu) if base_apu else {}
    effective_base_for_prompt, is_specialty_coherent, unanchor_reason = apply_specialty_coherence_contract_to_base(
        pruned_base, user_description
    )
    base_json = (
        json.dumps(effective_base_for_prompt, ensure_ascii=False, separators=(',', ':'))
        if effective_base_for_prompt
        else "No disponible"
    )

    comp_text = ""
    if complementary_apus:
        valid_comps: List[Tuple[str, str, Dict[str, Any]]] = []
        for comp in complementary_apus:
            pruned_c = _prune_apu_for_prompt(comp)
            filtered_c, _, _ = apply_specialty_coherence_contract_to_base(pruned_c, user_description)
            if any(filtered_c.get(k) for k in ("materiales", "equipos", "mano_obra")):
                valid_comps.append((str(comp.get("codpar", "N/A")), str(comp.get("descripcion", ""))[:80], filtered_c))
        if valid_comps:
            comp_text = "\n# INSUMOS COMPLEMENTARIOS DE APOYO (actividades accesorias faltantes en la base)\n"
            comp_text += "Usa SOLO los insumos de esta sección para la actividad accesoria indicada (ej. bote, friso, pintura). Conserva sus precios sin modificación.\n\n"
            for i, (c_cod, c_desc, c_dict) in enumerate(valid_comps):
                comp_text += f"## Complementaria {i+1} [{c_cod}] — {c_desc}\n"
                comp_text += json.dumps(c_dict, ensure_ascii=False, separators=(',', ':'))
                comp_text += "\n"

    effective_cov_prefix = (covenin_prefix or "").strip()
    if not effective_cov_prefix:
        effective_cov_prefix = infer_covenin_prefix(user_description, base_apu.get("covenin") or base_apu.get("codpar") or "")

    base_unit = str(base_apu.get('unidad') or base_apu.get('unit') or '').strip().lower()
    base_ren = base_apu.get('rendimiento') or base_apu.get('performance') or base_apu.get('RenPar') or 'N/A'
    u_clean = str(requested_unit).strip().lower() if requested_unit else base_unit
    req_u_clean = u_clean
    is_global_unit = u_clean in ("gl", "sg", "global", "suma global")

    unit_directive = ""
    if is_global_unit:
        dias_val = float(execution_days) if execution_days and float(execution_days) > 0 else 1.0
        target_perf = round(1.0 / dias_val, 4)
        unit_directive = f"""
# DIRECTIVA OBLIGATORIA DE UNIDAD GLOBAL (Gl / S.G. - SUMA GLOBAL)
La partida DEBE estructurarse OBLIGATORIAMENTE con la unidad: 'Gl'.
- El campo `unit` de `partida` DEBE ser exactamente 'Gl'.
- La cantidad de la partida en el presupuesto es 1.00 Gl (suma alzada global por el paquete completo).
- DURACIÓN Y RENDIMIENTO MATEMÁTICO ESTRICTO:
  * La duración estimada de trabajo de cuadrilla es de {dias_val} días hábiles.
  * El rendimiento diario DEBE ser estrictamente: performance = {target_perf} (es decir, R = 1.0 / {dias_val} días). NUNCA coloques otro rendimiento.
- MATERIALES EN BULTO TOTAL (100% DE LA OBRA DESCRITA):
  * En partidas 'Gl', los consumos de materiales NO son por m2 ni por pieza unitaria; DEBEN representar la totalidad acumulada de materiales físicos necesarios para completar el 100% de la obra descrita (ej: total de galones, perfiles, sacos, rollos, cables, tuberías o consumibles).
  * Si el usuario especificó cantidades o dimensiones exactas en su solicitud, respétalas estrictamente.
- MANO DE OBRA Y EQUIPOS:
  * La cuadrilla y los equipos se asignan para la jornada diaria normal. La fórmula universal de costos dividirá su costo diario entre R, multiplicando exactamente por los {dias_val} días de duración.
"""
    elif u_clean:
        unit_directive = f"""
# DIRECTIVA OBLIGATORIA DE UNIDAD DE MEDIDA (DEFINIDA POR EL ANALISTA)
La partida DEBE estructurarse OBLIGATORIAMENTE con la unidad: '{u_clean}'.
- El campo `unit` de `partida` DEBE ser exactamente '{u_clean}'.
- Si la unidad es 'pza' o 'und':
  * CÁLCULO VOLUMÉTRICO Y UNITARIO RIGUROSO: Todos los consumos de materiales DEBEN calcularse para UNA SOLA PIEZA o unidad individual.
  * Si el elemento es de concreto o mortero (ej. dinteles, machones, brocales, mesones, apoyos, peldaños):
    - Calcula el volumen real: V = Largo (m) x Ancho/Base (m) x Espesor/Alto (m). Ejemplo para dintel de 0.90 m x 0.15 m x 0.05 m: V = 0.00675 m³.
    - Dosificación de cemento: Para mortero 1:3 es de ~10.6 sacos/m³; para concreto f'c 180-210 kgf/cm² es de ~8.0 sacos/m³.
    - Cantidad por unidad = V x Dosificación. Para dicho dintel: 0.00675 m³ x 10.6 = 0.072 sacos (¡NO 0.5 ni 1.0 saco!).
    - PROHIBIDO redondear al alza a fracciones comerciales grandes (como 0.50 o 1.0 saco) cuando la unidad física consume solo una pequeña fracción decimal. Utiliza la cantidad decimal exacta calculada (ej. 0.072 sacos).
    - Dosificación de agregados: Arena = V x 1.10 m³ (aprox. 0.10 m³ por saco de cemento); Agua = V x 0.24 m³.
  * Si el elemento es metálico o carpintería (puertas, rejas, protectores, peldaños, marcos): calcula los perfiles por longitud real y consumibles (electrodos, discos, pintura ~0.02-0.05 gln) para UNA sola pieza.
  * NUNCA dejes consumos por m² o por m³ si la unidad es pieza o unidad.
  * El rendimiento diario de la cuadrilla DEBE expresarse en piezas o unidades al día (ej. para dinteles/vigas pequeñas en sitio: 8 a 15 und/día; para peldaños: 15 a 25 pza/día).
- Si la unidad es 'm2':
  * Todos los consumos de materiales y el rendimiento diario se calculan por metro cuadrado de superficie desarrollada (25 a 35 m2/día).
- Si la unidad es 'm' o 'ml':
  * Todos los consumos y rendimientos se calculan por metro lineal de desarrollo.
"""

    if is_global_unit:
        dias_val = float(execution_days) if execution_days and float(execution_days) > 0 else 1.0
        target_perf = round(1.0 / dias_val, 4)
        performance_instruction = f"""2. CÁLCULO DE RENDIMIENTO PARA PARTIDA GLOBAL (Gl):
   - La unidad solicitada es 'Gl' (Suma Global).
   - El rendimiento diario DEBE ser obligatoriamente: performance = {target_perf} (correspondiente a 1.0 / {dias_val} días).
   - En `notas_adaptacion`, explica que el rendimiento R = {target_perf} Gl/día corresponde a {dias_val} días de trabajo de cuadrilla."""
    elif req_u_clean and base_unit and not _are_units_physically_equivalent(req_u_clean, base_unit):
        performance_instruction = f"""2. CÁLCULO DINÁMICO DE RENDIMIENTO (DESANCLAJE DIMENSIONAL OBLIGATORIO):
   - La partida base histórica tiene unidad '{base_unit}' (rendimiento {base_ren} {base_unit}/día), mientras que la partida requerida es '{req_u_clean}'.
   - ESTÁ TERMINANTEMENTE PROHIBIDO copiar o anclarte al número {base_ren}: una unidad de '{req_u_clean}' no equivale físicamente a una de '{base_unit}'.
   - Calcula el rendimiento diario como: R = (Horas totales de cuadrilla al día) / (Horas-hombre que toma ejecutar 1 {req_u_clean}).
   - Para mantenimiento o reparaciones localizadas por unidad (und/pza), el rendimiento de una cuadrilla típica de 2 a 4 trabajadores es de 4 a 8 {req_u_clean}/día.
   - Justifica el cálculo detalladamente en `notas_adaptacion`."""
    else:
        performance_instruction = f"""2. CÁLCULO DE RENDIMIENTO Y ESCALA DE CUADRILLA:
   - Rendimiento base de referencia: {base_ren} {base_unit}/día.
   - Si tu cuadrilla adaptada tiene mayor o menor número de oficiales/obreros que la base, o si la partida implica mayor dificultad (mantenimiento, demolición, altura, acceso restringido), AJUSTA el rendimiento en proporción a las Horas-Hombre reales.
   - En actividades de mantenimiento o rehabilitación en sitio, el rendimiento suele reducirse entre un 25% y 40% respecto a obra nueva.
   - Explica el cálculo en `notas_adaptacion`."""

    deep_well_directive = ""
    u_desc_lower = (user_description or "").lower()
    is_removal_task = bool(re.search(r"\b(desmontaje|demolici[oó]n|retiro|desinstalaci[oó]n|extracci[oó]n|desmantelamiento)\b", u_desc_lower))
    is_deep_well_req = (
        bool(re.search(r"\b(pozo\s+profundo|pozo\s+de\s+agua|pozo\s+tubular|bomba\s+(?:tipo\s+)?lapicero)\b", u_desc_lower))
        or (bool(re.search(r"\bbomba\s+sumergible\b", u_desc_lower)) and not bool(re.search(r"\b(aguas?\s+negras?|aguas?\s+servidas?|residuales?|achique|fosa|cloaca|triturador\w*)\b", u_desc_lower)))
    )
    if is_deep_well_req:
        depth_val = deep_well_depth or 50.0
        if is_removal_task:
            deep_well_directive = f"""
# DIRECTIVA CRÍTICA OBLIGATORIA PARA DESMONTAJE / EXTRACCIÓN EN POZO PROFUNDO:
- Profundidad de extracción: {int(depth_val)} METROS.
- QUEDA TERMINANTEMENTE PROHIBIDO incluir o cotizar el suministro o compra de una bomba sumergible nueva, tubería de impulsión nueva o cable sumergible nuevo. Esta es una partida de DESMONTAJE/EXTRACCIÓN.
- La partida consiste exclusivamente en la extracción de la columna ({int(depth_val)} m), cable y bomba existente, desacople de tramos y movilización interna.
- Equipos: trípode/malacate o grúa de extracción y herramientas mecánicas de desacople.
- Rendimiento diario típico de extracción: 1 und/día (la jornada de trabajo de la cuadrilla para izar y desacoplar tramos a {int(depth_val)} m)."""
        else:
            deep_well_directive = f"""
# DIRECTIVA CRÍTICA OBLIGATORIA PARA BOMBA SUMERGIBLE / POZO PROFUNDO (OBRA NUEVA):
- Profundidad de instalación calculada: {int(depth_val)} METROS.
- La partida requiere UNA SOLA BOMBA SUMERGIBLE (tipo lapicero para pozo profundo con motor y cuerpo de impulsión) de la potencia solicitada.
- QUEDA TERMINANTEMENTE PROHIBIDO incluir o conservar bombas centrífugas, de superficie o de presión constante heredadas de la base histórica.
- Dimensiona estrictamente la columna de tubería de impulsión en {int(depth_val)} metros.
- Dimensiona el cable sumergible plano y la guaya de suspensión de acero en {round(depth_val * 1.05, 1)} metros (+5% de holgura).
- Incluye válvula de retención (check) para pozo profundo y accesorios de conexión."""

    pipe_mounting_directive = ""
    base_desc_str = str(base_apu.get("descripcion") or base_apu.get("description") or "")
    if is_pipe_or_conduit_activity(user_description) or is_pipe_or_conduit_activity(base_desc_str):
        eff_pipe_mode = resolve_effective_pipe_mounting(user_description, base_desc_str)
        if eff_pipe_mode == "EMBUTIDA":
            pipe_mounting_directive = """
# DIRECTIVA GLOBAL DE MODALIDAD DE INSTALACIÓN DE TUBERÍA: EMBUTIDA / EN INTERIORES
- La tubería solicitada corresponde a instalación EMBUTIDA (o en interiores de edificación, NO enterrada en zanja).
- En la descripción de `partida`, especifica únicamente la condición 'EMBUTIDA' (o 'EN INTERIORES'); QUEDA PROHIBIDO copiar la cláusula ambigua 'EMBUTIDA O ENTERRADA' o la palabra 'ENTERRADA'.
- QUEDA TERMINANTEMENTE PROHIBIDO incluir equipos de movimiento de tierra, zanja o topografía vial (carretillas, cinta métrica de topógrafo de 25m/50m, pico, pala, compactador) ni abrazaderas colgantes."""
        elif eff_pipe_mode == "ENTERRADA":
            pipe_mounting_directive = """
# DIRECTIVA GLOBAL DE MODALIDAD DE INSTALACIÓN DE TUBERÍA: ENTERRADA / SUBTERRÁNEA
- La tubería solicitada corresponde a instalación ENTERRADA (subterránea / en zanja).
- En la descripción de `partida`, especifica únicamente la condición 'ENTERRADA'; QUEDA PROHIBIDO copiar la cláusula ambigua 'EMBUTIDA O ENTERRADA', 'EMBUTIDA' o 'COLGANTE'.
- QUEDA PROHIBIDO incluir equipos de fijación aérea/colgante (andamios, escaleras, pistola de fijación, abrazaderas colgantes)."""
        elif eff_pipe_mode == "SUPERFICIAL_COLGANTE":
            pipe_mounting_directive = """
# DIRECTIVA GLOBAL DE MODALIDAD DE INSTALACIÓN DE TUBERÍA: SUPERFICIAL / COLGANTE / A LA VISTA
- La tubería solicitada corresponde a instalación SUPERFICIAL o COLGANTE (a la vista, adosada o suspendida).
- En la descripción de `partida`, especifica la condición 'SUPERFICIAL' o 'COLGANTE' según lo solicitado; QUEDA PROHIBIDO usar 'EMBUTIDA O ENTERRADA'.
- Incluye los elementos de fijación/soportería correspondientes y EXCLUYE equipos de excavación/zanja/topografía (carretilla, cinta de topógrafo)."""

    coherence_contract_directive = ""
    if not is_specialty_coherent:
        coherence_contract_directive = f"""
# CONTRATO DE COHERENCIA DE ESPECIALIDAD (DESANCLAJE AUTOMÁTICO DE INSUMOS ACTIVADO):
- Diagnóstico técnico: {unanchor_reason}.
- La disciplina o el sistema constructivo de la partida base (D_base) NO coincide plenamente con la partida solicitada (D_user).
- El ancla de materiales y equipos específicos de la partida base ha quedado AUTOMÁTICAMENTE REVOCADA.
- Conserva de la base únicamente la escala referencial del rendimiento, la estructura de cuadrilla y las herramientas menores porcentuales, y SINTETIZA el 100% de los materiales y equipos específicos directamente desde los principios técnicos de la disciplina solicitada."""

    prompt = f"""
# MODO DE TRABAJO: ADAPTACIÓN DE APU BASE
El sistema ha seleccionado una partida histórica de la base de datos como BASE DE ADAPTACIÓN.
Tu tarea es ADAPTAR ese APU base para la nueva partida solicitada por el usuario.
{unit_directive}
{deep_well_directive}
{pipe_mounting_directive}
{coherence_contract_directive}
# SOLICITUD DEL USUARIO
Descripción: {user_description}
Categoría COVENIN: {covenin_context}
Prefijo COVENIN: {effective_cov_prefix}
{answers_text}

# APU BASE SELECCIONADO (partida histórica real de la base de datos)
{base_json}
{comp_text}
{history_text}

# INSTRUCCIONES ESPECÍFICAS DE ADAPTACIÓN
1. El APU base es para una partida SIMILAR, no idéntica. Tu trabajo es adaptarlo para "{user_description}".
{performance_instruction}
3. CONSERVA únicamente los insumos de la base que pertenezcan legítimamente a la especialidad y sistema constructivo de la nueva partida. Márcalos como `"origen": "historico"`.
4. CONTRATO DE COHERENCIA DE ESPECIALIDAD Y SISTEMA CONSTRUCTIVO: Si la disciplina o familia material de la partida base ($D_{{base}}, M_{{base}}$) no coincide plenamente con la disciplina o familia material solicitada ($D_{{user}}, M_{{user}}$), el ancla de materiales y equipos específicos queda revocada. Conserva de la base únicamente la escala del rendimiento y herramientas menores porcentuales, y sintetiza el 100% de los materiales y equipos específicos directamente desde los principios técnicos de la disciplina solicitada, marcándolos con `"origen": "ia"`, precio referencial de mercado en USD y advertencia `[PRECIO_REFERENCIAL]`.
5. AJUSTA cantidades cuando la nueva partida lo requiera (ej: distinta área, espesor, proporción, o cómputo global Gl).
   Los insumos provenientes de la partida base o complementarias que sean técnicamente compatibles DEBEN CONSERVAR obligatoriamente `"origen": "historico"` (incluso si sus cantidades fueron escaladas).
   Explica el ajuste métrico en `nota_calculo`.
   Marca con `"origen": "ia"` ÚNICAMENTE los insumos nuevos que agregues tú y no existían en la base.
6. AUTO-FUSIÓN: Si la descripción del usuario exige algo que falta en la Base (ej. Bote de material, Pintura, Andamios, Encofrado) pero que sí existe en las Partidas Complementarias y es afín a la especialidad, intégralo conservando sus precios históricos.
7. AGREGA insumos nuevos que la nueva partida requiera estrictamente y no estén ni en la base ni en las complementarias. Márcalos como `"origen": "ia"`, asígnales un precio unitario referencial estimado de mercado en USD (nunca 0.0) y agrega una advertencia con el prefijo `[PRECIO_REFERENCIAL]`.
8. NUNCA alteres los precios unitarios de los insumos del APU base ni de las complementarias. Son precios reales de la BD.
9. DIRECTIVA OBLIGATORIA: PODA Y ELIMINACIÓN DE EQUIPOS Y MATERIALES DISCORDANTES O CORRUPTOS DE LA BASE:
   - TIENES LA OBLIGACIÓN ESTRICTA DE ELIMINAR del APU cualquier material o equipo de la base que resulte discordante, sobredimensionado o manifiestamente corrupto:
     * Si la partida solicitada es un DESMONTAJE o DEMOLICIÓN, queda TERMINANTEMENTE PROHIBIDO incluir la compra o suministro del activo que se está desmontando. Un desmontaje NO compra activos.
     * Si el objeto es liviano o mecánico menor (ej: bomba de 1 a 10 HP, motor pequeño, puertas, artefactos), ELIMINA equipos de oxicorte/sopletes de alta temperatura y señoritas pesadas de 5 TON si no se justifican físicamente; sustitúyelos por herramientas mecánicas y acarreo liviano.
     * Si un insumo o equipo de la base pertenece a otra especialidad o proceso constructivo incompatible con la actividad solicitada, ELIMÍNALO SIN DUDAR.
     * Si un insumo histórico presenta unidades absurdas para su descripción (ej. tubos medidos en kgf o sacos en partidas de acabados), es un error de digitación en la base histórica. DESCÁRTALO INMEDIATAMENTE. ESTÁ PROHIBIDO justificarlo con 'posible error de codificación pero se conserva'.
     * REFUERZO DE VARILLAS DE FIBRA DE VIDRIO (FRP / GFRP): La fibra de vidrio estructural tiene una densidad de ~2.0 g/cm³ (1/4 del peso del acero de construcción tradicional que pesa 7.85 g/cm³). Para una cuantía estructural equivalente al 1% en volumen de concreto (m³), la cantidad de varilla FRP es de 20 a 25 kgf por m³ de concreto, NUNCA 80-100 kgf como si fuera acero de cabilla pesada.
     * NO inventes justificaciones forzadas en notas_adaptacion para retener insumos absurdos de la base.
10. Registra SIEMPRE en `notas_adaptacion` (para el log técnico de depuración) que el APU fue adaptado desde la partida base [{base_apu.get('codpar', 'N/A')}], qué insumos se podaron y la justificación del rendimiento.
11. El campo `advertencias` es EXCLUSIVAMENTE para alertas de precios referenciales de mercado estimados por IA con el prefijo `[PRECIO_REFERENCIAL]` (cuando un insumo indispensable no existe en el catálogo histórico o cuando se sustituyó un equipo o material incompatible de la base).
    - NUNCA agregues advertencias sobre exclusiones de alcance (`[ALCANCE]`); el analista de costos ya conoce el alcance solicitado.
    - NUNCA menciones qué partida o código se utilizó como base histórica en `advertencias`.
    - Las notas de adaptación interna van EXCLUSIVAMENTE en `notas_adaptacion`, jamás en `advertencias`.
12. UNIDAD OBLIGATORIA: Si se especifica una directiva de unidad obligatoria arriba, el campo `unit` de `partida` DEBE ser exactamente esa unidad, escalando los consumos de materiales y el rendimiento diario en correspondencia matemática estricta.
"""
    t_llm_start = time.time()
    result = call_llm_json(prompt, use_case="cost360", system_prompt=_APU_SYSTEM_PROMPT)
    llm_duration_ms = round((time.time() - t_llm_start) * 1000, 2)
    _sanitize_llm_numbers(result)
    result["debug_llm_latency_ms"] = llm_duration_ms
    if "advertencias" not in result:
        result["advertencias"] = []
    if "notas_adaptacion" not in result:
        result["notas_adaptacion"] = []

    if result.get("status") == "clarification_needed":
        if "options" not in result or not isinstance(result["options"], list):
            result["options"] = []

    # Salvaguarda determinista de exclusiones de alcance explícitas
    _enforce_scope_exclusions(result, user_description)

    # Salvaguarda determinista de seguridad para trabajos a rapel / en altura
    _enforce_rapel_and_height_equipment(result, user_description)

    # Salvaguarda determinista para trabajos a nivel de piso / suelo
    _enforce_floor_ground_equipment(result, user_description)

    # Salvaguarda determinista de exclusión mutua de materiales preponderantes
    _enforce_primary_materials_mutual_exclusion(result, user_description)

    # Poda determinista de insumos y equipos discordantes o sobredimensionados
    enforce_discordant_inputs_purging(result, user_description, base_apu)

    # Limpieza determinista de la descripción de la partida (remoción de tipologías coloquiales como 'en casa')
    _sanitize_partida_description(result, user_description)

    # Salvaguarda determinista de pozo profundo y bombas sumergibles
    _enforce_deep_well_dimensions(result, user_description, deep_well_depth)

    # Salvaguarda determinista de unidad solicitada
    if result.get("partida") and requested_unit:
        result["partida"]["unit"] = requested_unit.strip().lower()

    # Coherencia de la mezcla pedida (arena-cemento vs concreto), refuerzo/encofrado por defecto
    # en elementos estructurales y plausibilidad física de la dosificación fina
    align_description_with_requested_mix(result, user_description)
    enforce_reinforcement_for_structural_elements(result, user_description)
    enforce_fine_mix_plausibility(result, user_description)

    effective_base_for_heritage = (
        base_apu
        if is_specialty_coherent
        else {"equipos": effective_base_for_prompt.get("equipos", []), "materiales": []}
    )
    _normalize_equipment_prices(result, effective_base_for_heritage, complementary_apus)
    calibrate_apu_crew_and_equipment(result, base_apu)
    _enforce_base_apu_material_heritage(result, effective_base_for_heritage, complementary_apus)
    reconcile_equipment_with_database(result, db)
    reconcile_materials_with_database(result, db)
    reconcile_labor_with_database(result, db)

    # Poda final de discordancia y deduplicación tras reconciliaciones
    enforce_discordant_inputs_purging(result, user_description, base_apu)
    _enforce_deep_well_dimensions(result, user_description, deep_well_depth)

    result["debug_base_apu"] = base_apu
    result["debug_specialty_coherence"] = {
        "is_coherent": is_specialty_coherent,
        "unanchor_reason": unanchor_reason,
    }
    result["prompt_enviado_al_llm"] = prompt

    return result
