import re
import subprocess
import time
from datetime import datetime
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session

from app.core.logging import logger
from app.db.base import get_db
from app.db.arko_base import ArkoSessionLocal
from app.api.v1.endpoints.arko import get_current_arko_admin
from app.middleware.plan_limits import check_ai_access
from app.schemas.costbase import (
    AiApuGenerateRequest,
    SmartSelectRequest,
    RagDiagnosticRequest
)
from app.crud.crud_costbase import (
    get_item_by_code,
    get_item_by_code_or_covpar,
    get_apu_materials,
    get_apu_equipments,
    get_apu_labors
)
from app.services.preprocessing_service import preprocess_apu_data, fast_preprocess_debug
from app.services.ai_apu_service import (
    is_code_input,
    generate_apu_with_ai,
    generate_apu_with_ai_from_base,
    get_dynamic_candidates,
    fetch_base_apu_for_prompt,
    select_relevant_complementary_apus,
    infer_covenin_prefix
)
from app.services.synonyms_service import expand_technical_synonyms
from app.services.ai_search import detect_materials, ai_engine
from app.services.apu_input_validator import validate_apu_input, validate_rag_signals, build_rejection_response
from app.services.ai_apu_service.domain_rules.parametric_ontology import evaluate_parametric_ontology_contract
from app.services.user_semantic_cache import lookup_user_semantic_cache
from app.services.inverse_apu_synthesizer import synthesize_apu_inverse
from app.services.typesafe_service import evaluate_construction_prompt
from app.api.v1.endpoints.costbase.common import (
    is_covenin_coded_item,
    normalize_text_alphanumeric,
    get_active_typesafe_key
)

router = APIRouter()


