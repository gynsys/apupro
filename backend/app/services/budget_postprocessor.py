"""
Servicio de Post-procesamiento y Calibración de Rendimientos de Presupuestos.
Audita todas las partidas de un presupuesto:
1. Recalibra rendimientos (performance) según la base maestra COVENIN, cuadrillas reales
   y normas técnicas empíricas de construcción civil y rehabilitación venezolanas.
2. Ataja y purga materiales indebidos en partidas de demolición, remoción, desmonte,
   excavación, acarreo, supervisión, trazo, pruebas, lijado y pulituras (solo MO y Equipos).
"""

import logging
import re
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy.orm import Session

from app.core.logging import logger
from app.db.models.budget import Budget, BudgetItem
from app.db.models.costbase import CostItem
from app.services.ai_apu_service.domain_rules.scope_exclusions import is_labor_only_activity
from app.services.ai_apu_service_v2.composer import (
    calculate_v2_deterministic_performance,
    classify_activity_typology,
    _benchmark_unit,
    _normalize_unit,
    EMPERICAL_HH_BENCHMARKS,
)
from app.services.ai_apu_service_v2.schemas import WorkSpec, WorkSpecDimensions


# ---------------------------------------------------------------------------
# Reglas empíricas de rendimiento diario normativo venezolano
# (Format: regex_pattern, target_unit, daily_yield, description)
# ---------------------------------------------------------------------------
_BENCHMARK_RULES: List[Tuple[str, str, float, str]] = [
    # Demolición y Remoción
    (r"REMOCION.*MANTO|RETIRO.*MANTO", "m2", 70.0, "Remoción de manto asfáltico en losas"),
    (r"DEMOLICION.*CERAMICA|REMOCION.*CERAMICA|RETIRO.*BALDOSA|PICADO.*FRISO", "m2", 20.0, "Picado/remoción/demolición de revestimientos cerámicos o frisos"),
    (r"DEMOLICION.*PARED|DEMOLICION.*BLOQUE|DEMOLICION.*MAMPOSTERIA", "m2", 18.0, "Demolición a mano de paredes de bloques"),
    (r"REMOCION|DEMOLICION|DESMONTE|PICADO", "m2", 25.0, "Demolición o remoción de revestimientos en m2"),
    (r"REMOCION|DEMOLICION|DESMONTE", "m3", 4.5, "Demolición de concreto o mampostería en m3"),
    (r"REMOCION|DEMOLICION|DESMONTE", "m", 30.0, "Desmonte de elementos lineales"),

    # Impermeabilización
    (r"IMPERMEABILIZACION.*TRANSITABLE|IMPERMEABILIZACION.*ASFALTO|MANTO.*ASFALTICO|PRIMER.*ASFALT", "m2", 35.0, "Impermeabilización con manto asfáltico caliente/primer"),
    (r"PINTURA.*ELASTOMERICA.*TECHO|IMPERMEABILIZANTE.*ACRILICO", "m2", 45.0, "Pintura elastomérica para techos/impermeabilización"),

    # Albañilería, Pisos y Frisos
    (r"SOBREPISO|NIVELAD.*CEMENTO|CARPETA.*NIVELACION", "m2", 22.0, "Sobrepiso nivelado de cemento hasta 6cm"),
    (r"REVESTIMIENTO.*EXTERIOR|FRISO.*BASE|MORTERO.*CAL|FRISO.*LISO|CONSTRUCCION.*REVESTIMIENTO", "m2", 18.0, "Revestimiento exterior con mortero / friso base"),
    (r"FRISO.*RAYADO|ACABADO.*ESPONJA", "m2", 16.0, "Friso exterior rayado a esponja"),
    (r"ENCAMISADO.*PASTA|PASTA.*PROFESIONAL|ENCAMISADO.*TECHOS|LIJADO", "m2", 40.0, "Encamisado de paredes/techos con pasta y lijado"),
    (r"DRY\s*WALL|YESO.*CARTON", "m2", 25.0, "Acabados de Drywall / juntas encamisadas"),
    (r"BALDOSA|CERAMICA|PORCELANATO|PISO", "m2", 12.0, "Instalación de pisos y revestimientos cerámicos"),
    (r"TOPE.*MAMPOSTERIA", "m2", 5.0, "Construcción de tope en mampostería"),

    # Pintura
    (r"PINTURA.*ESMALTE.*METAL|ESMALTE.*PUERTA|ESMALTE.*MARCO|ESMALTE.*PANEL", "m2", 30.0, "Pintura de esmalte en paneles/elementos metálicos"),
    (r"PINTURA.*ESMALTE.*MARCO|ESMALTE.*MARCO", "m", 35.0, "Pintura de esmalte en marcos metálicos por metro"),
    (r"PINTURA.*TEXTURIZADA", "m2", 35.0, "Pintura texturizada aplicada con compresor/pistola"),
    (r"PINTURA.*CAUCHO.*PARED|PINTURA.*CAUCHO.*INTERIOR|PINTURA.*CAUCHO.*EXTERIOR|PINTURA.*CAUCHO", "m2", 55.0, "Pintura de caucho en paredes"),
    (r"DEMARCACION.*BROCAL|DEMARCACION.*ESTACIONAMIENTO|PINTURA.*TRAFICO|DEMARCACION", "m", 120.0, "Demarcación con pintura de tráfico"),
    (r"PREPARACION.*SUPERFICIE.*PINTURA|LAVADO.*HONGO", "m2", 60.0, "Preparación de superficie/limpieza de moho para pintura"),

    # Electricidad
    (r"PUNTO.*ILUMINACION|PUNTO.*ELECTRICIDAD|PUNTO.*TOMA|PUNTO.*TOMACORRIENTE|PUNTO.*INTERRUPTOR|PUNTO.*CAMARA|PUNTO.*FUERZA|PUNTO.*SALIDA", "pto", 5.0, "Instalación de punto eléctrico"),
    (r"CABLE.*COBRE|CONDUCTOR.*THW", "m", 120.0, "Tendido de cable de cobre THW en tubería"),
    (r"TUBERIA.*PVC.*ELECTRIC|TUBERIA.*PLASTICA.*PVC|TUBERIA.*EMT", "m", 35.0, "Instalación de tubería plástica PVC para electricidad"),
    (r"CAJA.*CONTROL.*ALUMBRADO|TABLERO.*ELECTRICO", "pza", 2.0, "Instalación y conexionado de caja de control/tablero"),
    (r"CAJA.*METALICA.*PASO|CAJA.*DERIVACION|CAJA.*PASO", "pza", 8.0, "Instalación de cajas de paso o derivación"),
    (r"BREAKER|INTERRUPTOR.*TERMOMAGNETICO", "pza", 6.0, "Instalación de breaker termomagnético en tablero"),
    (r"TOMACORRIENTE|INTERRUPTOR.*COMBINABLE|INTERRUPTOR.*SIMPLE|FACE.*PLATE", "pza", 8.0, "Colocación de interruptores, tomacorrientes o placas"),
    (r"LAMPARA.*LED|REFLECTOR.*LED|LUMINARIA|VENTILADOR.*TECHO", "und", 10.0, "Instalación de lámpara/reflector LED/ventilador"),
    (r"LAMPARA.*LED|REFLECTOR.*LED|LUMINARIA|VENTILADOR.*TECHO", "pza", 10.0, "Instalación de lámpara/reflector LED/ventilador"),

    # Ventanas, Puertas y Carpintería
    (r"VENTANA.*ALUMINIO|PERFIL.*ALUMINIO.*VIDRIO|VENTANA.*PANORAMICA|VENTANAS.*RI", "m2", 7.0, "Suministro e instalación de ventanas de aluminio y vidrio"),
    (r"PUERTA.*METALICA|PORTON|PUERTA.*MADERA|PUERTA.*BAÑO", "m2", 5.0, "Instalación de puertas metálicas/madera"),
    (r"TABIQUERIA.*PVC", "m2", 15.0, "Instalación de tabiquería de PVC para baños"),
    (r"PUERTA.*DOBLE.*VIDRIO|PUERTA.*VIDRIO", "und", 2.0, "Instalación de puerta de vidrio templado"),
    (r"PUERTA.*BATIENTE|PUERTA", "pza", 3.0, "Instalación de puertas batientes"),
    (r"CERRADURA", "pza", 6.0, "Instalación de cerraduras"),
    (r"MUEBLE.*ARCHIVO|MUEBLE.*GAVETA", "m2", 4.0, "Fabricación/colocación de mueble de archivo"),

    # Aire Acondicionado y Climatización
    (r"A/C.*INSTALACION|INSTALACION.*AIRE.*ACONDICIONADO|SUSTITUCION.*AIRE", "und", 1.0, "Instalación de equipo de aire acondicionado"),
    (r"A/C.*INSTALACION|INSTALACION.*AIRE.*ACONDICIONADO|SUSTITUCION.*AIRE", "ton", 1.0, "Instalación de aire acondicionado por tonelada"),
    (r"SUMINISTRO.*CONDENSADORA|SUMINISTRO.*EVAPORADORA", "und", 2.0, "Suministro e izamiento de condensadora/evaporadora"),
    (r"AJUSTES.*BALANCEO|PUESTA.*EN.*MARCHA", "trf", 1.0, "Ajustes, balanceo y puesta en marcha de aire"),
    (r"PUNTO.*DRENAJE.*AIRE", "pto", 4.0, "Punto de drenaje de aire acondicionado"),

    # Plomería e Instalaciones Sanitarias
    (r"DRENAJE.*AGUA.*LLUVIA|BAJANTE|CANAL", "sg", 1.0, "Reparación puntual de drenajes de lluvia"),
    (r"PUNTO.*AGUAS.*NEGRAS|PUNTO.*AGUAS.*BLANCAS|PUNTO.*AGUAS.*CLARAS|PUNTO.*AGUAS.*RESIDUALES|PUNTO.*VENTILACION", "pto", 4.0, "Punto hidrosanitario"),
    (r"TUBERIA.*AGUAS.*RESIDUALES|TUBERIA.*AGUAS.*CLARAS|TUBERIA.*POLIPROPILENO|TUBERIA.*PVC", "m", 30.0, "Tendido de tubería hidrosanitaria"),
    (r"LLAVE.*PASO|LLAVE.*ARRESTO|CANILLA", "pza", 8.0, "Instalación de llaves de paso, arresto o canillas"),
    (r"LAVAMANOS|WC|POCETA|DUCHA|GRIFERIA", "pza", 4.0, "Instalación de piezas y griferías sanitarias"),
    (r"CALENTADOR.*ELECTRICO|SISTEMA.*HIDRONEUMATICO|TERMOSTATO|RESISTENCIA", "und", 2.0, "Instalación de calentador o sistema hidroneumático"),
    (r"CALENTADOR.*ELECTRICO|SISTEMA.*HIDRONEUMATICO|TERMOSTATO|RESISTENCIA", "pza", 2.0, "Instalación de calentador o sistema hidroneumático"),
    (r"ELECTRODOMESTICO", "und", 4.0, "Instalación de electrodomésticos"),

    # Movimiento de Materiales, Acarreos y Botes
    (r"ACARREO.*MANO.*CARRETILLA|ACARREO.*HORIZONTAL|ACARREO.*A.*MANO", "m3", 8.0, "Acarreo horizontal a mano con carretilla"),
    (r"ACARREO.*VERTICAL", "m3", 6.0, "Acarreo vertical de material a mano"),
    (r"TRANSPORTE.*BOTE.*ESCOMBRO|BOTE.*BASURA|TRANSPORTE.*Y.*BOTE", "vje", 4.0, "Transporte y bote de escombros en camioneta (viajes/día)"),
    (r"LIMPIEZA.*GENERAL.*OBRA", "und", 1.0, "Limpieza general de obra"),
]

