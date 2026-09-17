import json
import math
import os
import re
import unicodedata
from typing import Any, Dict, List, Optional, Set, Tuple

import yaml

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.logging import logger
from app.db.session import get_db_session
from app.db.models.costbase import (
    CostItem,
    CostMaterial,
    CostLabor,
    CostEquipment,
    CostAPUMaterial,
    CostAPULabor,
    CostAPUEquipment,
)
from app.services.llm_router import call_llm_json
from app.services.apu_labor_calibrator import (
    EMPERICAL_HH_BENCHMARKS,
    classify_activity_typology,
)
from app.services.ai_apu_service import reconcile_equipment_with_database


# ---------------------------------------------------------------------------
# CATÁLOGO CERTIFICADO DE MANO DE OBRA (TABULADOR NACIONAL DE LA CONSTRUCCIÓN)
# ---------------------------------------------------------------------------
CANONICAL_LABOR_ROLES: Dict[str, Dict[str, Any]] = {
    "PINTOR_1RA": {
        "codigo": "19-221",
        "descripcion": "PINTOR DE 1RA",
        "unidad": "día",
        "jornal": 3.02,
        "bono": 3.22,
    },
    "SOLDADOR_1RA": {
        "codigo": "19-7.3",
        "descripcion": "SOLDADOR DE 1RA",
        "unidad": "día",
        "jornal": 3.02,
        "bono": 3.22,
    },
    "HERRERO_1RA": {
        "codigo": "19-7.3",
        "descripcion": "HERRERO DE 1RA",
        "unidad": "día",
        "jornal": 3.02,
        "bono": 3.22,
    },
    "ALBANIL_1RA": {
        "codigo": "19-2.2",
        "descripcion": "ALBAÑIL DE 1RA",
        "unidad": "día",
        "jornal": 3.02,
        "bono": 3.22,
    },
    "CARPINTERO_1RA": {
        "codigo": "19-2.5",
        "descripcion": "CARPINTERO DE 1RA",
        "unidad": "día",
        "jornal": 3.02,
        "bono": 3.22,
    },
    "PLOMERO_1RA": {
        "codigo": "19-211",
        "descripcion": "PLOMERO DE 1RA",
        "unidad": "día",
        "jornal": 3.02,
        "bono": 3.22,
    },
    "ELECTRICISTA_1RA": {
        "codigo": "19-215",
        "descripcion": "ELECTRICISTA DE 1RA",
        "unidad": "día",
        "jornal": 3.02,
        "bono": 3.22,
    },
    "AYUDANTE": {
        "codigo": "1-1.2",
        "descripcion": "AYUDANTE - TABULADOR CONSTRUCCION -N2",
        "unidad": "día",
        "jornal": 2.46,
        "bono": 3.22,
    },
    "OBRERO_1RA": {
        "codigo": "1-1.2",
        "descripcion": "OBRERO DE 1RA",
        "unidad": "día",
        "jornal": 2.46,
        "bono": 3.22,
    },
    "CAPORAL": {
        "codigo": "11-1.3",
        "descripcion": "CAPORAL -N3",
        "unidad": "día",
        "jornal": 2.55,
        "bono": 3.22,
    },
    "CHOFER_1RA": {
        "codigo": "13-3.6",
        "descripcion": "CHOFER DE 1RA ( DE 8 A 15 TON) -N5",
        "unidad": "día",
        "jornal": 3.02,
        "bono": 3.22,
    },
}


def _normalize_string(text: str) -> str:
    """
    Normaliza el texto eliminando acentos y convirtiéndolo a mayúsculas
    para comparaciones seguras en español.
    """
    if not text:
        return ""
    nfkd = unicodedata.normalize("NFKD", text)
    return "".join(c for c in nfkd if not unicodedata.combining(c)).upper().strip()


FAMILY_RULES_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "config",
    "family_rules.yaml"
)

FAMILY_TO_ARCHETYPE_MAP: Dict[str, str] = {
    "EQUIPOS_BOMBEO": "EQUIPOS_BOMBEO",
    "ACARREO": "DEMOLICION_ACARREO",
    "DEMOLICION": "DEMOLICION_ACARREO",
    "PINTURA_RECUBRIMIENTO": "PINTURA_RECUBRIMIENTO",
    "ESTRUCTURAS_METALICAS": "HERRERIA_ESTRUCTURA",
    "CONCRETO": "CONCRETO_VACIADO",
    "ALBANILERIA": "ALBANILERIA_PAREDES",
    "REVESTIMIENTOS": "ALBANILERIA_PAREDES",
    "REPARACIONES_CONCRETO": "ALBANILERIA_PAREDES",
    "INSTALACIONES_HIDRAULICAS": "INSTALACIONES_HIDRAULICAS",
    "INSTALACIONES_ELECTRICAS": "INSTALACIONES_ELECTRICAS",
}


def load_family_rules() -> List[Dict[str, Any]]:
    """
    Carga la matriz ontológica declarativa de reglas de clasificación
    desde el archivo YAML de configuración sin requerir cambios de código.
    """
    if os.path.exists(FAMILY_RULES_PATH):
        try:
            with open(FAMILY_RULES_PATH, "r", encoding="utf-8") as f:
                data = yaml.safe_load(f)
                if isinstance(data, dict):
                    return data.get("rules", []) or []
        except Exception as exc:
            logger.error("Error al cargar reglas ontológicas de family_rules.yaml: %s", exc, exc_info=True)
    return []


