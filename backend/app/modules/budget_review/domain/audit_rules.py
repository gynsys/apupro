"""Motor determinista de reglas de auditoría para presupuestos y APUs (Maprex vs CostBase)."""
from __future__ import annotations

from collections import Counter
import re
from typing import Any, Dict, List, Optional, Set, Tuple
import unicodedata

from app.modules.budget_review.domain.ai_apu_auditor import audit_uncoded_apu_with_ai
from app.modules.budget_review.domain.maprex_baseline import (
    KNOWN_MATERIAL_CODE_COLLISIONS,
    KNOWN_PARTIDA_CODE_COLLISIONS,
    classify_costbase_item_origin,
    is_native_maprex_deprec_difference,
    normalize_unit,
)

_SPECIALIZED_LABOR_PATTERNS: Tuple[str, ...] = (
    r"\bcalculista\b",
    r"\blaboratorio\b",
    r"\blaboratorista\b",
    r"\bespecialista\b",
    r"\bgeotecn",
    r"\bpatolog",
    r"\bconsultor\b",
    r"\bestructurista\b",
    r"\bensayista\b",
    r"\binspector\b",
    r"\bperito\b",
    r"\bbuzo\b",
    r"\bcertificad[oa]\b",
)
_SPECIALIZED_LABOR_RE = re.compile("|".join(_SPECIALIZED_LABOR_PATTERNS), re.IGNORECASE)


def is_specialized_labor_profile(description: str) -> bool:
    """Detecta si la descripción de la mano de obra corresponde a personal técnico especializado o de consultoría."""
    if not isinstance(description, str) or not description.strip():
        return False
    return bool(_SPECIALIZED_LABOR_RE.search(description.strip()))

STOPWORDS: Set[str] = {
    "DE", "LA", "EL", "EN", "CON", "PARA", "POR", "LOS", "LAS", "DEL", "AL",
    "UN", "UNA", "Y", "O", "A", "SEGUN", "INCLUYE", "EXCLUYE", "HASTA", "TIPO",
}

UNCODED_PREFIXES: Tuple[str, ...] = (
    "S/C", "SC", "CUST", "NEW", "TEMP", "PROV", "IA-", "SIN", "N/A", "TAPU",
)

SUPPLY_KEYWORDS: Tuple[str, ...] = (
    "SUMINISTRO", "S/T/C", "S/I", "S/C", "CONSTRUCCION DE", "COLOCACION DE CONCRETO",
    "VACIADO DE CONCRETO", "PINTURA DE", "CAPA IMPERMEABILIZANTE", "TUBERIA", "CABLE",
)


def strip_accents_upper(text: str) -> str:
    """Convierte texto a mayúsculas sin acentos ni caracteres especiales."""
    if not isinstance(text, str):
        return ""
    norm = unicodedata.normalize("NFKD", text)
    no_acc = "".join(ch for ch in norm if not unicodedata.combining(ch)).upper()
    cleaned = re.sub(r"[^A-Z0-9\s]", " ", no_acc)
    return re.sub(r"\s+", " ", cleaned).strip()


def tokenize_description(text: str) -> Set[str]:
    """Extrae tokens significativos de una descripción técnica."""
    cleaned = strip_accents_upper(text)
    if not cleaned:
        return set()
    return {
        tok
        for tok in cleaned.split()
        if len(tok) >= 2 and tok not in STOPWORDS
    }


def compute_description_similarity(desc_a: str, desc_b: str) -> float:
    """Calcula similitud léxica (Jaccard ponderado con prefijo de 40 caracteres de Maprex)."""
    if not desc_a or not desc_b:
        return 0.0
    clean_a = strip_accents_upper(desc_a)
    clean_b = strip_accents_upper(desc_b)
    if clean_a == clean_b:
        return 1.0
    # Si una descripción es versión truncada de 40 caracteres de Maprex de la otra
    if len(clean_a) >= 25 and clean_b.startswith(clean_a[:35]):
        return 0.96
    if len(clean_b) >= 25 and clean_a.startswith(clean_b[:35]):
        return 0.96

    tokens_a = tokenize_description(desc_a)
    tokens_b = tokenize_description(desc_b)
    if not tokens_a or not tokens_b:
        return 0.0
    inter = len(tokens_a & tokens_b)
    union = len(tokens_a | tokens_b)
    return round(inter / union, 4) if union > 0 else 0.0


def is_exact_or_1to1_description(desc_a: str, desc_b: str) -> bool:
    """
    Determina si existe coincidencia 1 a 1 entre la descripción del presupuesto y la maestra.
    No permite discrepancias en el alcance (ej. 'LIMPIEZA' vs 'LIMPIEZA Y DESMALEZAMIENTO').
    Tolera únicamente diferencias tipográficas de acentos, mayúsculas o puntuación menor.
    """
    if not desc_a or not desc_b:
        return False
    clean_a = strip_accents_upper(desc_a)
    clean_b = strip_accents_upper(desc_b)
    if clean_a == clean_b:
        return True
    norm_a = re.sub(r"[^A-Z0-9]", "", clean_a)
    norm_b = re.sub(r"[^A-Z0-9]", "", clean_b)
    if norm_a == norm_b:
        return True
    # Solo tolerar truncamiento legacy en Maprex (límite de 40 caracteres en versiones antiguas)
    if len(norm_a) >= 35 and norm_b.startswith(norm_a):
        return True
    if len(norm_b) >= 35 and norm_a.startswith(norm_b):
        return True
    return False


def is_uncoded_code(code: str, cov_code: Optional[str] = None) -> bool:
    """
    Determina si una partida carece de codificación maestra/COVENIN o es una partida S/C genérica.
    Partidas con prefijo de capítulo COVENIN (ej. 'E12 S/C', 'E33 S/C') no se consideran genéricas
    para permitir que el motor busque su coincidencia en CovPar de la base maestra.
    """
    clean = (code or "").strip().upper()
    cov = (cov_code or "").strip().upper()
    if not clean and not cov:
        return True
    # Indicadores explícitos de partidas genéricas sin código (sin capítulo COVENIN asociado)
    if clean in {"0", "-", "SC", "S/C", "S-C", "S.C.", "S/C."}:
        return True
    if any(clean.startswith(p) for p in UNCODED_PREFIXES):
        return True
    # Números puros (ej. "1", "01", "2.1") que representan números de fila o renglón
    if re.match(r"^\d+(\.\d+)?$", clean):
        return True
    if cov in {"0", "-", "SC", "S/C", "S-C", "S.C."} and not clean:
        return True
    if cov in {"S/C", "E S/C", "ES/C"} and clean.startswith(("CUST", "NEW", "PART", "TEMP")):
        return True
    return False