@router.post("/generate-ai-apu")
def generate_ai_apu_route(
    payload: AiApuGenerateRequest,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_arko_admin)
) -> Any:
    # Verificar acceso a IA
    check_ai_access(current_user)
    t_route_start = time.time()

    # 0. Si el usuario aceptó la partida de Match Exacto ("Sí, es esa"), devolver APU de BD directamente
    if payload.accept_exact_match_code:
        item = get_item_by_code_or_covpar(db, payload.accept_exact_match_code)
        if item:
            mat_results = get_apu_materials(db, item.CodPar)
            eq_results = get_apu_equipments(db, item.CodPar)
            mo_results = get_apu_labors(db, item.CodPar)

            materials = [
                {
                    "id": f"m-{mat.CodMat}",
                    "codigo": mat.ref_code or mat.CodMat,
                    "cod_ins": mat.CodMat,
                    "ref_code": mat.ref_code,
                    "descripcion": mat.Descri,
                    "unidad": mat.UniMat,
                    "cantidad": rel.CanIns,
                    "desperdicio": getattr(rel, 'Desper', 0.0) or 0.0,
                    "precio_unitario": mat.CosMat or 0.0,
                    "origen": "historico",
                    "nota_calculo": "Extraído directamente de la base de datos certificada."
                } for rel, mat in mat_results
            ]

            equipments = [
                {
                    "id": f"e-{eq.CodEqu}",
                    "codigo": eq.ref_code or eq.CodEqu,
                    "cod_ins": eq.CodEqu,
                    "ref_code": eq.ref_code,
                    "descripcion": eq.Descri,
                    "unidad": "día",
                    "cantidad": rel.CanIns,
                    "depreciacion": getattr(rel, 'Deprec', 1.0) or 1.0,
                    "precio_unitario": eq.CosDia or 0.0,
                    "origen": "historico",
                    "nota_calculo": "Extraído directamente de la base de datos certificada."
                } for rel, eq in eq_results
            ]

            labors = [
                {
                    "id": f"l-{mo.CodMan}",
                    "codigo": mo.ref_code or mo.CodMan,
                    "cod_ins": mo.CodMan,
                    "ref_code": mo.ref_code,
                    "descripcion": mo.Descri,
                    "unidad": "día",
                    "cantidad": rel.CanIns,
                    "jornal": mo.Jornal or 0.0,
                    "bono": mo.Bono or 0.0,
                    "precio_unitario": (mo.Jornal or 0.0) + (mo.Bono or 0.0),
                    "origen": "historico",
                    "nota_calculo": "Extraído directamente de la base de datos certificada."
                } for rel, mo in mo_results
            ]

            return {
                "status": "completed",
                "partida": {
                    "cod_par": item.CodPar,
                    "cov_par": item.CovPar or item.CodPar,
                    "description": item.Descri,
                    "unit": item.UniPar,
                    "quantity": 1.0,
                    "performance": getattr(item, 'RenPar', 1.0) or 1.0
                },
                "materials": materials,
                "equipments": equipments,
                "labors": labors,
                "advertencias": []
            }

    # 1. Early Validation & Detección de Código vs Descripción de Obra
    raw_desc = (payload.description or "").strip()

    # Reconstrucción y unificación de contexto si es una respuesta a aclaratoria con historial
    if payload.history and raw_desc:
        last_user_msg = next(
            (
                getattr(msg, "content", "").strip()
                for msg in reversed(payload.history)
                if getattr(msg, "role", "") == "user"
                and getattr(msg, "content", "").strip()
                and getattr(msg, "content", "").strip().lower() != raw_desc.lower()
            ),
            None
        )
        if last_user_msg:
            raw_tokens = raw_desc.lower().split()
            has_action = any(
                act in raw_desc.lower()
                for act in ("suministro", "instalacion", "construccion", "demolicion", "vaciado", "colocacion", "montaje", "acarreo")
            )
            if len(raw_tokens) <= 6 or not has_action:
                logger.info("Unificando respuesta de aclaratoria con mensaje previo: '%.80s' + '%.80s'", last_user_msg, raw_desc)
                raw_desc = f"{last_user_msg}, {raw_desc}"
                payload.description = raw_desc

    # --- CAPA 1: Validación de entrada (costo cero — sin LLM, sin red) ---
    capa1_result = validate_apu_input(raw_desc)
    if capa1_result is not None:
        veredicto, mensaje, codigo_interno = capa1_result
        logger.info("APU input rejected by Capa 1 [%s]: %.80s", codigo_interno, raw_desc)
        return build_rejection_response(veredicto, mensaje, codigo_interno)

    # Si el usuario ingresó únicamente un código o nomenclatura:
    if is_code_input(raw_desc):
        if not payload.bypass_exact_match:
            exact_item = get_item_by_code_or_covpar(db, raw_desc.strip())
            if exact_item and is_covenin_coded_item(exact_item):
                return {
                    "status": "exact_match_candidate",
                    "matched_item": {
                        "cod_par": exact_item.CodPar,
                        "cov_par": exact_item.CovPar or exact_item.CodPar,
                        "description": exact_item.Descri,
                        "unit": exact_item.UniPar,
                        "pre_uni": exact_item.PreUni or 0.0,
                        "performance": getattr(exact_item, 'RenPar', 1.0) or 1.0
                    },
                    "message": f"Existe la partida {exact_item.CovPar or exact_item.CodPar} correspondiente al código ingresado. ¿Te refieres a esta partida?"
                }
        return {
            "status": "clarification_needed",
            "clarification_type": "redirect_to_guided",
            "clarification_message": f"El texto ingresado ('{raw_desc}') no es una descripción técnica de obra.",
            "recommendation": "Te recomendamos utilizar el Asistente Guiado para estructurar tu descripción paso a paso.",
            "options": [],
            "questions": [],
            "guia_redaccion": "Estructura recomendada: [Acción] + [Elemento] + [Especificaciones/Materiales] + [Unidad]."
        }

    # 2. Normalización y Expansión Técnica con Diccionario
    if payload.description:
        payload.description = expand_technical_synonyms(payload.description)

    # --- VALIDACIÓN ONTOLÓGICA PARAMÉTRICA GLOBAL (PRE-RAG) ---
    # Verifica si la descripción pertenece a una familia constructiva y carece de especificaciones críticas (espesor, mezcla, etc.)
    ontology_eval = evaluate_parametric_ontology_contract(payload.description)
    if ontology_eval and not payload.only_preprocess and not payload.accept_exact_match_code:
        logger.info("Ontology pre-RAG contract intercepted missing specifications [%s]: %.80s", ontology_eval["_internal_code"], payload.description)
        ontology_eval.setdefault("partida", None)
        ontology_eval.setdefault("materials", [])
        ontology_eval.setdefault("equipments", [])
        ontology_eval.setdefault("labors", [])
        ontology_eval.setdefault("advertencias", [])
        return ontology_eval

    # --- VALIDACIÓN DETERMINISTA DE UNIDAD PARA MANTENIMIENTO / REPARACIÓN ---
    MAINTENANCE_KEYWORDS = [
        "mantenimiento", "mantener", "saneamiento", "sanear",
        "reconstruccion", "reconstrucción", "reconstruir",
        "arreglo", "arreglar", "reparacion", "reparación", "reparar",
        "rehabilitacion", "rehabilitación", "rehabilitar",
        "restauracion", "restauración", "restaurar",
        "reacondicionamiento", "reacondicionar", "acondicionamiento", "acondicionar",
        "recuperacion", "recuperación", "recuperar",
        "adecuacion", "adecuación", "adecuar",
        "refaccion", "refacción", "refaccionar",
        "remodelacion", "remodelación", "remodelar",
        "resane", "resanado", "resanar",
        "repicado", "repicar", "repique",
        "escarificacion", "escarificación", "escarificar",
        "desmanchado", "desmanchar", "decapado", "decapar"
    ]
    raw_desc_lower = (raw_desc or "").lower()
    is_maintenance_activity = (
        any(kw in raw_desc_lower for kw in MAINTENANCE_KEYWORDS)
        or bool(re.search(
            r"\b(mantenimiento|mantener|saneamiento|sanear|reconstrucci[oó]n|reconstruir|arreglo|arreglar|reparaci[oó]n|reparar|rehabilitaci[oó]n|rehabilitar|restauraci[oó]n|restaurar|reacondicionamiento|reacondicionar|acondicionamiento|acondicionar|recuperaci[oó]n|recuperar|adecuaci[oó]n|adecuar|refacci[oó]n|refaccionar|remodelaci[oó]n|remodelar|resane|resanado|resanar|escarificaci[oó]n|escarificar|repicado|repicar|desmanchado|desmanchar|decapado|decapar)\b",
            raw_desc_lower
        ))
    )

    effective_unit = (payload.unit or "").strip().lower()
    if not effective_unit:
        unit_match = re.search(r'\b(gl|sg|global|suma\s*global|pza|und|unidad|piezas?|m2|m²|ml|mts?|metros?\s*lineales?|pto|puntos?)\b', raw_desc_lower)
        if unit_match:
            matched_u = unit_match.group(1)
            if matched_u in ("gl", "sg", "global", "suma global"):
                effective_unit = "Gl"
            elif matched_u in ("pieza", "piezas"):
                effective_unit = "pza"
            elif matched_u == "unidad":
                effective_unit = "und"
            elif matched_u in ("m2", "m²"):
                effective_unit = "m2"
            elif matched_u in ("ml", "mt", "mts", "metro", "metros", "metros lineales"):
                effective_unit = "m"
            elif matched_u in ("pto", "puntos"):
                effective_unit = "pto"
            else:
                effective_unit = matched_u

    if is_maintenance_activity and not effective_unit and not payload.only_preprocess and not payload.accept_exact_match_code:
        logger.info("Maintenance activity detected without explicit unit: %.80s", raw_desc)
        return {
            "status": "clarification_needed",
            "clarification_type": "maintenance_unit_required",
            "_internal_code": "RAG_MAINTENANCE_MISSING_UNIT",
            "clarification_message": (
                "Has solicitado una labor de mantenimiento, reacondicionamiento o reparación. En ingeniería de costos, "
                "el dimensionamiento de insumos y rendimientos de la cuadrilla depende estrictamente de la unidad de medida "
                "(por pieza individual, por superficie en m², por longitud en m o por suma global Gl). Por favor selecciona la unidad de cómputo:"
            ),
            "options": [
                "pza (Por Pieza / Peldaño / Elemento individual)",
                "und (Por Unidad)",
                "m2 (Por Metro Cuadrado de superficie)",
                "m (Por Metro Lineal de desarrollo)",
                "Gl (Suma Global / Todo el paquete)"
            ],
            "questions": [
                "¿En qué unidad de medida se computará la partida (pza, und, m2, m, Gl)?"
            ],
            "guia_redaccion": "Selecciona la unidad requerida para que el APU calcule los materiales y el rendimiento exacto sin distorsión de costos."
        }

    # --- VALIDACIÓN DETERMINISTA DE PROFUNDIDAD PARA POZO PROFUNDO / BOMBA SUMERGIBLE ---
    is_sewage_or_drainage = bool(re.search(
        r"\b(aguas?\s+negras?|aguas?\s+servidas?|residuales?|achique|fosa|cloaca|triturador\w*|drenaje\s+pluvial)\b",
        raw_desc_lower
    ))
    is_deep_well_pump = (
        bool(re.search(r"\b(pozo\s+profundo|pozo\s+de\s+agua|pozo\s+tubular|bomba\s+(?:tipo\s+)?lapicero)\b", raw_desc_lower))
        or (bool(re.search(r"\bbomba\s+sumergible\b", raw_desc_lower)) and not is_sewage_or_drainage)
    )
    if not is_deep_well_pump and payload.history:
        for msg in reversed(payload.history):
            c_low = (getattr(msg, "content", "") or "").lower()
            if (
                bool(re.search(r"\b(pozo\s+profundo|pozo\s+de\s+agua|pozo\s+tubular|bomba\s+(?:tipo\s+)?lapicero)\b", c_low))
                or (bool(re.search(r"\bbomba\s+sumergible\b", c_low)) and not is_sewage_or_drainage)
            ):
                is_deep_well_pump = True
                break

    effective_depth: Optional[float] = None
    if is_deep_well_pump:
        dm = re.search(
            r'(?:profundidad|columna|descenso|hondo|nivel\s+din[aá]mico)?\s*(?:de|a)?\s*(\d{1,3}(?:[.,]\d+)?)\s*(?:m|mts|metros?|pie|pies|ft)\b',
            raw_desc_lower
        )
        if not dm:
            dm = re.search(r'\b(\d{1,3})\s*(?:m|mts|metros)\b', raw_desc_lower)
        if dm:
            try:
                effective_depth = float(dm.group(1).replace(",", "."))
            except ValueError:
                effective_depth = None

        if not effective_depth and payload.history:
            for msg in reversed(payload.history):
                content_lower = (getattr(msg, "content", "") or "").lower()
                h_dm = re.search(
                    r'(?:profundidad|columna|descenso|hondo|nivel\s+din[aá]mico)?\s*(?:de|a)?\s*(\d{1,3}(?:[.,]\d+)?)\s*(?:m|mts|metros?|pie|pies|ft)\b',
                    content_lower
                )
                if not h_dm:
                    h_dm = re.search(r'\b(\d{1,3})\s*(?:m|mts|metros)\b', content_lower)
                if h_dm:
                    try:
                        effective_depth = float(h_dm.group(1).replace(",", "."))
                        break
                    except ValueError:
                        pass

        if not effective_depth and not payload.only_preprocess and not payload.accept_exact_match_code:
            logger.info("Deep well pump activity detected without explicit depth: %.80s", raw_desc)
            return {
                "status": "clarification_needed",
                "clarification_type": "deep_well_depth_required",
                "_internal_code": "RAG_DEEP_WELL_MISSING_DEPTH",
                "clarification_message": (
                    "Has solicitado el suministro e instalación de una bomba sumergible para pozo profundo. "
                    "En ingeniería de costos y obras electromecánicas, el dimensionamiento de la columna de tubería "
                    "de impulsión, la longitud del cable sumergible y la guaya de suspensión dependen estrictamente "
                    "de la profundidad de instalación del pozo. Por favor selecciona o indica la profundidad en metros:"
                ),
                "options": [
                    "30 metros de profundidad",
                    "50 metros de profundidad",
                    "80 metros de profundidad",
                    "100 metros de profundidad",
                    "120 metros de profundidad"
                ],
                "questions": [
                    "¿A qué profundidad en metros se instalará la bomba sumergible en el pozo profundo?"
                ],
                "guia_redaccion": "Indica la profundidad en metros (ej: 50m) para calcular la cantidad exacta de cable sumergible, tubería de impulsión y accesorios."
            }

        if not effective_unit or effective_unit in ("m", "ml", "metro", "metros", "mts") or "metro" in effective_unit:
            effective_unit = "und"

    # --- SELECTOR DE ARQUITECTURA: MODO MATEMÁTICO ---
    is_superadmin = (
        getattr(current_user, 'is_superadmin', False) is True or
        getattr(current_user, 'role', '') == 'superadmin' or
        getattr(current_user, 'email', '') == 'admin@arko360.net' or
        getattr(current_user, 'is_admin', False) is True
    )

    jev_analysis = None
    if is_superadmin and payload.description:
        typesafe_key = get_active_typesafe_key(db)
        if typesafe_key:
            logger.info("Evaluando decisión con TypeSafe AI (Jev) para Superadmin: %.80s", payload.description)
            try:
                jev_res = evaluate_construction_prompt(payload.description, typesafe_key)
                if jev_res.get("success"):
                    jev_analysis = jev_res
                    logger.info(
                        "TypeSafe Jev: rubro=%s (conf=%s) | unidad=%s (conf=%s) | latency=%sms",
                        jev_res.get("category"),
                        jev_res.get("category_confidence"),
                        jev_res.get("recommended_unit"),
                        jev_res.get("unit_confidence"),
                        jev_res.get("latency_ms")
                    )
                    if not effective_unit and jev_res.get("unit_confidence", 0) >= 0.85:
                        effective_unit = jev_res.get("recommended_unit")
            except Exception as j_err:
                logger.error("Error no fatal evaluando con TypeSafe Jev: %s", j_err, exc_info=True)

    if payload.generation_mode == "inverse" and is_superadmin and not payload.only_preprocess:
        logger.info(
            "Despachando generación de APU en Modo Matemático (Síntesis Inversa) para superadmin %s: %.80s",
            getattr(current_user, 'email', 'desconocido'),
            payload.description
        )
        try:
            inverse_result = synthesize_apu_inverse(
                user_description=payload.description,
                unit=effective_unit or payload.unit or "und",
                execution_days=payload.execution_days,
                covenin_prefix=payload.covenin_prefix or "",
                db=db
            )
            inverse_result["generation_engine"] = "inverse"
            if jev_analysis:
                inverse_result["jev_analysis"] = jev_analysis
            return inverse_result
        except Exception as exc:
            logger.error("Error al sintetizar APU en Modo Matemático: %s", exc, exc_info=True)
            raise HTTPException(status_code=500, detail=f"Error en Modo Matemático: {str(exc)}")

    # --- CAPA 0 (Semantic Cache Privado del Usuario) ---
    if current_user and payload.description and not payload.only_preprocess and not payload.base_partida_code and not payload.accept_exact_match_code:
        user_id = getattr(current_user, 'id', None)
        cached_apu = lookup_user_semantic_cache(
            db=db,
            user_id=user_id,
            description=payload.description,
            threshold=0.96
        )
        if cached_apu:
            logger.info("APU servido desde Semantic Cache para usuario %s: %.80s", user_id, payload.description)
            return cached_apu

    # 2.1. Si es solo preproceso DEBUG, devolver resultado rápido
    if payload.only_preprocess:
        debug_data = fast_preprocess_debug(
            db, payload.description, payload.covenin_prefix, payload.covenin_context
        )
        debug_data["motor_ia_estado"] = {
            "is_loaded": ai_engine.is_loaded,
            "total_ids_mapeados": len(ai_engine.ids_mapping),
            "embeddings_forma": str(ai_engine.embeddings.shape) if ai_engine.embeddings is not None else "No cargado",
        }
        return {
            "status": "clarification_needed",
            "clarification_message": f"MODO DEBUG: {len(debug_data.get('todas_las_partidas_covenin', []))} candidatas encontradas tras expansión dinámica",
            "options": [],
            "questions": [],
            "debug_preprocesamiento": debug_data
        }

    # --- CAPA 2 (Pre-RAG): Validación Léxica Temprana ---
    pre_rag_result = validate_rag_signals(payload.description, candidates=None)
    if pre_rag_result is not None:
        veredicto, mensaje, codigo_interno, options = pre_rag_result
        logger.info("APU input stopped by Capa 2 Pre-RAG [%s]: %.80s", codigo_interno, payload.description)
        return build_rejection_response(veredicto, mensaje, codigo_interno, rag_candidates=options)

    # 2.2. Búsqueda RAG Híbrida Automática
    candidates = []
    rag_latency_ms = 0.0
    if not candidates and not payload.only_preprocess:
        t_rag_start = time.time()
        candidates, _ = get_dynamic_candidates(db, payload.description, payload.covenin_prefix or "", limit=15)
        rag_latency_ms = round((time.time() - t_rag_start) * 1000, 2)

    # --- CAPA 2 (Post-RAG): Validación de Relevancia Semántica ---
    capa2_result = validate_rag_signals(payload.description, candidates)
    if capa2_result is not None:
        veredicto, mensaje, codigo_interno, options = capa2_result
        logger.info("APU input stopped by Capa 2 Post-RAG [%s]: %.80s", codigo_interno, payload.description)
        return build_rejection_response(veredicto, mensaje, codigo_interno, rag_candidates=options)

    # 2.3. Detección interactiva de Match Exacto
    if not payload.bypass_exact_match and not payload.base_partida_code:
        exclusion_patterns = ["no incluye", "sin ", "excepto", "excluyendo", "no contempla", "no considerar"]
        has_exclusion = any(neg in raw_desc.lower() for neg in exclusion_patterns)

        if not has_exclusion and candidates:
            coded_candidate = None
            for cand in candidates[:3]:
                if is_covenin_coded_item(cand["item"]):
                    coded_candidate = cand
                    break

            if coded_candidate:
                top_item = coded_candidate["item"]

                norm_query = normalize_text_alphanumeric(raw_desc)
                norm_item_desc = normalize_text_alphanumeric(top_item.Descri or "")

                stopwords = {"de", "la", "el", "en", "para", "con", "por", "un", "una", "y", "o", "a", "los", "las", "del", "al", "e"}
                words_query = set(norm_query.split()) - stopwords
                words_item = set(norm_item_desc.split()) - stopwords

                is_exact_text = (norm_query == norm_item_desc)
                is_high_overlap = False
                if words_query and words_item:
                    common_words = words_query.intersection(words_item)
                    overlap_ratio = len(common_words) / len(words_query)
                    item_overlap_ratio = len(common_words) / len(words_item)
                    is_high_overlap = (overlap_ratio >= 0.92 and item_overlap_ratio >= 0.85)

                query_mats = detect_materials(raw_desc)
                item_mats = detect_materials(top_item.Descri or "")
                has_material_conflict = False
                if query_mats:
                    for cat, q_set in query_mats.items():
                        it_set = item_mats.get(cat, set())
                        if it_set and not (q_set & it_set):
                            has_material_conflict = True
                            break
                        elif not it_set and q_set:
                            has_material_conflict = True
                            break

                if not has_material_conflict and (is_exact_text or is_high_overlap):
                    return {
                        "status": "exact_match_candidate",
                        "matched_item": {
                            "cod_par": top_item.CodPar,
                            "cov_par": top_item.CovPar or top_item.CodPar,
                            "description": top_item.Descri,
                            "unit": top_item.UniPar,
                            "pre_uni": top_item.PreUni or 0.0,
                            "performance": getattr(top_item, 'RenPar', 1.0) or 1.0
                        },
                        "message": f"Existe la partida {top_item.CovPar or top_item.CodPar} que coincide casi al 100% con tu descripción. ¿Te refieres a esta partida?"
                    }

    # 2.4. MODO RAG / ADAPTACIÓN DE BASE REAL
    base_code = payload.base_partida_code
    if not base_code and not payload.only_preprocess:
        if candidates and candidates[0]["score"] >= 0.35:
            base_code = candidates[0]["item"].CodPar

    if base_code:
        base_apu = fetch_base_apu_for_prompt(db, base_code)

        all_candidates_trace = []
        complementary_apus = []
        try:
            if not candidates:
                candidates, _ = get_dynamic_candidates(db, payload.description, payload.covenin_prefix or "", limit=15)
            all_candidates_trace = [
                {
                    "codpar": c["item"].CodPar,
                    "covenin": c["item"].CovPar,
                    "descripcion": c["item"].Descri,
                    "score": c["score"],
                    "scoring_breakdown": c.get("scoring_breakdown", {}),
                }
                for c in candidates
            ]
            complementary_apus = select_relevant_complementary_apus(
                db=db,
                user_description=payload.description,
                base_apu=base_apu,
                candidates=candidates,
                max_complementary=2,
            )
        except Exception as exc:
            logger.error("Error fetching complementary APUs: %s", exc, exc_info=True)

        history_dicts = [msg.model_dump() for msg in payload.history] if payload.history else []
        t_base_gen_start = time.time()
        result = generate_apu_with_ai_from_base(
            base_apu=base_apu,
            complementary_apus=complementary_apus,
            user_description=payload.description,
            covenin_prefix=payload.covenin_prefix or "",
            covenin_context=payload.covenin_context or "",
            smart_answers=payload.smart_answers or {},
            history=history_dicts,
            requested_unit=effective_unit or payload.unit,
            execution_days=payload.execution_days,
            db=db,
            deep_well_depth=effective_depth,
        )
        t_base_gen_end = time.time()

        # 1. CÓDIGO DE PARTIDA: SC001 para adaptaciones IA
        if result.get("partida"):
            partida_data = result["partida"]
            current_cod = (partida_data.get("cod_par") or "").strip()
            base_cod_val = getattr(base_apu, "get", lambda k, d=None: d)("codpar", base_code) or base_code

            expected_prefix = (payload.covenin_prefix or "").strip().replace(".", "").replace("-", "")
            if not expected_prefix or len(expected_prefix) < 3:
                expected_prefix = infer_covenin_prefix(payload.description, base_apu.get("covenin") or base_code or "")

            current_prefix = current_cod[:len(expected_prefix)].upper() if len(current_cod) >= len(expected_prefix) else ""
            if (
                current_cod == base_cod_val or 
                current_cod.upper().startswith("XXX") or 
                not current_cod or 
                "SC" not in current_cod.upper() or
                (expected_prefix and current_prefix != expected_prefix.upper())
            ):
                new_sc_code = f"{expected_prefix.upper()}SC001"
                partida_data["cod_par"] = new_sc_code
                partida_data["cov_par"] = new_sc_code

        # 2. ADVERTENCIAS AL USUARIO
        if "advertencias" in result and isinstance(result["advertencias"], list):
            clean_adv = []
            base_code_lower = (base_code or "").strip().lower()
            current_eq_descs = [
                str(e.get("descripcion", "")).lower() 
                for e in result.get("equipments", []) 
                if isinstance(e, dict) and str(e.get("origen", "")).lower() in ("ia", "referencial")
            ]
            current_mat_descs = [
                str(m.get("descripcion", "")).lower() 
                for m in result.get("materials", []) 
                if isinstance(m, dict) and str(m.get("origen", "")).lower() in ("ia", "referencial")
            ]
            active_ia_descs = current_eq_descs + current_mat_descs

            for adv in result["advertencias"]:
                if not adv or not isinstance(adv, str):
                    continue
                adv_lower = adv.lower()
                if "[alcance]" in adv_lower or "alcance:" in adv_lower or "se excluye" in adv_lower:
                    continue
                if "partida base" in adv_lower or "apu base" in adv_lower or "adaptado desde" in adv_lower:
                    continue
                if base_code_lower and base_code_lower in adv_lower:
                    continue
                if "[precio_referencial]" in adv_lower:
                    quoted = re.findall(r"['\"]([^'\"]+)['\"]", adv)
                    if quoted and active_ia_descs:
                        insumo_name = quoted[0].lower()
                        insumo_tokens = set(re.findall(r'\w+', insumo_name)) - {"de", "la", "el", "en", "para", "con", "por", "un", "una", "y", "o"}
                        has_overlap = any(
                            insumo_name in act or act in insumo_name or (insumo_tokens and len(insumo_tokens & set(re.findall(r'\w+', act))) >= 2)
                            for act in active_ia_descs
                        )
                        if not has_overlap:
                            continue
                    elif not active_ia_descs:
                        continue
                clean_adv.append(adv)
            result["advertencias"] = clean_adv

        result["debug_rag_trace"] = {
            "motor_rag": "RAG Híbrido (Gemini Embeddings + Léxico)",
            "solicitud_usuario": payload.description,
            "covenin_prefix": payload.covenin_prefix,
            "covenin_context": payload.covenin_context,
            "partida_base_ganadora": {
                "codpar": base_apu.get("codpar"),
                "covenin": base_apu.get("covenin"),
                "descripcion": base_apu.get("descripcion")
            },
            "partidas_complementarias": [
                {"codpar": c.get("codpar"), "covenin": c.get("covenin"), "descripcion": c.get("descripcion")}
                for c in complementary_apus
            ],
            "top_candidatas_evaluadas": all_candidates_trace
        }

        second_cand = candidates[1] if len(candidates) > 1 else None
        result["debug_base_selection"] = {
            "criterio": "seleccion_manual_usuario" if payload.base_partida_code else "seleccion_automatica_rag",
            "partida_ganadora": {
                "codpar": base_apu.get("codpar"),
                "covenin": base_apu.get("covenin"),
                "descripcion": base_apu.get("descripcion"),
                "score": candidates[0]["score"] if candidates else None
            },
            "segunda_opcion": {
                "codpar": second_cand["item"].CodPar,
                "covenin": second_cand["item"].CovPar,
                "descripcion": second_cand["item"].Descri,
                "score": second_cand["score"]
            } if second_cand else None,
            "gap_score": round(candidates[0]["score"] - second_cand["score"], 3) if (candidates and second_cand) else 0.0,
            "umbral_aceptacion": 0.35,
            "supera_umbral": (candidates[0]["score"] >= 0.35) if candidates else False
        }

        total_latency_ms = round((time.time() - t_route_start) * 1000, 2)
        llm_latency_ms = float(result.get("debug_llm_latency_ms") or 0.0)
        postproc_latency_ms = round(max(0.0, (t_base_gen_end - t_base_gen_start) * 1000 - llm_latency_ms), 2)

        result["debug_meta"] = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "motor_generacion": "RAG Híbrido + Adaptación Anclada de Partida Base",
            "modelo_llm": "Router LLM (Gemini / Providers Activos)",
            "latencia_total_ms": total_latency_ms,
            "latencia_rag_ms": rag_latency_ms,
            "latencia_llm_ms": llm_latency_ms,
            "latencia_postproceso_ms": postproc_latency_ms,
            "conteo_candidatos_rag": len(candidates),
            "conteo_complementarias": len(complementary_apus),
            "solicitud_unidad": effective_unit or payload.unit,
            "usuario_rol": "superadmin" if is_superadmin else "regular",
            "usuario_id": getattr(current_user, "id", None)
        }
        if (result.get("status") in ("success", "completed")) and result.get("partida"):
            with ArkoSessionLocal() as adb:
                db_user = adb.query(current_user.__class__).filter_by(id=current_user.id).first()
                if db_user:
                    db_user.ai_apus_generated = getattr(db_user, 'ai_apus_generated', 0) + 1
                    adb.commit()
        result["generation_engine"] = "rag"
        if jev_analysis and isinstance(result, dict):
            result["jev_analysis"] = jev_analysis
        return result

    # 3. Preprocesamiento (BD + Estadísticas) + IA semántica (Fallback clásico sin base directa)
    payload_llm = preprocess_apu_data(db, payload.description, payload.covenin_prefix, payload.covenin_context)

    # 3.5. Pregunta interactiva si hay Match Exacto
    if payload_llm.get("modo") == "partida_exacta_encontrada" and not payload.bypass_exact_match:
        cod_par = payload_llm.get("partida_exacta_codigo")
        item = get_item_by_code(db, cod_par)
        if item and is_covenin_coded_item(item):
            return {
                "status": "exact_match_candidate",
                "matched_item": {
                    "cod_par": item.CodPar,
                    "cov_par": item.CovPar or item.CodPar,
                    "description": item.Descri,
                    "unit": item.UniPar,
                    "pre_uni": item.PreUni or 0.0,
                    "performance": getattr(item, 'RenPar', 1.0) or 1.0
                },
                "message": f"Existe la partida {item.CovPar or item.CodPar} que coincide casi al 100% con tu descripción. ¿Te refieres a esta partida?"
            }

    # 4. Generación con IA
    history_dicts = [msg.model_dump() for msg in payload.history] if payload.history else []
    result = generate_apu_with_ai(payload_llm, history_dicts, db=db)

    if (result.get("status") in ("success", "completed")) and result.get("partida"):
        if "advertencias" in result and isinstance(result["advertencias"], list):
            result["advertencias"] = [
                adv for adv in result["advertencias"]
                if adv and isinstance(adv, str) and "[alcance]" not in adv.lower() and "alcance:" not in adv.lower()
            ]
        with ArkoSessionLocal() as adb:
            db_user = adb.query(current_user.__class__).filter_by(id=current_user.id).first()
            if db_user:
                db_user.ai_apus_generated = getattr(db_user, 'ai_apus_generated', 0) + 1
                adb.commit()

    if jev_analysis and isinstance(result, dict):
        result["jev_analysis"] = jev_analysis

    return result