# Tabulador de respaldo por unidad de medida si ninguna regla textual coincide
_UNIT_FALLBACK_PERFORMANCES: Dict[str, float] = {
    "m2": 25.0,
    "m": 30.0,
    "m3": 8.0,
    "pto": 4.0,
    "pza": 8.0,
    "und": 6.0,
    "vje": 4.0,
    "viaje": 4.0,
    "kg": 300.0,
    "kgf": 300.0,
    "ton": 5.0,
}


def normalize_unit_str(unit: Optional[str]) -> str:
    """Normaliza cadenas de unidad a minúsculas sin acentos ni espacios."""
    if not unit:
        return "und"
    raw = str(unit).strip().lower()
    return _normalize_unit(raw) or "und"


def calibrate_item_performance(item: BudgetItem, db: Session) -> Tuple[float, str]:
    """
    Determina el rendimiento diario calibrado y realista para un BudgetItem.
    Retorna (calibrated_performance, motivo_calibracion).
    Prioridad:
    1. Unidades globales canónicas (gl, glb, sg).
    2. Catálogo maestro COVENIN (si tiene código formal COVENIN).
    3. Normas Técnicas y Benchmarks Empíricos del tabulador especializado venezolano.
    4. Cálculo determinista según cuadrilla de obreros.
    5. Tabulador de respaldo COVENIN por unidad de medida.
    """
    if item is None:
        raise ValueError("item no puede ser None")
    if db is None:
        raise ValueError("db Session no puede ser None")

    if bool(item.is_chapter):
        return 1.0, "Capítulo de presupuesto (sin rendimiento)"

    unit = normalize_unit_str(item.unit)

    # 1. Unidades intrínsecamente globales o por evento
    if unit in ("gl", "glb", "sg"):
        return 1.0, f"Unidad global/suma global '{unit}' (rendimiento canónico 1.0)"

    # 2. Búsqueda en catálogo maestro COVENIN (CostItem) por código de partida formal (no índice numérico simple)
    candidate_codes: List[str] = []
    if item.cod_par and item.cod_par.strip() and not item.cod_par.strip().isdigit():
        candidate_codes.append(item.cod_par.strip())
    if item.cov_par and item.cov_par.strip() and not item.cov_par.strip().isdigit() and item.cov_par.strip() != item.cod_par.strip():
        candidate_codes.append(item.cov_par.strip())

    for c_code in candidate_codes:
        ci = db.query(CostItem).filter(
            (CostItem.CodPar == c_code) | (CostItem.CovPar == c_code)
        ).first()
        if ci and ci.RenPar and float(ci.RenPar) > 1.0:
            ci_unit = normalize_unit_str(ci.UniPar)
            if ci_unit == unit or not unit:
                return float(ci.RenPar), f"Catálogo maestro COVENIN ({ci.CodPar}): {float(ci.RenPar):.2f} {ci.UniPar}/día"

    # 3. Reglas empíricas basadas en tipología de obra y descripción técnica
    desc_upper = (item.description or "").upper()
    for pattern, rule_unit, perf, label in _BENCHMARK_RULES:
        if re.search(pattern, desc_upper, re.IGNORECASE):
            norm_rule_unit = normalize_unit_str(rule_unit)
            if norm_rule_unit == unit or (norm_rule_unit in ("und", "pza") and unit in ("und", "pza")):
                return float(perf), f"Norma Técnica: {label}"

    # 4. Cálculo determinista si el ítem cuenta con cuadrilla de mano de obra (BudgetAPULabor)
    if hasattr(item, "labors") and item.labors:
        labors_list = [
            {
                "codigo": getattr(l, "codigo", ""),
                "descripcion": getattr(l, "descripcion", ""),
                "cantidad": float(getattr(l, "cantidad", 1.0) or 1.0),
            }
            for l in item.labors
        ]
        if labors_list:
            try:
                act_type = "DEMOLICION" if is_labor_only_activity(item.description)[0] else "CONSTRUCCION"
                temp_workspec = WorkSpec(
                    activity_type=act_type,
                    element=item.description[:60],
                    target_unit=unit,
                    dimensions=WorkSpecDimensions()
                )
                calc_perf, notes = calculate_v2_deterministic_performance(
                    workspec=temp_workspec,
                    labors=labors_list,
                    user_description=item.description,
                    base_apu=None
                )
                if calc_perf > 1.0:
                    note_msg = notes[0] if notes else f"Determinista Cuadrilla v2 ({len(labors_list)} obreros)"
                    return float(calc_perf), f"Cuadrilla APU: {note_msg}"
            except Exception as exc:
                logger.warning("Fallo al calcular rendimiento determinista con cuadrilla: %s", exc)

    # 5. Tabulador de respaldo estándar COVENIN según unidad de medida
    fallback_perf = _UNIT_FALLBACK_PERFORMANCES.get(unit, 10.0)
    return float(fallback_perf), f"Tabulador base COVENIN por unidad ({unit})"