def classify_inverse_archetype(description: str, unit: str, covenin_prefix: str = "") -> str:
    """
    Clasifica de forma determinista y extensible la actividad en un Arquetipo Constructivo
    evaluando primero la matriz declarativa (YAML) y aplicando fallback heurístico.
    """
    if not description or not isinstance(description, str):
        raise ValueError("La descripción de la partida no puede estar vacía.")

    desc_clean = _normalize_string(description)
    u_clean = (unit or "").strip().lower()
    cov_clean = _normalize_string(covenin_prefix).replace(".", "").replace("-", "")

    # 0. Evaluación de la Matriz Ontológica Declarativa (Reglas configurables)
    rules = load_family_rules()
    if rules:
        sorted_rules = sorted(rules, key=lambda r: r.get("priority", 999))
        for rule in sorted_rules:
            family = str(rule.get("family", "")).strip()
            keywords = [k.upper() for k in rule.get("keywords", [])]
            actions = [a.upper() for a in rule.get("actions", [])]
            cov_prefixes = [p.upper() for p in rule.get("covenin_prefixes", [])]
            units = [u.lower() for u in rule.get("units", [])]

            score = 0.0
            if any(k in desc_clean for k in keywords):
                score += 0.40
            if any(a in desc_clean for a in actions):
                score += 0.30
            if any(cov_clean.startswith(p) for p in cov_prefixes):
                score += 0.20
            if u_clean and u_clean in units:
                score += 0.10

            if score >= 0.40:
                mapped = FAMILY_TO_ARCHETYPE_MAP.get(family)
                if mapped:
                    return mapped

    # 1. Demoliciones y Desmantelamientos
    if cov_clean.startswith("R1") or cov_clean.startswith("R2") or cov_clean.startswith("R3"):
        return "DEMOLICION_ACARREO"
    if any(k in desc_clean for k in ["DEMOLICION", "DESMANTELAMIENTO", "PICA DE CONCRETO", "PICADO DE", "DEMOLER"]):
        return "DEMOLICION_ACARREO"

    # 2. Acarreos y Transporte Manual
    if "m3.m" in u_clean or "m3xm" in u_clean or "sac.m" in u_clean or "sacxm" in u_clean or any(k in desc_clean for k in ["ACARREO", "BOTE DE ESCOMBRO", "CARRETILLA"]):
        return "DEMOLICION_ACARREO"

    # 3. Equipos de Bombeo e Hidráulica
    if any(k in desc_clean for k in ["BOMBA SUMERGIBLE", "BOMBA CENTRIFUGA", "POZO PROFUNDO", "HIDRONEUMATICO", "EQUIPO DE BOMBEO"]):
        return "EQUIPOS_BOMBEO"

    # 4. Pintura, Esmalte y Tratamientos de Superficie (incluye limpieza y desengrase)
    is_paint = any(k in desc_clean for k in [
        "PINTURA", "ESMALTE", "ANTICORROSIV", "CROMATO", "CONVERTIDOR DE OXIDO",
        "FONDO DE ZINC", "FONDO ANTIALCALINO", "FONDO ANTICORROSIVO", "BARNIZ", "EMPASTADO",
        "LIMPIEZA DE SUPERFICIE", "DESENGRASANTE", "DESMANCHADO", "LAVADO DE SUPERFICIE"
    ])
    has_fabrication = any(k in desc_clean for k in [
        "FABRICACION", "SUMINISTRO Y MONTAJE", "MONTAJE DE ESTRUCTURA", "SOLDADURA ESTRUCTURAL",
        "ARMADO DE ESTRUCTURA"
    ])
    if is_paint and not has_fabrication:
        return "PINTURA_RECUBRIMIENTO"

    # 5. Estructuras Metálicas, Herrería y Soldadura
    if cov_clean.startswith("E36") or cov_clean.startswith("M36") or cov_clean.startswith("R36"):
        return "HERRERIA_ESTRUCTURA"
    if any(k in desc_clean for k in [
        "ESTRUCTURA METALICA", "HERRERIA", "SOLDADURA", "OXICORTE", "BARANDA",
        "PASAMANO", "ESCALERA METALICA", "TUBO ESTRUCTURAL", "PERFIL ESTRUCTURAL",
        "VIGA METALICA", "COLUMNA METALICA", "REJA DE HIERRO", "PORTON METALICO"
    ]):
        return "HERRERIA_ESTRUCTURA"

    # 6. Concreto Estructural
    if cov_clean.startswith("E31") or cov_clean.startswith("E32") or any(k in desc_clean for k in [
        "CONCRETO", "VACIADO DE CONCRETO", "LOSA DE CONCRETO", "VIGA DE CONCRETO", "COLUMNA DE CONCRETO"
    ]):
        return "CONCRETO_VACIADO"

    # 7. Albañilería y Frisos
    if cov_clean.startswith("E41") or any(k in desc_clean for k in [
        "PARED DE BLOQUE", "ALBANILERIA", "FRISO", "REVOQUE", "TABIQUERIA"
    ]):
        return "ALBANILERIA_PAREDES"

    # 8. Instalaciones Sanitarias e Hidráulicas
    if cov_clean.startswith("E5") or any(k in desc_clean for k in [
        "TUBERIA PVC", "AGUAS BLANCAS", "AGUAS SERVIDAS", "BOMBA", "GRIFERIA", "PLOMERIA"
    ]):
        return "INSTALACIONES_HIDRAULICAS"

    # 9. Instalaciones Eléctricas
    if cov_clean.startswith("E6") or any(k in desc_clean for k in [
        "CABLEADO", "TABLERO ELECTRICO", "ACOMETIDA", "TOMACORRIENTE", "ILUMINACION"
    ]):
        return "INSTALACIONES_ELECTRICAS"

    return "GENERAL_CONSTRUCCION"


