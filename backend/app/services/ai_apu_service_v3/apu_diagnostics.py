"""
Módulo de Diagnóstico Físico y Económico de APUs (Motor v3.0).
Calcula métricas universales de física del trabajo (Horas-Hombre/unidad, Días de Ejecución,
Costo Diario de Equipos y Mano de Obra, Jerarquía de Costos) para detectar inconsistencias
y alucinaciones antes de almacenar un APU.
"""

from typing import Any, Dict, List, Optional
from dataclasses import dataclass, field


@dataclass
class APUDiagnosticsResult:
    """Resultado del análisis físico y económico de un APU."""
    performance: float
    total_workers: float
    hh_per_unit: float
    implicit_execution_days: Optional[float]
    equipment_cost_day: float
    labor_cost_day: float
    materials_cost_unit: float
    equipment_cost_unit: float
    labor_cost_unit: float
    costo_directo: float
    labor_pct: float
    equipment_pct: float
    materials_pct: float
    alerts: List[Dict[str, Any]] = field(default_factory=list)

    @property
    def has_critical_alerts(self) -> bool:
        return any(a.get("severity") == "CRITICAL" for a in self.alerts)

    @property
    def alert_summary_lines(self) -> List[str]:
        return [f"[{a.get('code')}] ({a.get('severity')}): {a.get('message')}" for a in self.alerts]


