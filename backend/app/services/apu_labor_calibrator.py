import math
import re
import unicodedata
from typing import Any, Dict, List, Optional, Tuple
from app.core.logging import logger
from app.services.text_norm import norm_text
from app.services.element_geometry import extract_linear_length_m, is_linear_element

_normalize_str = norm_text


def _safe_float(value: Any, default: float = 0.0) -> float:
    """Conversión robusta a float tolerando comas decimales, strings con espacios y None (VER-17)."""
    if value is None:
        return default
    if isinstance(value, bool):
        return float(value)
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        s = value.strip().replace(" ", "").replace(",", ".")
        try:
            return float(s)
        except ValueError:
            return default
    return default


_UNIT_BENCHMARK_ALIAS: Dict[str, str] = {
    "pza": "und",
    "u": "und",
    "unidad": "und",
    "piezas": "und",
    "pieza": "und",
    "ml": "m",
    "mt": "m",
    "mts": "m",
    "metro": "m",
    "metros": "m",
    "metro lineal": "m",
    "m²": "m2",
    "m³": "m3",
}


def _benchmark_unit(unit: str) -> str:
    """Normaliza y unifica variantes de unidades para benchmarks empíricos (VER-1)."""
    u = (unit or "").strip().lower()
    return _UNIT_BENCHMARK_ALIAS.get(u, u)


def _strip_accents_labor(s: str) -> str:
    """Elimina tildes y diacríticos para normalización de cargos de mano de obra."""
    if not s:
        return ""
    nfkd = unicodedata.normalize("NFKD", s)
    return "".join(c for c in nfkd if not unicodedata.combining(c))


def normalize_labor_role_key(desc: str) -> str:
    """
    Normaliza la descripción de un cargo de mano de obra eliminando sufijos de tabulador
    ('-N1' a '-N9', '- TABULADOR CONSTRUCCION', puntos de abreviatura '1RA.') para detectar
    duplicados exactos de oficio cuando una partida histórica mezcla dos tabuladores.
    """
    if not desc or not isinstance(desc, str):
        return ""
    up = _strip_accents_labor(desc).upper().strip()
    up = re.sub(r"\s*-\s*TABULADOR\s+CONSTRUCCION\b", "", up)
    up = re.sub(r"\bTABULADOR\s+CONSTRUCCION\b", "", up)
    up = re.sub(r"\s*-\s*N\d+\b", "", up)
    up = re.sub(r"\bN\d+\b", "", up)
    up = re.sub(r"\b(1RA|2DA|3RA)\.", r"\1", up)
    up = re.sub(r"[^A-Z0-9\s/()]", " ", up)
    up = re.sub(r"\s{2,}", " ", up).strip()
    return up


