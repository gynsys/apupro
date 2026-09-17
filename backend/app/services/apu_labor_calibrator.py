import math
import re
import unicodedata
from typing import Any, Dict, List, Optional, Tuple
from app.core.logging import logger


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

    # 6. Concreto Estructural (E31/E32)
    "CONCRETO_m3": {
        "p10": 1.5000,
        "p25": 4.0000,
        "median": 7.2667,
        "p75": 11.5000,
        "p90": 15.1600,
        "rendimiento_med": 12.0,
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
    "REPARACIONES_PUNTUALES_pza": {
        "p10": 1.0000,
        "p25": 1.5000,
        "median": 2.4000,
        "p75": 4.0000,
        "p90": 6.0000,
        "rendimiento_med": 8.0,
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
}


def _normalize_str(text: str) -> str:
    """
    Elimina acentos y signos diacríticos, convirtiendo a mayúsculas
    para comparaciones semánticas deterministas y robustas en español.
    """
    if not text:
        return ""
    nfkd = unicodedata.normalize("NFKD", text)
    stripped = "".join(c for c in nfkd if not unicodedata.combining(c))
    return stripped.upper().strip()


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
    if any(k in desc_clean for k in ["DEMOLICION", "DESMANTELAMIENTO", "PICA DE CONCRETO", "PICADO DE"]):
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
    has_metalwork_action = any(k in desc_clean for k in [
        "FABRICACION", "SUMINISTRO Y MONTAJE", "MONTAJE DE ESTRUCTURA", "SOLDADURA",
        "OXICORTE", "CORTE DE PERFIL", "MONTAJE DE VIGA", "MONTAJE DE COLUMNA",
        "ARMADO DE ESTRUCTURA", "REFUERZO DE ESTRUCTURA", "REFUERZO EN ESTRUCTURA",
        "REFUERZO METALICO", "REPARACION DE ESTRUCTURA", "REPARACION Y REFUERZO",
        "REPARACION DE DANOS", "DESMONTAJE Y MONTAJE", "HERRERIA"
    ]) or (
        any(e in desc_clean for e in ["ESTRUCTURA METALICA", "ESTRUCTURAS METALICAS", "BARANDA METALICA", "VIGA METALICA", "COLUMNA METALICA", "VIGAS DE APOYO"])
        and any(w in desc_clean for w in ["REPARACION", "REFUERZO", "SOLDADURA", "OXICORTE", "CORTE", "DESMONTAJE"])
    )
    if is_paint_action and not has_metalwork_action:
        return "PINTURA"

    # 4. Estructuras Metálicas, Herrería y Soldadura (E36, M36, R36, C22, E22)
    if (
        cov_upper.startswith("E36") or cov_upper.startswith("M36") or cov_upper.startswith("R36")
        or cov_upper.startswith("C22") or cov_upper.startswith("E22")
    ):
        return "ESTRUCTURAS_METALICAS"
    if any(k in desc_clean for k in [
        "ESTRUCTURA METALICA", "ESTRUCTURAS METALICAS", "HERRERIA", "SOLDADURA", "OXICORTE",
        "TUBO ESTRUCTURAL", "TUBOS ESTRUCTURALES", "PERFIL ESTRUCTURAL", "PERFILES DE ACERO",
        "VIGA METALICA", "COLUMNA METALICA", "VIGAS DE APOYO", "ZANCA", "ZANCAS", "PLETINA", "PLETINAS",
        "ESCALERA METALICA", "BARANDA METALICA", "BARANDA", "BARANDAS", "PORTON METALICO", "REJA DE HIERRO",
        "PLANCHA DE APOYO", "PLANCHA BASE"
    ]):
        if not (u_norm in ("kgf", "kg", "ton", "tonf") and any(c in desc_clean for c in ["CABILLA", "ACERO DE REFUERZO", "MALLA ELECTROSOLDADA"])):
            return "ESTRUCTURAS_METALICAS"

    # 4. Acero de Refuerzo / Cabillas (prioridad sobre Concreto por unidad de medida kgf/ton)
    if u_norm in ("kgf", "kg", "ton", "tonf") and any(k in desc_clean for k in ["ACERO", "CABILLA", "ARMADURA", "HIERRO", "MALLA"]):
        return "ACERO"
    if any(k in desc_clean for k in ["ACERO DE REFUERZO", "CABILLA", "ARMADURA DE ACERO", "MALLA ELECTROSOLDADA"]):
        return "ACERO"

    # 4. Albañilería y Paredes
    if cov_upper.startswith("E411") or cov_upper.startswith("E412"):
        return "ALBANILERIA"
    if any(k in desc_clean for k in ["PARED DE BLOQUE", "PARED DE LADRILLO", "ALBANILERIA", "MURO DE BLOQUE", "TABIQUERIA DE BLOQUE"]):
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

    # 8. Encofrados
    if any(k in desc_clean for k in ["ENCOFRADO", "DESENCOFRADO", "FORMALETA"]):
        return "ENCOFRADOS"
    if cov_upper.startswith("E33") or cov_upper.startswith("E34") or cov_upper.startswith("E35"):
        if "ACERO" not in desc_clean and "CABILLA" not in desc_clean and u_norm not in ("kgf", "kg", "ton"):
            return "ENCOFRADOS"

    # 9. Concreto Estructural
    if cov_upper.startswith("E31") or cov_upper.startswith("E32"):
        if u_norm not in ("kgf", "kg", "ton"):
            return "CONCRETO"
    if any(k in desc_clean for k in ["CONCRETO", "VACIADO DE CONCRETO", "LOSA DE CONCRETO", "VIGA DE CONCRETO", "COLUMNA DE CONCRETO", "ZAPATA"]):
        if u_norm not in ("kgf", "kg", "ton"):
            return "CONCRETO"

    # 10. Instalaciones Sanitarias e Hidráulicas
    if cov_upper.startswith("E5"):
        return "SANITARIAS"
    if any(k in desc_clean for k in ["TUBERIA SANITARIA", "AGUAS NEGRAS", "AGUAS BLANCAS", "PVC SANITARIO", "GRIFERIA", "LAVAMANOS", "EXCUSADO", "POCETA", "DUCHA", "LLAVE DE PASO", "SUMIDERO"]):
        return "SANITARIAS"

    # 11. Instalaciones Eléctricas
    if cov_upper.startswith("E6"):
        return "ELECTRICAS"
    if any(k in desc_clean for k in ["TUBERIA CONDUIT", "CABLE", "CONDUCTOR ELECTRICO", "TABLERO ELECTRICO", "TOMACORRIENTE", "INTERRUPTOR", "LUMINARIA", "CAJETIN", "BREAKER"]):
        return "ELECTRICAS"

    # 12. Excavación y Movimiento de Tierra
    if any(k in desc_clean for k in ["EXCAVACION A MANO", "ZANJA A MANO", "COMPACTACION A MANO", "DESMALEZAMIENTO A MANO"]):
        return "EXCAVACION_MANUAL"
    if any(k in desc_clean for k in ["EXCAVACION", "MOVIMIENTO DE TIERRA", "NIVELACION", "COMPACTACION"]):
        if any(m in desc_clean for m in ["RETROEXCAVADORA", "TRACTOR", "MAQUINARIA", "JUMBO", "PAYLOADER"]):
            return "EXCAVACION_MECANICA"
        return "EXCAVACION_MANUAL"

    # 13. Mantenimiento Electromecánico y Equipos (M6, M7, M5)
    if cov_upper.startswith("M6") or cov_upper.startswith("M7") or cov_upper.startswith("M5"):
        if any(k in desc_clean for k in ["MANTENIMIENTO", "REVISION", "SERVICIO", "BOMBA", "MOTOR", "COMPRESOR", "AIRE ACONDICIONADO", "HIDRONEUMATICO"]):
            return "MANTENIMIENTO_ELECTROMECANICO"
    if any(k in desc_clean for k in ["MANTENIMIENTO DE BOMBA", "MANTENIMIENTO ELECTROMECANICO", "SISTEMA HIDRONEUMATICO", "COMPRESOR DE AIRE", "PLANTA ELECTRICA"]):
        return "MANTENIMIENTO_ELECTROMECANICO"

    # 14. Reparaciones y Reformas Puntuales en Sitio (R4, R6, R2 o en und/pza)
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
    desc_clean = (role_desc or "").upper()
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
    Filtro 1: Deduplica y consolida las asignaciones de supervisión (Caporal).
    Suma líneas redundantes y acota la fracción según el tamaño de cuadrilla activa:
    - Cuadrilla activa <= 12 trabajadores: 0.10 <= Caporal <= 0.25
    - Cuadrilla activa > 12 trabajadores: 0.20 <= Caporal <= 0.50
    """
    if not isinstance(labors, list) or not labors:
        return labors or [], []

    notes: List[str] = []
    supervision_items: List[Dict[str, Any]] = []
    active_workers: List[Dict[str, Any]] = []

    for item in labors:
        if not isinstance(item, dict):
            continue
        desc = str(item.get("descripcion", ""))
        code = str(item.get("codigo", ""))
        if is_supervisory_role(desc, code):
            supervision_items.append(item)
        else:
            active_workers.append(item)

    # Si no hay supervisión, no hay nada que consolidar
    if not supervision_items:
        return labors, notes

    # Calcular el tamaño total de la cuadrilla operativa directa
    total_active_count = sum(float(w.get("cantidad", 1.0) or 1.0) for w in active_workers)

    # Calcular fracción acumulada de supervisión
    total_sup_qty = sum(float(s.get("cantidad", 0.0) or 0.0) for s in supervision_items)

    # Determinar el tope técnico según la normativa de rendimientos
    if total_active_count <= 12.0:
        clamped_sup_qty = min(0.25, max(0.10, total_sup_qty))
    else:
        clamped_sup_qty = min(0.50, max(0.20, total_sup_qty))

    # Seleccionar la línea de supervisión principal (preferir la que tenga código estructurado o tarifas más representativas)
    primary_sup = supervision_items[0].copy()
    for s in supervision_items:
        jornal = float(s.get("jornal", 0.0) or 0.0)
        bono = float(s.get("bono", 0.0) or 0.0)
        if (jornal + bono) > (float(primary_sup.get("jornal", 0.0) or 0.0) + float(primary_sup.get("bono", 0.0) or 0.0)):
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
        "ALBAÑIL", "PINTOR", "PLOMERO", "ELECTRICISTA", "CARPINTERO",
        "CABILLERO", "SOLDADOR", "HERRERO", "MONTADOR", "OXICORTADOR",
        "TECNICO", "MECANICO", "INSTALADOR", "OFICIAL DE 1RA", "OFICIAL"
    ]
    helper_terms = ["AYUDANTE", "OBRERO DE 1RA", "OBRERO", "PEON"]

    specialists: List[Dict[str, Any]] = []
    helpers: List[Dict[str, Any]] = []
    others: List[Dict[str, Any]] = []

    for item in labors:
        desc = str(item.get("descripcion", "")).upper()
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

    # Sustitución de oficios incompatibles para ESTRUCTURAS_METALICAS
    if typology == "ESTRUCTURAS_METALICAS":
        for s in specialists:
            s_desc = str(s.get("descripcion", "")).upper()
            if any(inc in s_desc for inc in ["CABILLERO", "CARPINTERO", "ALBAÑIL", "PLOMERO"]):
                s["descripcion"] = "HERRERO DE 1RA"
                notes.append(f"Oficio especializado calibrado: Se sustituyó cargo incompatible '{s_desc}' de la base por HERRERO DE 1RA.")

    spec_count = sum(float(s.get("cantidad", 1.0) or 1.0) for s in specialists)
    help_count = sum(float(h.get("cantidad", 1.0) or 1.0) for h in helpers)

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
        help_count = sum(float(h.get("cantidad", 1.0) or 1.0) for h in helpers)
        notes.append(f"Cuadrilla equilibrada: Se asignó 1.0 {spec_role} como oficial técnico de frente de trabajo.")

    # Regla: máximo 1.0 ayudante por especialista en trabajos puntuales/mantenimiento, 2.0 en masivos
    max_ratio = 1.0 if typology in ("ESTRUCTURAS_METALICAS", "REPARACIONES_PUNTUALES", "MANTENIMIENTO_ELECTROMECANICO") else 2.0
    max_allowed_helpers = max(1.0, round(spec_count * max_ratio, 1))
    if spec_count > 0 and help_count > max_allowed_helpers:
        # Escalar ayudantes al tope técnico admisible
        scale_ratio = max_allowed_helpers / help_count
        for h in helpers:
            old_qty = float(h.get("cantidad", 1.0) or 1.0)
            h["cantidad"] = max(1.0, round(old_qty * scale_ratio, 1))
        new_help_count = sum(float(h.get("cantidad", 1.0) or 1.0) for h in helpers)
        notes.append(
            f"Proporción de cuadrilla ajustada: Se calibró el ratio ayudante/oficial a {new_help_count/spec_count:.1f} "
            f"({new_help_count:.1f} ayudantes para {spec_count:.1f} especialistas)."
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
            active_labor_count += float(l.get("cantidad", 1.0) or 1.0)

    if active_labor_count <= 0.0:
        active_labor_count = 1.0

    # -----------------------------------------------------------------------
    # CASO A: LOGÍSTICA, TRANSPORTE Y ACARREOS (Circuito Continuo)
    # -----------------------------------------------------------------------
    desc_clean = _normalize_str(description)
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
            had_carretilla = any("CARRETILLA" in str(eq.get("descripcion", "")).upper() for eq in equipments)
            equipments = [eq for eq in equipments if "CARRETILLA" not in str(eq.get("descripcion", "")).upper()]
            if had_carretilla:
                notes.append(
                    "Modalidad de acarreo calibrada: Se eliminaron carretillas por incompatibilidad física con acarreo en interiores/pisos superiores/tobos."
                )

            # 2. Sincronización de tobos (1.5 tobos por obrero activo en circuito de relevo)
            target_tobos = max(2.0, float(round(active_labor_count * 1.5)))
            target_palas = max(1.0, float(round(active_labor_count * 0.25)))

            tobo_item = next((eq for eq in equipments if any(t in str(eq.get("descripcion", "")).upper() for t in ["TOBO", "CUNETE", "SACO", "BOLSA"])), None)
            pala_item = next((eq for eq in equipments if "PALA" in str(eq.get("descripcion", "")).upper()), None)

            if tobo_item is not None:
                curr_tobos = float(tobo_item.get("cantidad", 1.0) or 1.0)
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
                curr_pala = float(pala_item.get("cantidad", 1.0) or 1.0)
                if curr_pala < target_palas:
                    pala_item["cantidad"] = target_palas
                    notes.append(
                        f"Herramientas menores sincronizadas: Palas ajustadas a {target_palas:.0f} unidades para carga de tobos."
                    )

        else:
            # Modalidad en carretilla (terrenos planos / exteriores)
            # 1. Purgar tobos si fueron heredados erróneamente de partidas base de tobo
            had_tobo = any("TOBO" in str(eq.get("descripcion", "")).upper() or "CUNETE" in str(eq.get("descripcion", "")).upper() for eq in equipments)
            equipments = [eq for eq in equipments if "TOBO" not in str(eq.get("descripcion", "")).upper() and "CUNETE" not in str(eq.get("descripcion", "")).upper()]
            if had_tobo:
                notes.append(
                    "Modalidad de acarreo calibrada: Se eliminaron tobos por incompatibilidad física con acarreo plano en carretilla."
                )

            # 2. Sincronizar carretillas (40% de la cuadrilla)
            target_carretillas = max(1.0, float(round(active_labor_count * 0.40)))
            target_palas = max(1.0, float(round(active_labor_count * 0.30)))

            carretilla_item = next((eq for eq in equipments if "CARRETILLA" in str(eq.get("descripcion", "")).upper()), None)
            pala_item = next((eq for eq in equipments if "PALA" in str(eq.get("descripcion", "")).upper()), None)

            if carretilla_item is not None:
                curr_qty = float(carretilla_item.get("cantidad", 1.0) or 1.0)
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
                curr_pala = float(pala_item.get("cantidad", 1.0) or 1.0)
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
            desc_l = str(l.get("descripcion", "")).upper()
            is_helper = any(h in desc_l for h in ["AYUDANTE", "OBRERO", "PEON"])
            if (not is_helper) and any(term in desc_l for term in ["ALBAÑIL", "PINTOR", "FRISADOR"]):
                specialist_count += float(l.get("cantidad", 1.0) or 1.0)

        if specialist_count > 0:
            for eq in equipments:
                desc_e = str(eq.get("descripcion", "")).upper()
                if any(tool in desc_e for tool in ["CUCHARA", "NIVEL", "BROCHA", "RODILLO", "LLANA"]):
                    curr_qty = float(eq.get("cantidad", 1.0) or 1.0)
                    if curr_qty < specialist_count:
                        eq["cantidad"] = specialist_count
                        notes.append(
                            f"Paridad de herramientas 1:1: Ajustada cantidad de '{eq.get('descripcion')}' "
                            f"a {specialist_count:.0f} unidades (una por especialista activo)."
                        )

        # Sincronización de herramientas eléctricas menores de preparación de superficie:
        # Si la pintura incluye decapado, cepillado de óxido o preparación en elementos metálicos:
        desc_c_paint = _normalize_str(description)
        is_metal_prep = any(k in desc_c_paint for k in ["CEPILLADO", "OXIDO", "DECAPADO", "SANEAMIENTO", "PELDANO", "ESCALERA", "BARANDA", "REJA", "ANTICORROSIV", "METALIC"])
        if is_metal_prep:
            # 1. Sustituir esmeril industrial pesado de 7" por amoladora liviana de 4 1/2" para trabajo en sitio
            for eq in equipments:
                d_up = str(eq.get("descripcion", "")).upper()
                if any(h in d_up for h in ["7 PULG", "7\"", "INDUSTRIAL", "BANCO", "TRONCHADORA"]) and any(e in d_up for e in ["ESMERIL", "AMOLADORA"]):
                    eq["codigo"] = "EQU-HER-045"
                    eq["descripcion"] = "AMOLADORA ANGULAR DE 4 1/2 PULG CON CEPILLO DE ALAMBRE"
                    eq["depreciacion"] = 0.01
                    eq["precio_unitario"] = 55.0
                    eq["nota_calculo"] = "Sustituido esmeril industrial de 7\" por amoladora angular portátil de 4 1/2\" con cepillo circular de alambre de acero para trabajo ergonómico en elementos instalados en sitio."
                    notes.append("Herramienta calibrada: Se sustituyó esmeril industrial de 7\" por Amoladora de 4 1/2\" con cepillo de alambre por accesibilidad en sitio.")

            # 2. Si no tiene amoladora o cepillo, incorporar la de 4 1/2"
            has_grinder = any(any(g in str(eq.get("descripcion", "")).upper() for g in ["ESMERIL", "AMOLADORA", "CEPILLO"]) for eq in equipments)
            if not has_grinder:
                equipments.append({
                    "id": "e-ia-amoladora-4y12",
                    "codigo": "EQU-HER-045",
                    "descripcion": "AMOLADORA ANGULAR DE 4 1/2 PULG CON CEPILLO DE ALAMBRE",
                    "unidad": "día",
                    "cantidad": 1.0,
                    "depreciacion": 0.01,
                    "precio_unitario": 55.0,
                    "origen": "historico",
                    "nota_calculo": "Herramienta portátil de 4 1/2 pulg con cepillo circular de alambre de acero para decapado y desprendimiento mecánico de óxido en elementos instalados en sitio."
                })
                notes.append("Herramientas de preparación superficial: Se incorporó Amoladora Angular de 4 1/2\" con cepillo de alambre para desprendimiento mecánico de óxido en sitio.")

    # -----------------------------------------------------------------------
    # CASO D: ESTRUCTURAS METÁLICAS, HERRERÍA Y SOLDADURA
    # -----------------------------------------------------------------------
    elif typology == "ESTRUCTURAS_METALICAS":
        # Contar soldadores activos
        welders_count = sum(float(l.get("cantidad", 1.0) or 1.0) for l in labors if "SOLDADOR" in str(l.get("descripcion", "")).upper())
        if welders_count > 0:
            welder_eq = next((eq for eq in equipments if any(w in str(eq.get("descripcion", "")).upper() for w in ["SOLDADORA", "MAQUINA DE SOLDAR", "MOTO SOLDADOR", "LINCOLN", "INVERSORA"])), None)
            if welder_eq is not None:
                curr_w = float(welder_eq.get("cantidad", 1.0) or 1.0)
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

        # Sincronizar amoladora angular según la escala operativa:
        # A) Mantenimiento, reparación o decapado en elementos instalados en sitio (peldaños, barandas, rejas, marcos):
        #    Amoladora portátil de 4 1/2" con cepillo de alambre de acero.
        # B) Fabricación, montaje o corte pesado de perfiles estructurales en taller/obra:
        #    Esmeril angular / amoladora industrial de 7".
        desc_c = _normalize_str(description)
        is_site_maintenance = any(m in desc_c for m in ["MANTENIMIENTO", "SANEAMIENTO", "REPARACION", "RESTAURACION", "PELDANO", "BARANDA", "REJA", "PINTURA", "ANTICORROSIV"])
        if is_site_maintenance:
            # Sustituir esmeril de 7" por amoladora 4 1/2" con cepillo en sitio
            for eq in equipments:
                d_up = str(eq.get("descripcion", "")).upper()
                if any(h in d_up for h in ["7 PULG", "7\"", "INDUSTRIAL", "BANCO", "TRONCHADORA"]) and any(e in d_up for e in ["ESMERIL", "AMOLADORA"]):
                    eq["codigo"] = "EQU-HER-045"
                    eq["descripcion"] = "AMOLADORA ANGULAR DE 4 1/2 PULG CON CEPILLO DE ALAMBRE"
                    eq["depreciacion"] = 0.01
                    eq["precio_unitario"] = 55.0
                    eq["nota_calculo"] = "Sustituido esmeril industrial de 7\" por amoladora angular portátil de 4 1/2\" con cepillo circular de alambre de acero para trabajo en elementos instalados en sitio."
                    notes.append("Herramienta calibrada: Se sustituyó esmeril industrial de 7\" por Amoladora de 4 1/2\" con cepillo de alambre para mantenimiento en sitio.")

        if any(k in desc_c for k in [
            "CORTE", "DESBASTE", "ESMERIL", "AMOLADORA", "PELDANO", "ZANCA", "TUBO", "PERFIL",
            "PLETINA", "SANEAMIENTO", "CEPILLADO", "ANTICORROSIV", "DECAPADO", "OXIDO"
        ]):
            has_grinder = any(any(g in str(eq.get("descripcion", "")).upper() for g in ["ESMERIL", "AMOLADORA", "TRONCHADORA"]) for eq in equipments)
            if not has_grinder:
                if is_site_maintenance:
                    equipments.append({
                        "id": "e-ia-amoladora-4y12",
                        "codigo": "EQU-HER-045",
                        "descripcion": "AMOLADORA ANGULAR DE 4 1/2 PULG CON CEPILLO DE ALAMBRE",
                        "unidad": "día",
                        "cantidad": 1.0,
                        "depreciacion": 0.01,
                        "precio_unitario": 55.0,
                        "origen": "historico",
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
    # CASO E: LOGÍSTICA INTELIGENTE DE VEHÍCULOS DE APOYO Y CHOFERES
    # -----------------------------------------------------------------------
    # Aplica para trabajos de campo, mantenimiento, herrería y reparaciones en sitio
    is_site_logistics = typology in (
        "ESTRUCTURAS_METALICAS", "REPARACIONES_PUNTUALES", "MANTENIMIENTO_ELECTROMECANICO",
        "PINTURA", "ALBANILERIA", "FRISOS", "SANITARIAS", "ELECTRICAS"
    )

    if is_site_logistics:
        light_terms = ["F-350", "F350", "ESTACAS", "F-150", "F150", "PICK-UP", "PICKUP", "CHEVROLET", "SILVERADO", "HILUX", "D-MAX", "FURGON"]
        heavy_terms = [
            "750", "CAMION 750", "MACK", "CHUTO", "GANDOLA", "VOLTEO", "PERFORADOR",
            "CALDWELL", "MIXER", "CONCRETERA", "GRUA TELESCOPICA", "GRUA 40", "GRUA 50", "GRUA 100"
        ]

        # 1. Detectar y sustituir transporte pesado o maquinaria pesada fuera de escala
        heavy_truck_found = False
        purged_equipments = []
        for eq in equipments:
            eq_desc = str(eq.get("descripcion", "")).upper()
            if any(h in eq_desc for h in heavy_terms):
                heavy_truck_found = True
            else:
                purged_equipments.append(eq)
        equipments = purged_equipments

        if heavy_truck_found:
            has_light = any(any(lv in str(eq.get("descripcion", "")).upper() for lv in light_terms) for eq in equipments)
            if not has_light:
                equipments.append({
                    "id": "e-vehiculo-utilitario-cuadrilla",
                    "codigo": "EQU-PES-054",
                    "descripcion": "CAMION FORD F- 350 ESTACAS",
                    "unidad": "día",
                    "cantidad": 0.25,
                    "depreciacion": 0.004429,
                    "precio_unitario": 96278.52,
                    "origen": "historico",
                    "nota_calculo": "Logística de cuadrilla: Camión F-350 estacas (0.25 día) para transporte de cuadrilla, soldadora, cilindros y herramientas en sitio (degradado de maquinaria pesada de la base)."
                })
                notes.append(
                    "Logística de cuadrilla calibrada: Se sustituyó maquinaria/transporte pesado de la base por Camión F-350 estacas a 0.25 día (adecuado a escala de obra)."
                )

        # 2. Preservar vehículos utilitarios livianos y acotar a escala razonable (0.25 a 0.50 día)
        for eq in equipments:
            eq_desc = str(eq.get("descripcion", "")).upper()
            if any(lv in eq_desc for lv in light_terms):
                curr_qty = float(eq.get("cantidad", 0.0) or 0.0)
                if curr_qty > 0.50:
                    eq["cantidad"] = 0.25
                    notes.append(
                        f"Logística de cuadrilla: Se acotó '{eq.get('descripcion')}' de {curr_qty:.2f} a 0.25 día para soporte logístico en sitio."
                    )
                elif curr_qty <= 0.0:
                    eq["cantidad"] = 0.25

        # 3. Sincronizar al Chofer con el vehículo de apoyo
        has_any_vehicle = any(any(lv in str(eq.get("descripcion", "")).upper() for lv in light_terms) for eq in equipments)
        if has_any_vehicle:
            driver = next((l for l in labors if "CHOFER" in str(l.get("descripcion", "")).upper()), None)
            if driver is not None:
                curr_drv = float(driver.get("cantidad", 0.0) or 0.0)
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
    typology: str
) -> Tuple[Dict[str, Any], List[str]]:
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
        return partida or {}, []

    notes: List[str] = []
    unit = str(partida.get("unit") or partida.get("unidad") or "").strip().lower()
    perf = float(partida.get("performance") or partida.get("rendimiento") or 0.0)

    unit_clean = str(unit or "").strip().lower()
    if unit_clean in ("gl", "sg", "global", "suma global"):
        # INMUNIDAD UNIVERSAL PARA PARTIDAS GLOBALES:
        # El rendimiento es estrictamente determinista por plazo: R = 1.0 / Días de trabajo.
        # NUNCA aplicar benchmarks empíricos de piezas, m2 o m3.
        perf = float(partida.get("performance") or partida.get("rendimiento") or 1.0)
        if perf <= 0.0:
            perf = 1.0
        perf = max(0.05, min(perf, 2.0))
        days_equiv = round(1.0 / perf, 2)
        notes.append(
            f"Rendimiento Global (Gl) certificado: {perf:.4f} Gl/día "
            f"correspondiente a una duración estimada de {days_equiv} días de cuadrilla."
        )
        partida["performance"] = perf
        if "rendimiento" in partida:
            partida["rendimiento"] = perf
        return partida, notes

    # Sumar total de personas en cuadrilla (incluyendo supervisión ponderada)
    total_crew_size = sum(float(l.get("cantidad", 1.0) or 1.0) for l in labors)
    if total_crew_size <= 0.0:
        return partida, notes

    total_hh_per_day = total_crew_size * 8.0

    # Si rendimiento viene en cero o negativo, fijar a un valor razonable
    if perf <= 0.0:
        perf = 10.0

    current_hh = total_hh_per_day / perf

    # 0. Factor de Complejidad Constructiva (Mantenimiento, Saneamiento, Altura)
    desc_clean = _normalize_str(str(partida.get("description") or partida.get("descripcion") or ""))
    is_maintenance = any(k in desc_clean for k in [
        "MANTENIMIENTO", "SANEAMIENTO", "REPARACION", "RECONSTRUCCION", "RESTAURACION",
        "REHABILITACION", "DEMOLICION", "REMOCION", "SUSTITUCION", "REEMPLAZO", "PELDANO"
    ])
    difficulty_factor = 1.30 if is_maintenance else 1.0

    # 1. Buscar benchmark empírico por clave compuesta exacta (ej: ACARREO_m3.m, ALBANILERIA_m2, PINTURA_pza)
    benchmark_key = f"{typology}_{unit}"
    benchmark = EMPERICAL_HH_BENCHMARKS.get(benchmark_key)

    # 1.1 Benchmark especializado para reparaciones y mantenimiento localizado de estructuras metálicas en und/pza
    if typology == "ESTRUCTURAS_METALICAS" and is_maintenance and unit in ("und", "pza"):
        benchmark = {
            "p10": 2.5000,
            "p25": 3.8000,
            "median": 5.2000,
            "p75": 7.0000,
            "p90": 9.5000,
            "rendimiento_med": 5.0,
        }
        difficulty_factor = 1.0

    # Si no coincide exactamente, buscar SOLO dentro de benchmarks compatibles con la MISMA unidad física
    if not benchmark:
        for k, v in EMPERICAL_HH_BENCHMARKS.items():
            if k.endswith(f"_{unit}") and k.startswith(typology):
                benchmark = v
                break

    # Fallback inteligente para unidades discretas (und / pza) si la tipología no tenía clave directa
    if not benchmark and unit in ("und", "pza"):
        if typology in ("ALBANILERIA", "FRISOS", "CONCRETO", "PISOS"):
            benchmark = EMPERICAL_HH_BENCHMARKS.get(f"{typology}_{unit}") or EMPERICAL_HH_BENCHMARKS.get(f"ALBANILERIA_{unit}")
        elif typology == "PINTURA":
            benchmark = EMPERICAL_HH_BENCHMARKS.get(f"PINTURA_{unit}")
        elif typology == "ESTRUCTURAS_METALICAS":
            benchmark = EMPERICAL_HH_BENCHMARKS.get(f"ESTRUCTURAS_METALICAS_{unit}")
        else:
            benchmark = EMPERICAL_HH_BENCHMARKS.get("ALBANILERIA_und")

    # Blindaje dimensional estricto: Si no hay benchmark para esta unidad física exacta,
    # NUNCA cruzar dimensiones (ej. jamás comparar m2 con und, pza o kgf).
    # Conservar el rendimiento propuesto por el analista / LLM y registrar nota explicativa.
    if not benchmark:
        notes.append(
            f"Rendimiento conservado: No se altera el rendimiento ({perf:.2f} {unit}/día) "
            f"para {typology} en '{unit}' para garantizar consistencia dimensional estricta."
        )
        return partida, notes

    p10 = benchmark["p10"]
    p50 = benchmark["median"]
    p90 = benchmark["p90"]

    adjusted_p50 = p50 * difficulty_factor
    lower_bound = p10 * difficulty_factor if is_maintenance else p10 * 0.80
    upper_bound = p90 * 1.30 * difficulty_factor

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

    # -------------------------------------------------------------
    # FUSIBLE BIOMECÁNICO UNIVERSAL (LÍMITES FÍSICOS HUMANOS INFRANQUEABLES)
    # -------------------------------------------------------------
    lead_worker_count = 1.0
    for l in labors:
        desc_l = _normalize_str(l.get("descripcion", ""))
        if any(role in desc_l for role in ["ALBANIL", "PINTOR", "SOLDADOR", "HERRERO", "ELECTRICISTA", "PLOMERO", "CARPINTERO"]):
            lead_worker_count = max(lead_worker_count, float(l.get("cantidad", 1.0) or 1.0))
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
    cap_key = f"{typology}_{unit}"
    max_cap_single = CAPS_PER_LEAD_WORKER.get(cap_key)
    if max_cap_single:
        max_physical_perf = round(max_cap_single * lead_worker_count, 2)
        current_perf_val = float(partida.get("performance") or partida.get("rendimiento") or 0.0)
        if current_perf_val > max_physical_perf:
            notes.append(
                f"Fusible biomecánico activado: Rendimiento acotado de {current_perf_val:.2f} a "
                f"{max_physical_perf:.2f} {unit}/día (límite físico máximo de {max_cap_single:.1f} {unit}/jornada "
                f"para {lead_worker_count:.1f} oficiales líderes)."
            )
            partida["performance"] = max_physical_perf
            if "rendimiento" in partida:
                partida["rendimiento"] = max_physical_perf

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
        covenin = str(partida.get("cod_par") or partida.get("cov_par") or "")

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
        calibrated_partida, hh_notes = validate_and_calibrate_hh(
            partida, balanced_labors, typology
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

        logger.info(
            "Calibración de APU completada satisfactoriamente para tipología '%s' (%d notas técnicas generadas).",
            typology,
            len(all_calibration_notes)
        )

    except Exception as exc:
        logger.error("Error inesperado en calibración de APU: %s", exc, exc_info=True)

    return result
