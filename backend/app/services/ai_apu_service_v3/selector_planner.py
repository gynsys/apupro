"""
Stage 1 & Stage 2 of AI APU Service v3.0:
1. Enriched Candidate Retrieval (Top K candidates with real Materials, Equipment, and Labor recipes).
2. AI Base Selector + Surgical Delta Planner (chooses best matching base APU and outputs only Delta operations).
"""

import json
import time
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy.orm import Session

from app.core.logging import logger
from app.services.ai_apu_service.rag_context.base_apu_fetcher import fetch_base_apu_for_prompt
from app.services.ai_apu_service.rag_context.candidates import get_dynamic_candidates
from app.services.ai_apu_service.reconciliation.specs_matcher import _normalize_unit
from app.services.ai_apu_service_v3.schemas import V3AdaptationPlan
from app.services.llm_router import call_llm_json


_V3_SELECTOR_SYSTEM_PROMPT = """Eres un Ingeniero Civil y de Costos Senior venezolano experto en la Norma COVENIN 2000:1992.
Tu trabajo opera en DOS modalidades según exista o no una partida base compatible:

REGLA DE ORO DE REDACCIÓN Y MEJORA TÉCNICA COVENIN (adapted_description):
- ESTÁ TERMINANTEMENTE PROHIBIDO devolver la descripción del usuario intacta, literal o en minúsculas.
- DEBES MEJORAR, EXPANDIR Y PROFESIONALIZAR la descripción transformándola en una especificación técnica formal COVENIN en MAYÚSCULAS.
- Estructura obligatoria: [ACCIÓN TÉCNICA NORMATIVA] + [ELEMENTO ESTRUCTURAL O CONSTRUCTIVO] + [MATERIALES, QUÍMICOS Y ESPECIFICACIONES] + [ALCANCES Y METODOLOGÍA INCLUIDA].
- Ejemplo: Si el usuario escribe: "reparacion de losa de techo. incluye la remocion de recubrimiento en mal estado, cepillado de acero de refuerzo corroida, aplicacion de convertidor de oxido y la aplicacion de mortero de alta resistencia",
  DEBES REDACTAR: "REPARACIÓN INTEGRAL DE LOSA DE TECHO DE CONCRETO ARMADO, INCLUYE REMOCIÓN DE FRISO/RECUBRIMIENTO DETERIORADO, LIMPIEZA CON CEPILLO DE ACERO EN ACERO DE REFUERZO CORROÍDO, APLICACIÓN DE CONVERTIDOR DE ÓXIDO Y RECUBRIMIENTO CON MORTERO ESTRUCTURAL DE ALTA RESISTENCIA".
- Elimina cualquier mención coloquial a casas, quintas, apartamentos o clientes privados; usa terminología normativa formal de ingeniería civil.

REGLAS DE ORO DE COHERENCIA CONSTRUCTIVA POR PRIMEROS PRINCIPIOS:
1. CAUSALIDAD DIRECTA DE LA CUADRILLA (SIN OFICIOS FANTASMA):
   - Cada cargo de mano de obra DEBE tener una relación de causa y efecto directa con la acción física de la partida.
   - En DESMALEZAMIENTO, DEFORESTACIÓN, TALA, PODA O LIMPIEZA DE TERRENO: TERMINANTEMENTE PROHIBIDO incluir Albañil, Plomero, Electricista, Soldador o Carpintero. La cuadrilla natural se compone de: `CAPORAL`, `OBRERO DE 1RA` (operador de desmalezadora a motor / motosierra / machetero) y `AYUDANTE` (recogida, rastrilleo y apilado).
   - En HERRERÍA, ESTRUCTURAS METÁLICAS O CERCAS CON TUBOS SOLDADOS: Si la partida involucra soldadura, corte de perfiles o fijación metálica, el oficial técnico debe ser `SOLDADOR DE 1RA` o `HERRERO DE 1RA` (no albañil).
   - En PARTIDAS ATÍPICAS O ESPECIALIZADAS (ej. geomembranas PEAD, impermeabilizaciones, micropilotes): Asigna el especialista idóneo (`IMPERMEABILIZADOR DE 1RA`, `TÉCNICO ESPECIALISTA`) con sus herramientas y equipos correspondientes.
2. ÁMBITO DE TRABAJO Y ESCALA POR UNIDAD DE MEDIDA:
   - Si la unidad es territorial (`ha` = 10.000 m², `km` lineal o grandes volúmenes de tierra): PROHIBIDO asignar cuadrillas enanas de 1 o 2 trabajadores. Debes estructurar una BRIGADA DE CAMPO PROPORCIONAL (mínimo 4 a 8 trabajadores en hectáreas) con dotación coherente de equipos motrices (ej. 2 a 4 desmalezadoras de motor, machetes y rastrillos).
   - Rendimiento diario proporcional: En `ha`, el rendimiento diario por brigada debe ser una fracción realista (típicamente 0.20 a 0.50 ha/día).
3. PURGA OBLIGATORIA DE INSUMOS FANTASMA HEREDADOS (MODALIDAD A):
   - Si la partida candidata base seleccionada contiene insumos que contradicen la acción física solicitada (por ejemplo, un Albañil o cemento en una partida base elegida para desmalezamiento), DEBES ELIMINARLOS quirúrgicamente con `op: "remove"`.

MODALIDAD A — ADAPTACIÓN QUIRÚRGICA DESDE PARTIDA BASE (CUANDO HAY CANDIDATA COMPATIBLE):
1. Analiza las partidas candidatas reales de la Base de Datos Oficial (con sus materiales, equipos, mano de obra y rendimiento real).
2. Si al menos una candidata sirve como molde constructivo real para la actividad solicitada, elige su código en `selected_codpar` (puede ser la candidata #1, #2, #3, #4, #5 o #6).
3. El sistema clonará intacta la partida base que elijas (conservando todos sus códigos oficiales, precios reales, depreciaciones y jornales).
4. Por lo tanto, NO reescribas los insumos que ya están bien: emite en `material_ops`, `equipment_ops` o `labor_ops` ÚNICAMENTE las diferencias puntuales (`replace`, `remove`, `modify_qty`, `add`) entre la base y lo solicitado. Si hay oficios ajenos a la actividad en la base, ELIMÍNALOS con `remove`.
5. Si la unidad solicitada es equivalente a la de la base y la escala es similar, usa `keep_base_performance: true`. Si la unidad o la escala cambió (ej. de m2 a ha), usa `keep_base_performance: false` y ajusta `new_performance`.

MODALIDAD B — CREACIÓN REGULADA DESDE CERO (`selected_codpar: "NONE"` CUANDO NO HAY COINCIDENCIA CONSTRUCTIVA):
Si ninguna de las candidatas pertenece a la actividad/sistema constructivo solicitado (o si la lista de candidatas está vacía) PERO la descripción del usuario es completa y clara:
1. Coloca `"selected_codpar": "NONE"`, `"keep_base_performance": false` y calcula `"new_performance"` según las Horas-Hombre diarias de la cuadrilla (`Obreros_Activos * 8 h/día / HH_por_unidad`).
2. Construye la receta completa usando operaciones `"op": "add"` en `material_ops`, `equipment_ops` y `labor_ops` siguiendo estas REGLAS OBLIGATORIAS COVENIN:
   - REGLA DE MATERIALES: Expresa consumos técnicos exactos por 1 unidad de medida (`target_unit`) con desperdicio normativo (`3%` a `10%`). Si la partida es solo Instalación (`I/S`), Demolición, Remoción o Desmontaje, PROHIBIDO incluir la compra del activo principal.
   - REGLA DE EQUIPOS: Incluye siempre `HERRAMIENTAS MENORES` (`new_quantity: 1.0`, `depreciation_factor: 1.0`, `estimated_price_usd: 1.50`). Para herramientas eléctricas o equipos propios, usa factor de depreciación diario (`depreciation_factor` entre `0.002` y `0.015`) sobre su valor de reposición en USD, o `1.0` si el precio es tarifa diaria.
   - REGLA DE MANO DE OBRA: Asigna los oficios técnicos exactamente requeridos por la actividad física:
     * Supervisión: `MAESTRO DE OBRA` o `CAPORAL` (`0.10` a `0.50`).
     * Especialistas según oficio real: `ALBAÑIL DE 1RA` (albañilería/concreto), `SOLDADOR DE 1RA` o `HERRERO DE 1RA` (metálicas/soldadura), `PLOMERO DE 1RA` (tuberías/gas), `ELECTRICISTA DE 1RA` (electricidad), `PINTOR DE 1RA` (pintura), `IMPERMEABILIZADOR` (impermeabilización/geomembranas), `CARPINTERO DE 1RA` (madera/encofrados).
     * En labores de campo/áreas verdes: NO usar especialistas de obra civil; usar `OBRERO DE 1RA` (operadores de desmalezadora/macheteros) y `AYUDANTE`.
     * Apoyo: `AYUDANTE` y/o `OBRERO DE 1RA` dimensionados a la escala de la partida.
3. Solo pon `"clarification_needed": true` si la descripción del usuario está incompleta o carece de actividad/material definitorio.
- Responde SIEMPRE en formato JSON válido cumpliendo el esquema solicitado.
"""