def compute_apu_diagnostics(
    apu: Dict[str, Any],
    quantity: Optional[float] = None,
    user_description: str = "",
) -> APUDiagnosticsResult:
    """
    Analiza un APU armado y calcula sus métricas físicas y económicas.
    Genera alertas objetivas basadas en números, no en opiniones.
    """
    partida = apu.get("partida") or {}
    unit = str(partida.get("unit") or partida.get("unidad") or "und").strip().upper()
    perf = float(partida.get("performance") or partida.get("rendimiento") or 1.0)
    if perf <= 0:
        perf = 1.0

    materials = apu.get("materials") or []
    equipments = apu.get("equipments") or []
    labors = apu.get("labors") or []

    # 1. Mano de Obra
    total_workers = 0.0
    labor_cost_day = 0.0
    for l in labors:
        cant = float(l.get("cantidad") or 0.0)
        jornal = float(l.get("jornal") or 0.0)
        bono = float(l.get("bono") or 0.0)
        total_workers += cant
        labor_cost_day += cant * (jornal + bono)

    hh_per_unit = round((total_workers * 8.0) / perf, 4) if perf > 0 else 0.0
    labor_cost_unit = round(labor_cost_day / perf, 4) if perf > 0 else 0.0

    # 2. Equipos
    equipment_cost_day = 0.0
    eq_details: List[Dict[str, Any]] = []
    for e in equipments:
        cant = float(e.get("cantidad") or 0.0)
        pu = float(e.get("precio_unitario") or 0.0)
        dep = float(e.get("depreciacion") if e.get("depreciacion") is not None else 1.0)
        costo_dia = cant * pu * dep
        equipment_cost_day += costo_dia
        eq_details.append({
            "codigo": str(e.get("codigo") or ""),
            "descripcion": str(e.get("descripcion") or "").upper(),
            "costo_dia": costo_dia,
            "depreciacion": dep,
            "pu": pu,
            "cantidad": cant,
        })

    equipment_cost_unit = round(equipment_cost_day / perf, 4) if perf > 0 else 0.0

    # 3. Materiales
    materials_cost_unit = 0.0
    for m in materials:
        cant = float(m.get("cantidad") or 0.0)
        pu = float(m.get("precio_unitario") or 0.0)
        desp = float(m.get("desperdicio") or 0.0)
        factor_desp = 1.0 + (desp / 100.0) if desp > 0 else 1.0
        materials_cost_unit += cant * pu * factor_desp
    materials_cost_unit = round(materials_cost_unit, 4)

    # 4. Totales y porcentajes
    costo_directo = round(materials_cost_unit + equipment_cost_unit + labor_cost_unit, 4)
    if costo_directo > 0:
        labor_pct = round((labor_cost_unit / costo_directo) * 100.0, 1)
        equipment_pct = round((equipment_cost_unit / costo_directo) * 100.0, 1)
        materials_pct = round((materials_cost_unit / costo_directo) * 100.0, 1)
    else:
        labor_pct = equipment_pct = materials_pct = 0.0

    implicit_days: Optional[float] = None
    if quantity is not None and quantity > 0 and perf > 0:
        implicit_days = round(quantity / perf, 2)

    alerts: List[Dict[str, Any]] = []
    desc_upper = (user_description or partida.get("description") or "").upper()

    # ALERTA A: Inversión de Jerarquía en Equipos (Camión o maquinaria pesada costando menos que una carretilla/pala)
    heavy_keywords = ("CAMION", "CAMIÓN", "VOLTEO", "BOBCAT", "RETROEXCAVADORA", "COMPRESOR", "TROMPO", "MINICARGADOR")
    small_keywords = ("CARRETILLA", "PALA", "PICO", "CEPILLO", "HERRAMIENTAS MENORES")

    heavy_eqs = [eq for eq in eq_details if any(hk in eq["descripcion"] for hk in heavy_keywords)]
    small_eqs = [eq for eq in eq_details if any(sk in eq["descripcion"] for sk in small_keywords)]

    for he in heavy_eqs:
        # Si un camión o equipo pesado cuesta menos de $15/día, seguro tiene factor 0.01 por error
        if he["costo_dia"] < 15.0 and he["pu"] >= 50.0:
            alerts.append({
                "code": "INVERTED_EQUIPMENT_HIERARCHY",
                "severity": "CRITICAL",
                "message": (
                    f"El equipo mayor '{he['descripcion']}' tiene un costo diario anormalmente bajo "
                    f"(${he['costo_dia']:.2f}/día, dep={he['depreciacion']}). Requiere factor de alquiler 1.0."
                ),
                "target_code": he["codigo"],
                "suggested_fix": {"action": "set_depreciation", "factor": 1.0},
            })
        # Si un equipo pesado cuesta menos por día que una carretilla
        for se in small_eqs:
            if he["costo_dia"] < se["costo_dia"] and he["pu"] > se["pu"]:
                alerts.append({
                    "code": "INVERTED_EQUIPMENT_HIERARCHY",
                    "severity": "CRITICAL",
                    "message": (
                        f"Inversión de jerarquía: '{he['descripcion']}' (${he['costo_dia']:.2f}/día) "
                        f"cuesta menos por día que '{se['descripcion']}' (${se['costo_dia']:.2f}/día)."
                    ),
                    "target_code": he["codigo"],
                    "suggested_fix": {"action": "set_depreciation", "factor": 1.0},
                })

    # ALERTA B: Distorsión en Unidades Compuestas (M3-M, M3-KM)
    if unit in ("M3-M", "M3M", "M3/M"):
        # M3-M: volumen x metros. Rendimiento no puede ser 10-20 m3/día (escala de tierra)
        if perf < 50.0:
            alerts.append({
                "code": "COMPOUND_UNIT_M3_M_LOW_PERF",
                "severity": "CRITICAL",
                "message": (
                    f"Rendimiento de {perf:g} M3-M/día es irrealmente bajo para transporte por distancia horizontal. "
                    f"En M3-M el rendimiento debe ser al menos 100 a 300 M3-M/día."
                ),
                "suggested_fix": {"action": "set_performance", "min_value": 150.0},
            })
        if hh_per_unit > 0.30:
            alerts.append({
                "code": "EXCESSIVE_MAN_HOURS_PER_UNIT",
                "severity": "CRITICAL",
                "message": (
                    f"Esfuerzo de {hh_per_unit:.2f} Horas-Hombre por cada M3-M es excesivo "
                    f"(equivale a mover 1 m³ un metro en {hh_per_unit*60:.0f} minutos)."
                ),
            })
        if costo_directo > 0.50:
            alerts.append({
                "code": "OUT_OF_RANGE_UNIT_PRICE",
                "severity": "CRITICAL",
                "message": f"Precio unitario de ${costo_directo:.2f}/M3-M excede el rango normal de mercado ($0.02 - $0.15/M3-M).",
            })

    elif unit in ("M3-KM", "M3KM", "M3/KM"):
        if perf < 150.0:
            alerts.append({
                "code": "COMPOUND_UNIT_M3_KM_LOW_PERF",
                "severity": "CRITICAL",
                "message": (
                    f"Rendimiento de {perf:g} M3-KM/día es anormalmente bajo para un camión de volteo. "
                    f"Debe ser al menos 300 a 800 M3-KM/día."
                ),
                "suggested_fix": {"action": "set_performance", "min_value": 400.0},
            })
        if costo_directo > 1.50:
            alerts.append({
                "code": "OUT_OF_RANGE_UNIT_PRICE",
                "severity": "CRITICAL",
                "message": f"Precio unitario de ${costo_directo:.2f}/M3-KM excede el rango de flete vehicular ($0.15 - $0.50/M3-KM).",
            })

    # ALERTA C: Cuadrilla Sobredimensionada en Tareas Livianas
    is_light_task = any(kw in desc_upper for kw in ("MOBILIARIO", "MUEBLE", "ENSER", "OFICINA", "DESALOJO", "LIMPIEZA FINAL"))
    if is_light_task and total_workers >= 4.0:
        alerts.append({
            "code": "OUTSIZED_LIGHT_TASK_CREW",
            "severity": "CRITICAL",
            "message": (
                f"La cuadrilla tiene {total_workers:g} trabajadores para una labor de mobiliario/enseres. "
                f"Una cuadrilla estándar para acarreo liviano no debe superar 2 obreros + 1 carretilla."
            ),
            "suggested_fix": {"action": "reduce_crew", "max_workers": 2.0},
        })

    # ALERTA D: Herramientas de excavación o postes en partidas de muebles/acabados
    discordant_tool_keywords = ("EXCAVACION", "EXCAVACIÓN", "POSTES", "PERFORACION", "PERFORACIÓN", "COMPRESOR NEUMATICO")
    if is_light_task:
        for eq in eq_details:
            if any(dt in eq["descripcion"] for dt in discordant_tool_keywords):
                alerts.append({
                    "code": "SEMANTIC_EQUIPMENT_MISMATCH",
                    "severity": "CRITICAL",
                    "message": f"Equipo discordante '{eq['descripcion']}' no pertenece a una partida de mobiliario/enseres.",
                    "target_code": eq["codigo"],
                    "suggested_fix": {"action": "remove_equipment", "target_code": eq["codigo"]},
                })

    # ALERTA E: Duración Implícita Excesiva (más de 10 días para desalojo o acarreo puntual)
    if implicit_days is not None and implicit_days > 15.0 and is_light_task:
        alerts.append({
            "code": "EXCESSIVE_IMPLICIT_DURATION",
            "severity": "WARNING",
            "message": (
                f"Duración estimada de {implicit_days:.1f} días laborales continuos para ejecutar {quantity:g} {unit} "
                f"con rendimiento de {perf:g}/día resulta desproporcionada."
            ),
        })

    return APUDiagnosticsResult(
        performance=perf,
        total_workers=round(total_workers, 2),
        hh_per_unit=hh_per_unit,
        implicit_execution_days=implicit_days,
        equipment_cost_day=round(equipment_cost_day, 4),
        labor_cost_day=round(labor_cost_day, 4),
        materials_cost_unit=materials_cost_unit,
        equipment_cost_unit=equipment_cost_unit,
        labor_cost_unit=labor_cost_unit,
        costo_directo=costo_directo,
        labor_pct=labor_pct,
        equipment_pct=equipment_pct,
        materials_pct=materials_pct,
        alerts=alerts,
    )