def build_deterministic_crew(
    archetype: str,
    scale: str = "estándar",
    db: Optional[Session] = None
) -> Tuple[List[Dict[str, Any]], List[str]]:
    """
    Construye de forma 100% determinista la cuadrilla certificada COVENIN
    según el arquetipo técnico y su escala operativa.
    """
    if not archetype or not isinstance(archetype, str):
        raise ValueError("El arquetipo de cuadrilla debe ser una cadena válida.")

    notes: List[str] = []
    crew: List[Dict[str, Any]] = []

    if archetype == "PINTURA_RECUBRIMIENTO":
        # Cuadrilla tipo pintura: 1 Pintor de 1ra + 1 Ayudante + 0.20 Caporal
        crew = [
            {**CANONICAL_LABOR_ROLES["PINTOR_1RA"], "id": "l-1", "cantidad": 1.0, "origen": "historico", "nota_calculo": "Oficial técnico especialista en aplicación y acabados."},
            {**CANONICAL_LABOR_ROLES["AYUDANTE"], "id": "l-2", "cantidad": 1.0, "origen": "historico", "nota_calculo": "Apoyo en preparación de superficie, limpieza y mezclas."},
            {**CANONICAL_LABOR_ROLES["CAPORAL"], "id": "l-3", "cantidad": 0.20, "origen": "historico", "nota_calculo": "Supervisión técnica de frente de trabajo (20% de jornada)."},
        ]
        notes.append("Cuadrilla determinista asignada: 1 Pintor de 1ra + 1 Ayudante + 0.20 Caporal.")

    elif archetype == "HERRERIA_ESTRUCTURA":
        # Cuadrilla tipo herrería: 1 Soldador/Herrero + 1 Ayudante + 0.20 Caporal
        crew = [
            {**CANONICAL_LABOR_ROLES["SOLDADOR_1RA"], "id": "l-1", "cantidad": 1.0, "origen": "historico", "nota_calculo": "Soldador/Herrero calificado para corte, armado y soldadura."},
            {**CANONICAL_LABOR_ROLES["AYUDANTE"], "id": "l-2", "cantidad": 1.0, "origen": "historico", "nota_calculo": "Apoyo en sujeción, desbaste y acarreo de perfiles."},
            {**CANONICAL_LABOR_ROLES["CAPORAL"], "id": "l-3", "cantidad": 0.20, "origen": "historico", "nota_calculo": "Supervisión técnica de seguridad y alineación."},
        ]
        notes.append("Cuadrilla determinista asignada: 1 Soldador de 1ra + 1 Ayudante + 0.20 Caporal.")

    elif archetype == "DEMOLICION_ACARREO":
        # Cuadrilla tipo demolición: 3 Obreros de 1ra + 0.20 Caporal
        crew = [
            {**CANONICAL_LABOR_ROLES["OBRERO_1RA"], "id": "l-1", "cantidad": 3.0, "origen": "historico", "nota_calculo": "Obreros para pica, carga y transporte continuo en carretilla."},
            {**CANONICAL_LABOR_ROLES["CAPORAL"], "id": "l-2", "cantidad": 0.20, "origen": "historico", "nota_calculo": "Supervisión de seguridad y rendimientos de bote."},
        ]
        notes.append("Cuadrilla determinista asignada: 3 Obreros de 1ra + 0.20 Caporal.")

    elif archetype == "CONCRETO_VACIADO":
        # Cuadrilla vaciado: 1 Albañil + 2 Obreros + 0.25 Caporal
        crew = [
            {**CANONICAL_LABOR_ROLES["ALBANIL_1RA"], "id": "l-1", "cantidad": 1.0, "origen": "historico", "nota_calculo": "Nivelación, maestrado y acabado superficial."},
            {**CANONICAL_LABOR_ROLES["OBRERO_1RA"], "id": "l-2", "cantidad": 2.0, "origen": "historico", "nota_calculo": "Vaciado, paleado y vibrado de mezcla."},
            {**CANONICAL_LABOR_ROLES["CAPORAL"], "id": "l-3", "cantidad": 0.25, "origen": "historico", "nota_calculo": "Supervisión de cotas y plomos."},
        ]
        notes.append("Cuadrilla determinista asignada: 1 Albañil de 1ra + 2 Obreros + 0.25 Caporal.")

    elif archetype == "ALBANILERIA_PAREDES":
        # Cuadrilla albañilería: 1 Albañil + 1 Ayudante + 0.20 Caporal
        crew = [
            {**CANONICAL_LABOR_ROLES["ALBANIL_1RA"], "id": "l-1", "cantidad": 1.0, "origen": "historico", "nota_calculo": "Pegado de bloques y aplomado."},
            {**CANONICAL_LABOR_ROLES["AYUDANTE"], "id": "l-2", "cantidad": 1.0, "origen": "historico", "nota_calculo": "Preparación de mortero y acarreo de bloques."},
            {**CANONICAL_LABOR_ROLES["CAPORAL"], "id": "l-3", "cantidad": 0.20, "origen": "historico", "nota_calculo": "Supervisión de alineación y espesor de juntas."},
        ]
        notes.append("Cuadrilla determinista asignada: 1 Albañil de 1ra + 1 Ayudante + 0.20 Caporal.")

    elif archetype in ("EQUIPOS_BOMBEO", "INSTALACIONES_HIDRAULICAS"):
        crew = [
            {**CANONICAL_LABOR_ROLES["PLOMERO_1RA"], "id": "l-1", "cantidad": 1.0, "origen": "historico", "nota_calculo": "Instalación mecánica, conexiones hidráulicas y tuberías."},
            {**CANONICAL_LABOR_ROLES["ELECTRICISTA_1RA"], "id": "l-2", "cantidad": 1.0, "origen": "historico", "nota_calculo": "Conexión de fuerza, tablero de control, mediciones y pruebas eléctricas."},
            {**CANONICAL_LABOR_ROLES["AYUDANTE"], "id": "l-3", "cantidad": 2.0, "origen": "historico", "nota_calculo": "Apoyo en maniobra de descenso, montaje de tuberías y acarreo."},
            {**CANONICAL_LABOR_ROLES["CAPORAL"], "id": "l-4", "cantidad": 0.25, "origen": "historico", "nota_calculo": "Supervisión técnica y verificación de caudales/presiones."},
        ]
        notes.append("Cuadrilla determinista asignada: 1 Plomero de 1ra + 1 Electricista de 1ra + 2 Ayudantes + 0.25 Caporal.")

    elif archetype == "INSTALACIONES_ELECTRICAS":
        crew = [
            {**CANONICAL_LABOR_ROLES["ELECTRICISTA_1RA"], "id": "l-1", "cantidad": 1.0, "origen": "historico", "nota_calculo": "Oficial electricista calificado para canalización, cableado y tableros."},
            {**CANONICAL_LABOR_ROLES["AYUDANTE"], "id": "l-2", "cantidad": 1.0, "origen": "historico", "nota_calculo": "Apoyo en tendido, pase de cables y canalización."},
            {**CANONICAL_LABOR_ROLES["CAPORAL"], "id": "l-3", "cantidad": 0.20, "origen": "historico", "nota_calculo": "Supervisión de diagramas y normas de seguridad eléctrica."},
        ]
        notes.append("Cuadrilla determinista asignada: 1 Electricista de 1ra + 1 Ayudante + 0.20 Caporal.")

    else:
        # Fallback estándar de construcción
        crew = [
            {**CANONICAL_LABOR_ROLES["ALBANIL_1RA"], "id": "l-1", "cantidad": 1.0, "origen": "historico", "nota_calculo": "Oficial técnico calificado."},
            {**CANONICAL_LABOR_ROLES["AYUDANTE"], "id": "l-2", "cantidad": 1.0, "origen": "historico", "nota_calculo": "Ayudante general de obra."},
            {**CANONICAL_LABOR_ROLES["CAPORAL"], "id": "l-3", "cantidad": 0.20, "origen": "historico", "nota_calculo": "Supervisión."},
        ]
        notes.append("Cuadrilla determinista asignada: 1 Oficial + 1 Ayudante + 0.20 Caporal.")

    # Reconciliar con salarios reales de BD si la sesión está disponible
    if db is not None:
        for item in crew:
            cod = item.get("codigo")
            if cod:
                db_l = db.query(CostLabor).filter(CostLabor.CodMan == cod).first()
                if db_l:
                    if db_l.Jornal and db_l.Jornal > 0:
                        item["jornal"] = float(db_l.Jornal)
                    if db_l.Bono and db_l.Bono > 0:
                        item["bono"] = float(db_l.Bono)

    return crew, notes