def _format_candidate_recipe_summary(index: int, score: float, apu_data: Dict[str, Any]) -> str:
    """Formatea de manera compacta y legible la receta completa de una partida candidata para el prompt V3."""
    codpar = str(apu_data.get("codpar") or "")
    covenin = str(apu_data.get("covenin") or codpar)
    desc = str(apu_data.get("descripcion") or "")
    unidad = str(apu_data.get("unidad") or "")
    rend = float(apu_data.get("rendimiento") or 1.0)

    mats = apu_data.get("materiales") or []
    eqs = apu_data.get("equipos") or []
    labs = apu_data.get("mano_obra") or []

    mat_lines: List[str] = []
    for m in mats[:12]:
        m_cod = str(m.get("codigo") or "")
        m_desc = str(m.get("descripcion") or "")
        m_uni = str(m.get("unidad") or "")
        m_qty = float(m.get("cantidad") or 0.0)
        mat_lines.append(f"[{m_cod}] {m_desc} ({m_qty:g} {m_uni})")

    eq_lines: List[str] = []
    for e in eqs[:8]:
        e_cod = str(e.get("codigo") or "")
        e_desc = str(e.get("descripcion") or "")
        e_qty = float(e.get("cantidad") or 0.0)
        eq_lines.append(f"[{e_cod}] {e_desc} (cant={e_qty:g})")

    lab_lines: List[str] = []
    for l in labs[:8]:
        l_cod = str(l.get("codigo") or "")
        l_desc = str(l.get("descripcion") or "")
        l_qty = float(l.get("cantidad") or 0.0)
        lab_lines.append(f"[{l_cod}] {l_desc} (cant={l_qty:g})")

    summary = (
        f"=== CANDIDATA #{index} | codpar=\"{codpar}\" | COVENIN=\"{covenin}\" | "
        f"Unidad=\"{unidad}\" | Rendimiento={rend:g}/día | ScoreRAG={score:.3f} ===\n"
        f"Descripción Oficial: {desc}\n"
        f"Materiales ({len(mats)}): {'; '.join(mat_lines) if mat_lines else 'Ninguno'}\n"
        f"Equipos ({len(eqs)}): {'; '.join(eq_lines) if eq_lines else 'Ninguno'}\n"
        f"Mano de Obra ({len(labs)}): {'; '.join(lab_lines) if lab_lines else 'Ninguno'}\n"
    )
    return summary


