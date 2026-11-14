"""
Orquestador del Motor v3.0 para macro partidas expresadas en toneladas.

ETAPA 1 - Precio unitario por sub-partida: cada actividad detectada se resuelve con el pipeline
          v3 existente SIN forzar su unidad; se conserva la unidad real de la base elegida.
ETAPA 2 - Indicaciones hacia la unidad maestra: tabla de factores (unidades de la sub-partida
          por tonelada) con su fuente (dato del usuario, densidad de literatura o biblioteca de
          indicaciones por defecto). Lo que no se pueda deducir queda "pendiente de indicacion"
          y se pide al usuario. Con todas las indicaciones, se funde en un unico APU en toneladas
          (jornadas de 8 h, rendimiento por dia).
"""

import re
import time
import unicodedata
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.core.logging import logger
from app.services.ai_apu_service_v3.compound_merger import (
    ActivityContribution,
    merge_activity_apus_to_master_ton,
)
from app.services.ai_apu_service_v3.compound_params import (
    DEFAULT_RUBBLE_DENSITY_T_PER_M3,
    MASTER_UNIT,
)
from app.services.ai_apu_service_v3.conversion_registry import (
    MissingConversionData,
    density_for,
    lookup_default_indicator,
)
from app.services.ai_apu_service_v3.delta_applier import apply_v3_deltas_to_base_apu
from app.services.ai_apu_service_v3.schemas import ActivityScope, CompoundPlan
from app.services.ai_apu_service_v3.selector_planner import (
    fetch_enriched_candidates_for_v3,
    plan_v3_selection_and_deltas,
)

_TON_UNIT_ALIASES = ("ton", "t", "tn", "tm", "tonelada", "toneladas")
_MASS_UNITS = ("ton", "t", "tn", "kg", "kgf")
_LUMP_UNITS = ("gl", "sg")
_AFFINITY_THRESHOLD = 0.25
_DEFAULT_LUMP_DAYS = 10.0
_STOPWORDS = {
    "para", "con", "sin", "del", "las", "los", "desde", "hasta", "incluye", "excluye", "entre",
    "sobre", "como", "otra", "otro", "esta", "este", "mediante", "segun", "cada", "hacia",
}

_UNIT_EQUIVALENCE_MAP: Dict[str, str] = {
    "kgf": "kg",
    "kgr": "kg",
    "t": "ton",
    "tn": "ton",
    "tm": "ton",
    "sg": "gl",
    "s.g.": "gl",
    "m3.m": "m3xm",
    "m3-m": "m3xm",
}


def is_master_ton_unit(unit: Optional[str]) -> bool:
    """True si la unidad solicitada equivale a toneladas."""
    return bool(unit) and str(unit).strip().lower() in _TON_UNIT_ALIASES


def _norm_unit(unit: str) -> str:
    raw = str(unit or "").strip().lower().replace("\u00b3", "3").replace("\u00b2", "2")
    return _UNIT_EQUIVALENCE_MAP.get(raw, raw)


def _units_are_equivalent(u1: str, u2: str) -> bool:
    return _norm_unit(u1) == _norm_unit(u2)


def _significant_tokens(text: str) -> set[str]:
    nfkd = unicodedata.normalize("NFKD", str(text or "").lower())
    clean = "".join(ch for ch in nfkd if not unicodedata.combining(ch))
    words = re.findall(r"[a-z0-9]+", clean)
    return {w[:6] for w in words if len(w) >= 4 and w not in _STOPWORDS}


def base_affinity(activity_description: str, base_description: str) -> float:
    """Fraccion de los terminos significativos de la actividad que aparecen en la descripcion de la base."""
    wanted = _significant_tokens(activity_description)
    if not wanted:
        return 0.0
    return len(wanted & _significant_tokens(base_description)) / len(wanted)