def calculate_deterministic_performance(
    labors: List[Dict[str, Any]],
    archetype: str,
    unit: str,
    description: str = "",
    is_maintenance: bool = False
) -> Tuple[float, List[str]]:
    """
    Calcula matemáticamente el rendimiento diario de la cuadrilla aplicando
    la fórmula de horas-hombre:
    R = round(Total_HH_activa / median_hh_benchmark, 2).
    Aplica factor de densidad de material, segregación E/R/M y fusible biomecánico
    para garantizar viabilidad física constructiva en obra real.
    """
    if not isinstance(labors, list) or not labors:
        raise ValueError("Se requiere una lista válida de trabajadores para calcular el rendimiento.")
    if not unit or not isinstance(unit, str):
        raise ValueError("La unidad de medida es requerida para el cálculo de rendimiento.")

    notes: List[str] = []
    u_norm = unit.strip().lower()
    desc_clean = _normalize_string(description)

    # 1. Sumar Horas-Hombre del personal activo (excluyendo Caporal de supervisión indirecta)
    active_workers = 0.0
    for l in labors:
        desc = str(l.get("descripcion", "")).upper()
        if "CAPORAL" in desc or "MAESTRO" in desc or "SUPERVIS" in desc:
            continue
        active_workers += float(l.get("cantidad", 1.0) or 1.0)

    total_hh_daily = active_workers * 8.0  # Jornada laboral legal de 8 horas

    # 2. Casos especiales deterministas directos
    if archetype == "EQUIPOS_BOMBEO":
        if u_norm in ("und", "pza", "jgo"):
            ren_bomba = 1.0
            notes.append("Rendimiento determinista de montaje, conexión eléctrica y calibración hidráulica de bomba: 1.0 und/día.")
            return ren_bomba, notes

    # 3. Buscar benchmark empírico derivado de la base de 17.408 partidas
    benchmark_key = ""
    if archetype == "PINTURA_RECUBRIMIENTO":
        if u_norm in ("pza", "und"):
            benchmark_key = f"PINTURA_{u_norm}"
        elif u_norm in ("m", "ml"):
            benchmark_key = "PINTURA_m"
        else:
            benchmark_key = "PINTURA_m2"

    elif archetype == "HERRERIA_ESTRUCTURA":
        if u_norm in ("pza", "und"):
            benchmark_key = f"ESTRUCTURAS_METALICAS_{u_norm}"
        elif u_norm in ("m", "ml"):
            benchmark_key = "ESTRUCTURAS_METALICAS_m"
        elif u_norm in ("kg", "kgf"):
            benchmark_key = "ESTRUCTURAS_METALICAS_kgf"
        else:
            benchmark_key = "ESTRUCTURAS_METALICAS_m2"

    elif archetype == "DEMOLICION_ACARREO":
        if u_norm in ("m3.m", "m3xm", "m3*m"):
            benchmark_key = "ACARREO_m3.m"
        elif u_norm in ("sac.m", "sacxm", "sac*m"):
            benchmark_key = "ACARREO_sac.m"
        elif u_norm in ("m3", "m³"):
            benchmark_key = "DEMOLICION_m3"
        elif u_norm in ("m2", "m²"):
            benchmark_key = "DEMOLICION_m2"
        else:
            benchmark_key = "ACARREO_m3"

    elif archetype == "CONCRETO_VACIADO":
        benchmark_key = "CONCRETO_m3"

    elif archetype == "ALBANILERIA_PAREDES":
        benchmark_key = "ALBANILERIA_m2"

    benchmark = EMPERICAL_HH_BENCHMARKS.get(benchmark_key)
    if benchmark and "median" in benchmark:
        median_hh = benchmark["median"]

        # Factor de densidad en Acarreos m3.m (Piedra bruta/escombro pesado vs material liviano)
        is_heavy_load = False
        if benchmark_key == "ACARREO_m3.m":
            is_heavy_load = any(k in desc_clean for k in [
                "PIEDRA", "ROCA", "CONCRETO", "ESCOMBRO", "PESAD", "BOULDER", "PICA"
            ])
            if is_heavy_load:
                # Mediana empírica para piedra bruta / escombros pesados (partida COVENIN R910132360: ~193.52 m3.m/día)
                median_hh = 0.1240
                notes.append("Factor de densidad aplicado: Material pesado (piedra bruta/escombro) -> 0.1240 HH/(m³·m).")
            else:
                median_hh = 0.0080
                notes.append("Factor de densidad aplicado: Material liviano (tierra, arena, mortero) -> 0.0080 HH/(m³·m).")

        raw_performance = total_hh_daily / median_hh

        # Segregación de Régimen E / R / M:
        # En reparaciones y mantenimiento en sitio, la productividad se reduce un 35% respecto a obra nueva
        if is_maintenance and benchmark_key not in ("ACARREO_m3.m", "ACARREO_sac.m"):
            raw_performance *= 0.65
            notes.append("Ajuste de régimen R/M: -35% por condiciones de intervención y ajuste en sitio.")

        calculated_ren = round(raw_performance, 2)

        # Fusible Biomecánico: Barrera física infranqueable de capacidad humana por obrero por día
        PHYSICAL_CAPS_PER_WORKER: Dict[str, float] = {
            "ACARREO_m3.m_PESADO": 65.0,    # máx 65 m3.m/obrero/día en piedra (para 3 obreros = máx 195 m3.m)
            "ACARREO_m3.m_LIVIANO": 200.0,  # máx 200 m3.m/obrero/día en tierra
            "ACARREO_m3": 4.0,              # máx 4 m3/obrero/día
            "DEMOLICION_m3": 4.0,           # máx 4 m3/obrero/día
            "DEMOLICION_m2": 15.0,          # máx 15 m2/obrero/día
        }

        cap_key = None
        if benchmark_key == "ACARREO_m3.m":
            cap_key = "ACARREO_m3.m_PESADO" if is_heavy_load else "ACARREO_m3.m_LIVIANO"
        elif benchmark_key in PHYSICAL_CAPS_PER_WORKER:
            cap_key = benchmark_key

        if cap_key and cap_key in PHYSICAL_CAPS_PER_WORKER:
            max_limit = round(PHYSICAL_CAPS_PER_WORKER[cap_key] * max(active_workers, 1.0), 2)
            if calculated_ren > max_limit:
                calculated_ren = max_limit
                notes.append(
                    f"Fusible biomecánico activado: Rendimiento acotado a la capacidad física real "
                    f"({max_limit} {unit}/día para {active_workers:.0f} obreros)."
                )

        notes.append(
            f"Rendimiento matemático calculado: {calculated_ren} {unit}/día "
            f"(Total HH activa={total_hh_daily:.1f}h / Mediana={median_hh:.4f} HH/{unit} de {benchmark_key})."
        )
        return calculated_ren, notes

    # 4. Fallbacks empíricos seguros según unidad si no hay benchmark directo
    default_performances: Dict[str, float] = {
        "m2": 25.0,
        "m": 30.0,
        "pza": 16.0,
        "und": 12.0,
        "m3": 8.0,
        "kgf": 500.0,
    }
    fallback_ren = default_performances.get(u_norm, 10.0)
    notes.append(f"Rendimiento asignado por tabulador empírico estándar: {fallback_ren} {unit}/día.")
    return fallback_ren, notes