def deduplicate_labor_items(
    labors: List[Dict[str, Any]],
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Deduplica cargos de mano de obra equivalentes (ej. 'PLOMERO DE 1RA -N5' y 'PLOMERO DE 1ra.')
    conservando una única línea por oficio y priorizando el registro con mayor salario integral (jornal + bono).
    Retorna (lista_limpia, lista_purgados).
    """
    if not isinstance(labors, list) or not labors:
        return [], []

    by_role: Dict[str, Dict[str, Any]] = {}
    role_order: List[str] = []
    purged: List[Dict[str, Any]] = []

    for item in labors:
        if not isinstance(item, dict):
            continue
        desc = str(item.get("descripcion") or "").strip()
        role_key = normalize_labor_role_key(desc)
        if not role_key:
            clean = re.sub(r"[^A-Za-z0-9]", "", str(desc).upper())
            role_key = clean or f" IDX_{len(role_order)}"

        jornal = _safe_float(item.get("jornal"), 0.0)
        bono = _safe_float(item.get("bono"), 0.0)
        total_comp = jornal + bono

        if role_key not in by_role:
            by_role[role_key] = item
            role_order.append(role_key)
        else:
            existing = by_role[role_key]
            ex_comp = _safe_float(existing.get("jornal"), 0.0) + _safe_float(existing.get("bono"), 0.0)
            if total_comp > ex_comp:
                purged.append(existing)
                by_role[role_key] = item
            else:
                purged.append(item)

    clean_list = [by_role[k] for k in role_order]
    return clean_list, purged


# ---------------------------------------------------------------------------
# BENCHMARKS EMPÍRICOS DE HORAS-HOMBRE (HH) Y RENDIMIENTO
# Derivados del estudio estadístico sobre las 17.408 partidas de la BD
# ---------------------------------------------------------------------------
EMPERICAL_HH_BENCHMARKS: Dict[str, Dict[str, float]] = {
    # 1. Acarreos y Transporte de Materiales
    "ACARREO_m3.m": {
        "p10": 0.0010,
        "p25": 0.0024,
        "median": 0.0080,
        "p75": 0.0800,
        "p90": 0.2500,
        "rendimiento_med": 514.84,
    },
    "ACARREO_sac.m": {
        "p10": 0.0001,
        "p25": 0.0002,
        "median": 0.0003,
        "p75": 0.0004,
        "p90": 0.0005,
        "rendimiento_med": 14750.0,
    },
    "ACARREO_m3": {
        "p10": 0.5000,
        "p25": 1.2000,
        "median": 2.0000,
        "p75": 3.5000,
        "p90": 5.0000,
        "rendimiento_med": 25.0,
    },

    # 2. Albañilería y Paredes (E411/E412)
    "ALBANILERIA_m2": {
        "p10": 0.7200,
        "p25": 1.1314,
        "median": 2.1767,
        "p75": 2.8000,
        "p90": 3.4000,
        "rendimiento_med": 22.0,
    },
    "ALBANILERIA_und": {
        "p10": 2.5000,
        "p25": 3.0000,
        "median": 3.8000,
        "p75": 5.0000,
        "p90": 6.5000,
        "rendimiento_med": 6.5,
    },
    "ALBANILERIA_pza": {
        "p10": 2.0000,
        "p25": 2.6000,
        "median": 3.2000,
        "p75": 4.5000,
        "p90": 5.5000,
        "rendimiento_med": 7.5,
    },
    "ALBANILERIA_m": {
        "p10": 0.4000,
        "p25": 0.8000,
        "median": 1.2800,
        "p75": 2.1000,
        "p90": 3.2000,
        "rendimiento_med": 22.0,
    },

    # 3. Frisos y Revoques (E413/E414)
    "FRISOS_m2": {
        "p10": 0.6500,
        "p25": 0.9333,
        "median": 2.0000,
        "p75": 2.6000,
        "p90": 3.1891,
        "rendimiento_med": 25.0,
    },
    "FRISOS_und": {
        "p10": 2.2000,
        "p25": 2.8000,
        "median": 3.6000,
        "p75": 4.8000,
        "p90": 6.0000,
        "rendimiento_med": 7.0,
    },
    "FRISOS_pza": {
        "p10": 1.8000,
        "p25": 2.4000,
        "median": 3.0000,
        "p75": 4.2000,
        "p90": 5.2000,
        "rendimiento_med": 8.0,
    },
    "FRISOS_m": {
        "p10": 0.3500,
        "p25": 0.5500,
        "median": 0.8000,
        "p75": 1.2000,
        "p90": 1.6000,
        "rendimiento_med": 35.0,
    },

    # 4. Pintura y Acabados (E8)
    "PINTURA_m2": {
        "p10": 0.1063,
        "p25": 0.4000,
        "median": 1.0000,
        "p75": 2.5000,
        "p90": 5.9943,
        "rendimiento_med": 60.0,
    },
    "PINTURA_m": {
        "p10": 0.2000,
        "p25": 0.5200,
        "median": 0.8667,
        "p75": 1.8000,
        "p90": 3.2776,
        "rendimiento_med": 40.0,
    },
    "PINTURA_pza": {
        "p10": 0.6000,
        "p25": 0.9000,
        "median": 1.2000,
        "p75": 1.8000,
        "p90": 2.5000,
        "rendimiento_med": 20.0,
    },
    "PINTURA_und": {
        "p10": 0.8000,
        "p25": 1.1000,
        "median": 1.5000,
        "p75": 2.2000,
        "p90": 3.0000,
        "rendimiento_med": 16.0,
    },

    # 5. Pisos y Pavimentos (E43)
    "PISOS_m2": {
        "p10": 1.5000,
        "p25": 2.7938,
        "median": 4.4000,
        "p75": 6.2000,
        "p90": 7.9086,
        "rendimiento_med": 12.0,
    },
    "PISOS_und": {
        "p10": 2.0000,
        "p25": 2.6000,
        "median": 3.5000,
        "p75": 4.8000,
        "p90": 6.0000,
        "rendimiento_med": 7.0,
    },

    # 6. Concreto Estructural (E31/E32/E33)
    "CONCRETO_m3": {
        "p10": 1.5000,
        "p25": 4.0000,
        "median": 7.2667,
        "p75": 11.5000,
        "p90": 15.1600,
        "rendimiento_med": 12.0,
    },
    "CONCRETO_m": {
        "p10": 0.5000,
        "p25": 0.9000,
        "median": 1.4000,
        "p75": 2.4000,
        "p90": 3.6000,
        "rendimiento_med": 20.0,
    },
    "CONCRETO_und": {
        "p10": 3.0000,
        "p25": 3.8000,
        "median": 4.8000,
        "p75": 6.2000,
        "p90": 7.5000,
        "rendimiento_med": 5.0,
    },
    "CONCRETO_pza": {
        "p10": 2.5000,
        "p25": 3.2000,
        "median": 4.0000,
        "p75": 5.5000,
        "p90": 6.8000,
        "rendimiento_med": 6.0,
    },

    # 7. Encofrados y Formaletas (E33-E35)
    "ENCOFRADOS_m2": {
        "p10": 0.7273,
        "p25": 1.3600,
        "median": 2.1818,
        "p75": 5.2000,
        "p90": 7.0400,
        "rendimiento_med": 40.0,
    },

    # 8. Acero de Refuerzo / Cabillas (E3)
    "ACERO_kgf": {
        "p10": 0.0738,
        "p25": 0.1043,
        "median": 0.1745,
        "p75": 0.2113,
        "p90": 0.2500,
        "rendimiento_med": 700.0,
    },

    # 9. Instalaciones Sanitarias e Hidráulicas (E5)
    "SANITARIAS_m": {
        "p10": 0.0933,
        "p25": 0.3500,
        "median": 0.4667,
        "p75": 0.8000,
        "p90": 1.2800,
        "rendimiento_med": 70.0,
    },
    "SANITARIAS_pza": {
        "p10": 0.7400,
        "p25": 1.0286,
        "median": 1.8000,
        "p75": 3.4000,
        "p90": 8.6133,
        "rendimiento_med": 12.0,
    },
    "SANITARIAS_pto": {
        "p10": 1.5000,
        "p25": 2.4000,
        "median": 3.3333,
        "p75": 4.8000,
        "p90": 6.0000,
        "rendimiento_med": 12.0,
    },

    # 10. Instalaciones Eléctricas (E6)
    "ELECTRICAS_m": {
        "p10": 0.3867,
        "p25": 0.8400,
        "median": 1.4667,
        "p75": 2.7778,
        "p90": 5.1200,
        "rendimiento_med": 25.0,
    },
    "ELECTRICAS_pza": {
        "p10": 0.9000,
        "p25": 1.4256,
        "median": 2.6000,
        "p75": 4.3667,
        "p90": 6.7400,
        "rendimiento_med": 10.0,
    },
    "ELECTRICAS_pto": {
        "p10": 1.7778,
        "p25": 2.5000,
        "median": 3.4000,
        "p75": 6.0000,
        "p90": 10.0000,
        "rendimiento_med": 10.0,
    },

    # 11. Movimiento de Tierra y Excavación Manual (E1/C1)
    "EXCAVACION_MANUAL_m3": {
        "p10": 1.2000,
        "p25": 1.8000,
        "median": 2.8000,
        "p75": 4.5000,
        "p90": 6.5000,
        "rendimiento_med": 10.0,
    },

    # 12. Excavación y Carga Mecánica (E1/C1)
    "EXCAVACION_MECANICA_m3": {
        "p10": 0.0500,
        "p25": 0.1634,
        "median": 0.4500,
        "p75": 0.8500,
        "p90": 1.5000,
        "rendimiento_med": 180.0,
    },

    # 13. Demoliciones y Pica
    "DEMOLICION_m2": {
        "p10": 0.3000,
        "p25": 0.6000,
        "median": 1.1000,
        "p75": 1.8000,
        "p90": 2.5000,
        "rendimiento_med": 25.0,
    },
    "DEMOLICION_m3": {
        "p10": 1.0000,
        "p25": 2.0000,
        "median": 3.5000,
        "p75": 5.5000,
        "p90": 8.0000,
        "rendimiento_med": 8.0,
    },

    # 14. Estructuras Metálicas, Herrería y Soldadura (E36/M36)
    "ESTRUCTURAS_METALICAS_und": {
        "p10": 12.0000,
        "p25": 16.0000,
        "median": 24.0000,
        "p75": 30.0000,
        "p90": 40.0000,
        "rendimiento_med": 1.25,
    },
    "ESTRUCTURAS_METALICAS_pza": {
        "p10": 4.0000,
        "p25": 6.0000,
        "median": 8.0000,
        "p75": 12.0000,
        "p90": 16.0000,
        "rendimiento_med": 3.0,
    },
    "ESTRUCTURAS_METALICAS_kgf": {
        "p10": 0.0200,
        "p25": 0.0280,
        "median": 0.0380,
        "p75": 0.0500,
        "p90": 0.0650,
        "rendimiento_med": 630.0,
    },
    "ESTRUCTURAS_METALICAS_m": {
        "p10": 0.3000,
        "p25": 0.5000,
        "median": 0.8000,
        "p75": 1.2000,
        "p90": 1.6000,
        "rendimiento_med": 30.0,
    },
    "ESTRUCTURAS_METALICAS_m2": {
        "p10": 2.0000,
        "p25": 3.0000,
        "median": 4.0000,
        "p75": 5.5000,
        "p90": 7.0000,
        "rendimiento_med": 6.0,
    },

    # 15. Reparaciones y Reformas Puntuales en Sitio (R4/R6)
    "REPARACIONES_PUNTUALES_und": {
        "p10": 8.0000,
        "p25": 12.0000,
        "median": 16.0000,
        "p75": 20.0000,
        "p90": 24.0000,
        "rendimiento_med": 1.0,
    },
    # VER-1: Unificado con _und para evitar disparidad 6.7x según etiqueta und vs pza
    "REPARACIONES_PUNTUALES_pza": {
        "p10": 8.0000,
        "p25": 12.0000,
        "median": 16.0000,
        "p75": 20.0000,
        "p90": 24.0000,
        "rendimiento_med": 1.0,
    },

    # 16. Mantenimiento Electromecánico y Equipos (M6/M7)
    "MANTENIMIENTO_ELECTROMECANICO_und": {
        "p10": 6.0000,
        "p25": 10.0000,
        "median": 16.0000,
        "p75": 20.0000,
        "p90": 24.0000,
        "rendimiento_med": 1.5,
    },
    "MANTENIMIENTO_ELECTROMECANICO_pza": {
        "p10": 6.0000,
        "p25": 10.0000,
        "median": 16.0000,
        "p75": 20.0000,
        "p90": 24.0000,
        "rendimiento_med": 1.5,
    },

    # 17. Aliases de und para especialidades (VER-1)
    "ELECTRICAS_und": {
        "p10": 0.9000,
        "p25": 1.4256,
        "median": 2.6000,
        "p75": 4.3667,
        "p90": 6.7400,
        "rendimiento_med": 10.0,
    },
    "SANITARIAS_und": {
        "p10": 0.7400,
        "p25": 1.0286,
        "median": 1.8000,
        "p75": 3.4000,
        "p90": 8.6133,
        "rendimiento_med": 12.0,
    },

    # 18. Tipologías huérfanas calibrables (VER-11)
    "LIMPIEZA_m2": {
        "p10": 0.0500,
        "p25": 0.1000,
        "median": 0.2000,
        "p75": 0.4000,
        "p90": 0.8000,
        "rendimiento_med": 80.0,
    },
    "LIMPIEZA_m": {
        "p10": 0.0400,
        "p25": 0.0800,
        "median": 0.1500,
        "p75": 0.3000,
        "p90": 0.5000,
        "rendimiento_med": 100.0,
    },
    "LIMPIEZA_und": {
        "p10": 0.5000,
        "p25": 1.0000,
        "median": 2.0000,
        "p75": 4.0000,
        "p90": 6.0000,
        "rendimiento_med": 8.0,
    },
    "IMPERMEABILIZACION_m2": {
        "p10": 0.3000,
        "p25": 0.5000,
        "median": 0.8000,
        "p75": 1.4000,
        "p90": 2.2000,
        "rendimiento_med": 20.0,
    },
    "IMPERMEABILIZACION_m": {
        "p10": 0.1500,
        "p25": 0.2500,
        "median": 0.4000,
        "p75": 0.7000,
        "p90": 1.1000,
        "rendimiento_med": 40.0,
    },
    "IMPERMEABILIZACION_und": {
        "p10": 1.0000,
        "p25": 2.0000,
        "median": 3.5000,
        "p75": 5.0000,
        "p90": 8.0000,
        "rendimiento_med": 5.0,
    },
    "RELLENO_m3": {
        "p10": 0.3000,
        "p25": 0.6000,
        "median": 1.2000,
        "p75": 2.0000,
        "p90": 3.0000,
        "rendimiento_med": 15.0,
    },
    "RELLENO_m2": {
        "p10": 0.1000,
        "p25": 0.2000,
        "median": 0.4000,
        "p75": 0.7000,
        "p90": 1.2000,
        "rendimiento_med": 40.0,
    },
    "PERFORACION_m": {
        "p10": 0.5000,
        "p25": 1.0000,
        "median": 2.0000,
        "p75": 3.5000,
        "p90": 5.0000,
        "rendimiento_med": 8.0,
    },
    "PERFORACION_und": {
        "p10": 8.0000,
        "p25": 16.0000,
        "median": 24.0000,
        "p75": 36.0000,
        "p90": 48.0000,
        "rendimiento_med": 1.0,
    },
}

# Constantes y escalador dinámico de mano de obra para pozo profundo (VER-6)
DEEP_WELL_BASE_DEPTH_M: float = 30.0
DEEP_WELL_DEPTH_EXPONENT: float = 0.35


def _deep_well_benchmark(depth_m: float) -> Dict[str, float]:
    """Escala el benchmark de mano de obra en función de la profundidad real del pozo (VER-6)."""
    base = {
        "p10": 16.0,
        "p25": 24.0,
        "median": 32.0,
        "p75": 48.0,
        "p90": 64.0,
    }
    effective_depth = max(DEEP_WELL_BASE_DEPTH_M, float(depth_m or DEEP_WELL_BASE_DEPTH_M))
    factor = max(1.0, (effective_depth / DEEP_WELL_BASE_DEPTH_M) ** DEEP_WELL_DEPTH_EXPONENT)
    out = {k: round(v * factor, 4) for k, v in base.items()}
    out["rendimiento_med"] = round(1.0 / factor, 2)
    out["_depth_factor"] = round(factor, 3)
    return out


def classify_activity_typology(description: str, unit: str, covenin_code: str = "") -> str:
    """
    Clasifica de manera determinista una partida en una de las familias operativas estándar
    según su descripción técnica, código COVENIN y unidad de medida.
    """
    desc_clean = _normalize_str(description)
    cov_upper = _normalize_str(covenin_code).replace(".", "").replace("-", "")
    u_norm = (unit or "").lower().strip()

    # 1. Demoliciones y Desmantelamientos (prioridad máxima sobre elementos constructivos)
    if cov_upper.startswith("R1") or cov_upper.startswith("R2") or cov_upper.startswith("R3"):
        return "DEMOLICION"
    if any(k in desc_clean for k in ["DEMOLICION", "DESMANTELAMIENTO", "PICA DE CONCRETO", "PICADO DE", "DESMONTAJE", "RETIRO DE"]):
        return "DEMOLICION"

    # 2. Acarreo y transporte manual / distancia
    if "m3.m" in u_norm or "sac.m" in u_norm:
        return "ACARREO"
    if (
        ("ACARREO" in desc_clean or "TRANSPORTE A MANO" in desc_clean or "CARRETILL" in desc_clean)
        and ("MAQUINARIA" not in desc_clean and "CAMION" not in desc_clean and "VOLTEO" not in desc_clean)
    ):
        return "ACARREO"
    if cov_upper.startswith("R9"):
        return "ACARREO"

    # 3. Pintura, Esmalte y Tratamientos de Superficie (Prioridad de acción sobre sustrato)
    # Si la acción es pintar, aplicar esmalte, fondo anticorrosivo o tratamiento superficial, la disciplina es PINTURA,
    # independientemente de que el sustrato sea metal (barandas, rejas, escaleras, peldaños, tuberías), madera o concreto.
    is_paint_action = any(k in desc_clean for k in [
        "PINTURA", "ESMALTE", "ANTICORROSIV", "CROMATO", "CONVERTIDOR DE OXIDO",
        "FONDO DE ZINC", "FONDO ANTIALCALINO", "FONDO ANTICORROSIVO", "BARNIZ", "EMPASTADO",
        "TRATAMIENTO ANTICORROSIVO"
    ])
    is_plastic_or_hydraulic_pipe = any(p in desc_clean for p in [
        "PVC", "CPVC", "PPR", "POLIPROPILENO", "PEAD", "POLIETILENO", "TERMOFUSION",
        "SOLDADURA LIQUIDA", "JUNTA SOLDADA", "AGUAS CLARAS", "AGUAS BLANCAS",
        "AGUAS NEGRAS", "AGUAS RESIDUALES", "AGUAS SERVIDAS", "AGUA POTABLE", "TUBERIA SANITARIA"
    ])
    has_metalwork_action = (not is_plastic_or_hydraulic_pipe) and (
        any(k in desc_clean for k in [
            "FABRICACION", "SUMINISTRO Y MONTAJE", "MONTAJE DE ESTRUCTURA", "SOLDADURA",
            "OXICORTE", "CORTE DE PERFIL", "MONTAJE DE VIGA", "MONTAJE DE COLUMNA",
            "ARMADO DE ESTRUCTURA", "REFUERZO DE ESTRUCTURA", "REFUERZO EN ESTRUCTURA",
            "REFUERZO METALICO", "REPARACION DE ESTRUCTURA", "REPARACION Y REFUERZO",
            "REPARACION DE DANOS", "DESMONTAJE Y MONTAJE", "HERRERIA"
        ]) or (
            any(e in desc_clean for e in ["ESTRUCTURA METALICA", "ESTRUCTURAS METALICAS", "BARANDA METALICA", "VIGA METALICA", "COLUMNA METALICA", "VIGAS DE APOYO"])
            and any(w in desc_clean for w in ["REPARACION", "REFUERZO", "SOLDADURA", "OXICORTE", "CORTE", "DESMONTAJE"])
        )
    )
    if is_paint_action and not has_metalwork_action:
        return "PINTURA"

    # 3.5. Instalaciones Sanitarias e Hidráulicas de Tuberías (prioridad sobre 'SOLDADURA' metalmecánica)
    if any(k in desc_clean for k in [
        "TUBERIA SANITARIA", "TUBERIA DE AGUAS CLARAS", "TUBERIA AGUAS CLARAS",
        "TUBERIA DE AGUAS BLANCAS", "TUBERIA AGUAS BLANCAS", "TUBERIA DE AGUAS RESIDUALES",
        "TUBERIA AGUAS RESIDUALES", "AGUAS NEGRAS", "AGUAS BLANCAS", "AGUAS CLARAS",
        "AGUAS SERVIDAS", "AGUA POTABLE", "PVC SANITARIO", "CPVC", "PPR", "POLIPROPILENO",
        "TERMOFUSION", "GRIFERIA", "LAVAMANOS", "EXCUSADO", "POCETA", "DUCHA", "LLAVE DE PASO", "SUMIDERO"
    ]):
        return "SANITARIAS"

    # 4. Estructuras Metálicas, Herrería y Soldadura (E36, M36, R36, C22, E22)
    if (
        cov_upper.startswith("E36") or cov_upper.startswith("M36") or cov_upper.startswith("R36")
        or cov_upper.startswith("C22") or cov_upper.startswith("E22")
    ):
        return "ESTRUCTURAS_METALICAS"
    if (not is_plastic_or_hydraulic_pipe) and any(k in desc_clean for k in [
        "ESTRUCTURA METALICA", "ESTRUCTURAS METALICAS", "HERRERIA", "SOLDADURA", "OXICORTE",
        "TUBO ESTRUCTURAL", "TUBOS ESTRUCTURALES", "PERFIL ESTRUCTURAL", "PERFILES DE ACERO",
        "VIGA METALICA", "COLUMNA METALICA", "VIGAS DE APOYO", "ZANCA", "ZANCAS", "PLETINA", "PLETINAS",
        "ESCALERA METALICA", "BARANDA METALICA", "BARANDA", "BARANDAS", "PORTON METALICO", "REJA DE HIERRO",
        "PLANCHA DE APOYO", "PLANCHA BASE"
    ]):
        if not (u_norm in ("kgf", "kg", "ton", "tonf") and any(c in desc_clean for c in ["CABILLA", "ACERO DE REFUERZO", "MALLA ELECTROSOLDADA"])):
            return "ESTRUCTURAS_METALICAS"

    # Detectar elementos constructivos civiles compuestos (ej. dinteles, machones, vigas, losas, brocales)
    # donde el acero de refuerzo o el encofrado son insumos incluidos ("INCLUYE ACERO...", "INCLUYE ENCOFRADO...")
    # y NO la actividad principal por peso (kgf) ni de carpintería de encofrado aislada (E34).
    has_composite_civil_element = any(k in desc_clean for k in [
        "DINTEL", "DINTELES", "MACHON", "MACHONES", "VIGA DE CORONA", "VIGAS DE CORONA",
        "VIGA DE RIOSTRA", "VIGAS DE RIOSTRA", "BROCAL", "BROCALES", "CUNETA", "CUNETAS",
        "ACERA", "ACERAS", "LOSA", "LOSAS", "ZAPATA", "ZAPATAS", "PEDESTAL", "PEDESTALES",
        "TANQUILLA", "TANQUILLAS", "FUNDACION", "FUNDACIONES", "MEDIA CANA", "MEDIA CAÑA",
        "GOTERO", "FILO DE ESCALERA", "PENDIENTE EN LOSA", "PENDIENTES EN LOSA"
    ])
    steel_is_included_clause = bool(
        re.search(r'\b(?:INCLUYE|INCLUYENDO|CON)\b[^.;]*\b(?:ACERO|CABILLA|CABILLAS|ARMADURA|MALLA)\b', desc_clean)
    )
    formwork_is_included_clause = bool(
        re.search(r'\b(?:INCLUYE|INCLUYENDO|CON)\b[^.;]*\b(?:ENCOFRADO|DESENCOFRADO|FORMALETA)\b', desc_clean)
    )

    # 4. Acero de Refuerzo / Cabillas (exclusivo para partidas medidas en peso kgf/ton o E35,
    # o suministro directo de acero/malla cuando no es un elemento civil compuesto)
    if u_norm in ("kgf", "kg", "ton", "tonf") and any(k in desc_clean for k in ["ACERO", "CABILLA", "ARMADURA", "HIERRO", "MALLA"]):
        return "ACERO"
    if cov_upper.startswith("E35") and u_norm in ("kgf", "kg", "ton", "tonf"):
        return "ACERO"
    if (
        not has_composite_civil_element
        and not steel_is_included_clause
        and u_norm in ("kgf", "kg", "ton", "tonf")
        and any(k in desc_clean for k in ["ACERO DE REFUERZO", "CABILLA", "ARMADURA DE ACERO", "MALLA ELECTROSOLDADA"])
    ):
        return "ACERO"
    if (
        not has_composite_civil_element
        and not steel_is_included_clause
        and any(k in desc_clean for k in ["MALLA ELECTROSOLDADA", "MALLA TRUCKSON", "PREPARACION Y COLOCACION DE ACERO", "SUMINISTRO Y COLOCACION DE ACERO", "S/C DE ACERO DE REFUERZO"])
    ):
        return "ACERO"

    # 4b. Elementos constructivos civiles con mortero (dinteles con mortero, media caña, goteros, pendientes)
    if any(k in desc_clean for k in [
        "DINTEL", "DINTELES", "MACHON", "MACHONES", "VIGA DE CORONA", "VIGAS DE CORONA",
        "MEDIA CANA", "MEDIA CAÑA", "GOTERO", "FILO DE ESCALERA", "PENDIENTE EN LOSA", "PENDIENTES EN LOSA"
    ]):
        if "MORTERO" in desc_clean or any(k in desc_clean for k in ["MEDIA CANA", "MEDIA CAÑA", "GOTERO", "FILO DE ESCALERA"]):
            return "ALBANILERIA"
        if "CONCRETO" in desc_clean or cov_upper.startswith("E33") or cov_upper.startswith("E32"):
            return "CONCRETO"
        return "ALBANILERIA"

    # 4c. Albañilería y Paredes
    if cov_upper.startswith("E411") or cov_upper.startswith("E412") or cov_upper.startswith("E418"):
        return "ALBANILERIA"
    if any(k in desc_clean for k in ["PARED DE BLOQUE", "PARED DE LADRILLO", "ALBANILERIA", "MURO DE BLOQUE", "TABIQUERIA DE BLOQUE", "MORTERO DE ARENA"]):
        return "ALBANILERIA"

    # 5. Frisos y Revoques
    if cov_upper.startswith("E413") or cov_upper.startswith("E414"):
        return "FRISOS"
    if any(k in desc_clean for k in ["FRISO", "REVOQUE", "SALPICADO", "ENLUCIDO", "ESTUCO"]):
        return "FRISOS"

    # 6. Pintura y Acabados
    if cov_upper.startswith("E8"):
        return "PINTURA"
    if any(k in desc_clean for k in ["PINTURA", "ESMALTE", "EMPASTADO", "FONDO ANTIALCALINO", "FONDO ANTICORROSIVO", "BARNIZ"]):
        return "PINTURA"

    # 7. Pisos y Pavimentos
    if cov_upper.startswith("E43"):
        return "PISOS"
    if any(k in desc_clean for k in ["PISO DE", "BALDOSA", "PORCELANATO", "CERAMICA", "GRANITO", "RODAPIE"]):
        return "PISOS"

    # 8. Encofrados (solo cuando el encofrado es la actividad principal, no una cláusula "INCLUYE ENCOFRADO")
    if cov_upper.startswith("E34"):
        return "ENCOFRADOS"
    if any(k in desc_clean for k in ["ENCOFRADO", "DESENCOFRADO", "FORMALETA"]):
        if not formwork_is_included_clause and not has_composite_civil_element:
            return "ENCOFRADOS"

    # 9. Concreto Estructural
    if cov_upper.startswith("E31") or cov_upper.startswith("E32") or cov_upper.startswith("E33"):
        if u_norm not in ("kgf", "kg", "ton", "tonf"):
            return "CONCRETO"
    if any(k in desc_clean for k in [
        "CONCRETO", "VACIADO DE CONCRETO", "LOSA DE CONCRETO", "VIGA DE CONCRETO",
        "COLUMNA DE CONCRETO", "ZAPATA", "BROCAL", "CUNETA", "PEDESTAL"
    ]):
        if u_norm not in ("kgf", "kg", "ton", "tonf"):
            return "CONCRETO"

    # 10. Instalaciones Eléctricas
    if any(k in desc_clean for k in ["TUBERIA CONDUIT", "TUBERIA EMT", "CABLE", "CONDUCTOR ELECTRICO", "TABLERO ELECTRICO", "TOMACORRIENTE", "INTERRUPTOR", "LUMINARIA", "CAJETIN", "BREAKER"]):
        return "ELECTRICAS"

    # 11. Instalaciones Sanitarias e Hidráulicas por prefijo
    if cov_upper.startswith("E5") or cov_upper.startswith("M61") or cov_upper.startswith("M62") or cov_upper.startswith("R61") or cov_upper.startswith("R62"):
        return "SANITARIAS"
    if cov_upper.startswith("E6"):
        return "ELECTRICAS"

    # 12. Limpieza, Desmalezamiento y Despeje (VER-11)
    if any(k in desc_clean for k in ["LIMPIEZA", "DESMALEZAMIENTO", "DESRAICE", "DESFORESTACION", "BARRIDO", "LAVADO", "DESPEJE"]):
        return "LIMPIEZA"

    # 13. Impermeabilización (VER-11)
    if cov_upper.startswith("E416") or any(k in desc_clean for k in ["IMPERMEABILIZACION", "MANTO ASFALTICO", "PRIMER ASFALTICO", "TECHO ASFALTICO", "IMPERMEABILIZANTE"]):
        return "IMPERMEABILIZACION"

    # 14. Relleno y Compactación (VER-11)
    if cov_upper.startswith("E12") or any(k in desc_clean for k in ["RELLENO", "COMPACTACION CON MATERIAL", "BASE GRANULAR", "SUB-BASE", "PRESTAMO"]):
        return "RELLENO"

    # 15. Perforación y Pozos Profundos (VER-11)
    if any(k in desc_clean for k in ["PERFORACION", "POZO PROFUNDO", "POZO TUBULAR", "HINCADO", "SONDEO", "PILOTE"]):
        return "PERFORACION"

    # 16. Excavación y Movimiento de Tierra General
    if any(k in desc_clean for k in ["EXCAVACION A MANO", "ZANJA A MANO", "COMPACTACION A MANO"]):
        return "EXCAVACION_MANUAL"
    if any(k in desc_clean for k in ["EXCAVACION", "MOVIMIENTO DE TIERRA", "NIVELACION", "COMPACTACION"]):
        if any(m in desc_clean for m in ["RETROEXCAVADORA", "TRACTOR", "MAQUINARIA", "JUMBO", "PAYLOADER"]):
            return "EXCAVACION_MECANICA"
        return "EXCAVACION_MANUAL"

    # 17. Mantenimiento Electromecánico y Equipos (M6, M7, M5)
    if cov_upper.startswith("M6") or cov_upper.startswith("M7") or cov_upper.startswith("M5"):
        if any(k in desc_clean for k in ["MANTENIMIENTO", "REVISION", "SERVICIO", "BOMBA", "MOTOR", "COMPRESOR", "AIRE ACONDICIONADO", "HIDRONEUMATICO"]):
            return "MANTENIMIENTO_ELECTROMECANICO"
    if any(k in desc_clean for k in ["MANTENIMIENTO DE BOMBA", "MANTENIMIENTO ELECTROMECANICO", "SISTEMA HIDRONEUMATICO", "COMPRESOR DE AIRE", "PLANTA ELECTRICA"]):
        return "MANTENIMIENTO_ELECTROMECANICO"

    # 18. Reparaciones y Reformas Puntuales en Sitio (R4, R6, R2 o en und/pza)
    if cov_upper.startswith("R4") or cov_upper.startswith("R6") or cov_upper.startswith("R2"):
        if u_norm in ("und", "pza"):
            return "REPARACIONES_PUNTUALES"
    if u_norm in ("und", "pza") and any(k in desc_clean for k in ["REPARACION", "REPARAR", "RECONSTRUCCION", "SANEAMIENTO", "SUSTITUCION DE"]):
        return "REPARACIONES_PUNTUALES"

    return "GENERAL"


def is_supervisory_role(role_desc: str, code: str = "") -> bool:
    """
    Verifica si una línea de mano de obra corresponde a supervisión menor (Caporal / Maestro).
    """
    if not role_desc and not code:
        return False
    desc_clean = norm_text(role_desc)
    code_clean = (code or "").upper().strip()

    supervision_terms = ["CAPORAL", "MAESTRO", "SOBRESTANTE", "SUPERVISOR", "JEFE DE CUADRILLA"]
    if any(term in desc_clean for term in supervision_terms):
        return True

    supervision_codes = {"11-1.3", "MOB013", "11-1.1", "11-1.2", "CAPORAL", "CAP-01"}
    if code_clean in supervision_codes or "MO-DIR" in code_clean:
        return True

    return False


def consolidate_labor_crew(labors: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], List[str]]:
    """
    Filtro 1: Deduplica oficios operativos con doble tabulador y consolida las asignaciones
    de supervisión (Caporal / Maestro).
    Suma líneas redundantes de supervisión y acota la fracción según el tamaño de cuadrilla activa:
    - Cuadrilla activa <= 12 trabajadores: 0.10 <= Caporal <= 0.25
    - Cuadrilla activa > 12 trabajadores: 0.20 <= Caporal <= 0.50
    """
    if not isinstance(labors, list) or not labors:
        return labors or [], []

    notes: List[str] = []
    supervision_items: List[Dict[str, Any]] = []
    raw_active_workers: List[Dict[str, Any]] = []

    for item in labors:
        if not isinstance(item, dict):
            continue
        desc = str(item.get("descripcion", ""))
        code = str(item.get("codigo", ""))
        if is_supervisory_role(desc, code):
            supervision_items.append(item)
        else:
            raw_active_workers.append(item)

    # Deduplicar trabajadores operativos cuando una partida base mezcla dos tabuladores (ej. '-N5' y 'DE 1ra.')
    active_workers, purged_workers = deduplicate_labor_items(raw_active_workers)
    if purged_workers:
        notes.append(
            f"Cuadrilla operativa depurada: Se eliminaron {len(purged_workers)} líneas duplicadas por doble tabulador "
            f"en la partida base, conservando una única asignación por oficio con salario integral vigente."
        )

    # Si no hay supervisión, retornar los trabajadores operativos ya deduplicados
    if not supervision_items:
        return active_workers, notes

    # Calcular el tamaño total de la cuadrilla operativa directa
    total_active_count = sum(_safe_float(w.get("cantidad", 1.0), 1.0) for w in active_workers)

    # Calcular fracción acumulada de supervisión
    total_sup_qty = sum(_safe_float(s.get("cantidad", 0.0), 0.0) for s in supervision_items)

    # Determinar el tope técnico según la normativa de rendimientos
    if total_active_count <= 12.0:
        clamped_sup_qty = min(0.25, max(0.10, total_sup_qty))
    else:
        clamped_sup_qty = min(0.50, max(0.20, total_sup_qty))

    # Seleccionar la línea de supervisión principal (preferir la que tenga código estructurado o tarifas más representativas)
    primary_sup = supervision_items[0].copy()
    for s in supervision_items:
        jornal = _safe_float(s.get("jornal", 0.0), 0.0)
        bono = _safe_float(s.get("bono", 0.0), 0.0)
        if (jornal + bono) > (_safe_float(primary_sup.get("jornal", 0.0), 0.0) + _safe_float(primary_sup.get("bono", 0.0), 0.0)):
            primary_sup = s.copy()

    was_consolidated = (len(supervision_items) > 1) or abs(total_sup_qty - clamped_sup_qty) > 0.01

    primary_sup["cantidad"] = round(clamped_sup_qty, 2)
    if "CAPORAL" not in primary_sup.get("descripcion", "").upper():
        primary_sup["descripcion"] = "CAPORAL"

    if was_consolidated:
        note_msg = (
            f"Supervisión calibrada: Se consolidó el cargo de Caporal a {clamped_sup_qty:.2f} "
            f"para una cuadrilla activa de {total_active_count:.1f} trabajadores "
            f"(deduplicadas {len(supervision_items)} líneas históricas redundantes)."
        )
        notes.append(note_msg)

    consolidated_labors = active_workers + [primary_sup]
    return consolidated_labors, notes


def balance_crew_specialties(labors: List[Dict[str, Any]], typology: str) -> Tuple[List[Dict[str, Any]], List[str]]:
    """
    Filtro 2: Verifica la proporcionalidad de oficios (Oficial/Especialista vs. Ayudante).
    Para disciplinas especializadas (albañilería, plomería, electricidad, carpintería, pintura),
    garantiza que los ayudantes no excedan el ratio técnico constructivo (máximo 2 ayudantes por oficial).
    """
    if not isinstance(labors, list) or not labors:
        return labors or [], []

    specialized_typologies = {
        "ALBANILERIA", "FRISOS", "PINTURA", "ENCOFRADOS", "SANITARIAS", "ELECTRICAS",
        "ESTRUCTURAS_METALICAS", "REPARACIONES_PUNTUALES", "MANTENIMIENTO_ELECTROMECANICO"
    }
    if typology not in specialized_typologies:
        return labors, []

    notes: List[str] = []

    # Detectar oficiales y ayudantes
    specialist_terms = [
        "ALBANIL", "ALBAÑIL", "PINTOR", "PLOMERO", "ELECTRICISTA", "CARPINTERO",
        "CABILLERO", "SOLDADOR", "HERRERO", "MONTADOR", "OXICORTADOR",
        "TECNICO", "MECANICO", "INSTALADOR", "OFICIAL DE 1RA", "OFICIAL"
    ]
    helper_terms = ["AYUDANTE", "OBRERO DE 1RA", "OBRERO", "PEON"]

    specialists: List[Dict[str, Any]] = []
    helpers: List[Dict[str, Any]] = []
    others: List[Dict[str, Any]] = []

    for item in labors:
        desc = norm_text(item.get("descripcion", ""))
        if is_supervisory_role(desc, str(item.get("codigo", ""))):
            others.append(item)
            continue

        is_help = any(t in desc for t in helper_terms)
        is_spec = (not is_help) and any(t in desc for t in specialist_terms)

        if is_spec:
            specialists.append(item)
        elif is_help:
            helpers.append(item)
        else:
            others.append(item)

    # Sustitución de oficios incompatibles para disciplinas especializadas
    if typology == "ESTRUCTURAS_METALICAS":
        for s in specialists:
            s_desc = norm_text(s.get("descripcion", ""))
            if any(inc in s_desc for inc in ["CABILLERO", "CARPINTERO", "ALBANIL", "ALBAÑIL", "PLOMERO"]):
                s["descripcion"] = "HERRERO DE 1RA"
                notes.append(f"Oficio especializado calibrado: Se sustituyó cargo incompatible '{s_desc}' de la base por HERRERO DE 1RA.")
    elif typology == "SANITARIAS":
        for s in specialists:
            s_desc = norm_text(s.get("descripcion", ""))
            if any(inc in s_desc for inc in ["ELECTRICISTA", "CABILLERO", "CARPINTERO", "PINTOR"]):
                s["descripcion"] = "PLOMERO DE 1RA"
                notes.append(f"Oficio especializado calibrado: Se sustituyó cargo incompatible '{s_desc}' de la base por PLOMERO DE 1RA.")
        for o in others:
            o_desc = norm_text(o.get("descripcion", ""))
            if "ELECTRICISTA" in o_desc:
                o["descripcion"] = "MAESTRO PLOMERO -N7"
                notes.append(f"Supervisión calibrada: Se sustituyó supervisión incompatible '{o_desc}' de la base por MAESTRO PLOMERO.")
    elif typology == "ELECTRICAS":
        for s in specialists:
            s_desc = norm_text(s.get("descripcion", ""))
            if any(inc in s_desc for inc in ["PLOMERO", "CABILLERO", "CARPINTERO", "PINTOR"]):
                s["descripcion"] = "ELECTRICISTA DE 1RA"
                notes.append(f"Oficio especializado calibrado: Se sustituyó cargo incompatible '{s_desc}' de la base por ELECTRICISTA DE 1RA.")
        for o in others:
            o_desc = norm_text(o.get("descripcion", ""))
            if "PLOMERO" in o_desc:
                o["descripcion"] = "MAESTRO ELECTRICISTA -N7"
                notes.append(f"Supervisión calibrada: Se sustituyó supervisión incompatible '{o_desc}' de la base por MAESTRO ELECTRICISTA.")

    spec_count = sum(_safe_float(s.get("cantidad", 1.0), 1.0) for s in specialists)
    help_count = sum(_safe_float(h.get("cantidad", 1.0), 1.0) for h in helpers)

    # Si hay ayudantes pero 0 especialistas en una disciplina especializada, convertir el primer ayudante en oficial
    if spec_count == 0 and help_count > 0:
        first_helper = helpers[0]
        trade_names = {
            "ALBANILERIA": "ALBAÑIL DE 1RA",
            "FRISOS": "ALBAÑIL FRISADOR",
            "PINTURA": "PINTOR DE 1RA",
            "ENCOFRADOS": "CARPINTERO DE 1RA",
            "SANITARIAS": "PLOMERO DE 1RA",
            "ELECTRICAS": "ELECTRICISTA DE 1RA",
            "ESTRUCTURAS_METALICAS": "SOLDADOR DE 1RA",
            "REPARACIONES_PUNTUALES": "OFICIAL DE REPARACIONES DE 1RA",
            "MANTENIMIENTO_ELECTROMECANICO": "TECNICO ELECTROMECANICO DE 1RA"
        }
        spec_role = trade_names.get(typology, "OFICIAL DE 1RA")
        first_helper["descripcion"] = spec_role
        first_helper["cantidad"] = 1.0
        specialists.append(first_helper)
        helpers.pop(0)
        spec_count = 1.0
        help_count = sum(_safe_float(h.get("cantidad", 1.0), 1.0) for h in helpers)
        notes.append(f"Cuadrilla equilibrada: Se asignó 1.0 {spec_role} como oficial técnico de frente de trabajo.")

    # Regla: máximo 1.0 ayudante por especialista en trabajos puntuales/mantenimiento, 2.0 en masivos
    max_ratio = 1.0 if typology in ("ESTRUCTURAS_METALICAS", "REPARACIONES_PUNTUALES", "MANTENIMIENTO_ELECTROMECANICO") else 2.0
    max_allowed_helpers = max(1.0, round(spec_count * max_ratio, 1))
    if spec_count > 0 and help_count > max_allowed_helpers:
        # VER-4: Reducción iterativa del exceso tomando primero la línea de mayor cantidad
        excess = help_count - max_allowed_helpers
        while excess > 1e-6 and helpers:
            target = max(helpers, key=lambda x: _safe_float(x.get("cantidad", 1.0), 1.0))
            cur = _safe_float(target.get("cantidad", 1.0), 1.0)
            take = min(cur, excess)
            new_qty = round(cur - take, 2)
            if new_qty <= 0.01:
                helpers.remove(target)
            else:
                target["cantidad"] = new_qty
            excess -= take

        new_help_count = sum(_safe_float(h.get("cantidad", 1.0), 1.0) for h in helpers)
        notes.append(
            f"Proporción de cuadrilla ajustada: ratio ayudante/oficial calibrado a "
            f"{new_help_count / spec_count:.2f} "
            f"({new_help_count:.1f} ayudantes para {spec_count:.1f} especialistas, "
            f"tope {max_allowed_helpers:.1f})."
        )
        assert new_help_count <= max_allowed_helpers + 0.01, (
            f"Calibración de ayudantes falló: {new_help_count:.2f} > {max_allowed_helpers:.2f}"
        )

    balanced_labors = specialists + helpers + others
    return balanced_labors, notes


def balance_crew_and_equipments(
    labors: List[Dict[str, Any]],
    equipments: List[Dict[str, Any]],
    typology: str,
    description: str,
    unit: str
) -> Tuple[List[Dict[str, Any]], List[str]]:
    """
    Filtro 3: Sincronización entre Cuadrilla y Equipos / Herramientas Menores.
    Aplica:
    1. Circuito continuo de acarreo: Carretillas = 35% - 45% de la cuadrilla activa (~40%).
       Palas = 25% - 35% de la cuadrilla (carga y descarga).
    2. Herramientas de mano 1:1 para oficiales (Albañiles, Pintores, etc.).
    3. Validación de operadores para equipos motorizados (Trompo, Vibrador).
    """
    if not isinstance(equipments, list):
        equipments = []
    if not isinstance(labors, list):
        labors = []

    notes: List[str] = []
    active_labor_count = 0.0
    for l in labors:
        desc = str(l.get("descripcion", ""))
        code = str(l.get("codigo", ""))
        if not is_supervisory_role(desc, code):
            active_labor_count += _safe_float(l.get("cantidad", 1.0), 1.0)

    if active_labor_count <= 0.0:
        active_labor_count = 1.0

    # -----------------------------------------------------------------------
    # CASO A: LOGÍSTICA, TRANSPORTE Y ACARREOS (Circuito Continuo)
    # -----------------------------------------------------------------------
    desc_clean = norm_text(description)
    is_haulage = (
        typology == "ACARREO" or
        "ACARREO" in desc_clean or
        "CARRETILL" in desc_clean or
        "m3.m" in unit.lower() or
        "sac.m" in unit.lower()
    )

    if is_haulage:
        # Discriminar modalidad física de acarreo:
        # A) En tobos / cuñetes / sacos (pisos superiores, escaleras, interiores, vertical)
        # B) En carretillas (planta baja, exteriores, terrenos planos)
        is_tobo_haulage = any(term in desc_clean for term in ["TOBO", "CUNETE", "SACO", "BOLSA", "PISOS SUPERIORES", "ESCALERA", "INTERIORES"])

        if is_tobo_haulage:
            # 1. En acarreo por tobos/sacos se eliminan carretillas por incompatibilidad física
            had_carretilla = any("CARRETILLA" in norm_text(eq.get("descripcion", "")) for eq in equipments)
            equipments = [eq for eq in equipments if "CARRETILLA" not in norm_text(eq.get("descripcion", ""))]
            if had_carretilla:
                notes.append(
                    "Modalidad de acarreo calibrada: Se eliminaron carretillas por incompatibilidad física con acarreo en interiores/pisos superiores/tobos."
                )

            # 2. Sincronización de tobos (1.5 tobos por obrero activo en circuito de relevo)
            target_tobos = max(2.0, float(round(active_labor_count * 1.5)))
            target_palas = max(1.0, float(round(active_labor_count * 0.25)))

            tobo_item = next((eq for eq in equipments if any(t in norm_text(eq.get("descripcion", "")) for t in ["TOBO", "CUNETE", "SACO", "BOLSA"])), None)
            pala_item = next((eq for eq in equipments if "PALA" in norm_text(eq.get("descripcion", ""))), None)

            if tobo_item is not None:
                curr_tobos = _safe_float(tobo_item.get("cantidad", 1.0), 1.0)
                if curr_tobos < target_tobos:
                    tobo_item["cantidad"] = target_tobos
                    notes.append(
                        f"Sincronización equipo-cuadrilla: Tobos ajustados a {target_tobos:.0f} unidades "
                        f"(ratio de relevo continuo para {active_labor_count:.0f} obreros: carga, traslado y vaciado)."
                    )
            else:
                new_tobo = {
                    "id": "e-ia-tobo-circuito",
                    "codigo": "ALB026",
                    "descripcion": "TOBO PLASTICO DE ALBAÑIL/ACARREO/EXC",
                    "unidad": "día",
                    "cantidad": target_tobos,
                    "depreciacion": 0.067,
                    "precio_unitario": 13.63,
                    "origen": "historico",
                    "nota_calculo": f"Asignación técnica: {target_tobos:.0f} tobos para cuadrilla de {active_labor_count:.0f} obreros en acarreo vertical/interiores."
                }
                equipments.append(new_tobo)
                notes.append(
                    f"Sincronización equipo-cuadrilla: Se incorporaron {target_tobos:.0f} tobos de albañilería "
                    f"para cuadrilla de {active_labor_count:.0f} obreros en acarreo manual."
                )

            if pala_item is not None:
                curr_pala = _safe_float(pala_item.get("cantidad", 1.0), 1.0)
                if curr_pala < target_palas:
                    pala_item["cantidad"] = target_palas
                    notes.append(
                        f"Herramientas menores sincronizadas: Palas ajustadas a {target_palas:.0f} unidades para carga de tobos."
                    )

        else:
            # Modalidad en carretilla (terrenos planos / exteriores)
            # 1. Purgar tobos si fueron heredados erróneamente de partidas base de tobo
            had_tobo = any("TOBO" in norm_text(eq.get("descripcion", "")) or "CUNETE" in norm_text(eq.get("descripcion", "")) for eq in equipments)
            equipments = [eq for eq in equipments if "TOBO" not in norm_text(eq.get("descripcion", "")) and "CUNETE" not in norm_text(eq.get("descripcion", ""))]
            if had_tobo:
                notes.append(
                    "Modalidad de acarreo calibrada: Se eliminaron tobos por incompatibilidad física con acarreo plano en carretilla."
                )

            # 2. Sincronizar carretillas (40% de la cuadrilla)
            target_carretillas = max(1.0, float(round(active_labor_count * 0.40)))
            target_palas = max(1.0, float(round(active_labor_count * 0.30)))

            carretilla_item = next((eq for eq in equipments if "CARRETILLA" in norm_text(eq.get("descripcion", ""))), None)
            pala_item = next((eq for eq in equipments if "PALA" in norm_text(eq.get("descripcion", ""))), None)

            if carretilla_item is not None:
                curr_qty = _safe_float(carretilla_item.get("cantidad", 1.0), 1.0)
                if curr_qty < target_carretillas:
                    carretilla_item["cantidad"] = target_carretillas
                    notes.append(
                        f"Sincronización equipo-cuadrilla: Carretillas ajustadas de {curr_qty:.0f} a {target_carretillas:.0f} unidades "
                        f"(ratio de circuito continuo 40% para {active_labor_count:.0f} obreros: "
                        f"{target_carretillas:.0f} en acarreo activo y {active_labor_count - target_carretillas:.0f} en carga/descarga)."
                    )
            else:
                new_carretilla = {
                    "id": "e-ia-carretilla-circuito",
                    "codigo": "ALB112",
                    "descripcion": "CARRETILLA CAP= 55 LT",
                    "unidad": "día",
                    "cantidad": target_carretillas,
                    "depreciacion": 0.02,
                    "precio_unitario": 194.88,
                    "origen": "historico",
                    "nota_calculo": (
                        f"Dimensionamiento técnico: {target_carretillas:.0f} carretillas para cuadrilla de "
                        f"{active_labor_count:.0f} obreros en ciclo continuo de transporte."
                    )
                }
                equipments.append(new_carretilla)
                notes.append(
                    f"Sincronización equipo-cuadrilla: Se incorporaron {target_carretillas:.0f} carretillas metálicas "
                    f"en circuito continuo para los {active_labor_count:.0f} obreros de acarreo."
                )

            if pala_item is not None:
                curr_pala = _safe_float(pala_item.get("cantidad", 1.0), 1.0)
                if curr_pala < target_palas:
                    pala_item["cantidad"] = target_palas
                    notes.append(
                        f"Herramientas menores sincronizadas: Palas ajustadas a {target_palas:.0f} unidades "
                        f"para cuadrilla de carga/descarga."
                    )

    # -----------------------------------------------------------------------
    # CASO B: CONCRETO EN ESTRUCTURA (Sincronización de Trompo y Vibrador)
    # -----------------------------------------------------------------------
    elif typology == "CONCRETO":
        has_mixer = False
        has_vibrator = False
        for eq in equipments:
            desc_e = str(eq.get("descripcion", "")).upper()
            if "MEZCLADORA" in desc_e or "TROMPO" in desc_e:
                has_mixer = True
            if "VIBRADOR" in desc_e:
                has_vibrator = True

        # Si hay mezcladora y la cuadrilla es muy pequeña (< 4 personas), advertir o calibrar
        if has_mixer and active_labor_count < 4.0:
            notes.append(
                f"Advertencia operativa: Mezcladora de concreto operando con cuadrilla reducida ({active_labor_count:.0f} obreros). "
                f"Se recomienda un frente mínimo de 4 personas (1 operador, 2 carga de agregados/cemento, 1 transporte)."
            )

        if has_vibrator and active_labor_count < 3.0:
            notes.append(
                "Sincronización de vaciado: Se requiere al menos 1 operador dedicado para el vibrador de inmersión."
            )

    # -----------------------------------------------------------------------
    # CASO C: ALBAÑILERÍA Y PINTURA (Paridad 1:1 de herramientas manuales)
    # -----------------------------------------------------------------------
    elif typology in ("ALBANILERIA", "PINTURA", "FRISOS"):
        # Contar especialistas
        specialist_count = 0.0
        for l in labors:
            desc_l = norm_text(l.get("descripcion", ""))
            is_helper = any(h in desc_l for h in ["AYUDANTE", "OBRERO", "PEON"])
            if (not is_helper) and any(term in desc_l for term in ["ALBANIL", "ALBAÑIL", "PINTOR", "FRISADOR"]):
                specialist_count += _safe_float(l.get("cantidad", 1.0), 1.0)

        if specialist_count > 0:
            for eq in equipments:
                desc_e = norm_text(eq.get("descripcion", ""))
                if any(tool in desc_e for tool in ["CUCHARA", "NIVEL", "BROCHA", "RODILLO", "LLANA"]):
                    curr_qty = _safe_float(eq.get("cantidad", 1.0), 1.0)
                    if curr_qty < specialist_count:
                        eq["cantidad"] = specialist_count
                        notes.append(
                            f"Paridad de herramientas 1:1: Ajustada cantidad de '{eq.get('descripcion')}' "
                            f"a {specialist_count:.0f} unidades (una por especialista activo)."
                        )

        # Sincronización de herramientas eléctricas menores de preparación de superficie:
        desc_c_paint = norm_text(description)
        is_pigment_color = any(p in desc_c_paint for p in ["OXIDO NEGRO", "OXIDO ROJO", "OXIDO AMARILLO", "OXIDO VERDE", "PIGMENTO", "COLOR", "PISO", "SOBREPISO", "REQUEMADO", "MORTERO"])
        is_metal_prep = (not is_pigment_color) and any(k in desc_c_paint for k in ["CEPILLADO", "OXIDO", "DECAPADO", "SANEAMIENTO", "PELDANO", "ESCALERA", "BARANDA", "REJA", "ANTICORROSIV", "METALIC"])
        if is_metal_prep:
            # 1. Sustituir esmeril industrial pesado de 7" por amoladora liviana de 4 1/2" para trabajo en sitio
            for eq in equipments:
                d_up = norm_text(eq.get("descripcion", ""))
                if any(h in d_up for h in ["7 PULG", "7\"", "INDUSTRIAL", "BANCO", "TRONCHADORA"]) and any(e in d_up for e in ["ESMERIL", "AMOLADORA"]):
                    eq["codigo"] = "EQU-IA-AMOLADORA"
                    eq["descripcion"] = "AMOLADORA ANGULAR DE 4 1/2 PULG CON CEPILLO DE ALAMBRE"
                    eq["depreciacion"] = 0.01
                    eq["precio_unitario"] = 55.0
                    eq["origen"] = "ia"
                    eq["nota_calculo"] = "Sustituido esmeril industrial de 7\" por amoladora angular portátil de 4 1/2\" con cepillo circular de alambre de acero para trabajo ergonómico en elementos instalados en sitio."
                    notes.append("Herramienta calibrada: Se sustituyó esmeril industrial de 7\" por Amoladora de 4 1/2\" con cepillo de alambre por accesibilidad en sitio.")

            # 2. Si no tiene amoladora o cepillo, incorporar la de 4 1/2"
            has_grinder = any(any(g in norm_text(eq.get("descripcion", "")) for g in ["ESMERIL", "AMOLADORA", "CEPILLO"]) for eq in equipments)
            if not has_grinder:
                equipments.append({
                    "id": "e-ia-amoladora-4y12",
                    "codigo": "EQU-IA-AMOLADORA",
                    "descripcion": "AMOLADORA ANGULAR DE 4 1/2 PULG CON CEPILLO DE ALAMBRE",
                    "unidad": "día",
                    "cantidad": 1.0,
                    "depreciacion": 0.01,
                    "precio_unitario": 55.0,
                    "origen": "ia",
                    "nota_calculo": "Herramienta portátil de 4 1/2 pulg con cepillo circular de alambre de acero para decapado y desprendimiento mecánico de óxido en elementos instalados en sitio."
                })
                notes.append("Herramientas de preparación superficial: Se incorporó Amoladora Angular de 4 1/2\" con cepillo de alambre para desprendimiento mecánico de óxido en sitio.")

    # -----------------------------------------------------------------------
    # CASO D: ESTRUCTURAS METÁLICAS, HERRERÍA Y SOLDADURA
    # -----------------------------------------------------------------------
    elif typology == "ESTRUCTURAS_METALICAS":
        # Contar soldadores activos
        welders_count = sum(_safe_float(l.get("cantidad", 1.0), 1.0) for l in labors if "SOLDADOR" in norm_text(l.get("descripcion", "")))
        if welders_count > 0:
            welder_eq = next((eq for eq in equipments if any(w in norm_text(eq.get("descripcion", "")) for w in ["SOLDADORA", "MAQUINA DE SOLDAR", "MOTO SOLDADOR", "LINCOLN", "INVERSORA"])), None)
            if welder_eq is not None:
                curr_w = _safe_float(welder_eq.get("cantidad", 1.0), 1.0)
                if curr_w < welders_count:
                    welder_eq["cantidad"] = welders_count
                    notes.append(f"Equipos metalmecánicos: Ajustada máquina de soldar a {welders_count:.0f} un. (1 por soldador activo).")
            else:
                equipments.append({
                    "id": "e-ia-soldadora-lincoln",
                    "codigo": "EQU-HER-152",
                    "descripcion": "SOLDADORA LINCOLN SA-200",
                    "unidad": "día",
                    "cantidad": welders_count,
                    "depreciacion": 0.005282,
                    "precio_unitario": 26559.59,
                    "origen": "historico",
                    "nota_calculo": f"1 máquina de soldar por cada soldador activo ({welders_count:.0f} soldadores)."
                })
                notes.append(f"Equipos metalmecánicos: Se incorporó máquina soldadora ({welders_count:.0f} un.) para soldadores activos.")

        desc_c = norm_text(description)
        is_site_maintenance = any(m in desc_c for m in ["MANTENIMIENTO", "SANEAMIENTO", "REPARACION", "RESTAURACION", "PELDANO", "BARANDA", "REJA", "PINTURA", "ANTICORROSIV"])
        if is_site_maintenance:
            for eq in equipments:
                d_up = norm_text(eq.get("descripcion", ""))
                if any(h in d_up for h in ["7 PULG", "7\"", "INDUSTRIAL", "BANCO", "TRONCHADORA"]) and any(e in d_up for e in ["ESMERIL", "AMOLADORA"]):
                    eq["codigo"] = "EQU-IA-AMOLADORA"
                    eq["descripcion"] = "AMOLADORA ANGULAR DE 4 1/2 PULG CON CEPILLO DE ALAMBRE"
                    eq["depreciacion"] = 0.01
                    eq["precio_unitario"] = 55.0
                    eq["origen"] = "ia"
                    eq["nota_calculo"] = "Sustituido esmeril industrial de 7\" por amoladora angular portátil de 4 1/2\" con cepillo circular de alambre de acero para trabajo en elementos instalados en sitio."
                    notes.append("Herramienta calibrada: Se sustituyó esmeril industrial de 7\" por Amoladora de 4 1/2\" con cepillo de alambre para mantenimiento en sitio.")

        if any(k in desc_c for k in [
            "CORTE", "DESBASTE", "ESMERIL", "AMOLADORA", "PELDANO", "ZANCA", "TUBO", "PERFIL",
            "PLETINA", "SANEAMIENTO", "CEPILLADO", "ANTICORROSIV", "DECAPADO", "OXIDO"
        ]):
            has_grinder = any(any(g in norm_text(eq.get("descripcion", "")) for g in ["ESMERIL", "AMOLADORA", "TRONCHADORA"]) for eq in equipments)
            if not has_grinder:
                if is_site_maintenance:
                    equipments.append({
                        "id": "e-ia-amoladora-4y12",
                        "codigo": "EQU-IA-AMOLADORA",
                        "descripcion": "AMOLADORA ANGULAR DE 4 1/2 PULG CON CEPILLO DE ALAMBRE",
                        "unidad": "día",
                        "cantidad": 1.0,
                        "depreciacion": 0.01,
                        "precio_unitario": 55.0,
                        "origen": "ia",
                        "nota_calculo": "Herramienta portátil de 4 1/2 pulg con cepillo circular de alambre de acero para remoción mecánica de óxido en elementos instalados en sitio."
                    })
                    notes.append("Herramientas metalmecánicas: Se incorporó Amoladora Angular de 4 1/2\" con cepillo de alambre para saneamiento en sitio.")
                else:
                    equipments.append({
                        "id": "e-ia-esmeril-angular",
                        "codigo": "EQU-HER-056",
                        "descripcion": "ESMERIL ANGULAR / AMOLADORA INDUSTRIAL 7 PULG",
                        "unidad": "día",
                        "cantidad": 1.0,
                        "depreciacion": 0.01,
                        "precio_unitario": 120.0,
                        "origen": "historico",
                        "nota_calculo": "Herramienta industrial para corte y desbaste de perfiles pesados y planchas estructurales."
                    })
                    notes.append("Herramientas metalmecánicas: Se incorporó Esmeril Angular Industrial de 7\" para corte y desbaste estructural.")

    # -----------------------------------------------------------------------
    # CASO E: LOGÍSTICA INTELIGENTE DE VEHÍCULOS DE APOYO Y CHOFERES (VER-12, VER-15)
    # -----------------------------------------------------------------------
    # Aplica para trabajos de campo, mantenimiento, herrería y reparaciones en sitio
    is_site_logistics = typology in (
        "ESTRUCTURAS_METALICAS", "REPARACIONES_PUNTUALES", "MANTENIMIENTO_ELECTROMECANICO",
        "PINTURA", "ALBANILERIA", "FRISOS", "SANITARIAS", "ELECTRICAS"
    )

    if is_site_logistics:
        # VER-12: Compilar regexes estrictos para transporte pesado y vehículos livianos
        _HEAVY_RE = re.compile(
            r"\b(CAMI[OÓ]N\s+750|750\s*(?:PESADO|C[AO]RGA)|MACK|CHUTO|GANDOLA"
            r"|VOLTEO|PERFORADOR|CALDWELL|MIXER|CONCRETERA"
            r"|GRUA\s+TELESC[OÓ]PICA|GRUA\s+(?:40|50|100))\b",
            re.IGNORECASE,
        )
        _LIGHT_VEHICLE_RE = re.compile(
            r"\b(F-?350|ESTACAS|F-?150|PICK-?UP|PICKUP|CHEVROLET|SILVERADO|HILUX|D-MAX|FURGON)\b",
            re.IGNORECASE,
        )

        # 1. Detectar y sustituir transporte pesado o maquinaria pesada fuera de escala
        heavy_truck_found = False
        purged_equipments = []
        for eq in equipments:
            eq_desc = norm_text(eq.get("descripcion", ""))
            if _HEAVY_RE.search(eq_desc):
                heavy_truck_found = True
            else:
                purged_equipments.append(eq)
        equipments = purged_equipments

        if heavy_truck_found:
            has_light = any(_LIGHT_VEHICLE_RE.search(norm_text(eq.get("descripcion", ""))) for eq in equipments)
            if not has_light:
                # VER-15: Origen referencial honesto
                equipments.append({
                    "id": "e-vehiculo-utilitario-cuadrilla",
                    "codigo": "EQU-PES-054",
                    "descripcion": "CAMION FORD F- 350 ESTACAS",
                    "unidad": "día",
                    "cantidad": 0.25,
                    "depreciacion": 0.004429,
                    "precio_unitario": 96278.52,
                    "origen": "referencial",
                    "nota_calculo": "Logística de cuadrilla: Camión F-350 estacas (0.25 día) para transporte de cuadrilla, soldadora, cilindros y herramientas en sitio (degradado de maquinaria pesada de la base)."
                })
                notes.append(
                    "[PRECIO_REFERENCIAL] Equipo logístico con precio embebido en el motor: 'CAMION FORD F-350 ESTACAS' ($96,278.52 USD/día). Verifique tarifa de alquiler local."
                )

        # 2. Preservar vehículos utilitarios livianos y acotar a escala razonable (0.25 a 0.50 día)
        for eq in equipments:
            eq_desc = norm_text(eq.get("descripcion", ""))
            if _LIGHT_VEHICLE_RE.search(eq_desc):
                curr_qty = _safe_float(eq.get("cantidad", 0.0), 0.0)
                if curr_qty > 0.50:
                    eq["cantidad"] = 0.25
                    notes.append(
                        f"Logística de cuadrilla: Se acotó '{eq.get('descripcion')}' de {curr_qty:.2f} a 0.25 día para soporte logístico en sitio."
                    )
                elif curr_qty <= 0.0:
                    eq["cantidad"] = 0.25

        # 3. Sincronizar al Chofer con el vehículo de apoyo
        has_any_vehicle = any(_LIGHT_VEHICLE_RE.search(norm_text(eq.get("descripcion", ""))) for eq in equipments)
        if has_any_vehicle:
            driver = next((l for l in labors if "CHOFER" in norm_text(l.get("descripcion", ""))), None)
            if driver is not None:
                curr_drv = _safe_float(driver.get("cantidad", 0.0), 0.0)
                if curr_drv > 0.50 or curr_drv <= 0.0:
                    driver["cantidad"] = 0.25
                    notes.append("Mano de obra logística: Chofer ajustado a 0.25 día en correspondencia con el vehículo de apoyo.")
            else:
                labors.append({
                    "id": "mo-chofer-logistica",
                    "codigo": "MO-OPR-12",
                    "descripcion": "CHOFER DE 2DA (DE 3 A 8 TON) -N4",
                    "unidad": "día",
                    "cantidad": 0.25,
                    "jornal": 2.74,
                    "bono": 3.22,
                    "origen": "historico",
                    "nota_calculo": "Chofer para vehículo utilitario de transporte de cuadrilla y equipos (0.25 día)."
                })
                notes.append("Mano de obra logística: Se incorporó Chofer de 2da (0.25 día) sincronizado con el vehículo de apoyo.")

    return equipments, notes


def validate_and_calibrate_hh(
    partida: Dict[str, Any],
    labors: List[Dict[str, Any]],
    typology: str,
    return_trace: bool = False,
) -> Any:
    """
    Filtro 4: Verificador Paramétrico de Horas-Hombre (HH/unidad).
    Calcula:
        HH = (Sumatoria obreros * 8.0 horas) / Rendimiento
    Compara contra la banda empírica [P10, P90] de las 17.408 partidas.
    Si el rendimiento está fuera de límites físicos:
    - Si HH < P10 (rendimiento sobrehumano o cuadrilla microscópica): recalibra al P50.
    - Si HH > P90 (rendimiento raquítico o cuadrilla hiperinflada): recalibra al P50.
    """
    if not isinstance(partida, dict) or not isinstance(labors, list) or not labors:
        empty_res = (partida or {}, [])
        if return_trace:
            return empty_res[0], empty_res[1], {}
        return empty_res

    notes: List[str] = []
    unit = str(partida.get("unit") or partida.get("unidad") or "").strip().lower()
    perf = _safe_float(partida.get("performance") or partida.get("rendimiento"), 0.0)

    unit_clean = str(unit or "").strip().lower()
    if unit_clean in ("gl", "sg", "global", "suma global"):
        # INMUNIDAD UNIVERSAL PARA PARTIDAS GLOBALES (VER-3):
        # El rendimiento es estrictamente determinista por plazo: R = 1.0 / Días de trabajo.
        # NUNCA aplicar benchmarks empíricos ni acotar silenciosamente la duración indicada por el analista.
        perf = _safe_float(partida.get("performance") or partida.get("rendimiento"), 1.0)
        if perf <= 0.0:
            perf = 1.0
        days_equiv = round(1.0 / perf, 2)

        MAX_GLOBAL_DAYS = 365.0
        if days_equiv > MAX_GLOBAL_DAYS:
            notes.append(
                f"Advertencia de alcance: la duración solicitada ({days_equiv:.0f} días) "
                f"excede el límite de cordura de {MAX_GLOBAL_DAYS:.0f} días. "
                f"Verifique el plazo antes de presupuestar."
            )

        notes.append(
            f"Rendimiento Global (Gl): {perf:.4f} Gl/día "
            f"correspondiente a {days_equiv} días de cuadrilla. "
            f"Duración preservada tal como la indicó el analista."
        )
        partida["performance"] = perf
        if "rendimiento" in partida:
            partida["rendimiento"] = perf
        gl_trace = {
            "hh_iniciales": None,
            "hh_finales": None,
            "tipo_rendimiento": "global_deterministico",
            "dias_estimados": days_equiv,
            "benchmark_encontrado": False,
            "calibracion_aplicada": False,
        }
        if return_trace:
            return partida, notes, gl_trace
        return partida, notes

    # Sumar total de personas en cuadrilla (incluyendo supervisión ponderada)
    total_crew_size = sum(_safe_float(l.get("cantidad", 1.0), 1.0) for l in labors)
    if total_crew_size <= 0.0:
        empty_crew_trace = {"error": "cuadrilla_vacia", "calibracion_aplicada": False}
        if return_trace:
            return partida, notes, empty_crew_trace
        return partida, notes

    total_hh_per_day = total_crew_size * 8.0

    # Si rendimiento viene en cero o negativo, fijar a un valor razonable
    if perf <= 0.0:
        perf = 10.0

    current_hh = total_hh_per_day / perf

    # 0. Factor de Complejidad Constructiva (Mantenimiento, Saneamiento, Altura)
    desc_clean = norm_text(str(partida.get("description") or partida.get("descripcion") or ""))
    is_maintenance = any(k in desc_clean for k in [
        "MANTENIMIENTO", "SANEAMIENTO", "REPARACION", "RECONSTRUCCION", "RESTAURACION",
        "REHABILITACION", "REACONDICIONAMIENTO", "ACONDICIONAMIENTO", "DEMOLICION",
        "REMOCION", "SUSTITUCION", "REEMPLAZO", "PELDANO"
    ])
    # Para tipologías que intrínsecamente ya son de mantenimiento o reparación puntual,
    # el benchmark empírico ya incorpora la dificultad de campo (factor neutro 1.0)
    if typology in ("REPARACIONES_PUNTUALES", "MANTENIMIENTO_ELECTROMECANICO"):
        difficulty_factor = 1.0
    else:
        difficulty_factor = 1.30 if is_maintenance else 1.0

    # 1. Buscar benchmark empírico por clave compuesta exacta (VER-1: normalizar unidad vía _benchmark_unit)
    bench_unit = _benchmark_unit(unit)
    benchmark_key = f"{typology}_{bench_unit}"
    benchmark = EMPERICAL_HH_BENCHMARKS.get(benchmark_key)

    # 1.1 Elementos constructivos lineales pedidos por unidad discreta (ej. 'dintel de 0.80-1.00 m' en und):
    # el benchmark por pieza (CONCRETO_und = pedestales/dados) NO aplica. Se deriva desde el benchmark
    # lineal de la misma tipología escalado por la longitud típica declarada; sin longitud, se preserva
    # el rendimiento propuesto en lugar de imponer un benchmark dimensionalmente ajeno.
    skip_discrete_benchmark = False
    if unit in ("und", "pza", "u") and is_linear_element(desc_clean):
        linear_len = extract_linear_length_m(str(partida.get("description") or partida.get("descripcion") or ""))
        linear_bench = EMPERICAL_HH_BENCHMARKS.get(f"{typology}_m")
        if linear_len and linear_bench:
            benchmark = {
                key: round(value * linear_len, 4)
                for key, value in linear_bench.items()
                if key != "rendimiento_med"
            }
            benchmark["rendimiento_med"] = round(linear_bench["rendimiento_med"] / linear_len, 2)
            notes.append(
                f"Benchmark lineal escalado: {typology}_m x {linear_len:.2f} m de longitud típica por unidad "
                f"(P50 {benchmark['median']:.4f} HH/{unit})."
            )
        else:
            benchmark = None
            skip_discrete_benchmark = True

    # 1.2 Benchmark especializado para pozo profundo, bombas y desmontajes electromecánicos en und/pza
    is_mech_elec = any(k in desc_clean for k in [
        "BOMBA", "MOTOR", "COMPRESOR", "TABLERO", "TRANSFORMADOR",
        "AIRE ACONDICIONADO", "SPLIT", "ELECTROMECANIC", "POZO"
    ])
    is_dismantling = any(k in desc_clean for k in [
        "DESMONTAJE", "DESCONEXION", "DESMANTELAMIENTO", "EXTRACCION", "RETIRO"
    ])

    if not benchmark and not skip_discrete_benchmark and unit in ("und", "pza"):
        # Pozo profundo / bomba sumergible en pozo (VER-6: escala con profundidad real del pozo)
        is_deep_well_match = bool(
            re.search(r"\bPOZO\s+(?:PROFUNDO|TUBULAR)\b", desc_clean)
            or (re.search(r"\b\d{2,3}\s*M\b", desc_clean) and "POZO" in desc_clean)
            or partida.get("profundidad_m")
        )
        if is_deep_well_match and ("POZO" in desc_clean or "BOMBA" in desc_clean):
            depth_m = _safe_float(partida.get("profundidad_m"), 0.0)
            if depth_m <= 0.0:
                m_depth = re.search(r"\b(\d{2,3})\s*M\b", desc_clean)
                if m_depth:
                    depth_m = _safe_float(m_depth.group(1), 30.0)
                else:
                    depth_m = 30.0
            benchmark = _deep_well_benchmark(depth_m)
            difficulty_factor = 1.0
            notes.append(
                f"Benchmark de pozo profundo calibrado: Profundidad efectiva {depth_m:.0f} m "
                f"(P50 {benchmark['median']:.1f} HH/und, factor profundidad x{benchmark.get('_depth_factor', 1.0)})."
            )
        # Desmontaje electromecánico / hidráulico general
        elif (is_dismantling or typology == "DEMOLICION") and is_mech_elec:
            benchmark = {
                "p10": 4.0000,
                "p25": 6.0000,
                "median": 10.0000,
                "p75": 16.0000,
                "p90": 24.0000,
                "rendimiento_med": 2.5,
            }
            difficulty_factor = 1.0
        # Desmontaje liviano no electromecánico
        elif is_dismantling or typology == "DEMOLICION":
            benchmark = {
                "p10": 3.0000,
                "p25": 5.0000,
                "median": 8.0000,
                "p75": 14.0000,
                "p90": 20.0000,
                "rendimiento_med": 3.0,
            }
            difficulty_factor = 1.0
        # Mantenimiento electromecánico general
        elif is_mech_elec or typology == "MANTENIMIENTO_ELECTROMECANICO":
            benchmark = {
                "p10": 6.0000,
                "p25": 10.0000,
                "median": 16.0000,
                "p75": 22.0000,
                "p90": 30.0000,
                "rendimiento_med": 1.5,
            }
            difficulty_factor = 1.0

    # Si no coincide exactamente, buscar SOLO dentro de benchmarks compatibles con la MISMA unidad física
    if not benchmark and not skip_discrete_benchmark:
        for k, v in EMPERICAL_HH_BENCHMARKS.items():
            if k.endswith(f"_{bench_unit}") and k.startswith(typology):
                benchmark = v
                break

    # Fallback inteligente para unidades discretas (und / pza) si la tipología es explícitamente civil/albañilería
    if not benchmark and not skip_discrete_benchmark and unit in ("und", "pza"):
        if typology in ("ALBANILERIA", "FRISOS", "CONCRETO", "PISOS"):
            benchmark = EMPERICAL_HH_BENCHMARKS.get(f"{typology}_{bench_unit}") or EMPERICAL_HH_BENCHMARKS.get(f"ALBANILERIA_{bench_unit}")
        elif typology == "PINTURA":
            benchmark = EMPERICAL_HH_BENCHMARKS.get(f"PINTURA_{bench_unit}")
        elif typology == "ESTRUCTURAS_METALICAS":
            benchmark = EMPERICAL_HH_BENCHMARKS.get(f"ESTRUCTURAS_METALICAS_{bench_unit}")

    # Blindaje dimensional estricto: Si no hay benchmark para esta unidad física exacta o disciplina,
    # NUNCA cruzar dimensiones ni imponer albañilería a disciplinas mecánicas o eléctricas.
    # Conservar el rendimiento propuesto por el analista / LLM y registrar nota explicativa,
    # SALVO si el rendimiento propuesto es <= 1.0 (fallback no inicializado de IA/plantilla) en unidades no globales.
    if not benchmark:
        u_clean = unit.lower().strip()
        default_unit_performances: Dict[str, float] = {
            "m2": 25.0,
            "m": 30.0,
            "ml": 30.0,
            "pza": 16.0,
            "und": 12.0,
            "u": 12.0,
            "m3": 8.0,
            "kgf": 500.0,
            "kg": 500.0,
            "ton": 5.0,
            "tonf": 5.0,
            "pto": 4.0,
            "viaje": 6.0,
        }
        if perf <= 1.0 and u_clean not in ("gl", "sg", "global") and u_clean in default_unit_performances:
            calibrated_perf = default_unit_performances[u_clean]
            if is_maintenance:
                calibrated_perf = round(calibrated_perf * 0.70, 2)
            new_hh = total_hh_per_day / calibrated_perf
            partida["performance"] = calibrated_perf
            if "rendimiento" in partida:
                partida["rendimiento"] = calibrated_perf
            notes.append(
                f"Calibración de rendimiento estándar: Rendimiento ajustado de {perf:.2f} a {calibrated_perf:.2f} {unit}/día "
                f"según tabulador empírico normativo para unidad '{unit}' (evitando valor residual por defecto 1.0 sin benchmark específico)."
            )
            fallback_trace = {
                "hh_iniciales": round(current_hh, 4),
                "hh_finales": round(new_hh, 4),
                "total_hh_jornada_cuadrilla": round(total_hh_per_day, 2),
                "tamano_cuadrilla": round(total_crew_size, 2),
                "factor_dificultad": round(difficulty_factor, 2),
                "benchmark_encontrado": False,
                "motivo_sin_benchmark": f"Sin benchmark empírico para {typology}_{unit}; ajustado por tabulador estándar normativo de unidad.",
                "calibracion_aplicada": True,
            }
            if return_trace:
                return partida, notes, fallback_trace
            return partida, notes

        notes.append(
            f"Rendimiento conservado: Se preserva el rendimiento propuesto ({perf:.2f} {unit}/día) "
            f"para {typology} en '{unit}' para evitar distorsiones con benchmarks ajenos a la disciplina."
        )
        no_bench_trace = {
            "hh_iniciales": round(current_hh, 4),
            "hh_finales": round(current_hh, 4),
            "total_hh_jornada_cuadrilla": round(total_hh_per_day, 2),
            "tamano_cuadrilla": round(total_crew_size, 2),
            "factor_dificultad": round(difficulty_factor, 2),
            "benchmark_encontrado": False,
            "motivo_sin_benchmark": f"Sin benchmark empírico para {typology}_{unit}; preservado para evitar distorsión dimensional.",
            "calibracion_aplicada": False,
        }
        if return_trace:
            return partida, notes, no_bench_trace
        return partida, notes

    p10 = benchmark["p10"]
    p50 = benchmark["median"]
    p90 = benchmark["p90"]

    adjusted_p50 = p50 * difficulty_factor
    lower_bound = p10 * difficulty_factor if is_maintenance else p10 * 0.80
    upper_bound = p90 * 1.30 * difficulty_factor
    new_hh = current_hh
    calibrated_perf = perf

    if current_hh < lower_bound:
        # Rendimiento excesivo / subdimensionamiento de HH
        calibrated_perf = round(total_hh_per_day / adjusted_p50, 2)
        new_hh = total_hh_per_day / calibrated_perf
        partida["performance"] = calibrated_perf
        if "rendimiento" in partida:
            partida["rendimiento"] = calibrated_perf
        maint_txt = f" (aplicando factor de mantenimiento x{difficulty_factor:.2f})" if is_maintenance else ""
        notes.append(
            f"Calibración de rendimiento (HH): Rendimiento diario ajustado de {perf:.2f} a {calibrated_perf:.2f} {unit}/día{maint_txt}. "
            f"El valor anterior implicaba {current_hh:.4f} HH/{unit} (físicamente inalcanzable, banda P10: {lower_bound:.4f}). "
            f"Nuevo HH resultante: {new_hh:.4f} HH/{unit} (mediana calibrada P50: {adjusted_p50:.4f})."
        )
    elif current_hh > upper_bound:
        # Cuadrilla inflada o rendimiento colapsado
        calibrated_perf = round(total_hh_per_day / adjusted_p50, 2)
        new_hh = total_hh_per_day / calibrated_perf
        partida["performance"] = calibrated_perf
        if "rendimiento" in partida:
            partida["rendimiento"] = calibrated_perf
        notes.append(
            f"Calibración de rendimiento (HH): Rendimiento diario ajustado de {perf:.2f} a {calibrated_perf:.2f} {unit}/día "
            f"para evitar sobrecosto por subrendimiento. (HH anterior: {current_hh:.4f}, calibrado a {new_hh:.4f} HH/{unit}, "
            f"benchmark P50: {adjusted_p50:.4f})."
        )
    elif perf <= 1.0 and unit.lower().strip() not in ("gl", "sg", "global") and (total_hh_per_day / adjusted_p50) > 1.8:
        # El rendimiento propuesto era <= 1.0 (típicamente fallback no inicializado de IA o plantilla)
        # mientras que la mediana del benchmark para la cuadrilla activa dicta un rendimiento significativamente mayor.
        calibrated_perf = round(total_hh_per_day / adjusted_p50, 2)
        new_hh = total_hh_per_day / calibrated_perf
        partida["performance"] = calibrated_perf
        if "rendimiento" in partida:
            partida["rendimiento"] = calibrated_perf
        notes.append(
            f"Calibración de rendimiento por defecto (HH): Rendimiento nominal ({perf:.2f} {unit}/día) "
            f"calibrado a {calibrated_perf:.2f} {unit}/día según mediana normativa P50 ({adjusted_p50:.4f} HH/{unit}) "
            f"para evitar subrendimiento artificial por valor no inicializado."
        )

    # -------------------------------------------------------------
    # FUSIBLE BIOMECÁNICO UNIVERSAL (LÍMITES FÍSICOS HUMANOS INFRANQUEABLES)
    # -------------------------------------------------------------
    lead_worker_count = 1.0
    for l in labors:
        desc_l = norm_text(l.get("descripcion", ""))
        if any(role in desc_l for role in ["ALBANIL", "PINTOR", "SOLDADOR", "HERRERO", "ELECTRICISTA", "PLOMERO", "CARPINTERO"]):
            lead_worker_count = max(lead_worker_count, _safe_float(l.get("cantidad", 1.0), 1.0))
            break

    CAPS_PER_LEAD_WORKER = {
        "ALBANILERIA_und": 10.0,
        "FRISOS_und": 10.0,
        "REPARACIONES_PUNTUALES_und": 8.0,
        "CONCRETO_und": 8.0,
        "PISOS_und": 10.0,
        "ESTRUCTURAS_METALICAS_und": 8.0,
        "ESTRUCTURAS_METALICAS_pza": 10.0,
        "PINTURA_und": 25.0,
        "PINTURA_pza": 30.0,
        "PINTURA_m2": 80.0,
        "ALBANILERIA_m2": 25.0,
        "FRISOS_m2": 28.0,
        "DEMOLICION_m3": 2.5,
        "ACARREO_m3.m": 250.0,
    }
    cap_key = f"{typology}_{bench_unit}"
    max_cap_single = CAPS_PER_LEAD_WORKER.get(cap_key)
    biomechanical_triggered = False
    if max_cap_single:
        max_physical_perf = round(max_cap_single * lead_worker_count, 2)
        current_perf_val = _safe_float(partida.get("performance") or partida.get("rendimiento"), 0.0)
        if current_perf_val > max_physical_perf:
            biomechanical_triggered = True
            notes.append(
                f"Fusible biomecánico activado: Rendimiento acotado de {current_perf_val:.2f} a "
                f"{max_physical_perf:.2f} {unit}/día (límite físico máximo de {max_cap_single:.1f} {unit}/jornada "
                f"para {lead_worker_count:.1f} oficiales líderes)."
            )
            partida["performance"] = max_physical_perf
            if "rendimiento" in partida:
                partida["rendimiento"] = max_physical_perf
            new_hh = total_hh_per_day / max_physical_perf

    hh_trace = {
        "hh_iniciales": round(current_hh, 4),
        "hh_finales": round(new_hh, 4),
        "total_hh_jornada_cuadrilla": round(total_hh_per_day, 2),
        "tamano_cuadrilla": round(total_crew_size, 2),
        "factor_dificultad": round(difficulty_factor, 2),
        "benchmark_encontrado": True,
        "benchmark_aplicado": {
            "p10": benchmark.get("p10"),
            "mediana_p50": benchmark.get("median"),
            "p90": benchmark.get("p90"),
            "rendimiento_mediano": benchmark.get("rendimiento_med"),
        },
        "banda_inferior_hh": round(lower_bound, 4),
        "banda_superior_hh": round(upper_bound, 4),
        "dentro_de_banda": (lower_bound <= current_hh <= upper_bound),
        "calibracion_aplicada": (calibrated_perf != perf or biomechanical_triggered),
        "fusible_biomecanico": {
            "activado": biomechanical_triggered,
            "limite_oficial_lider": max_cap_single,
            "oficiales_lideres": lead_worker_count,
            "rendimiento_techo": round(max_cap_single * lead_worker_count, 2) if max_cap_single else None,
        } if max_cap_single else None,
    }

    if return_trace:
        return partida, notes, hh_trace
    return partida, notes


def calibrate_apu_crew_and_equipment(
    result: Dict[str, Any],
    base_apu: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    PUNTO DE ENTRADA PRINCIPAL DEL MOTOR DETERMINISTA DE CALIBRACIÓN:
    Ejecuta en cascada los 4 filtros de consistencia técnica:
    1. Deduplicación y acotamiento de supervisión (Caporal).
    2. Proporcionalidad de oficios (Oficiales vs. Ayudantes).
    3. Sincronización de cuadrilla vs. equipos y herramientas menores.
    4. Validación paramétrica de Horas-Hombre (HH) y calibración de rendimiento.
    """
    if not isinstance(result, dict):
        return result

    # Si la generación requirió clarificación, no procesar
    if result.get("status") == "clarification_needed":
        return result

    try:
        partida = result.get("partida")
        if not isinstance(partida, dict):
            return result

        # Identificar listas de insumos (soportando claves en inglés y español)
        labors_key = "labors" if "labors" in result else "mano_obra"
        equipments_key = "equipments" if "equipments" in result else "equipos"

        labors = result.get(labors_key)
        equipments = result.get(equipments_key)

        if not isinstance(labors, list):
            labors = []
        if not isinstance(equipments, list):
            equipments = []

        description = str(partida.get("description") or partida.get("descripcion") or "")
        unit = str(partida.get("unit") or partida.get("unidad") or "")
        covenin = str(partida.get("cod_par") or partida.get("cov_par") or partida.get("codigo") or "")
        perf_orig = _safe_float(partida.get("performance") or partida.get("rendimiento"), 0.0)

        # 0. Clasificar tipología constructiva
        typology = classify_activity_typology(description, unit, covenin)

        all_calibration_notes: List[str] = []

        # 1. Deduplicación de supervisión (Caporal)
        consolidated_labors, sup_notes = consolidate_labor_crew(labors)
        all_calibration_notes.extend(sup_notes)

        # 2. Proporcionalidad de oficios
        balanced_labors, trade_notes = balance_crew_specialties(consolidated_labors, typology)
        all_calibration_notes.extend(trade_notes)

        # 3. Sincronización cuadrilla vs equipos
        balanced_equipments, eq_notes = balance_crew_and_equipments(
            balanced_labors, equipments, typology, description, unit
        )
        all_calibration_notes.extend(eq_notes)

        # Sanitizar advertencias de insumos eliminados en la calibración
        if "advertencias" in result and isinstance(result["advertencias"], list):
            if any("eliminaron carretillas" in note.lower() for note in eq_notes):
                result["advertencias"] = [
                    adv for adv in result["advertencias"]
                    if not (isinstance(adv, str) and "carretilla" in adv.lower())
                ]
            if any("eliminaron tobos" in note.lower() for note in eq_notes):
                result["advertencias"] = [
                    adv for adv in result["advertencias"]
                    if not (isinstance(adv, str) and ("tobo" in adv.lower() or "cuñete" in adv.lower() or "cunete" in adv.lower()))
                ]

        # 4. Calibración paramétrica de Horas-Hombre (HH)
        calibrated_partida, hh_notes, hh_trace = validate_and_calibrate_hh(
            partida, balanced_labors, typology, return_trace=True
        )
        all_calibration_notes.extend(hh_notes)

        # Guardar insumos actualizados en result
        result[labors_key] = balanced_labors
        result[equipments_key] = balanced_equipments
        result["partida"] = calibrated_partida

        # Inyectar notas de calibración en notas_adaptacion
        if "notas_adaptacion" not in result or not isinstance(result["notas_adaptacion"], list):
            result["notas_adaptacion"] = []

        for note in all_calibration_notes:
            if note not in result["notas_adaptacion"]:
                result["notas_adaptacion"].append(note)

        # Inyectar trazabilidad completa del calibrador para el archivo de Debug
        perf_final = _safe_float(calibrated_partida.get("performance") or calibrated_partida.get("rendimiento"), 0.0)
        result["debug_calibrator_trace"] = {
            "tipologia_constructiva": typology,
            "unidad": unit,
            "rendimiento_inicial_llm": perf_orig,
            "rendimiento_calibrado_final": perf_final,
            "ajuste_rendimiento_aplicado": (perf_orig != perf_final),
            "metricas_horas_hombre": hh_trace,
            "cuadrilla": {
                "total_trabajadores": round(sum(_safe_float(l.get("cantidad", 1.0), 1.0) for l in balanced_labors if isinstance(l, dict)), 2),
                "supervision_notas": sup_notes,
                "especialidades_notas": trade_notes,
            },
            "equipos": {
                "notas": eq_notes,
            },
            "todas_las_notas_calibracion": all_calibration_notes,
            # VER-11: Métrica de cobertura de tipología constructiva
            "cobertura": {
                "tipologia": typology,
                "benchmark_aplicado": bool(hh_trace.get("benchmark_encontrado")),
                "calibrado": typology != "GENERAL",
            },
        }

        # VER-11: Advertencia clara si la partida cayó en tipología GENERAL
        if typology == "GENERAL":
            result.setdefault("advertencias", []).append(
                "[CALIBRACION] Esta partida no pudo clasificarse en una familia operativa "
                "conocida. Los rendimientos NO fueron validados contra la base empírica."
            )

        logger.info(
            "Calibración de APU completada satisfactoriamente para tipología '%s' (%d notas técnicas generadas).",
            typology,
            len(all_calibration_notes)
        )

    except Exception as exc:
        # VER-17: El fallo de calibración debe dejar constancia explícita en advertencias y trace
        logger.error("Error en calibración de APU: %s", exc, exc_info=True)
        result.setdefault("advertencias", []).append(
            "[CALIBRACION] La calibración automática no pudo completarse. "
            "Los rendimientos y cuadrillas NO fueron validados contra la base empírica. "
            "Verifique manualmente antes de presupuestar."
        )
        result["debug_calibrator_trace"] = {"error": str(exc), "calibracion_aplicada": False}

    return result