def recalibrate_budget_performances(
    budget_id: str,
    db: Session,
    dry_run: bool = False
) -> Dict[str, Any]:
    """
    Audita y recalibra los rendimientos de todas las partidas de un presupuesto.
    Corrige automáticamente cualquier partida no-global estancada en 1.0.
    Además, ataja y purga materiales indebidos en partidas de solo mano de obra/equipos.
    """
    if not budget_id or not isinstance(budget_id, str):
        raise ValueError("budget_id debe ser un UUID o cadena no vacía")
    if db is None:
        raise ValueError("db Session es obligatoria")

    budget = db.query(Budget).filter(Budget.id == budget_id).first()
    if not budget:
        raise ValueError(f"Presupuesto con ID '{budget_id}' no encontrado.")

    items = db.query(BudgetItem).filter(BudgetItem.budget_id == budget_id).order_by(BudgetItem.order).all()

    total_items = len(items)
    updated_items = 0
    covenin_matched = 0
    typology_calibrated = 0
    global_items = 0
    unchanged_items = 0
    total_materials_purged = 0
    items_with_purged_materials = 0
    items_detail: List[Dict[str, Any]] = []

    logger.info(
        "[Post-Processor] Iniciando auditoría y calibración de %d partidas para presupuesto '%s' (%s)",
        total_items, budget.name, budget.id
    )

    for item in items:
        # --- 1. Salvaguarda: Purga de materiales en actividades sin material ---
        is_labor_only, lo_reason = is_labor_only_activity(item.description)
        purged_in_item = 0
        if is_labor_only and hasattr(item, "materials") and item.materials:
            purged_in_item = len(item.materials)
            logger.info(
                "[Post-Processor] Purgando %d materiales indebidos en partida de solo mano de obra/equipos (Item %d: %s)",
                purged_in_item, item.order, item.description[:50]
            )
            if not dry_run:
                for mat in list(item.materials):
                    db.delete(mat)
            total_materials_purged += purged_in_item
            items_with_purged_materials += 1

        # --- 2. Calibración de rendimiento diario ---
        old_perf = float(item.performance or 1.0)
        new_perf, reason = calibrate_item_performance(item, db)

        # Limitar a 2 decimales limpios
        new_perf = round(new_perf, 2)
        has_changed = abs(new_perf - old_perf) > 0.001

        if "Catálogo maestro COVENIN" in reason:
            covenin_matched += 1
        elif "Norma Técnica" in reason or "Cuadrilla" in reason:
            typology_calibrated += 1
        elif "global" in reason.lower() or "capítulo" in reason.lower():
            global_items += 1
        else:
            typology_calibrated += 1

        if has_changed:
            updated_items += 1
            if not dry_run:
                item.performance = new_perf
        else:
            unchanged_items += 1

        items_detail.append({
            "order": item.order,
            "cod_par": item.cod_par,
            "description": item.description,
            "unit": item.unit,
            "old_performance": old_perf,
            "new_performance": new_perf,
            "reason": reason,
            "updated": has_changed,
            "is_labor_only": is_labor_only,
            "materials_purged": purged_in_item
        })

    if not dry_run and (updated_items > 0 or total_materials_purged > 0):
        db.commit()
        db.refresh(budget)
        logger.info(
            "[Post-Processor] Calibración y saneamiento completados en BD para '%s': %d rendimientos actualizados, %d materiales purgados.",
            budget.name, updated_items, total_materials_purged
        )

    return {
        "budget_id": budget.id,
        "budget_name": budget.name,
        "total_items": total_items,
        "updated_items": updated_items,
        "covenin_matched": covenin_matched,
        "typology_calibrated": typology_calibrated,
        "global_items": global_items,
        "unchanged_items": unchanged_items,
        "total_materials_purged": total_materials_purged,
        "items_with_purged_materials": items_with_purged_materials,
        "dry_run": dry_run,
        "items_detail": items_detail
    }