def requires_materials_by_description(description: str) -> bool:
    """Indica si la descripción de la partida implica obligatoriamente suministro de materiales."""
    clean = strip_accents_upper(description)
    if not clean:
        return False
    if any(clean.startswith(w) for w in (
        "DEMOLICION", "REMOCION", "EXCAVACION", "ACARREO", "BOTE ", "DESMONTAJE",
        "LIMPIEZA", "TRANSPORTE", "FLETE", "CARGA ", "DESCARGA", "MOVILIZACION"
    )):
        return False
    return any(kw in clean for kw in SUPPLY_KEYWORDS)


def calculate_apu_unit_price(
    performance: float,
    materials: List[Dict[str, Any]],
    equipments: List[Dict[str, Any]],
    labors: List[Dict[str, Any]],
    fcas_percent: float = 417.0,
    admin_percent: float = 15.0,
    profit_percent: float = 10.0,
) -> Dict[str, float]:
    """Calcula matemáticamente el precio unitario de un APU según la estructura venezolana COVENIN/Maprex."""
    eff_perf = performance if performance and performance > 0 else 1.0

    unit_mat = 0.0
    for m in materials:
        qty = float(m.get("quantity") or 0.0)
        price = float(m.get("unit_price") or 0.0)
        waste = float(m.get("waste_or_deprec") or 0.0)
        factor_waste = 1.0 + (waste / 100.0 if waste > 1.0 else waste)
        unit_mat += qty * price * factor_waste

    total_eq_day = 0.0
    for e in equipments:
        qty = float(e.get("quantity") or 0.0)
        price = float(e.get("unit_price") or 0.0)
        deprec = float(e.get("waste_or_deprec") if e.get("waste_or_deprec") is not None else 1.0)
        if deprec <= 0:
            deprec = 1.0
        total_eq_day += qty * price * deprec
    unit_eq = total_eq_day / eff_perf

    total_salario_day = 0.0
    total_bono_day = 0.0
    for l_item in labors:
        qty = float(l_item.get("quantity") or 0.0)
        jornal = float(l_item.get("unit_price") or 0.0)
        bono = float(l_item.get("bonus") or 0.0)
        total_salario_day += qty * jornal
        total_bono_day += qty * bono

    fcas_cost_day = total_salario_day * (fcas_percent / 100.0)
    unit_labor = (total_salario_day + fcas_cost_day + total_bono_day) / eff_perf

    direct_cost = unit_mat + unit_eq + unit_labor
    admin_cost = direct_cost * (admin_percent / 100.0)
    subtotal_a = direct_cost + admin_cost
    profit_cost = subtotal_a * (profit_percent / 100.0)
    unit_price = subtotal_a + profit_cost

    return {
        "unit_materials": round(unit_mat, 4),
        "unit_equipment": round(unit_eq, 4),
        "unit_labor": round(unit_labor, 4),
        "direct_cost": round(direct_cost, 4),
        "unit_price": round(unit_price, 4),
    }


