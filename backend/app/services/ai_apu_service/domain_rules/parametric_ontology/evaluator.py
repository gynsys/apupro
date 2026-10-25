"""Motor de evaluación de contratos paramétricos ontológicos (MOPTC)."""

import re
from typing import Any, Dict, List, Optional

from app.core.logging import logger
from .contextual_options import get_contextual_options
from .models import ParametricRequirement
from .patterns import (
    DEMOLITION_OR_REMOVAL_PATTERNS,
    MAINTENANCE_AND_REPAIR_PATTERNS,
    SURFACE_TREATMENTS_AND_FINISHES_PATTERNS,
    strip_accents,
)
from .registry import ONTOLOGY_REGISTRY


def evaluate_parametric_ontology_contract(
    query: str,
    unit: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    """
    Evalúa la descripción de obra contra la Ontología Paramétrica Universal.
    Si faltan parámetros físicos o logísticos indispensables para la familia constructiva detectada,
    devuelve un payload estructurado de aclaratoria interactiva para detener el pipeline
    ANTES de entrar a la búsqueda RAG y antes de consumir cualquier LLM.

    Args:
        query: Descripción textual ingresada por el usuario.
        unit: Unidad de cómputo solicitada (opcional, ej: 'und', 'pza', 'm2', 'm3', 'Gl').

    Returns:
        Dict con la aclaratoria estructurada (status: 'clarification_needed') o None si cumple.
    """
    if not query or not isinstance(query, str):
        return None

    norm_query = strip_accents(query.strip())
    raw_query = query.strip()

    # Extraer unidad si no fue provista explícitamente
    eff_unit = (unit or "").strip().lower()
    if not eff_unit:
        u_match = re.search(
            r'\b(?:unidad|en\s+unidad|unidad\s+de\s+medida|unidad:?)\s*[:=]?\s*(und|pza|piezas?|m2|m²|m3|m³|m|ml|gl|pto|puntos?)\b|\b(und|pza|m2|m²|m3|m³|ml|pto|gl)\b',
            norm_query
        )
        if u_match:
            eff_unit = (u_match.group(1) or u_match.group(2) or "").strip().lower()

    # 0. Inmunidad ontológica para Unidades Globales (Gl / Sg) o Labores por Jornada/Día/Hora
    eff_unit_lower = eff_unit.lower()
    is_global_unit = eff_unit_lower in ("gl", "sg", "global", "suma global") or bool(
        re.search(r"\b(?:unidad\s+)?(?:gl|sg|suma\s+global|global)\b", norm_query)
    )

    is_maintenance_or_service = any(
        p.search(raw_query) or p.search(norm_query)
        for p in (MAINTENANCE_AND_REPAIR_PATTERNS + SURFACE_TREATMENTS_AND_FINISHES_PATTERNS + DEMOLITION_OR_REMOVAL_PATTERNS)
    ) or bool(
        re.search(r"\b(servicio|inspecci[oó]n|revisi[oó]n|d[ií]as?|jornad[ao]|cuadrilla|mano\s+de\s+obra|hora|horas)\b", norm_query)
    )

    if is_global_unit or (is_maintenance_or_service and eff_unit_lower in ("gl", "sg", "dia", "dias", "jornada", "hh", "mes")):
        logger.info("Ontology contract bypassed: unit '%s' or maintenance/service task in '%.80s'", eff_unit, raw_query)
        return None

    for ontology in ONTOLOGY_REGISTRY:
        # 1. Verificar si la consulta activa esta familia constructiva
        is_activated = any(p.search(raw_query) or p.search(norm_query) for p in ontology.activation_patterns)
        if not is_activated:
            continue

        # 2. Verificar si aplica alguna regla de exclusión (ej: demolición, desmontaje)
        is_excluded = any(p.search(raw_query) or p.search(norm_query) for p in ontology.exclusion_patterns)
        if is_excluded:
            continue

        # 3. Evaluar cada parámetro requerido
        missing_params: List[ParametricRequirement] = []
        for req in ontology.required_parameters:
            has_param = any(p.search(raw_query) or p.search(norm_query) for p in req.detection_patterns)
            if not has_param:
                missing_params.append(req)

        # Si todos los parámetros están satisfechos, pasa al siguiente control
        if not missing_params:
            continue

        # 4. Construir la respuesta interactiva estructurada para los parámetros faltantes
        logger.info(
            "Ontological contract missing parameters for family [%s]: %s (query: '%.80s')",
            ontology.family_id,
            [p.param_id for p in missing_params],
            raw_query
        )

        missing_ids = [p.param_id for p in missing_params]
        questions_list: List[str] = [p.question for p in missing_params]

        # Determinar opciones: si hay generador compuesto (ej: espesor + tipo_mezcla combinados), usarlo
        options_list: List[str] = []
        if ontology.composite_options_generator:
            composite = ontology.composite_options_generator(missing_ids)
            if composite:
                options_list = composite

        if not options_list:
            if len(missing_params) == 1:
                options_list = get_contextual_options(
                    ontology.family_id,
                    missing_params[0].param_id,
                    raw_query,
                    norm_query,
                    missing_params[0].default_options
                )
            else:
                options_list = missing_params[0].default_options[:4]

        # Mensaje técnico contextualizado al elemento exacto solicitado
        specific_name = ontology.name.lower()
        if ontology.family_id in ("HERRERIA_ESTRUCTURAS_MET_DISCRETAS", "PUERTAS_VENTANAS_CARPINTERIA"):
            if re.search(r"\bpuertas?\b", norm_query):
                specific_name = "puertas metálicas"
            elif re.search(r"\b(porton|portones)\b", norm_query):
                specific_name = "portones"
            elif re.search(r"\b(rejas?|protector(?:es)?)\b", norm_query):
                specific_name = "rejas de protección"
            elif re.search(r"\b(barandas?|pasamanos?)\b", norm_query):
                specific_name = "barandas y pasamanos"
        elif ontology.family_id == "ELEMENTOS_ESTRUCTURALES_DISCRETOS":
            if re.search(r"\bdintel(?:es)?\b", norm_query):
                specific_name = "dinteles"
            elif re.search(r"\b(machon|machones)\b", norm_query):
                specific_name = "machones"
            elif re.search(r"\bvigas?\s+corona\b", norm_query):
                specific_name = "vigas de corona"

        if len(missing_params) == 1:
            clarification_msg = (
                f"Para calcular con exactitud un APU de {specific_name}, es indispensable "
                f"especificar el siguiente parámetro técnico o logístico: {missing_params[0].label.lower()}."
            )
        else:
            labels_str = " y ".join(p.label.lower() for p in missing_params)
            clarification_msg = (
                f"Para calcular con exactitud un APU de {specific_name}, se requieren "
                f"dos especificaciones técnicas indispensables en ingeniería de costos: {labels_str}."
            )

        internal_code = f"ONTOLOGY_MISSING_{'_AND_'.join(missing_ids).upper()}"

        return {
            "status": "clarification_needed",
            "clarification_type": "parametric_specification_required",
            "_internal_code": internal_code,
            "clarification_message": clarification_msg,
            "questions": questions_list,
            "options": options_list,
            "recommendation": (
                "Indica o selecciona los parámetros solicitados para dimensionar los insumos, equipos "
                "y el rendimiento exacto de la cuadrilla sin asumir equipos costosos arbitrariamente."
            ),
            "guia_redaccion": (
                f"Especifica los parámetros requeridos ({', '.join(missing_ids)}) en tu respuesta "
                "para continuar directamente con la generación del APU."
            )
        }

    # 5. Control Universal Fallback para Elementos Físicos en Unidades Discretas (und / pza / pto)
    if eff_unit in ("und", "pza", "pto", "pieza", "piezas", "unidad") and not is_maintenance_or_service:
        is_discrete_fabrication = bool(re.search(
            r"\b(construcci[oó]n|construir|fabricaci[oó]n|fabricar|vaciado|vaciar|hechura|hacer|elaboraci[oó]n|elaborar)\b",
            norm_query
        ))
        is_demolition = any(p.search(raw_query) or p.search(norm_query) for p in DEMOLITION_OR_REMOVAL_PATTERNS)
        has_dimensions_or_specs = bool(re.search(
            r"\b\d+([\.,]\d+)?\s*(?:m|mts|mt|cm|cms|mm|m2|m²|m3|m³|pulg|\"|kg|kgf|hp|kva|btu|x|\*|por)\b|\b(?:est[aá]ndar|estandar|comercial|seg[uú]n\s+plano|dimensiones?|medidas?)\b",
            norm_query
        ))
        if is_discrete_fabrication and not is_demolition and not has_dimensions_or_specs:
            logger.info("Universal discrete fabrication missing dimensions (unit=%s): '%.80s'", eff_unit, raw_query)
            return {
                "status": "clarification_needed",
                "clarification_type": "parametric_specification_required",
                "_internal_code": "ONTOLOGY_UNIVERSAL_DISCRETE_MISSING_DIMENSIONS",
                "clarification_message": (
                    f"Has solicitado la construcción o elaboración de un elemento por unidad ({eff_unit}). "
                    "En ingeniería de costos, el consumo de insumos materiales y el rendimiento de la cuadrilla "
                    "dependen de su escala física. Por favor indica sus dimensiones o sección aproximada (Largo x Ancho x Espesor/Alto):"
                ),
                "questions": [
                    "¿Cuáles son las dimensiones o sección física aproximada del elemento (Largo x Ancho x Espesor/Alto)?"
                ],
                "options": [
                    "Dimensiones menores (ej. 1.00 m x 0.15 m x 0.05 m)",
                    "Dimensiones estándar (ej. 2.00 m x 0.20 m x 0.10 m)",
                    "Dimensiones medianas (ej. 3.00 m x 0.25 m x 0.15 m)",
                    "Dimensiones grandes (ej. 4.00 m x 0.30 m x 0.20 m)"
                ],
                "recommendation": "Indica o selecciona las medidas aproximadas para calcular las cantidades exactas de materiales sin sobreestimar costos.",
                "guia_redaccion": "Escribe las dimensiones (ej: 0.90x0.15x0.05m o 1.00m de luz) para continuar con la generación exacta del APU."
            }

    return None