def build_deterministic_equipments(
    archetype: str,
    description: str,
    labors: List[Dict[str, Any]],
    unit: str,
    db: Optional[Session] = None
) -> Tuple[List[Dict[str, Any]], List[str]]:
    """
    Construye de manera determinista los equipos y herramientas menores
    requeridos para la cuadrilla y la actividad específica.
    """
    if not isinstance(labors, list):
        raise ValueError("Se requiere una lista de mano de obra para calibrar equipos.")

    notes: List[str] = []
    equipments: List[Dict[str, Any]] = []
    desc_clean = _normalize_string(description)

    # Identificar frentes de trabajo especiales
    is_maintenance = any(k in desc_clean for k in [
        "MANTENIMIENTO", "SANEAMIENTO", "REPARACION", "RESTAURACION", "PELDANO",
        "BARANDA", "REJA", "PINTURA", "ANTICORROSIV", "DECAPADO", "CEPILLADO"
    ])

    is_cleaning = any(k in desc_clean for k in ["LIMPIEZA", "DESENGRASANTE", "DESMANCHADO", "DETERGENTE"])

    if archetype == "PINTURA_RECUBRIMIENTO":
        if is_cleaning:
            equipments.append({
                "id": "e-1",
                "codigo": "HER005",
                "descripcion": "HERRAMIENTAS MENORES DE LIMPIEZA (BALDES, CEPILLOS, ESPONJAS, GUANTES)",
                "unidad": "día",
                "cantidad": 1.0,
                "depreciacion": 0.05,
                "precio_unitario": 20.0,
                "origen": "historico",
                "nota_calculo": "Baldes plásticos, cepillos de cerda dura y paños de frotado.",
            })
            notes.append("Herramientas asignadas: Kit de limpieza de superficies (baldes, cepillos y paños).")
        else:
            # 1. Herramientas manuales de pintura
            equipments.append({
                "id": "e-1",
                "codigo": "HER005",
                "descripcion": "HERRAMIENTAS MENORES (PINTURA, BROCHAS, RODILLOS)",
                "unidad": "día",
                "cantidad": 1.0,
                "depreciacion": 0.05,
                "precio_unitario": 25.0,
                "origen": "historico",
                "nota_calculo": "Juego de brochas, rodillos, bandejas y espátulas.",
            })

        # 2. Si es mantenimiento de metal / peldaños con remoción de óxido: Amoladora portátil 4 1/2" con cepillo de alambre
        if (is_maintenance or any(k in desc_clean for k in ["METAL", "PELDANO", "ESCALERA", "BARANDA", "OXIDO"])) and not is_cleaning:
            equipments.append({
                "id": "e-2",
                "codigo": "EQU-HER-045",
                "descripcion": "AMOLADORA ANGULAR DE 4 1/2 PULG CON CEPILLO DE ALAMBRE",
                "unidad": "día",
                "cantidad": 1.0,
                "depreciacion": 0.01,
                "precio_unitario": 55.0,
                "origen": "historico",
                "nota_calculo": "Amoladora portátil de 4 1/2 pulg con cepillo de alambre trenzado para remoción de óxido en elementos instalados.",
            })
            notes.append("Herramienta eléctrica asignada: Amoladora angular 4 1/2 pulg con cepillo circular de alambre de acero.")

    elif archetype == "HERRERIA_ESTRUCTURA":
        # 1. Máquina soldadora
        equipments.append({
            "id": "e-1",
            "codigo": "EQU469",
            "descripcion": "MOTOSOLDADORA 80-575 Amp LINCOLN MOD.SAE-400",
            "unidad": "día",
            "cantidad": 1.0,
            "depreciacion": 0.003,
            "precio_unitario": 1200.0,
            "origen": "historico",
            "nota_calculo": "Máquina de soldar para frentes estructurales de herrería.",
        })
        # 2. Amoladora/Esmeril
        if is_maintenance or "PELDANO" in desc_clean or "BARANDA" in desc_clean:
            equipments.append({
                "id": "e-2",
                "codigo": "EQU-HER-045",
                "descripcion": "AMOLADORA ANGULAR DE 4 1/2 PULG CON CEPILLO DE ALAMBRE",
                "unidad": "día",
                "cantidad": 1.0,
                "depreciacion": 0.01,
                "precio_unitario": 55.0,
                "origen": "historico",
                "nota_calculo": "Amoladora liviana para trabajos puntuales de desbaste y ajuste en sitio.",
            })
        else:
            equipments.append({
                "id": "e-2",
                "codigo": "EQU-7B078D",
                "descripcion": "ESMERIL DE DIAMETRO= 7\"",
                "unidad": "día",
                "cantidad": 1.0,
                "depreciacion": 0.008,
                "precio_unitario": 115.0,
                "origen": "historico",
                "nota_calculo": "Esmeril angular industrial de 7 pulg para corte y biselado de perfiles.",
            })
        # 3. Herramientas menores
        equipments.append({
            "id": "e-3",
            "codigo": "HER001",
            "descripcion": "HERRAMIENTAS MENORES HERRERIA (PRENSAS, ESCUADRAS)",
            "unidad": "día",
            "cantidad": 1.0,
            "depreciacion": 0.05,
            "precio_unitario": 35.0,
            "origen": "historico",
            "nota_calculo": "Prensas tipo C, niveles y escuadras metálicas.",
        })
        notes.append("Equipos deterministas de herrería asignados: Motosoldadora + Esmeril/Amoladora + Herramientas menores.")

    elif archetype == "DEMOLICION_ACARREO":
        # Carretilla, Palas, Pico
        equipments.append({
            "id": "e-1",
            "codigo": "ALB002",
            "descripcion": "CARRETILLA CAP= 55 LT CAUCHOS DE GOMA",
            "unidad": "día",
            "cantidad": 2.0,
            "depreciacion": 0.025,
            "precio_unitario": 187.19,
            "origen": "historico",
            "nota_calculo": "Carretillas para circuito continuo de acarreo y bote.",
        })
        equipments.append({
            "id": "e-2",
            "codigo": "ALB028",
            "descripcion": "PALA REDONDA PUNTA DE ACERO",
            "unidad": "día",
            "cantidad": 2.0,
            "depreciacion": 0.015,
            "precio_unitario": 18.0,
            "origen": "historico",
            "nota_calculo": "Palas para carga y desalojo de escombros.",
        })
        equipments.append({
            "id": "e-3",
            "codigo": "ALB029",
            "descripcion": "PICO DE ACERO CON MANGO DE MADERA",
            "unidad": "día",
            "cantidad": 1.0,
            "depreciacion": 0.015,
            "precio_unitario": 22.0,
            "origen": "historico",
            "nota_calculo": "Pico para descalce y remoción de fragmentos.",
        })
        notes.append("Equipos deterministas asignados: 2 Carretillas + 2 Palas + 1 Pico.")

    elif archetype in ("ALBANILERIA_PAREDES", "CONCRETO_VACIADO"):
        equipments.append({
            "id": "e-1",
            "codigo": "ALB002",
            "descripcion": "CARRETILLA CAP= 55 LT CAUCHOS DE GOMA",
            "unidad": "día",
            "cantidad": 1.0,
            "depreciacion": 0.025,
            "precio_unitario": 187.19,
            "origen": "historico",
            "nota_calculo": "Transporte de mezclas y morteros.",
        })
        equipments.append({
            "id": "e-2",
            "codigo": "ALB007",
            "descripcion": "CUCHARA PLANA PARA ALBAÑILERIA",
            "unidad": "día",
            "cantidad": 1.0,
            "depreciacion": 0.01,
            "precio_unitario": 25.0,
            "origen": "historico",
            "nota_calculo": "Aplicación de mortero y acabados.",
        })
        equipments.append({
            "id": "e-3",
            "codigo": "ALB015",
            "descripcion": "TOBO PLASTICO CAP= 10 LT DE ALBAÑILERIA",
            "unidad": "día",
            "cantidad": 2.0,
            "depreciacion": 0.07,
            "precio_unitario": 15.0,
            "origen": "historico",
            "nota_calculo": "Dosificación de agua y mezclas.",
        })
        if is_maintenance or any(k in desc_clean for k in ["AMOLADORA", "ESMERIL", "CORTE", "DEMOLICION", "REMOCION", "LAMINA"]):
            equipments.append({
                "id": "e-4",
                "codigo": "EQU-HER-045",
                "descripcion": "AMOLADORA PORTATIL DE 4 1/2 PULGADAS 800W",
                "unidad": "día",
                "cantidad": 1.0,
                "depreciacion": 0.02,
                "precio_unitario": 75.0,
                "origen": "historico",
                "nota_calculo": "Corte de perfiles, remoción de láminas corroídas y desbaste.",
            })
        equipments.append({
            "id": "e-5",
            "codigo": "HER001",
            "descripcion": "HERRAMIENTAS MENORES DE ALBAÑILERIA",
            "unidad": "día",
            "cantidad": 1.0,
            "depreciacion": 0.05,
            "precio_unitario": 20.0,
            "origen": "historico",
            "nota_calculo": "Nivel, plomada y llanas.",
        })
        notes.append("Equipos deterministas de albañilería asignados: Carretilla + Cuchara + Tobos + Herramientas menores.")

    else:
        # Fallback general
        equipments.append({
            "id": "e-1",
            "codigo": "HER001",
            "descripcion": "HERRAMIENTAS MENORES (5% MANO DE OBRA)",
            "unidad": "día",
            "cantidad": 1.0,
            "depreciacion": 0.05,
            "precio_unitario": 30.0,
            "origen": "historico",
            "nota_calculo": "Herramientas de mano estándar.",
        })

    # Si hay sesión de BD, reconciliar con la tabla cost360_equipment
    if db is not None:
        mock_result = {"equipments": equipments, "advertencias": []}
        reconcile_equipment_with_database(mock_result, db)
        equipments = mock_result["equipments"]

    return equipments, notes