def fetch_enriched_candidates_for_v3(
    db: Session,
    user_description: str,
    covenin_prefix: str = "",
    manual_base_code: Optional[str] = None,
    top_k: int = 6,
    use_embeddings: bool = False,
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], float]:
    """
    Recupera las mejores partidas candidatas desde PostgreSQL y enriquece las Top K
    con su receta real de materiales, equipos y mano de obra para que el LLM pueda
    comparar e inspeccionar qué tiene cada partida antes de elegir.
    Por defecto en V3 opera con use_embeddings=False (100% Léxico IDF + Ponderación Técnica COVENIN)
    para evitar latencia y consumo de cuota de API de embeddings externos.
    """
    if db is None:
        raise ValueError("db Session es obligatoria en fetch_enriched_candidates_for_v3")
    if not user_description or not isinstance(user_description, str):
        raise ValueError("user_description debe ser un string no vacío")

    t0 = time.time()
    candidates, _ = get_dynamic_candidates(
        db,
        user_description,
        covenin_prefix or "",
        limit=12,
        use_embeddings=use_embeddings,
    )

    all_candidates_trace: List[Dict[str, Any]] = [
        {
            "codpar": c["item"].CodPar,
            "covenin": c["item"].CovPar,
            "descripcion": c["item"].Descri,
            "unidad": c["item"].UniPar,
            "rendimiento": float(c["item"].RenPar or 1.0),
            "score": round(float(c["score"]), 4),
            "scoring_breakdown": c.get("scoring_breakdown", {}),
        }
        for c in candidates
    ]

    enriched_candidates: List[Dict[str, Any]] = []
    seen_codpars: set[str] = set()

    # Si el usuario especificó manualmente un código de partida base, priorizarlo en #1
    if manual_base_code and manual_base_code.strip():
        clean_manual = manual_base_code.strip()
        manual_apu = fetch_base_apu_for_prompt(db, clean_manual)
        if manual_apu and manual_apu.get("codpar"):
            enriched_candidates.append({
                "codpar": manual_apu["codpar"],
                "score": 1.0,
                "apu": manual_apu
            })
            seen_codpars.add(str(manual_apu["codpar"]))

    for cand in candidates:
        if len(enriched_candidates) >= top_k:
            break
        codpar = str(cand["item"].CodPar)
        if codpar in seen_codpars:
            continue
        apu_dict = fetch_base_apu_for_prompt(db, codpar)
        if apu_dict and apu_dict.get("codpar"):
            enriched_candidates.append({
                "codpar": codpar,
                "score": float(cand["score"]),
                "apu": apu_dict
            })
            seen_codpars.add(codpar)

    retrieval_ms = (time.time() - t0) * 1000.0
    return enriched_candidates, all_candidates_trace, retrieval_ms