def evaluate_item_audit_rules(
    item_data: Dict[str, Any],
    master_item: Optional[Dict[str, Any]],
    master_recipe: Optional[Dict[str, List[Dict[str, Any]]]],
    fcas_percent: float = 417.0,
    admin_percent: float = 15.0,
    profit_percent: float = 10.0,
) -> List[Dict[str, Any]]:
    """
    Ejecuta todas las reglas de auditoría sobre una partida importada frente a la base maestra CostBase/Maprex.
    Retorna la lista de hallazgos estructurados.
    """
    if not isinstance(item_data, dict):
        raise ValueError("item_data debe ser un diccionario válido.")

    findings: List[Dict[str, Any]] = []
    orig_code = str(item_data.get("original_code") or "").strip()
    cov_code = str(
        item_data.get("covenin_code")
        or (master_item.get("cov_par") if master_item else "")
        or ""
    ).strip()
    # Para el informe técnico de revisión, priorizar el código COVENIN (CovPar) sobre el código interno (CodPar)
    code = (
        cov_code
        if (cov_code and cov_code.upper() not in {"S/C", "E S/C", "ES/C"})
        else orig_code
    )
    desc = str(item_data.get("description") or "").strip()
    unit = str(item_data.get("unit") or "").strip()
    qty = float(item_data.get("quantity") or 0.0)
    perf = float(item_data.get("performance") or 0.0)
    imported_price = float(item_data.get("imported_unit_price") or 0.0)
    calc_price = float(item_data.get("calculated_unit_price") or 0.0)

    materials: List[Dict[str, Any]] = list(item_data.get("materials") or [])
    equipments: List[Dict[str, Any]] = list(item_data.get("equipments") or [])
    labors: List[Dict[str, Any]] = list(item_data.get("labors") or [])

    # -------------------------------------------------------------------------
    # A. REGLAS ESTRUCTURALES
    # -------------------------------------------------------------------------
    if not unit:
        findings.append({
            "rule_id": "EST-001",
            "category": "ESTRUCTURA",
            "severity": "ALTA",
            "item_code": code,
            "field_name": "unit",
            "imported_value": "(vacío)",
            "master_value": master_item.get("unit") if master_item else None,
            "diff_percent": None,
            "message": "La partida no tiene unidad de medida definida.",
            "suggestion": "Asignar la unidad técnica correspondiente antes de contratar.",
        })

    if qty <= 0:
        findings.append({
            "rule_id": "EST-002",
            "category": "ESTRUCTURA",
            "severity": "ALTA",
            "item_code": code,
            "field_name": "quantity",
            "imported_value": f"{qty:.2f}",
            "master_value": "> 0",
            "diff_percent": None,
            "message": f"La cantidad de obra de la partida es inválida ({qty:.2f}).",
            "suggestion": "Verificar los cómputos métricos de la partida.",
        })

    if perf <= 0:
        findings.append({
            "rule_id": "EST-003",
            "category": "RENDIMIENTO",
            "severity": "CRITICA",
            "item_code": code,
            "field_name": "performance",
            "imported_value": f"{perf:.4f}",
            "master_value": f"{float(master_item['performance']):.4f}" if master_item and master_item.get("performance") else "> 0",
            "diff_percent": None,
            "message": "El rendimiento del APU es cero o negativo, lo que invalida el cálculo de Equipos y Mano de Obra.",
            "suggestion": "Restaurar el rendimiento diario de la base maestra.",
        })

    # Insumos duplicados dentro del mismo APU
    for comp_type, comp_list, label in [
        ("MATERIALES", materials, "Material"),
        ("EQUIPOS", equipments, "Equipo"),
        ("MANO_OBRA", labors, "Mano de Obra"),
    ]:
        counts = Counter(
            str(c.get("resolved_master_code") or c.get("code") or "").strip().upper()
            for c in comp_list
            if str(c.get("code") or "").strip()
        )
        for c_code, cnt in counts.items():
            if cnt > 1:
                findings.append({
                    "rule_id": "EST-004",
                    "category": comp_type,
                    "severity": "ALTA",
                    "item_code": code,
                    "component_code": c_code,
                    "field_name": "duplicate_component",
                    "imported_value": f"{cnt} veces",
                    "master_value": "1 vez",
                    "diff_percent": float((cnt - 1) * 100.0),
                    "message": f"{label} '{c_code}' está repetido {cnt} veces dentro del mismo APU.",
                    "suggestion": "Consolidar o eliminar las líneas duplicadas del insumo en el APU.",
                })

    # EST-005 y EST-006: Reglas heurísticas exclusivas para partidas NO codificadas (S/C).
    # En partidas codificadas la comparación es estrictamente 1 a 1 contra la receta de la base seleccionada
    # mediante MAT-001 (materiales omitidos) y LAB-001 (cuadrilla de mano de obra omitida o alterada).
    if not master_item:
        if requires_materials_by_description(desc) and len(materials) == 0 and (len(equipments) > 0 or len(labors) > 0):
            findings.append({
                "rule_id": "EST-005",
                "category": "MATERIALES",
                "severity": "CRITICA",
                "item_code": code,
                "field_name": "materials_count",
                "imported_value": "0 materiales",
                "master_value": ">= 1 material",
                "diff_percent": -100.0,
                "message": "La descripción indica SUMINISTRO/CONSTRUCCIÓN pero el APU no incluye ningún material.",
                "suggestion": "Incorporar los materiales correspondientes o cambiar el alcance a solo colocación/mano de obra.",
            })

        if (len(materials) > 0 or len(equipments) > 0) and len(labors) == 0:
            findings.append({
                "rule_id": "EST-006",
                "category": "MANO_OBRA",
                "severity": "ALTA",
                "item_code": code,
                "field_name": "labors_count",
                "imported_value": "0 cuadrilla",
                "master_value": ">= 1 obrero",
                "diff_percent": -100.0,
                "message": "El APU tiene materiales/equipos pero carece totalmente de cuadrilla de Mano de Obra.",
                "suggestion": "Verificar si se omitió la cuadrilla de ejecución.",
            })

    # Coherencia matemática interna (si el archivo trae precio unitario explícito y desglose APU)
    if imported_price > 0 and calc_price > 0 and (materials or equipments or labors):
        diff_price_pct = ((imported_price - calc_price) / calc_price) * 100.0
        if abs(diff_price_pct) > 2.5:
            findings.append({
                "rule_id": "COH-001",
                "category": "COHERENCIA",
                "severity": "CRITICA" if abs(diff_price_pct) > 10.0 else "ALTA",
                "item_code": code,
                "field_name": "unit_price",
                "imported_value": f"{imported_price:.2f}",
                "master_value": f"{calc_price:.2f} (calculado del APU)",
                "diff_percent": round(diff_price_pct, 2),
                "message": (
                    f"Descuadre aritmético interno: el precio unitario declarado ({imported_price:.2f}) "
                    f"no coincide con la suma matemática de sus componentes APU ({calc_price:.2f}, dif: {diff_price_pct:+.1f}%)."
                ),
                "suggestion": "Recalcular el APU para eliminar fórmulas sobrescritas o recargos ocultos.",
            })

    # -------------------------------------------------------------------------
    # B. PARTIDAS SIN CODIFICACIÓN O ESPECIALES (AUDITORÍA TÉCNICA CON IA)
    # -------------------------------------------------------------------------
    if not master_item:
        ai_eval = audit_uncoded_apu_with_ai(item_data)
        item_data["ai_audit_status"] = ai_eval.get("status", "CONFORME")
        item_data["ai_audit_summary"] = (
            ai_eval.get("summary")
            or ai_eval.get("technical_diagnosis")
            or "APU especial analizado técnicamente."
        )

        # REGLA DE ORO: Si el APU está bien estructurado, NO se rechaza ni se generan errores forzados.
        # Tampoco se sugieren homologaciones arbitrarias con partidas de otros catálogos.
        if not ai_eval.get("is_well_structured", True):
            defects = ai_eval.get("defects") or []
            defect_msg = (
                "; ".join(defects)
                if defects
                else (ai_eval.get("technical_diagnosis") or "Inconsistencia en la estructura de insumos del APU.")
            )
            findings.append({
                "rule_id": "AI-UNC-001",
                "category": "ESTRUCTURA",
                "severity": "MEDIA",
                "item_code": code or "S/C",
                "field_name": "apu_structure",
                "imported_value": f"{len(materials)} materiales / {len(labors)} mano de obra / {len(equipments)} equipos",
                "master_value": "APU completo estructurado",
                "diff_percent": None,
                "message": f"Partida no codificada con estructura de APU incompleta u observada: {defect_msg}",
                "suggestion": "Completar los insumos o cuadrilla requerida para la ejecución conforme al alcance de la partida.",
            })

        # Detección de materiales no tipificados en base de referencia (solicitud de cotización)
        for m in materials:
            if m.get("is_in_database") is False:
                m_code = str(m.get("code") or "S/C").strip()
                m_desc = str(m.get("description") or m_code).strip()
                m_name_display = m_desc if (m_desc and m_desc.upper() != m_code.upper()) else m_code
                m_p = float(m.get("unit_price") or 0.0)
                findings.append({
                    "rule_id": "MAT-005",
                    "category": "MATERIALES",
                    "severity": "MEDIA",
                    "item_code": code or "S/C",
                    "component_code": m_code,
                    "component_description": m_desc,
                    "field_name": "unit_price",
                    "imported_value": f"${m_p:,.2f}" if m_p > 0 else "Sin precio",
                    "master_value": "No registrado en base de referencia",
                    "diff_percent": None,
                    "message": (
                        f"Material no registrado en {m_code} ({m_name_display}): no catalogado en la base de datos de referencia oficial. "
                        f"El precio unitario propuesto ({f'${m_p:,.2f}' if m_p > 0 else '0.00'}) carece de contraste oficial regulado; "
                        f"la empresa contratista debe consignar 1 cotización comercial de proveedor para sustentar su costo."
                    ),
                    "suggestion": (
                        "Solicitar a la empresa contratista consignar 1 cotización comercial vigente de proveedor reconocido "
                        "y ficha técnica del material para sustentar y validar el precio unitario propuesto en el APU."
                    ),
                })

        # Detección de equipos no tipificados en base de referencia (solicitud de cotización)
        for e in equipments:
            if e.get("is_in_database") is False:
                e_code = str(e.get("code") or "S/C").strip()
                e_desc = str(e.get("description") or e_code).strip()
                e_name_display = e_desc if (e_desc and e_desc.upper() != e_code.upper()) else e_code
                e_p = float(e.get("unit_price") or 0.0)
                findings.append({
                    "rule_id": "EQU-005",
                    "category": "EQUIPOS",
                    "severity": "MEDIA",
                    "item_code": code or "S/C",
                    "component_code": e_code,
                    "component_description": e_desc,
                    "field_name": "unit_price",
                    "imported_value": f"${e_p:,.2f}/día" if e_p > 0 else "Sin costo",
                    "master_value": "No registrado en base de referencia",
                    "diff_percent": None,
                    "message": (
                        f"Equipo no registrado en {e_code} ({e_name_display}): no catalogado en la base de referencia oficial. "
                        f"El costo propuesto ({f'${e_p:,.2f}/día' if e_p > 0 else '0.00'}) carece de tarifa oficial de contraste; "
                        f"la empresa contratista debe consignar 1 cotización comercial con memoria de cálculo horario."
                    ),
                    "suggestion": (
                        "Solicitar a la empresa contratista consignar 1 cotización comercial de adquisición o alquiler, acompañada de la memoria "
                        "de cálculo de costos horarios (depreciación, consumibles, operación y mantenimiento) para validar la tarifa en el APU."
                    ),
                })

        # Detección de mano de obra especializada o no tabulada (estudio de costo y soporte curricular)
        for l_row in labors:
            l_code = str(l_row.get("code") or "S/C").strip()
            l_desc = str(l_row.get("description") or l_code).strip()
            l_name_display = l_desc if (l_desc and l_desc.upper() != l_code.upper()) else l_code
            l_p = float(l_row.get("unit_price") or 0.0)
            is_in_db = l_row.get("is_in_database") is not False
            is_spec = is_specialized_labor_profile(l_desc)

            if not is_in_db or is_spec:
                findings.append({
                    "rule_id": "LAB-003",
                    "category": "MANO_OBRA",
                    "severity": "MEDIA",
                    "item_code": code or "S/C",
                    "component_code": l_code,
                    "component_description": l_desc,
                    "field_name": "jornal",
                    "imported_value": f"${l_p:,.2f}/día" if l_p > 0 else "Sin jornal",
                    "master_value": "Tarifa especial / no tabulada",
                    "diff_percent": None,
                    "message": (
                        f"Mano de obra especializada o no tabulada en {l_code} ({l_name_display}): categoría no tipificada en el tabulador oficial de referencia. "
                        f"Costo propuesto: {f'${l_p:,.2f}/día' if l_p > 0 else '0.00'}; requiere especial atención del auditor para estudiar el costo. "
                        f"La empresa contratista debe consignar soporte curricular y justificación de honorarios."
                    ),
                    "suggestion": (
                        "Poner atención y estudiar detalladamente el costo de la mano de obra especializada (ej. calculistas con alta experiencia, "
                        "analistas de laboratorio especializados, técnicos certificados); solicitar a la empresa contratista soporte curricular, "
                        "certificación de experiencia demostrable y memoria de cálculo de honorarios o jornales."
                    ),
                })

        return findings

    # -------------------------------------------------------------------------
    # C. REVISIÓN CONTRA PARTIDA MAESTRA CODIFICADA (COSTBASE / MAPREX)
    # -------------------------------------------------------------------------
    master_cov_code = str(master_item.get("cov_par") or "").strip().upper()
    master_internal_code = str(master_item.get("cod_par") or "").strip().upper()
    master_code = master_cov_code if master_cov_code and master_cov_code not in {"S/C", "E S/C", "ES/C"} else (master_cov_code or master_internal_code)
    master_desc = str(master_item.get("description") or "").strip()
    master_unit = str(master_item.get("unit") or "").strip()
    master_perf = float(master_item.get("performance") or 0.0)
    desc_sim = compute_description_similarity(desc, master_desc)

    # 1. Verificar coincidencia 1 a 1 de Código y Descripción (Regla de Oro de Auditoría)
    # Si el código existe en la base pero la descripción es alterada/diferente, no se comparan insumos (no comparar peras con manzanas)
    # y en su lugar entra la IA a evaluar la coherencia técnica interna de su propio APU.
    if master_internal_code in KNOWN_PARTIDA_CODE_COLLISIONS or not is_exact_or_1to1_description(desc, master_desc):
        findings.append({
            "rule_id": "DES-ALT-001" if master_internal_code not in KNOWN_PARTIDA_CODE_COLLISIONS else "COL-001",
            "category": "ESTRUCTURA",
            "severity": "ALTA" if master_internal_code not in KNOWN_PARTIDA_CODE_COLLISIONS else "CRITICA",
            "item_code": code,
            "field_name": "description",
            "imported_value": desc[:100],
            "master_value": master_desc[:100],
            "diff_percent": round((desc_sim - 1.0) * 100.0, 1),
            "message": (
                f"Código reutilizado con descripción alterada: En el presupuesto se describe como '{desc}', "
                f"mientras que en la base oficial bajo el código COVENIN '{master_code}' corresponde a '{master_desc}'. "
                f"Al no existir coincidencia 1 a 1 de código y descripción, el APU no se compara contra esta receta oficial "
                f"para evitar contrastar alcances incompatibles."
            ) if master_internal_code not in KNOWN_PARTIDA_CODE_COLLISIONS else (
                f"Colisión de código '{master_code}': la descripción del presupuesto no corresponde a la partida "
                f"registrada en CostBase con ese código (similitud {desc_sim * 100:.0f}%)."
            ),
            "suggestion": (
                "Verificar si se trata de una partida especial atípica que debe codificarse como S/C o ajustar el código al alcance real de la obra."
            ),
        })
        # Si no coincide 1 a 1, entra la IA para evaluar la coherencia técnica de su propio APU
        ai_eval = audit_uncoded_apu_with_ai(item_data)
        item_data["ai_audit_status"] = ai_eval.get("status", "CONFORME")
        item_data["ai_audit_summary"] = (
            ai_eval.get("summary")
            or ai_eval.get("technical_diagnosis")
            or "APU con descripción atípica evaluado técnicamente mediante IA."
        )
        # Evitar falsos positivos de insumos: no comparar receta
        return findings

    # 2. Comparar Unidad normalizada
    norm_imp_unit = normalize_unit(unit)
    norm_mst_unit = normalize_unit(master_unit)
    if norm_imp_unit and norm_mst_unit and norm_imp_unit != norm_mst_unit:
        findings.append({
            "rule_id": "UNI-001",
            "category": "ESTRUCTURA",
            "severity": "CRITICA",
            "item_code": code,
            "field_name": "unit",
            "imported_value": unit,
            "master_value": master_unit,
            "diff_percent": None,
            "message": f"Unidad de medida alterada: el presupuesto usa '{unit}' pero la base seleccionada tiene '{master_unit}'.",
            "suggestion": f"Ajustar la unidad a '{master_unit}' conforme a la base seleccionada y verificar las cantidades de obra y rendimiento.",
        })

    # 3. Comparar Rendimiento (RenPar)
    if perf > 0 and master_perf > 0:
        rend_diff_pct = ((perf - master_perf) / master_perf) * 100.0
        if abs(rend_diff_pct) > 3.0:
            # Rendimiento menor a la base seleccionada encarece artificialmente Equipos y Mano de Obra por unidad
            severity = "CRITICA" if rend_diff_pct < -20.0 else ("ALTA" if abs(rend_diff_pct) > 10.0 else "MEDIA")
            direction_msg = (
                "reducido (infla el costo unitario de equipos y mano de obra)"
                if rend_diff_pct < 0
                else "incrementado respecto a la base seleccionada"
            )
            findings.append({
                "rule_id": "REN-001",
                "category": "RENDIMIENTO",
                "severity": severity,
                "item_code": code,
                "field_name": "performance",
                "imported_value": f"{perf:.4f}",
                "master_value": f"{master_perf:.4f}",
                "diff_percent": round(rend_diff_pct, 2),
                "message": (
                    f"Rendimiento {direction_msg}: importado {perf:.2f} {unit}/día vs. "
                    f"base seleccionada {master_perf:.2f} {master_unit}/día ({rend_diff_pct:+.1f}%)."
                ),
                "suggestion": f"Restablecer el rendimiento oficial de {master_perf:.2f} {master_unit}/día según la base seleccionada o exigir justificación técnica.",
            })

    if not master_recipe:
        return findings

    # Si la partida importada vino solo como hoja de presupuesto sin desglose APU, no auditamos receta
    if not materials and not equipments and not labors:
        return findings

    # -------------------------------------------------------------------------
    # D. AUDITORÍA DE RECETA APU: MATERIALES, EQUIPOS Y MANO DE OBRA
    # -------------------------------------------------------------------------
    # 1. MATERIALES
    mst_mats = {
        str(m.get("code") or "").strip().upper(): m
        for m in (master_recipe.get("materials") or [])
        if str(m.get("code") or "").strip()
    }
    imp_mats: Dict[str, Dict[str, Any]] = {}
    for m in materials:
        eff_code = str(m.get("resolved_master_code") or m.get("code") or "").strip().upper()
        if eff_code and eff_code not in imp_mats:
            imp_mats[eff_code] = m

    for m_code, m_mst in mst_mats.items():
        if m_code not in imp_mats:
            findings.append({
                "rule_id": "MAT-001",
                "category": "MATERIALES",
                "severity": "ALTA",
                "item_code": code,
                "component_code": m_code,
                "component_description": str(m_mst.get("description") or ""),
                "field_name": "missing_material",
                "imported_value": "No incluido (0.00)",
                "master_value": f"{float(m_mst.get('quantity') or 0.0):.4f} {m_mst.get('unit') or ''}",
                "diff_percent": -100.0,
                "message": f"Material oficial faltante según la base seleccionada: {m_code} ({m_mst.get('description')}).",
                "suggestion": f"Verificar por qué se omitió el material {m_code} de la receta oficial en la base seleccionada.",
            })
        else:
            m_imp = imp_mats[m_code]
            imp_q = float(m_imp.get("quantity") or 0.0)
            mst_q = float(m_mst.get("quantity") or 0.0)
            if mst_q > 0:
                q_diff_pct = ((imp_q - mst_q) / mst_q) * 100.0
                if abs(q_diff_pct) > 5.0:
                    findings.append({
                        "rule_id": "MAT-002",
                        "category": "MATERIALES",
                        "severity": "CRITICA" if q_diff_pct > 25.0 else "ALTA",
                        "item_code": code,
                        "component_code": m_code,
                        "component_description": str(m_imp.get("description") or m_mst.get("description") or ""),
                        "field_name": "quantity",
                        "imported_value": f"{imp_q:.4f}",
                        "master_value": f"{mst_q:.4f}",
                        "diff_percent": round(q_diff_pct, 2),
                        "message": (
                            f"Cantidad de material manipulada en {m_code} ({m_mst.get('description')}): "
                            f"importado {imp_q:.4f} vs. base seleccionada {mst_q:.4f} ({q_diff_pct:+.1f}%)."
                        ),
                        "suggestion": f"Corregir el rendimiento/cantidad unitaria del material a {mst_q:.4f}.",
                    })

            imp_waste = float(m_imp.get("waste_or_deprec") or 0.0)
            mst_waste = float(m_mst.get("waste_or_deprec") or 0.0)
            if imp_waste > 15.0 and abs(imp_waste - mst_waste) > 5.0:
                findings.append({
                    "rule_id": "MAT-003",
                    "category": "MATERIALES",
                    "severity": "ALTA",
                    "item_code": code,
                    "component_code": m_code,
                    "component_description": str(m_imp.get("description") or ""),
                    "field_name": "desperdicio",
                    "imported_value": f"{imp_waste:.1f}%",
                    "master_value": f"{mst_waste:.1f}%",
                    "diff_percent": round(imp_waste - mst_waste, 2),
                    "message": f"Desperdicio excesivo en material {m_code}: {imp_waste:.1f}% (base seleccionada: {mst_waste:.1f}%).",
                    "suggestion": f"Ajustar el porcentaje de desperdicio al valor normativo ({mst_waste:.1f}%).",
                })

            if m_code in KNOWN_MATERIAL_CODE_COLLISIONS:
                findings.append({
                    "rule_id": "MAT-004",
                    "category": "MATERIALES",
                    "severity": "INFO_MAPREX",
                    "item_code": code,
                    "component_code": m_code,
                    "component_description": str(m_imp.get("description") or ""),
                    "field_name": "code_collision_maprex",
                    "imported_value": str(m_imp.get("description") or "")[:60],
                    "master_value": str(m_mst.get("description") or "")[:60],
                    "diff_percent": None,
                    "message": f"El código de material {m_code} difiere en descripción entre Base Agosto y Base Maestra.",
                    "suggestion": "Validar la descripción del insumo de bioseguridad.",
                })

        for m_code, m_imp in imp_mats.items():
            if m_code not in mst_mats and m_imp.get("is_in_database") is False:
                m_desc = str(m_imp.get("description") or m_code).strip()
                m_name_display = m_desc if (m_desc and m_desc.upper() != m_code.upper()) else m_code
                m_p = float(m_imp.get("unit_price") or 0.0)
                findings.append({
                    "rule_id": "MAT-005",
                    "category": "MATERIALES",
                    "severity": "MEDIA",
                    "item_code": code,
                    "component_code": m_code,
                    "component_description": m_desc,
                    "field_name": "unit_price",
                    "imported_value": f"${m_p:,.2f}" if m_p > 0 else "Sin precio",
                    "master_value": "Insumo adicional no registrado en base de referencia",
                    "diff_percent": None,
                    "message": (
                        f"Material adicional en {m_code} ({m_name_display}): incorporado al APU y no registrado en la base de referencia oficial. "
                        f"El precio unitario propuesto ({f'${m_p:,.2f}' if m_p > 0 else '0.00'}) carece de contraste oficial regulado; "
                        f"la empresa contratista debe consignar 1 cotización comercial de proveedor para sustentar su costo."
                    ),
                    "suggestion": (
                        "Solicitar a la empresa contratista consignar 1 cotización comercial vigente de proveedor reconocido "
                        "y ficha técnica del material para sustentar y validar el precio unitario propuesto en el APU."
                    ),
                })

    # 2. EQUIPOS Y DEPRECIACIÓN
    mst_eqs = {
        str(e.get("code") or "").strip().upper(): e
        for e in (master_recipe.get("equipments") or [])
        if str(e.get("code") or "").strip()
    }
    imp_eqs: Dict[str, Dict[str, Any]] = {}
    for e in equipments:
        eff_code = str(e.get("resolved_master_code") or e.get("code") or "").strip().upper()
        if eff_code and eff_code not in imp_eqs:
            imp_eqs[eff_code] = e

    for e_code, e_mst in mst_eqs.items():
        if e_code not in imp_eqs:
            findings.append({
                "rule_id": "EQU-001",
                "category": "EQUIPOS",
                "severity": "MEDIA",
                "item_code": code,
                "component_code": e_code,
                "component_description": str(e_mst.get("description") or ""),
                "field_name": "missing_equipment",
                "imported_value": "No incluido (0.00)",
                "master_value": f"{float(e_mst.get('quantity') or 0.0):.4f}",
                "diff_percent": -100.0,
                "message": f"Equipo oficial ausente según la base seleccionada: {e_code} ({e_mst.get('description')}).",
                "suggestion": f"Incluir el equipo {e_code} o verificar si fue sustituido conforme a la base seleccionada.",
            })
        else:
            e_imp = imp_eqs[e_code]
            imp_q = float(e_imp.get("quantity") or 0.0)
            mst_q = float(e_mst.get("quantity") or 0.0)
            if mst_q > 0:
                q_diff_pct = ((imp_q - mst_q) / mst_q) * 100.0
                if abs(q_diff_pct) > 5.0:
                    findings.append({
                        "rule_id": "EQU-002",
                        "category": "EQUIPOS",
                        "severity": "ALTA",
                        "item_code": code,
                        "component_code": e_code,
                        "component_description": str(e_imp.get("description") or e_mst.get("description") or ""),
                        "field_name": "quantity",
                        "imported_value": f"{imp_q:.4f}",
                        "master_value": f"{mst_q:.4f}",
                        "diff_percent": round(q_diff_pct, 2),
                        "message": (
                            f"Cantidad de equipo alterada en {e_code} ({e_mst.get('description')}): "
                            f"importado {imp_q:.4f} vs. base seleccionada {mst_q:.4f} ({q_diff_pct:+.1f}%)."
                        ),
                        "suggestion": f"Restablecer la cantidad del equipo a {mst_q:.4f}.",
                    })

            imp_dep = float(e_imp.get("waste_or_deprec") if e_imp.get("waste_or_deprec") is not None else 1.0)
            mst_dep = float(e_mst.get("waste_or_deprec") if e_mst.get("waste_or_deprec") is not None else 1.0)

            if imp_dep <= 0 or imp_dep > 1.0:
                findings.append({
                    "rule_id": "EQU-003",
                    "category": "EQUIPOS",
                    "severity": "CRITICA",
                    "item_code": code,
                    "component_code": e_code,
                    "component_description": str(e_imp.get("description") or ""),
                    "field_name": "depreciacion",
                    "imported_value": f"{imp_dep:.5f}",
                    "master_value": f"{mst_dep:.5f}",
                    "diff_percent": None,
                    "message": f"Factor de depreciación/alquiler fuera de rango válido (0 < Deprec <= 1) en {e_code}: {imp_dep:.5f}.",
                    "suggestion": f"Restablecer el factor de depreciación oficial ({mst_dep:.5f}).",
                })
            elif mst_dep > 0 and abs(imp_dep - mst_dep) > 0.0005:
                dep_diff_pct = ((imp_dep - mst_dep) / mst_dep) * 100.0
                if is_native_maprex_deprec_difference(e_code, imp_dep, mst_dep):
                    findings.append({
                        "rule_id": "EQU-004",
                        "category": "EQUIPOS",
                        "severity": "INFO_MAPREX",
                        "item_code": code,
                        "component_code": e_code,
                        "component_description": str(e_imp.get("description") or e_mst.get("description") or ""),
                        "field_name": "depreciacion",
                        "imported_value": f"{imp_dep:.5f}",
                        "master_value": f"{mst_dep:.5f}",
                        "diff_percent": round(dep_diff_pct, 2),
                        "message": (
                            f"Diferencia de catálogo histórico (Base Agosto vs Base Maestra) en factor de equipo {e_code}: "
                            f"Base Agosto usa alquiler diario ({imp_dep:.4f}) y Base Maestra factor compuesto ({mst_dep:.5f})."
                        ),
                        "suggestion": "No es manipulación del contratista; proviene del catálogo de Base Agosto.",
                    })
                elif abs(dep_diff_pct) > 5.0:
                    findings.append({
                        "rule_id": "EQU-004",
                        "category": "EQUIPOS",
                        "severity": "CRITICA" if dep_diff_pct > 50.0 else "ALTA",
                        "item_code": code,
                        "component_code": e_code,
                        "component_description": str(e_imp.get("description") or e_mst.get("description") or ""),
                        "field_name": "depreciacion",
                        "imported_value": f"{imp_dep:.5f}",
                        "master_value": f"{mst_dep:.5f}",
                        "diff_percent": round(dep_diff_pct, 2),
                        "message": (
                            f"Factor de depreciación manipulado en equipo {e_code} ({e_mst.get('description')}): "
                            f"importado {imp_dep:.5f} vs. base seleccionada {mst_dep:.5f} ({dep_diff_pct:+.1f}%)."
                        ),
                        "suggestion": f"Corregir el factor de depreciación del equipo {e_code} a {mst_dep:.5f}.",
                    })

        for e_code, e_imp in imp_eqs.items():
            if e_code not in mst_eqs and e_imp.get("is_in_database") is False:
                e_desc = str(e_imp.get("description") or e_code).strip()
                e_p = float(e_imp.get("unit_price") or 0.0)
                findings.append({
                    "rule_id": "EQU-005",
                    "category": "EQUIPOS",
                    "severity": "MEDIA",
                    "item_code": code,
                    "component_code": e_code,
                    "component_description": e_desc,
                    "field_name": "unit_price",
                    "imported_value": f"${e_p:,.2f}/día" if e_p > 0 else "Sin costo",
                    "master_value": "Equipo adicional no registrado en base de referencia",
                    "diff_percent": None,
                    "message": (
                        f"Equipo o maquinaria adicional '{e_desc}' (código {e_code}) incorporado al APU y no registrado en la base de referencia oficial. "
                        f"El costo diario/horario propuesto ({f'${e_p:,.2f}/día' if e_p > 0 else '0.00'}) carece de tarifa oficial de contraste."
                    ),
                    "suggestion": (
                        "Solicitar a la empresa contratista cotizaciones comerciales de adquisición o alquiler, acompañadas de la memoria "
                        "de cálculo de costos horarios (depreciación, consumibles, operación y mantenimiento) para validar la tarifa en el APU."
                    ),
                })

    # 3. MANO DE OBRA
    mst_labs = {
        str(l_row.get("code") or "").strip().upper(): l_row
        for l_row in (master_recipe.get("labors") or [])
        if str(l_row.get("code") or "").strip()
    }
    imp_labs: Dict[str, Dict[str, Any]] = {}
    for l_row in labors:
        eff_code = str(l_row.get("resolved_master_code") or l_row.get("code") or "").strip().upper()
        if eff_code and eff_code not in imp_labs:
            imp_labs[eff_code] = l_row

    for l_code, l_mst in mst_labs.items():
        if l_code in imp_labs:
            l_imp = imp_labs[l_code]
            imp_q = float(l_imp.get("quantity") or 0.0)
            mst_q = float(l_mst.get("quantity") or 0.0)
            if mst_q > 0:
                q_diff_pct = ((imp_q - mst_q) / mst_q) * 100.0
                if abs(q_diff_pct) > 5.0:
                    findings.append({
                        "rule_id": "LAB-001",
                        "category": "MANO_OBRA",
                        "severity": "CRITICA" if q_diff_pct > 50.0 else "ALTA",
                        "item_code": code,
                        "component_code": l_code,
                        "component_description": str(l_imp.get("description") or l_mst.get("description") or ""),
                        "field_name": "quantity",
                        "imported_value": f"{imp_q:.2f}",
                        "master_value": f"{mst_q:.2f}",
                        "diff_percent": round(q_diff_pct, 2),
                        "message": (
                            f"Composición de cuadrilla alterada en {l_code} ({l_mst.get('description')}): "
                            f"importado {imp_q:.2f} vs. maestro {mst_q:.2f} ({q_diff_pct:+.1f}%)."
                        ),
                        "suggestion": f"Restablecer la cantidad de personal en cuadrilla a {mst_q:.2f}.",
                    })

        for l_code, l_imp in imp_labs.items():
            l_desc = str(l_imp.get("description") or l_code).strip()
            l_p = float(l_imp.get("unit_price") or 0.0)
            is_in_db = l_imp.get("is_in_database") is not False
            is_spec = is_specialized_labor_profile(l_desc)

            if (l_code not in mst_labs and not is_in_db) or is_spec:
                findings.append({
                    "rule_id": "LAB-003",
                    "category": "MANO_OBRA",
                    "severity": "MEDIA",
                    "item_code": code,
                    "component_code": l_code,
                    "component_description": l_desc,
                    "field_name": "jornal",
                    "imported_value": f"${l_p:,.2f}/día" if l_p > 0 else "Sin jornal",
                    "master_value": "Tarifa especial / no tabulada",
                    "diff_percent": None,
                    "message": (
                        f"Personal técnico o categoría de mano de obra especializada no tipificada en el tabulador oficial de referencia: "
                        f"'{l_desc}' (código {l_code}). Requiere especial atención para el análisis y estudio de su costo ({f'${l_p:,.2f}/día' if l_p > 0 else '0.00'})."
                    ),
                    "suggestion": (
                        "Poner atención y estudiar detalladamente el costo de la mano de obra especializada (ej. calculistas con alta experiencia, "
                        "analistas de laboratorio especializados, técnicos certificados); solicitar a la empresa contratista soporte curricular, "
                        "certificación de experiencia demostrable y memoria de cálculo de honorarios o jornales."
                    ),
                })

    return findings