def extract_materials_recipe_from_db(
    description: str,
    archetype: str,
    unit: str,
    db: Session
) -> Tuple[List[Dict[str, Any]], List[str]]:
    """
    Extrae la receta técnica de materiales directamente desde partidas reales
    de la base de datos (cost360_items y cost360_apu_materials) afines a la actividad,
    adaptando automáticamente las dosificaciones a la unidad de cómputo solicitada.
    """
    if not description or not isinstance(description, str):
        raise ValueError("La descripción es obligatoria para extraer materiales de la BD.")
    if not isinstance(db, Session):
        raise ValueError("Se requiere una sesión SQLAlchemy válida.")

    notes: List[str] = []
    materials: List[Dict[str, Any]] = []
    desc_clean = _normalize_string(description)
    u_norm = unit.strip().lower()

    # 1. Si la actividad es demolición pura o bote manual, no requiere materiales
    if archetype == "DEMOLICION_ACARREO" and not any(k in desc_clean for k in ["RECONSTRUCCION", "REPARACION"]):
        notes.append("Actividad de demolición/acarreo: 0 materiales de consumo requeridos según normativa COVENIN.")
        return [], notes

    # 2. Buscar partidas similares en la base de datos para extraer su dosificación de insumos
    search_terms: List[str] = []
    is_cleaning = any(k in desc_clean for k in ["LIMPIEZA", "DESENGRASANTE", "DESMANCHADO", "DETERGENTE"])
    if is_cleaning:
        search_terms = ["limpieza con solvente", "limpieza de superficie", "limpieza"]
    elif archetype == "PINTURA_RECUBRIMIENTO":
        search_terms = ["esmalte metal", "anticorrosivo", "pintura esmalte", "pintura"]
    elif archetype == "HERRERIA_ESTRUCTURA":
        search_terms = ["baranda", "escalera metalica", "herreria", "tubo"]
    elif archetype == "CONCRETO_VACIADO":
        search_terms = ["concreto r=210", "concreto", "vaciado"]
    elif archetype == "ALBANILERIA_PAREDES":
        search_terms = ["pared bloque", "albanileria", "mortero"]

    candidate_item: Optional[CostItem] = None
    for term in search_terms:
        candidate_item = (
            db.query(CostItem)
            .filter(CostItem.Descri.ilike(f"%{term}%"))
            .filter(CostItem.UniPar.isnot(None))
            .first()
        )
        if candidate_item:
            break

    if candidate_item:
        mat_rows = (
            db.query(CostAPUMaterial, CostMaterial)
            .join(CostMaterial, CostAPUMaterial.CodIns == CostMaterial.CodMat)
            .filter(CostAPUMaterial.CodPar == candidate_item.CodPar)
            .all()
        )

        # Factor de escala según conversión de unidad (ej. m2 a pieza de peldaño 1x0.32m = ~0.8m2)
        scale_factor = 1.0
        base_unit = (candidate_item.UniPar or "").strip().lower()
        if base_unit == "m2" and u_norm in ("pza", "und"):
            # Para peldaños o elementos unitarios, un peldaño tiene ~0.8 m2 de desarrollo superficial
            scale_factor = 0.80
        elif base_unit in ("pza", "und") and u_norm == "m2":
            scale_factor = 1.25

        for idx, (rel, mat) in enumerate(mat_rows):
            pu = float(mat.CosMat or 0.0)
            base_can = float(rel.CanIns or 0.0)
            scaled_can = round(base_can * scale_factor, 4)

            materials.append({
                "id": f"m-{idx+1}",
                "codigo": mat.ref_code or mat.CodMat,
                "descripcion": mat.Descri,
                "unidad": mat.UniMat,
                "cantidad": scaled_can,
                "desperdicio": float(rel.Desper or 0.0),
                "precio_unitario": pu,
                "origen": "historico",
                "nota_calculo": f"Extraído de partida BD [{candidate_item.CodPar}] escalado con factor {scale_factor:.2f} para unidad '{u_norm}'.",
            })

        notes.append(f"Receta de materiales extraída de partida de referencia BD [{candidate_item.CodPar}]: {len(materials)} insumos.")

    # Si es actividad de limpieza de superficies
    if is_cleaning and not materials:
        is_und = u_norm in ("und", "pza", "tramo")
        can_deseng = 0.50 if is_und else 0.05
        can_deterg = 0.30 if is_und else 0.03
        can_estopa = 0.40 if is_und else 0.05

        materials = [
            {
                "id": "m-1",
                "codigo": "QUI035",
                "descripcion": "PRODUCTO QUIMICO DESENGRASANTE INDUSTRIAL",
                "unidad": "lt",
                "cantidad": can_deseng,
                "desperdicio": 3.0,
                "precio_unitario": 5.08,
                "origen": "historico",
                "nota_calculo": f"Dosificación técnica de desengrasante para remoción de grasa en {unit}.",
            },
            {
                "id": "m-2",
                "codigo": "MAU003",
                "descripcion": "DETERGENTE / JABON LIQUIDO CONCENTRADO",
                "unidad": "lt",
                "cantidad": can_deterg,
                "desperdicio": 3.0,
                "precio_unitario": 5.54,
                "origen": "historico",
                "nota_calculo": f"Detergente para lavado y desmanchado de estructura en {unit}.",
            },
            {
                "id": "m-3",
                "codigo": "ESP024",
                "descripcion": "MATERIAL LIMPIEZA: ESTOPA, TRAPOS Y GUANTES",
                "unidad": "sg",
                "cantidad": can_estopa,
                "desperdicio": 5.0,
                "precio_unitario": 2.18,
                "origen": "historico",
                "nota_calculo": "Insumos menores para aplicación, frotado y secado.",
            },
        ]
        notes.append("Receta canónica inyectada: Desengrasante industrial + Detergente líquido + Insumos menores de limpieza.")

    # Si no se extrajeron materiales y el arquetipo es PINTURA, inyectar el set canónico certificado de pintura/fondo
    if not materials and archetype == "PINTURA_RECUBRIMIENTO":
        is_pza = u_norm in ("pza", "und")
        can_pintura = 0.02 if is_pza else 0.08
        can_fondo = 0.015 if is_pza else 0.06
        can_solvente = 0.005 if is_pza else 0.02
        can_lija = 0.50 if is_pza else 1.0

        materials = [
            {
                "id": "m-1",
                "codigo": "PIN034",
                "descripcion": "PINTURA DE ESMALTE SINTETICO TIPO A",
                "unidad": "gln",
                "cantidad": can_pintura,
                "desperdicio": 5.0,
                "precio_unitario": 57.34,
                "origen": "historico",
                "nota_calculo": f"Consumo técnico de esmalte para {unit}.",
            },
            {
                "id": "m-2",
                "codigo": "PIN012",
                "descripcion": "FONDO ANTICORROSIVO ALQUIDICO / CROMATO DE ZINC",
                "unidad": "gln",
                "cantidad": can_fondo,
                "desperdicio": 5.0,
                "precio_unitario": 48.50,
                "origen": "historico",
                "nota_calculo": f"Capa de imprimación anticorrosiva para {unit}.",
            },
            {
                "id": "m-3",
                "codigo": "PIN002",
                "descripcion": "SOLVENTE TIPO THINNER / AGUARRAS MINERAL",
                "unidad": "gln",
                "cantidad": can_solvente,
                "desperdicio": 3.0,
                "precio_unitario": 18.20,
                "origen": "historico",
                "nota_calculo": "Dilución y limpieza técnica de herramientas.",
            },
            {
                "id": "m-4",
                "codigo": "ACA001",
                "descripcion": "LIJA DE ESMERIL PARA METALES PLIEGO",
                "unidad": "plgo",
                "cantidad": can_lija,
                "desperdicio": 5.0,
                "precio_unitario": 1.25,
                "origen": "historico",
                "nota_calculo": "Desbaste manual fino y preparación de anclaje mecánico.",
            },
        ]
        notes.append("Receta canónica inyectada: Esmalte + Fondo anticorrosivo + Solvente + Lija.")

    elif not materials and (archetype in ("ALBANILERIA_PAREDES", "CONCRETO_VACIADO") or any(k in desc_clean for k in ["FRISO", "PEGO", "MORTERO", "LOSA", "CONCRETO"])):
        materials = [
            {
                "id": "m-1",
                "codigo": "MAT-CON-0001",
                "descripcion": "CEMENTO GRIS PORTLAND SACO DE 42,5 KG",
                "unidad": "sco",
                "cantidad": 0.15 if u_norm in ("und", "pza") else 0.25,
                "desperdicio": 5.0,
                "precio_unitario": 9.50,
                "origen": "historico",
                "nota_calculo": f"Cemento para mortero de pega y friso en {unit}.",
            },
            {
                "id": "m-2",
                "codigo": "MAT-CON-0005",
                "descripcion": "ARENA LAVADA PARA FRISO Y ALBAÑILERIA",
                "unidad": "m3",
                "cantidad": 0.015 if u_norm in ("und", "pza") else 0.025,
                "desperdicio": 5.0,
                "precio_unitario": 35.0,
                "origen": "historico",
                "nota_calculo": "Agregado fino para mezcla de mortero.",
            },
            {
                "id": "m-3",
                "codigo": "MAT-VAR-0010",
                "descripcion": "MORTERO ADHESIVO (PEGO GRIS) SACO DE 14 KG",
                "unidad": "sco",
                "cantidad": 0.20 if u_norm in ("und", "pza") else 0.30,
                "desperdicio": 5.0,
                "precio_unitario": 6.50,
                "origen": "historico",
                "nota_calculo": "Adhesivo cementicio para puente de adherencia y nivelación.",
            },
            {
                "id": "m-4",
                "codigo": "MAT-AGU-0001",
                "descripcion": "AGUA PARA CONCRETO Y MEZCLAS",
                "unidad": "m3",
                "cantidad": 0.005,
                "desperdicio": 5.0,
                "precio_unitario": 2.50,
                "origen": "historico",
                "nota_calculo": "Agua de amasado para hidratación de cemento.",
            },
        ]
        if any(k in desc_clean for k in ["AMOLADORA", "DISCO", "CORTE", "LAMINA"]):
            materials.append({
                "id": "m-5",
                "codigo": "MAT-HER-0020",
                "descripcion": "DISCO DE CORTE PARA METALES DE 4 1/2 PULGADAS",
                "unidad": "und",
                "cantidad": 0.15 if u_norm in ("und", "pza") else 0.20,
                "desperdicio": 0.0,
                "precio_unitario": 2.50,
                "origen": "historico",
                "nota_calculo": "Consumible de corte de láminas y desbaste.",
            })
        notes.append("Receta canónica inyectada: Cemento + Arena + Pego gris + Agua + Disco de corte.")

    return materials, notes