def _build_v3_selector_prompt(
    user_description: str,
    enriched_candidates: List[Dict[str, Any]],
    requested_unit: Optional[str] = None,
    execution_days: Optional[float] = None,
    context: Optional[str] = None
) -> str:
    """Construye el prompt compacto para que la IA elija la mejor partida base o sintetice bajo reglas COVENIN."""
    if enriched_candidates:
        candidates_block = "\n".join(
            _format_candidate_recipe_summary(idx + 1, c["score"], c["apu"])
            for idx, c in enumerate(enriched_candidates)
        )
    else:
        candidates_block = "(SIN CANDIDATAS EN LA BASE DE DATOS OFICIAL — APLICAR MODALIDAD B: CREACIÓN REGULADA DESDE CERO CON selected_codpar=\"NONE\")\n"

    unit_line = f"Unidad solicitada por el usuario: {requested_unit}\n" if requested_unit else "Unidad solicitada: Usar la unidad técnica normativa adecuada.\n"
    days_line = f"Días de ejecución estimados (para unidad Global Gl): {execution_days}\n" if execution_days else ""
    ctx_line = f"Contexto adicional: {context}\n" if context else ""

    prompt = (
        f"SOLICITUD DEL USUARIO:\n"
        f"\"{user_description}\"\n"
        f"{unit_line}"
        f"{days_line}"
        f"{ctx_line}\n"
        f"PARTIDAS CANDIDATAS REALES EN BASE DE DATOS (CON SUS INSUMOS ACTUALES):\n"
        f"{candidates_block}\n"
        f"INSTRUCCIONES:\n"
        f"1. Si alguna candidata corresponde a la familia constructiva solicitada, escoge en `selected_codpar` su código `codpar` exacto y declara en `material_ops`, `equipment_ops` y `labor_ops` ÚNICAMENTE los cambios puntuales necesarios (`replace`, `remove`, `modify_qty`, `add`). SI LA BASE CONTIENE OFICIOS AJENOS A LA ACTIVIDAD FÍSICA SOLICITADA (ej. albañil en desmalezamiento), ELIMÍNALOS OBLIGATORIAMENTE con `remove`.\n"
        f"2. Si NINGUNA candidata tiene relación constructiva real con lo solicitado (o no hay candidatas) pero la descripción del usuario es completa, usa `\"selected_codpar\": \"NONE\"`, `\"keep_base_performance\": false`, asigna `\"new_performance\"` coherente con las Horas-Hombre de la cuadrilla y construye todos los materiales, equipos (incluyendo `HERRAMIENTAS MENORES`) y mano de obra con los oficios exactos que ejecutan la acción física mediante operaciones `\"op\": \"add\"`.\n"
        f"3. COHERENCIA DE OFICIOS Y ÁMBITO DE TRABAJO: En desmalezamiento/limpieza de terreno PROHIBIDO albañil/plomero/electricista (usar Caporal + Obrero de 1ra + Ayudante). En herrería/cercas con soldadura incluir Soldador/Herrero de 1ra. Si la unidad es territorial (`ha`, `km`), dimensiona una BRIGADA DE TRABAJO (4 a 8 personas) con sus equipos a motor suficientes (desmalezadoras), y rendimiento diario fraccionario (ej. 0.20 a 0.50 ha/día).\n"
        f"4. REDACCIÓN Y MEJORA TÉCNICA OBLIGATORIA (adapted_description): NO copies el texto del usuario literalmente ni en minúsculas. MEJORA, EXPANDE Y PROFESIONALIZA la redacción convirtiéndola en una especificación técnica formal COVENIN en MAYÚSCULAS que detalle el elemento intervenido, los productos/materiales utilizados y todos los alcances de la partida.\n"
        f"5. Si un insumo de la base se mantiene pero cambia su especificación (ej. otro tipo de bloque, otra resistencia de concreto, otro diámetro de tubería), usa `op: \"replace\"` indicando `target_code` del insumo original en la base.\n"
        f"6. Si un insumo de la base sobra o contradice la solicitud del usuario, usa `op: \"remove\"` indicando su `target_code`.\n"
        f"7. REGLA DE EQUIPOS DE LOGÍSTICA PESADA (SOLO POR SOLICITUD EXPLÍCITA): Elimina (`op: \"remove\"`) o abstente de agregar el WINCHE CABRESTANTE (+ GÜINCHERO), CAMIÓN F-350/VOLTEO/CONTENEDOR (+ CHOFER), COMPRESOR NEUMÁTICO (+ OPERADOR), PLANTA ELÉCTRICA/GENERADOR, BOMBA DE ACHIQUE, BOMBA DE CONCRETO, MINICARGADOR/BOBCAT, MONTACARGAS, PLATAFORMA ELEVADORA/MANLIFT, ANDAMIO TUBULAR/COLGANTE, EQUIPO AIRLESS, FRESADORA/ESCARIFICADORA DE PISO, CORTADORA DE PAVIMENTO DE CARRO, HIDROLAVADORA INDUSTRIAL, EQUIPO DE TOPOGRAFÍA, EQUIPO DE ENSAYO o EQUIPO DE OXICORTE/GRÚA/SEÑORITA salvo que el usuario lo haya solicitado expresamente en su descripción.\n\n"
        f"Devuelve ÚNICAMENTE un objeto JSON válido con esta estructura exacta:\n"
        "{\n"
        '  "selected_codpar": "CODIGO_CANDIDATA_O_NONE",\n'
        '  "selection_reason": "Por qué esta candidata es el mejor molde constructivo o por qué se crea desde cero bajo reglas COVENIN",\n'
        '  "adapted_description": "DESCRIPCIÓN TÉCNICA ADAPTADA EN MAYÚSCULAS",\n'
        '  "target_unit": "m2",\n'
        '  "keep_base_performance": true,\n'
        '  "new_performance": null,\n'
        '  "performance_reason": null,\n'
        '  "material_ops": [\n'
        '    {"op": "replace", "target_code": "COD_ORIGINAL", "new_description": "NUEVO MATERIAL", "new_unit": "und", "new_quantity": 1.0, "new_waste_pct": 5.0, "estimated_price_usd": 10.0, "reason": "Motivo del cambio"}\n'
        '  ],\n'
        '  "equipment_ops": [],\n'
        '  "labor_ops": [],\n'
        '  "technical_assumptions": ["Nota técnica de los ajustes aplicados"],\n'
        '  "clarification_needed": false,\n'
        '  "clarification_reason": null,\n'
        '  "clarification_options": []\n'
        "}"
    )
    return prompt