@router.post("/smart-select")
def smart_select_route(payload: SmartSelectRequest, db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Selección automática de partida base mediante RAG Híbrido."""
    candidates, best_score = get_dynamic_candidates(db, payload.description, payload.covenin_prefix or "", limit=15)
    best_match = None
    if candidates:
        top_item = candidates[0]["item"]
        best_match = {
            "codpar": top_item.CodPar,
            "covenin": top_item.CovPar,
            "descripcion": top_item.Descri,
            "unidad": top_item.UniPar,
            "score": round(candidates[0]["score"], 3),
        }
    return {
        "covenin_prefix": payload.covenin_prefix,
        "covenin_context": payload.covenin_context,
        "description": payload.description,
        "answers_received": payload.answers or {},
        "total_partidas": len(candidates),
        "candidates_count": len(candidates),
        "questions": [],
        "candidates": [
            {
                "codpar": c["item"].CodPar,
                "covenin": c["item"].CovPar,
                "descripcion": c["item"].Descri,
                "unidad": c["item"].UniPar,
                "score": round(c["score"], 3),
            }
            for c in candidates
        ],
        "best_match": best_match,
        "confidence": round(best_score, 3),
        "ready_to_generate": True,
    }


@router.post("/rag-diagnostic")
def rag_diagnostic_route(
    payload: RagDiagnosticRequest,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_arko_admin)
) -> Dict[str, Any]:
    """Diagnóstico técnico en tiempo real del motor RAG Híbrido, sin costo de LLM."""
    if not payload.query or not payload.query.strip():
        raise HTTPException(status_code=400, detail="La consulta no puede estar vacía.")

    query: str = payload.query.strip()
    expanded_query: str = expand_technical_synonyms(query)

    try:
        candidates, best_score = get_dynamic_candidates(
            db=db,
            description=expanded_query,
            covenin_prefix=payload.covenin_prefix or "",
            limit=payload.limit or 15
        )
    except Exception as exc:
        logger.error(f"Error en búsqueda RAG de diagnóstico: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error en motor RAG: {str(exc)}")

    formatted_candidates: List[Dict[str, Any]] = []
    base_apu_details: Optional[Dict[str, Any]] = None
    complementary_details: List[Dict[str, Any]] = []

    if candidates:
        for c in candidates:
            item = c["item"]
            formatted_candidates.append({
                "codpar": getattr(item, "CodPar", ""),
                "covenin": getattr(item, "CovPar", "") or getattr(item, "CodPar", ""),
                "descripcion": getattr(item, "Descri", ""),
                "unidad": getattr(item, "UniPar", ""),
                "rendimiento": getattr(item, "RenPar", 0.0),
                "score": round(float(c.get("score", 0.0)), 4),
            })

        winning_candidate = candidates[0]
        base_code: str = getattr(winning_candidate["item"], "CodPar", "")
        if base_code:
            try:
                base_apu = fetch_base_apu_for_prompt(db, base_code)
                base_apu_details = {
                    "codpar": base_apu.get("codpar"),
                    "covenin": base_apu.get("covenin"),
                    "descripcion": base_apu.get("descripcion"),
                    "unidad": base_apu.get("unidad"),
                    "rendimiento": base_apu.get("rendimiento"),
                    "total_materiales": len(base_apu.get("materiales", [])),
                    "total_equipos": len(base_apu.get("equipos", [])),
                    "total_mano_obra": len(base_apu.get("mano_obra", [])),
                    "materiales": base_apu.get("materiales", [])[:6],
                    "equipos": base_apu.get("equipos", [])[:6],
                    "mano_obra": base_apu.get("mano_obra", [])[:6],
                }

                complementaries = select_relevant_complementary_apus(
                    db=db,
                    user_description=expanded_query,
                    base_apu=base_apu,
                    candidates=candidates,
                    max_complementary=2,
                )
                for comp in complementaries:
                    complementary_details.append({
                        "codpar": comp.get("codpar"),
                        "covenin": comp.get("covenin"),
                        "descripcion": comp.get("descripcion"),
                        "unidad": comp.get("unidad"),
                        "rendimiento": comp.get("rendimiento"),
                    })
            except Exception as exc:
                logger.error(f"Error procesando APU base o complementarias en diagnóstico: {exc}", exc_info=True)

    return {
        "status": "ok",
        "query_original": query,
        "query_expandida": expanded_query,
        "sinonimos_aplicados": query.strip().lower() != expanded_query.strip().lower(),
        "total_candidatas": len(formatted_candidates),
        "best_score": round(float(best_score), 4) if best_score else 0.0,
        "ganadora": formatted_candidates[0] if formatted_candidates else None,
        "base_apu": base_apu_details,
        "complementarias": complementary_details,
        "es_autosuficiente": len(complementary_details) == 0,
        "candidatas": formatted_candidates,
    }


@router.post("/rag/update-brain")
def update_rag_brain(background_tasks: BackgroundTasks) -> Dict[str, str]:
    """
    Ejecuta la actualización del Cerebro RAG (generación de embeddings y CSV) en segundo plano.
    Este proceso lee las partidas de PostgreSQL, calcula los embeddings con MiniLM y 
    los guarda en la carpeta /app para que el AISearchEngine los cargue en el proximo restart.
    """
    def run_generation() -> None:
        try:
            subprocess.run(
                ["python3", "/app/generate_embeddings.py"], 
                capture_output=True, 
                text=True, 
                check=True
            )
            logger.info("Generación de Cerebro RAG finalizada con éxito.")
        except subprocess.CalledProcessError as e:
            logger.error(f"Error generando Cerebro RAG: {e.stderr}", exc_info=True)

    background_tasks.add_task(run_generation)

    return {
        "status": "success", 
        "message": "Actualización del Cerebro RAG iniciada en segundo plano. Esto tomará de 5 a 15 minutos."
    }