def audit_apu_with_llm(
    candidate_apu: Dict[str, Any],
    user_description: str
) -> Dict[str, Any]:
    """
    Paso 6: El LLM actúa como Auditor Técnico / Inspector de Calidad.
    - Cuadrilla (labors) y Rendimiento (performance) están ESTRICTAMENTE BLOQUEADOS.
    - El LLM solo inspecciona materiales y equipos menores por consumibles omitidos
      (ej. lija, solvente, electrodos pedidos expresamente en el texto del usuario).
    """
    if not candidate_apu or not isinstance(candidate_apu, dict):
        raise ValueError("candidate_apu debe ser un diccionario de APU estructurado.")
    if not user_description or not isinstance(user_description, str):
        raise ValueError("user_description es obligatoria para la auditoría.")

    # Extraer valores bloqueados
    locked_performance = float(candidate_apu.get("partida", {}).get("performance", 10.0))
    locked_unit = str(candidate_apu.get("partida", {}).get("unit", "und")).strip().lower()
    locked_labors = candidate_apu.get("labors", [])

    audit_prompt = f"""
# ROL: AUDITOR TÉCNICO DE ANÁLISIS DE PRECIOS UNITARIOS (APU) - COVENIN
Se ha sintetizado un APU por lógica de ingeniería para la siguiente solicitud:
SOLICITUD: "{user_description}"
UNIDAD CERTIFICADA: "{locked_unit}"
RENDIMIENTO MATEMÁTICO BLOQUEADO: {locked_performance} {locked_unit}/día

# APU SINTETIZADO CANDIDATO:
{json.dumps(candidate_apu, ensure_ascii=False, indent=2)}

# REGLAS ESTRICTAS DE AUDITORÍA:
1. RENDIMIENTO Y CUADRILLA INMUTABLES:
   - El rendimiento ({locked_performance}) y la lista de obreros/oficiales (labors) están validados por tabulador nacional y son 100% INMUTABLES. NO los modifiques ni alteres sus cantidades.
2. AUDITORÍA DE MATERIALES:
   - Revisa si la descripción del usuario exige consumibles indispensables no incluidos en la receta de materiales (ej. si pidió expresamente fondo epóxico, solvente, electrodo 7018 o tornillería).
   - Si falta algún material requerido por el texto, agrégalo con origen "ia", consumo coherente para una unidad de '{locked_unit}' y precio referencial de mercado en USD.
3. DESCRIPCIÓN TÉCNICA COVENIN:
   - Asegura que `partida.description` esté completamente en MAYÚSCULAS y redactada según especificación técnica formal COVENIN.
4. ADVERTENCIAS:
   - Si agregas algún material nuevo no contemplado, incluye una advertencia con el prefijo `[PRECIO_REFERENCIAL]`.

Devuelve ÚNICAMENTE el JSON final con la estructura:
{{
    "status": "completed",
    "partida": {{
        "cod_par": "{candidate_apu.get('partida', {}).get('cod_par', 'E360SC001')}",
        "description": "DESCRIPCIÓN EN MAYÚSCULAS...",
        "unit": "{locked_unit}",
        "quantity": 1.0,
        "performance": {locked_performance}
    }},
    "materials": [...],
    "equipments": [...],
    "labors": {json.dumps(locked_labors, ensure_ascii=False)},
    "notas_adaptacion": ["Notas de auditoría..."],
    "advertencias": []
}}
"""
    try:
        audited_result = call_llm_json(audit_prompt, use_case="cost360")
        if audited_result.get("status") == "completed":
            # Forzar invariabilidad de rendimiento y mano de obra
            if audited_result.get("partida"):
                audited_result["partida"]["performance"] = locked_performance
                audited_result["partida"]["unit"] = locked_unit
            audited_result["labors"] = locked_labors
            return audited_result
    except Exception as exc:
        logger.error("Error en auditoría LLM del APU: %s", exc, exc_info=True)

    # Si la llamada al LLM falla o da error, devolver el APU candidato determinista intacto
    return candidate_apu