def plan_v3_selection_and_deltas(
    user_description: str,
    enriched_candidates: List[Dict[str, Any]],
    requested_unit: Optional[str] = None,
    execution_days: Optional[float] = None,
    context: Optional[str] = None
) -> Tuple[V3AdaptationPlan, Dict[str, Any], float, str]:
    """
    Ejecuta la selección de la mejor partida base y planificación de ajustes Delta con el LLM,
    o la creación regulada desde cero (`selected_codpar="NONE"`) cuando no existe partida base afín.
    Retorna: (plan, selected_base_apu_dict, llm_latency_ms, prompt_sent).
    """
    if not user_description or not isinstance(user_description, str):
        raise ValueError("user_description debe ser una cadena no vacía")

    t0 = time.time()
    prompt = _build_v3_selector_prompt(
        user_description=user_description,
        enriched_candidates=enriched_candidates,
        requested_unit=requested_unit,
        execution_days=execution_days,
        context=context
    )

    default_cand: Dict[str, Any] = enriched_candidates[0]["apu"] if enriched_candidates else {}
    default_codpar = str(default_cand.get("codpar") or "NONE")
    default_unit = _normalize_unit(requested_unit or str(default_cand.get("unidad") or "und"))

    raw_dict: Dict[str, Any] = {}
    try:
        raw_dict = call_llm_json(
            prompt=prompt,
            use_case="cost360",
            system_prompt=_V3_SELECTOR_SYSTEM_PROMPT
        )
    except Exception as exc:
        logger.error("Error en LLM V3 Selector/Planner: %s. Aplicando fallback.", exc, exc_info=True)
        raw_dict = {
            "selected_codpar": default_codpar,
            "selection_reason": "Selección automática por mayor score híbrido RAG (fallback de red LLM).",
            "adapted_description": user_description.strip().upper(),
            "target_unit": default_unit,
            "keep_base_performance": bool(default_cand),
            "new_performance": 10.0 if not default_cand else None,
            "material_ops": [],
            "equipment_ops": [],
            "labor_ops": [],
            "technical_assumptions": ["Contingencia de servicio LLM."]
        }

    try:
        if not isinstance(raw_dict, dict):
            raw_dict = {}
        plan = V3AdaptationPlan.model_validate(raw_dict)
    except Exception as val_err:
        logger.error("Error validando V3AdaptationPlan con Pydantic: %s. Reconstruyendo plan base.", val_err, exc_info=True)
        plan = V3AdaptationPlan(
            selected_codpar=str(raw_dict.get("selected_codpar") or default_codpar),
            selection_reason=str(raw_dict.get("selection_reason") or "Partida seleccionada por similitud técnica."),
            adapted_description=str(raw_dict.get("adapted_description") or user_description.strip().upper()),
            target_unit=_normalize_unit(requested_unit or str(raw_dict.get("target_unit") or default_unit)),
            keep_base_performance=bool(default_cand)
        )

    # Verificar si el LLM eligió creación desde cero ("NONE") o una candidata real
    selected_apu: Dict[str, Any] = {}
    req_cod = (plan.selected_codpar or "").strip().upper()
    is_explicit_from_scratch = req_cod in ("NONE", "NULL", "N/A", "SIN_BASE", "CERO", "") or not enriched_candidates

    if not is_explicit_from_scratch:
        for c in enriched_candidates:
            c_apu = c["apu"]
            c_cod = str(c_apu.get("codpar") or "").strip().upper()
            c_cov = str(c_apu.get("covenin") or "").strip().upper()
            if req_cod and (req_cod == c_cod or req_cod == c_cov):
                selected_apu = c_apu
                plan.selected_codpar = str(c_apu.get("codpar"))
                break
        if not selected_apu and default_cand:
            selected_apu = default_cand
            plan.selected_codpar = default_codpar
    else:
        plan.selected_codpar = "NONE"
        plan.keep_base_performance = False
        if not plan.new_performance or float(plan.new_performance) <= 0:
            plan.new_performance = 10.0

    if requested_unit and requested_unit.strip():
        plan.target_unit = _normalize_unit(requested_unit)
    elif not plan.target_unit:
        plan.target_unit = _normalize_unit(str(selected_apu.get("unidad") or "und"))
    else:
        plan.target_unit = _normalize_unit(plan.target_unit)

    if not plan.adapted_description or len(plan.adapted_description.strip()) < 5:
        plan.adapted_description = user_description.strip().upper()
    else:
        plan.adapted_description = plan.adapted_description.strip().upper()

    llm_latency_ms = (time.time() - t0) * 1000.0
    logger.info(
        "[V3 Planner] Partida elegida: %s | Deltas: %d mat, %d eq, %d mo | Latencia LLM: %.1fms",
        plan.selected_codpar,
        len(plan.material_ops),
        len(plan.equipment_ops),
        len(plan.labor_ops),
        llm_latency_ms
    )
    return plan, selected_apu, llm_latency_ms, prompt