def _clarification(
    message: str,
    plan: Optional[CompoundPlan],
    required_params: List[Dict[str, str]],
    sub_partidas: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    return {
        "status": "clarification_needed",
        "clarification_message": message,
        "options": [],
        "questions": [p["label"] for p in required_params] or [message],
        "required_params": required_params,
        "sub_partidas": sub_partidas or [],
        "generation_engine": "v3_compound",
        "compound_plan": plan.model_dump() if plan else None,
        "_internal_code": "RAG_COMPOUND_MISSING_PARAMS",
    }


def _resolve_indicator(
    activity: ActivityScope,
    unit: str,
    base_description: str,
    density_override: Optional[float],
    units_per_ton: Dict[str, float],
    use_library_defaults: bool = True,
) -> Dict[str, Any]:
    """
    Indicacion (factor hacia toneladas) de la sub-partida segun la unidad REAL de su base.
    Prioridad:
      1. Indicacion explicita del usuario (`units_per_ton[activity.tag]`).
      2. Suma global (`Gl`) o unidad de masa directa (`ton`, `kg`, `kgf`).
      3. Volumen (`m3`) mediante densidad de tabla de literatura o `density_override`.
      4. Biblioteca de indicaciones por defecto (`INDICATOR_LIBRARY`) para `m2`, `m`, `m3xm`.
      5. Si nada aplica, lanza `MissingConversionData` para solicitar el dato clave al usuario.
    """
    u = _norm_unit(unit)
    user_factor = units_per_ton.get(activity.tag)
    if user_factor and float(user_factor) > 0:
        return {"density": None, "override": float(user_factor), "source": "indicacion del usuario"}
    if u in _LUMP_UNITS:
        return {"density": None, "override": None, "source": "suma global prorrateada entre las toneladas totales"}
    if u in _MASS_UNITS:
        return {"density": None, "override": None, "source": "conversion directa de masa"}
    if u == "m3":
        if density_override and float(density_override) > 0:
            return {"density": float(density_override), "override": None, "source": "densidad del usuario"}
        value, source = density_for(activity.material, activity.state)
        return {"density": value, "override": None, "source": f"densidad de tabla: {source}"}

    if use_library_defaults:
        default_ind = lookup_default_indicator(activity.description, base_description, u)
        if default_ind is not None:
            effective_override = round(default_ind.units_per_ton * float(activity.share), 6)
            return {
                "density": None,
                "override": effective_override,
                "source": f"biblioteca de literatura ({default_ind.key}): {default_ind.source}",
            }

    raise MissingConversionData(
        f"units_per_ton:{activity.tag}",
        f"[{activity.tag}] La partida base esta en '{unit}' ({base_description[:80]}). "
        f"Indica cuantos {unit} de esta actividad corresponden a cada tonelada.",
    )


def generate_apu_v3_compound(
    user_description: str,
    db: Session,
    compound_plan: CompoundPlan,
    total_tons: Optional[float],
    covenin_prefix: Optional[str] = None,
    context: Optional[str] = None,
    lump_execution_days: Optional[float] = None,
    density_override_t_per_m3: Optional[float] = None,
    units_per_ton: Optional[Dict[str, float]] = None,
    use_embeddings: bool = False,
) -> Dict[str, Any]:
    """Genera un unico APU en toneladas a partir de las N sub-partidas detectadas."""
    if not user_description or not user_description.strip():
        raise ValueError("user_description es obligatorio")
    if db is None:
        raise ValueError("db Session es obligatoria")
    if not compound_plan.is_compound or not compound_plan.activities:
        raise ValueError("compound_plan debe contener al menos una actividad detectada")

    if total_tons is None or float(total_tons) <= 0:
        return _clarification(
            "La partida compuesta se expresa en toneladas.",
            compound_plan,
            [{"key": "total_tons", "label": "Total de toneladas de la partida (necesario para prorratear)."}],
        )
    tons = float(total_tons)
    user_factors: Dict[str, float] = units_per_ton or {}
    activities = sorted(compound_plan.activities, key=lambda a: a.order)

    t_start = time.time()
    contributions: List[ActivityContribution] = []
    sub_partidas: List[Dict[str, Any]] = []
    pending: List[Dict[str, str]] = []
    warnings: List[str] = []
    assumptions: List[str] = [
        f"Porcentaje de ferrosos en peso: {compound_plan.ferrous_pct:g}% (supuesto editable; minimo normativo 1%).",
        "Rendimientos por jornada de 8 horas.",
    ]

    # ---------------- ETAPA 1: precio unitario por sub-partida ----------------
    for activity in activities:
        entry: Dict[str, Any] = {
            "actividad": activity.tag,
            "descripcion_actividad": activity.description,
            "unidad_natural_sugerida": activity.unit,
            "share": activity.share,
        }
        is_lump = activity.carrier == "lump"
        effective_lump_days: Optional[float] = None
        if is_lump:
            effective_lump_days = (
                float(lump_execution_days)
                if (lump_execution_days and float(lump_execution_days) > 0)
                else _DEFAULT_LUMP_DAYS
            )

        candidates, _, _ = fetch_enriched_candidates_for_v3(
            db=db,
            user_description=activity.description,
            covenin_prefix=covenin_prefix or "",
            top_k=6,
            use_embeddings=use_embeddings,
        )
        # No forzamos requested_unit ni execution_days en actividades fisicas para no inducir 'Gl' en el selector.
        plan, base_apu, _, _ = plan_v3_selection_and_deltas(
            user_description=activity.description,
            enriched_candidates=candidates,
            requested_unit="Gl" if is_lump else None,
            execution_days=effective_lump_days,
            context=context,
        )
        base_unit_raw = str((base_apu or {}).get("unidad") or "")
        if (
            plan.selected_codpar != "NONE"
            and base_unit_raw
            and not _units_are_equivalent(plan.target_unit, base_unit_raw)
        ):
            # El LLM cambio la unidad de una base real y reinvento el rendimiento: se revierte al catalogo.
            warnings.append(
                f"[{activity.tag}] El planificador cambio la unidad de la base {plan.selected_codpar} "
                f"de '{base_unit_raw}' a '{plan.target_unit}'; se revirtio a '{base_unit_raw}' con el "
                "rendimiento oficial del catalogo."
            )
            plan.target_unit = base_unit_raw
            plan.keep_base_performance = True
            plan.new_performance = None
            plan.performance_reason = None
            for ops in (plan.material_ops, plan.equipment_ops, plan.labor_ops):
                ops[:] = [op for op in ops if op.op != "modify_qty"]
        elif plan.selected_codpar != "NONE" and base_unit_raw:
            plan.target_unit = base_unit_raw
        elif plan.selected_codpar == "NONE" and not is_lump and _norm_unit(plan.target_unit) in _LUMP_UNITS:
            plan.target_unit = activity.unit or "m3"

        if plan.clarification_needed:
            entry["estado"] = "requiere_aclaratoria"
            pending.append({
                "key": f"clarification:{activity.tag}",
                "label": f"[{activity.tag}] {plan.clarification_reason or activity.description}",
            })
            sub_partidas.append(entry)
            continue

        apu, _ = apply_v3_deltas_to_base_apu(
            plan=plan,
            base_apu=base_apu,
            user_description=activity.description,
            db=db,
            requested_unit=plan.target_unit or None,
            execution_days=effective_lump_days,
            covenin_prefix=covenin_prefix,
        )
        partida = apu.get("partida") or {}
        unit = str(partida.get("unit") or "")
        base_desc = str((base_apu or {}).get("descripcion") or "")
        from_scratch = plan.selected_codpar == "NONE"
        affinity = None if from_scratch else round(base_affinity(activity.description, base_desc), 2)

        if _norm_unit(unit) in _LUMP_UNITS and not (lump_execution_days and float(lump_execution_days) > 0):
            assumptions.append(
                f"[{activity.tag}] Suma global calculada con {_DEFAULT_LUMP_DAYS:g} jornadas de 8 h (supuesto editable)."
            )

        entry.update({
            "partida_base": plan.selected_codpar,
            "base_descripcion": base_desc or "(creada desde cero)",
            "base_unidad": (base_apu or {}).get("unidad"),
            "unidad_resultante": unit,
            "rendimiento": partida.get("performance"),
            "costo_directo_unitario": apu.get("costo_directo"),
            "afinidad_base": affinity,
            "apu": apu,
        })
        if from_scratch:
            warnings.append(f"[{activity.tag}] Sin partida base afin en el catalogo: receta creada desde cero, sin respaldo; validar o cotizar.")
        elif affinity is not None and affinity < _AFFINITY_THRESHOLD:
            warnings.append(
                f"[{activity.tag}] La base {plan.selected_codpar} tiene baja afinidad ({affinity:.0%}) con la actividad: "
                f"'{base_desc[:90]}'. Confirmar o elegir otra."
            )

        # ---------------- ETAPA 2: indicacion hacia toneladas ----------------
        try:
            ind = _resolve_indicator(activity, unit, base_desc, density_override_t_per_m3, user_factors)
        except MissingConversionData as exc:
            entry["estado"] = "pendiente_indicacion"
            pending.append({"key": exc.param_key, "label": str(exc)})
            sub_partidas.append(entry)
            continue

        entry["estado"] = "lista"
        entry["indicacion"] = ind["source"]
        sub_partidas.append(entry)
        assumptions.append(f"[{activity.tag}] Indicacion: {ind['source']}.")
        contributions.append(
            ActivityContribution(
                tag=activity.tag,
                apu=apu,
                unit=unit,
                share=activity.share,
                density_t_m3=ind["density"],
                units_per_ton_override=ind["override"],
            )
        )

    if pending:
        public_subs = [{k: v for k, v in s.items() if k != "apu"} for s in sub_partidas]
        result = _clarification(
            "Se calcularon las sub-partidas disponibles; faltan indicaciones para fusionarlas en toneladas.",
            compound_plan,
            pending,
            public_subs,
        )
        result["advertencias"] = warnings
        return result

    order_by_tag = {a.tag: a.order for a in activities}
    contributions.sort(key=lambda c: order_by_tag.get(c.tag, 0))

    try:
        merged = merge_activity_apus_to_master_ton(
            contributions=contributions,
            total_tons=tons,
            master_description=user_description,
            rubble_density_t_per_m3=density_override_t_per_m3 or DEFAULT_RUBBLE_DENSITY_T_PER_M3,
        )
    except ValueError as exc:
        logger.error("[V3 Compound] No se pudo fusionar a toneladas: %s", exc, exc_info=True)
        public_subs = [{k: v for k, v in s.items() if k != "apu"} for s in sub_partidas]
        return _clarification(
            f"No fue posible fusionar a toneladas: {exc}",
            compound_plan,
            [{"key": getattr(exc, "param_key", "unit_conversion"), "label": str(exc)}],
            public_subs,
        )

    merged["partida"]["unit"] = MASTER_UNIT
    merged["supuestos_tecnicos"] = assumptions
    merged["notas_adaptacion"] = assumptions + merged.get("notas_adaptacion", [])
    merged["advertencias"] = warnings
    merged["v3_compound_plan"] = compound_plan.model_dump()
    # Soporte anexo: APU completo de cada sub-partida (precio unitario en su propia unidad)
    merged["sub_partidas_soporte"] = sub_partidas
    merged["total_tons_contrato"] = tons
    merged["telemetria_v3"] = {
        "engine": "v3_compound",
        "total_ms": round((time.time() - t_start) * 1000.0, 1),
        "activities": len(contributions),
    }
    return merged