def compute_snapshot_health_score(findings: List[Dict[str, Any]], total_items: int) -> float:
    """Porcentaje de partidas aprobadas (0 a 100): partidas sin observaciones / total de partidas.

    Una partida se considera con observaciones si tiene al menos un hallazgo de severidad
    CRITICA, ALTA o MEDIA. INFO_MAPREX no penaliza porque es diferencia nativa entre catálogos.
    Los hallazgos a nivel de capítulo (ARI-001) no corresponden a una partida y no se cuentan.
    """
    if total_items <= 0:
        return 100.0
    observed_codes = {
        str(f.get("item_code") or "").strip().upper()
        for f in findings
        if f.get("severity") in {"CRITICA", "ALTA", "MEDIA"}
        and f.get("rule_id") != "ARI-001"
        and str(f.get("item_code") or "").strip()
    }
    observed_count = min(len(observed_codes), total_items)
    approved = total_items - observed_count
    return round(approved / total_items * 100.0, 1)


def generate_default_executive_conclusion(
    health_score: float,
    critical_count: int,
    high_count: int,
    medium_count: int,
    uncoded_count: int,
    total_items: int,
    findings: List[Dict[str, Any]],
) -> str:
    """Genera una conclusión técnica preliminar y ejecutiva según los hallazgos reales detectados."""
    total_errors = critical_count + high_count + medium_count
    if total_errors == 0 and uncoded_count == 0:
        return (
            "El presupuesto evaluado cumple satisfactoriamente con los criterios de rendimientos, "
            "consumos de materiales, equipos y mano de obra establecidos en la base técnica de referencia. "
            "Se considera técnicamente APTO para su tramitación y aprobación."
        )

    issues: List[str] = []
    rule_ids = {str(f.get("rule_id") or "") for f in findings}
    if any(r in rule_ids for r in ["LAB-001", "LAB-002"]):
        issues.append("desviaciones estructurales en la asignación de cuadrillas")
    if any(r in rule_ids for r in ["MAT-002", "MAT-003"]):
        issues.append("sobreconsumo de materiales sin memoria de cálculo")
    if any(r in rule_ids for r in ["MAT-005"]):
        issues.append("materiales no registrados en la base de referencia que requieren consignar 1 cotización comercial")
    if any(r in rule_ids for r in ["EQU-003", "EQU-004"]):
        issues.append("omisión o alteración de factores de depreciación en maquinaria y equipos")
    if any(r in rule_ids for r in ["EQU-005"]):
        issues.append("equipos no catalogados pendientes de cotización y memoria de cálculo")
    if any(r in rule_ids for r in ["LAB-003"]):
        issues.append("mano de obra técnica especializada sujeta a estudio de honorarios y soporte curricular")
    if any(r in rule_ids for r in ["REN-001"]):
        issues.append("rendimientos atípicos fuera de los estándares de producción")
    if any(r in rule_ids for r in ["ARI-001"]):
        issues.append("errores aritméticos en sumatorias de partidas o capítulos")
    if any(r in rule_ids for r in ["DUP-001"]):
        issues.append("duplicidad de partidas dentro del presupuesto")
    if uncoded_count > 0:
        issues.append(f"{uncoded_count} APUs atípicos sin codificación COVENIN o discrepantes con la base de referencia")

    issues_text = ", ".join(issues) if issues else "discrepancias técnicas detectadas frente a la base de datos de referencia institucional"

    if critical_count > 0 or high_count > 0 or health_score < 75.0:
        return (
            f"El presupuesto no es apto para aprobación inmediata en su estado actual. "
            f"Presenta {issues_text}. Se requiere la subsanación formal de los hallazgos señalados "
            f"por parte de la empresa contratista previo a cualquier compromiso contractual o financiero."
        )
    if issues:
        return (
            f"El presupuesto presenta consistencia técnica global, pero registra {total_errors} observaciones "
            f"moderadas ({issues_text}) que ameritan justificación técnica, cotizaciones o soportes antes de su aprobación definitiva."
        )
    return (
        f"El presupuesto presenta consistencia técnica global, pero registra {total_errors} observaciones "
        f"moderadas que ameritan justificación técnica o ajustes menores antes de su aprobación definitiva."
    )
