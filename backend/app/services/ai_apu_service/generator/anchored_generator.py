import json
import re
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session
from app.services.llm_router import call_llm_json
from app.services.apu_labor_calibrator import calibrate_apu_crew_and_equipment
from app.services.ai_apu_service.helpers import _sanitize_llm_numbers
from app.services.ai_apu_service.prompts import _APU_SYSTEM_PROMPT
from app.services.ai_apu_service.domain_rules.scope_exclusions import _enforce_scope_exclusions
from app.services.ai_apu_service.domain_rules.safety_height import _enforce_rapel_and_height_equipment
from app.services.ai_apu_service.domain_rules.floor_ground import _enforce_floor_ground_equipment
from app.services.ai_apu_service.domain_rules.material_conflicts import _enforce_primary_materials_mutual_exclusion
from app.services.ai_apu_service.domain_rules.deep_well import _enforce_deep_well_dimensions
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
    - Le pide ADAPTAR (no crear desde cero)
    - Reduce drásticamente el riesgo de alucinaciones
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

    base_json = json.dumps(_prune_apu_for_prompt(base_apu), ensure_ascii=False, separators=(',', ':')) if base_apu else "No disponible"

    comp_text = ""
    if complementary_apus:
        comp_text = "\n# INSUMOS COMPLEMENTARIOS DE APOYO (actividades accesorias faltantes en la base)\n"
        comp_text += "Usa SOLO los insumos de esta sección para la actividad accesoria indicada (ej. bote, friso, pintura). Conserva sus precios sin modificación.\n\n"
        for i, comp in enumerate(complementary_apus):
            comp_text += f"## Complementaria {i+1} [{comp.get('codpar', 'N/A')}] — {comp.get('descripcion', '')[:80]}\n"
            comp_text += json.dumps(_prune_apu_for_prompt(comp), ensure_ascii=False, separators=(',', ':'))
            comp_text += "\n"

    effective_cov_prefix = (covenin_prefix or "").strip()
    if not effective_cov_prefix:
        effective_cov_prefix = infer_covenin_prefix(user_description, base_apu.get("covenin") or base_apu.get("codpar") or "")

    unit_directive = ""
    u_clean = str(requested_unit).strip().lower() if requested_unit else ""
    is_global_unit = u_clean in ("gl", "sg", "global", "suma global")

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
    elif requested_unit:
        unit_directive = f"""
# DIRECTIVA OBLIGATORIA DE UNIDAD DE MEDIDA (DEFINIDA POR EL ANALISTA)
La partida DEBE estructurarse OBLIGATORIAMENTE con la unidad: '{u_clean}'.
- El campo `unit` de `partida` DEBE ser exactamente '{u_clean}'.
- Si la unidad es 'pza' o 'und':
  * Todos los consumos de materiales (pintura, solvente, convertidor, lijas, electrodos, pernos) DEBEN calcularse para UNA SOLA PIEZA individual (ej. 1 peldaño de 1x0.32m consume ~0.02 gln de pintura/fondo y 0.01 gln de convertidor). NUNCA dejes consumos por m2 si la unidad es pieza o unidad.
  * El rendimiento diario de la cuadrilla DEBE expresarse en piezas o unidades al día (ej. 15 a 25 pza/día con amoladora portátil de 4 1/2 pulg).
- Si la unidad es 'm2':
  * Todos los consumos de materiales y el rendimiento diario se calculan por metro cuadrado de superficie desarrollada (25 a 35 m2/día).
- Si la unidad es 'm' o 'ml':
  * Todos los consumos y rendimientos se calculan por metro lineal de desarrollo.
"""

    base_unit = str(base_apu.get('unidad') or base_apu.get('unit') or '').strip().lower()
    base_ren = base_apu.get('rendimiento') or base_apu.get('performance') or base_apu.get('RenPar') or 'N/A'
    req_u_clean = str(requested_unit).strip().lower() if requested_unit else base_unit

    if is_global_unit:
        dias_val = float(execution_days) if execution_days and float(execution_days) > 0 else 1.0
        target_perf = round(1.0 / dias_val, 4)
        performance_instruction = f"""2. CÁLCULO DE RENDIMIENTO PARA PARTIDA GLOBAL (Gl):
   - La unidad solicitada es 'Gl' (Suma Global).
   - El rendimiento diario DEBE ser obligatoriamente: performance = {target_perf} (correspondiente a 1.0 / {dias_val} días).
   - En `notas_adaptacion`, explica que el rendimiento R = {target_perf} Gl/día corresponde a {dias_val} días de trabajo de cuadrilla."""
    elif req_u_clean and base_unit and req_u_clean != base_unit:
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
    is_deep_well_req = (
        bool(re.search(r"\b(pozo\s+profundo|pozo\s+de\s+agua|pozo\s+tubular|bomba\s+(?:tipo\s+)?lapicero)\b", u_desc_lower))
        or (bool(re.search(r"\bbomba\s+sumergible\b", u_desc_lower)) and not bool(re.search(r"\b(aguas?\s+negras?|aguas?\s+servidas?|residuales?|achique|fosa|cloaca|triturador\w*)\b", u_desc_lower)))
    )
    if is_deep_well_req:
        depth_val = deep_well_depth or 50.0
        deep_well_directive = f"""
# DIRECTIVA CRÍTICA OBLIGATORIA PARA BOMBA SUMERGIBLE / POZO PROFUNDO:
- Profundidad de instalación calculada: {int(depth_val)} METROS.
- La partida requiere UNA SOLA BOMBA SUMERGIBLE (tipo lapicero para pozo profundo con motor y cuerpo de impulsión) de la potencia solicitada.
- QUEDA TERMINANTEMENTE PROHIBIDO incluir o conservar bombas centrífugas, de superficie o de presión constante heredadas de la base histórica.
- Dimensiona estrictamente la columna de tubería de impulsión en {int(depth_val)} metros.
- Dimensiona el cable sumergible plano y la guaya de suspensión de acero en {round(depth_val * 1.05, 1)} metros (+5% de holgura).
- Incluye válvula de retención (check) para pozo profundo y accesorios de conexión."""

    prompt = f"""
# MODO DE TRABAJO: ADAPTACIÓN DE APU BASE
El sistema ha seleccionado una partida histórica de la base de datos como BASE DE ADAPTACIÓN.
Tu tarea es ADAPTAR ese APU base para la nueva partida solicitada por el usuario.
NO debes inventar desde cero. Usa los insumos, precios y cantidades del APU base como referencia principal.
{unit_directive}
{deep_well_directive}
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
3. CONSERVA todos los insumos que sigan siendo relevantes para la nueva partida. Márcalos como `"origen": "historico"`.
4. REGLA DE INSUMO PREPONDERANTE ÚNICO Y MATRIZ DE COMPATIBILIDAD EN 12 FAMILIAS: Si la nueva partida requiere un material o equipo preponderante diferente al de la base (ej: epóxica vs esmalte, porcelanato vs caico, drywall vs bloque de arcilla, etc.), ELIMINA POR COMPLETO el insumo histórico y sus solventes/fijaciones no afines. QUEDA ESTRICTAMENTE PROHIBIDO conservar ambos insumos en el APU. Sustitúyelo por el insumo correcto con origen "ia", precio referencial de mercado en USD y emite la advertencia `[PRECIO_REFERENCIAL]`.
5. AJUSTA cantidades cuando la nueva partida lo requiera (ej: distinta área, espesor, proporción, o cómputo global Gl).
   Los insumos provenientes de la partida base o complementarias DEBEN CONSERVAR obligatoriamente `"origen": "historico"` (incluso si sus cantidades fueron escaladas).
   Explica el ajuste métrico en `nota_calculo`.
   Marca con `"origen": "ia"` ÚNICAMENTE los insumos nuevos que agregues tú y no existían en la base.
6. AUTO-FUSIÓN: Si la descripción del usuario exige algo que falta en la Base (ej. Bote de material, Pintura, Andamios, Encofrado) pero que sí existe en las Partidas Complementarias, "róbalo" e intégralo conservando sus precios históricos.
7. AGREGA insumos nuevos que la nueva partida requiera estrictamente y no estén ni en la base ni en las complementarias. Márcalos como `"origen": "ia"`, asígnales un precio unitario referencial estimado de mercado en USD (nunca 0.0) y agrega una advertencia con el prefijo `[PRECIO_REFERENCIAL]`.
8. NUNCA alteres los precios unitarios de los insumos del APU base ni de las complementarias. Son precios reales de la BD.
9. Registra SIEMPRE en `notas_adaptacion` (para el log técnico de depuración) que el APU fue adaptado desde la partida base [{base_apu.get('codpar', 'N/A')}], qué insumos se podaron y la justificación del rendimiento.
10. El campo `advertencias` es EXCLUSIVAMENTE para alertas de precios referenciales de mercado estimados por IA con el prefijo `[PRECIO_REFERENCIAL]` (cuando un insumo indispensable no existe en el catálogo histórico o cuando se sustituyó un equipo o material incompatible de la base).
    - NUNCA agregues advertencias sobre exclusiones de alcance (`[ALCANCE]`); el analista de costos ya conoce el alcance solicitado.
    - NUNCA menciones qué partida o código se utilizó como base histórica en `advertencias`.
    - Las notas de adaptación interna van EXCLUSIVAMENTE en `notas_adaptacion`, jamás en `advertencias`.
11. UNIDAD OBLIGATORIA: Si se especifica una directiva de unidad obligatoria arriba, el campo `unit` de `partida` DEBE ser exactamente esa unidad, escalando los consumos de materiales y el rendimiento diario en correspondencia matemática estricta.
"""
    result = call_llm_json(prompt, use_case="cost360", system_prompt=_APU_SYSTEM_PROMPT)
    _sanitize_llm_numbers(result)
    if "advertencias" not in result:
        result["advertencias"] = []
    if "notas_adaptacion" not in result:
        result["notas_adaptacion"] = []

    if result.get("status") == "clarification_needed":
        result["options"] = []

    # Salvaguarda determinista de exclusiones de alcance explícitas
    _enforce_scope_exclusions(result, user_description)

    # Salvaguarda determinista de seguridad para trabajos a rapel / en altura
    _enforce_rapel_and_height_equipment(result, user_description)

    # Salvaguarda determinista para trabajos a nivel de piso / suelo
    _enforce_floor_ground_equipment(result, user_description)

    # Salvaguarda determinista de exclusión mutua de materiales preponderantes
    _enforce_primary_materials_mutual_exclusion(result, user_description)

    # Limpieza determinista de la descripción de la partida (remoción de tipologías coloquiales como 'en casa')
    _sanitize_partida_description(result, user_description)

    # Salvaguarda determinista de pozo profundo y bombas sumergibles
    _enforce_deep_well_dimensions(result, user_description, deep_well_depth)

    # Salvaguarda determinista de unidad solicitada
    if result.get("partida") and requested_unit:
        result["partida"]["unit"] = requested_unit.strip().lower()

    _normalize_equipment_prices(result, base_apu, complementary_apus)
    calibrate_apu_crew_and_equipment(result, base_apu)
    _enforce_base_apu_material_heritage(result, base_apu, complementary_apus)
    reconcile_equipment_with_database(result, db)
    reconcile_materials_with_database(result, db)
    reconcile_labor_with_database(result, db)

    # Salvaguarda final de pozo profundo tras reconciliación con base de datos
    _enforce_deep_well_dimensions(result, user_description, deep_well_depth)

    result["debug_base_apu"] = base_apu
    result["prompt_enviado_al_llm"] = prompt

    return result