def synthesize_apu_inverse(
    user_description: str,
    unit: str = "und",
    requested_unit: Optional[str] = None,
    covenin_prefix: str = "",
    smart_answers: Optional[Dict[str, str]] = None,
    db: Optional[Session] = None
) -> Dict[str, Any]:
    """
    Punto de entrada principal para el Sintetizador Inverso de APU (Component-First).
    
    Flujo:
    1. Arquetipo constructivo (Determinista)
    2. Cuadrilla canónica COVENIN (Determinista)
    3. Rendimiento matemático por HH empíricas (Determinista)
    4. Herramientas y equipos por oficio (Determinista)
    5. Extracción de receta de materiales de BD (Determinista / SQL)
    6. Auditoría de calidad e integridad con LLM
    """
    if not user_description or not isinstance(user_description, str):
        raise ValueError("La descripción técnica del usuario no puede estar vacía.")

    raw_u = requested_unit or unit or "und"
    unit_clean = raw_u.strip().lower()
    notes_total: List[str] = []

    # Determinar si es mantenimiento en sitio
    desc_clean = _normalize_string(user_description)
    is_maintenance = any(k in desc_clean for k in [
        "MANTENIMIENTO", "SANEAMIENTO", "REPARACION", "RESTAURACION", "PELDANO",
        "BARANDA", "REJA", "PINTURA", "ANTICORROSIV", "DECAPADO", "CEPILLADO"
    ])

    # Manejo seguro de la sesión de BD
    close_db_on_exit = False
    if db is None:
        db_context = get_db_session()
        db = db_context.__enter__()
        close_db_on_exit = True

    try:
        # Paso 1: Clasificar Arquetipo
        archetype = classify_inverse_archetype(user_description, unit_clean, covenin_prefix)
        notes_total.append(f"Arquetipo clasificado: {archetype}")

        # Paso 2: Construir Cuadrilla Certificada
        labors, crew_notes = build_deterministic_crew(archetype, scale="estándar", db=db)
        notes_total.extend(crew_notes)

        # Paso 3: Calcular Rendimiento Matemático
        performance, ren_notes = calculate_deterministic_performance(
            labors, archetype, unit_clean, description=user_description, is_maintenance=is_maintenance
        )
        notes_total.extend(ren_notes)

        # Paso 4: Construir Equipos por Oficio
        equipments, eq_notes = build_deterministic_equipments(
            archetype, user_description, labors, unit_clean, db=db
        )
        notes_total.extend(eq_notes)

        # Paso 5: Extraer Receta de Materiales de la BD
        materials, mat_notes = extract_materials_recipe_from_db(
            user_description, archetype, unit_clean, db=db
        )
        notes_total.extend(mat_notes)

        # Prefijo formal COVENIN para la partida especial
        prefix_code = covenin_prefix.strip().upper() if covenin_prefix else "E360"
        cod_par = f"{prefix_code}SC001"

        total_crew_size = sum(float(l.get("cantidad", 1.0) or 1.0) for l in labors)
        total_hh_day = round(total_crew_size * 8.0, 2)
        hh_per_unit = round(total_hh_day / performance, 4) if performance > 0 else 0.0

        debug_matematico_trace: Dict[str, Any] = {
            "motor": "Modo Matemático (Síntesis Inversa Component-First)",
            "solicitud_usuario": user_description,
            "arquetipo": archetype,
            "is_maintenance": is_maintenance,
            "unidad_certificada": unit_clean,
            "cuadrilla_matematica": {
                "total_trabajadores": total_crew_size,
                "total_hh_jornada": total_hh_day,
                "labors": labors,
                "notas_cuadrilla": crew_notes
            },
            "rendimiento_matematico": {
                "performance": performance,
                "unidad": unit_clean,
                "hh_por_unidad": hh_per_unit,
                "notas_calculo": ren_notes
            },
            "equipos": equipments,
            "materiales": materials,
            "notas_sintesis": notes_total
        }

        candidate_apu: Dict[str, Any] = {
            "status": "completed",
            "clarification_message": None,
            "options": [],
            "questions": [],
            "guia_redaccion": None,
            "partida": {
                "cod_par": cod_par,
                "description": _normalize_string(user_description),
                "unit": unit_clean,
                "quantity": 1.0,
                "performance": performance,
            },
            "materials": materials,
            "equipments": equipments,
            "labors": labors,
            "notas_adaptacion": notes_total,
            "advertencias": [],
            "debug_matematico_trace": debug_matematico_trace
        }

        # Paso 6: Auditoría con LLM
        final_apu = audit_apu_with_llm(candidate_apu, user_description)
        final_apu["debug_matematico_trace"] = debug_matematico_trace
        return final_apu

    finally:
        if close_db_on_exit and db is not None:
            db_context.__exit__(None, None, None)
