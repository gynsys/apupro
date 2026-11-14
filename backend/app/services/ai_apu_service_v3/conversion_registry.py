"""
Registro de conversiones e indicaciones por defecto a toneladas para macro partidas (Motor v3.0).

1. Densidades tomadas de tablas de literatura de ingenieria (pesos unitarios de materiales de
   construccion y escombros). Se modelan dos estados:
     - "en_sitio": material macizo, antes de demolerse (concreto armado 2,4 t/m3).
     - "suelto": material fragmentado en camion/contenedor = densidad en sitio / esponjamiento
       (coeficiente tipico 1,2 a 1,4 segun la literatura).

2. Biblioteca de indicaciones por defecto (unidades de sub-partida por tonelada o toneladas por
   unidad de sub-partida) basada en literatura de generacion de RCD y practica de ingenieria de
   costos cuando el usuario solo dispone del tonelaje total. Siempre se declaran como supuestos
   editables.
"""

import re
from dataclasses import dataclass
from typing import Dict, Optional, Pattern, Tuple


class MissingConversionData(ValueError):
    """Falta un dato clave del usuario para convertir una actividad a la unidad maestra."""

    def __init__(self, param_key: str, message: str) -> None:
        super().__init__(message)
        self.param_key = param_key


@dataclass(frozen=True)
class MaterialDensity:
    label: str
    insitu_t_m3: Optional[float]   # None si el material solo existe en estado suelto
    swell_factor: float            # volumen suelto / volumen en sitio
    loose_direct_t_m3: Optional[float]  # valor suelto directo de la literatura si aplica
    range_note: str


MATERIAL_DENSITIES: Dict[str, MaterialDensity] = {
    "concreto_armado": MaterialDensity("Concreto armado", 2.4, 1.3, None, "2,4 t/m3 (macizo)"),
    "concreto_simple": MaterialDensity("Concreto simple", 2.3, 1.3, None, "2,3 t/m3 (macizo)"),
    "mamposteria_bloque_concreto": MaterialDensity(
        "Mamposteria de bloques de concreto", 1.9, 1.3, None, "1,7 a 2,15 t/m3"
    ),
    "mamposteria_ladrillo": MaterialDensity("Mamposteria de ladrillo", 1.6, 1.3, None, "1,4 a 1,85 t/m3"),
    "mamposteria_piedra": MaterialDensity("Mamposteria de piedra", 2.2, 1.3, None, "2,2 t/m3"),
    "mortero": MaterialDensity("Mortero", 2.1, 1.3, None, "2,1 t/m3"),
    "tierra": MaterialDensity("Tierra / suelo", 1.8, 1.25, None, "compacta 1,7 a 1,9 t/m3; suelta 1,2 a 1,5 t/m3"),
    "arena": MaterialDensity("Arena seca", 1.65, 1.0, None, "1,6 a 1,7 t/m3 a granel"),
    "grava": MaterialDensity("Grava", 1.6, 1.0, None, "1,5 a 1,7 t/m3 a granel"),
    "acero": MaterialDensity("Acero", 7.8, 1.0, None, "7,8 t/m3"),
    "madera": MaterialDensity("Madera", 0.72, 1.0, None, "0,65 a 0,8 t/m3"),
    "escombro_mixto": MaterialDensity(
        "Escombro mixto de demolicion", None, 1.0, 1.35, "suelto 1,2 a 1,5 t/m3"
    ),
}

STATE_IN_SITU = "en_sitio"
STATE_LOOSE = "suelto"


def density_for(material: str, state: str) -> Tuple[float, str]:
    """
    Devuelve (densidad t/m3, nota de fuente) para el material y estado.
    Lanza MissingConversionData si el material no esta en la tabla o no hay valor para el estado.
    """
    key = str(material or "").strip().lower()
    entry = MATERIAL_DENSITIES.get(key)
    if entry is None:
        raise MissingConversionData(
            "density_t_per_m3",
            f"Material '{material}' no esta en la tabla de densidades. Indica la densidad (t/m3) "
            f"o elige uno de: {', '.join(sorted(MATERIAL_DENSITIES))}.",
        )
    st = str(state or "").strip().lower()
    if st == STATE_IN_SITU:
        if entry.insitu_t_m3 is None:
            # Si es escombro_mixto en_sitio, usamos la referencia de edificacion mixta (concreto + mamposteria ~ 2.0 t/m3)
            if key == "escombro_mixto":
                return 2.0, "Edificacion mixta concreto/mamposteria en sitio: ~2,0 t/m3 (promedio 1,6 a 2,4 t/m3)"
            raise MissingConversionData(
                "density_t_per_m3",
                f"'{entry.label}' no tiene densidad en sitio en la tabla. Indica el material "
                "predominante (ej. concreto armado, mamposteria) o la densidad en t/m3.",
            )
        return entry.insitu_t_m3, f"{entry.label} en sitio: {entry.range_note}"
    if st == STATE_LOOSE:
        if entry.loose_direct_t_m3 is not None:
            return entry.loose_direct_t_m3, f"{entry.label} suelto: {entry.range_note}"
        if entry.insitu_t_m3 is None:
            raise MissingConversionData(
                "density_t_per_m3",
                f"'{entry.label}' no tiene densidad suelta ni en sitio en la tabla. Indica la densidad (t/m3).",
            )
        value = round(entry.insitu_t_m3 / entry.swell_factor, 4)
        return value, (
            f"{entry.label} suelto = {entry.insitu_t_m3:g} / esponjamiento {entry.swell_factor:g} "
            f"({entry.range_note})"
        )
    raise MissingConversionData(
        "density_t_per_m3",
        f"Estado '{state}' invalido para convertir volumen a toneladas (use en_sitio o suelto).",
    )


@dataclass(frozen=True)
class DefaultIndicator:
    key: str
    description_pattern: Pattern[str]
    unit: str
    units_per_ton: float
    source: str


# Biblioteca de indicaciones por defecto expresadas en `unidades_de_subpartida / tonelada`.
INDICATOR_LIBRARY: Tuple[DefaultIndicator, ...] = (
    DefaultIndicator(
        key="demolicion_edificio_por_area_construida",
        description_pattern=re.compile(r"demolici\w*\s+(?:integral|mecanica|de\s+edificio|edificaci\w*)", re.IGNORECASE),
        unit="m2",
        units_per_ton=round(1.0 / 0.90, 4),  # ~1.1111 m2 / ton (0.90 t/m2 de área construida)
        source=(
            "1,1111 m2/ton equivalentes a 0,90 t/m2 de area construida "
            "(literatura RCD edificaciones de concreto armado: 0,60 a 1,15 t/m2)"
        ),
    ),
    DefaultIndicator(
        key="demolicion_paredes_mamposteria_m2",
        description_pattern=re.compile(r"demolici\w*.*\b(pared\w*|muro\w*|tabique\w*|mamposter\w*)", re.IGNORECASE),
        unit="m2",
        units_per_ton=round(1.0 / 0.27, 4),  # pared e=15cm ~ 0.27 t/m2 -> 3.7037 m2/ton
        source=(
            "3,7037 m2/ton equivalentes a ~0,27 t/m2 de pared de bloque/ladrillo e=15cm con friso "
            "(literatura pesos unitarios mamposteria: 1,8 t/m3 x 0,15 m)"
        ),
    ),
    DefaultIndicator(
        key="apuntalamiento_temporal_m2",
        description_pattern=re.compile(r"\b(apuntal\w*|entibad\w*|acodal\w*|sostenimiento)", re.IGNORECASE),
        unit="m2",
        units_per_ton=0.12,  # ~10% del área construida requiere apuntalamiento temporal (~0.12 m2/ton)
        source=(
            "0,12 m2/ton de apuntalamiento temporal preventivo (~10% del area construida a 0,90 t/m2; "
            "supuesto editable segun patologia estructural)"
        ),
    ),
    DefaultIndicator(
        key="corte_especializado_m2",
        description_pattern=re.compile(r"\bcorte\b", re.IGNORECASE),
        unit="m2",
        units_per_ton=0.05,  # sección de corte en nudos/juntas críticas por tonelada demolida
        source=(
            "0,05 m2/ton de seccion de corte especializado en juntas y nudos estructurales "
            "(~1 corte de 0,30x0,40 m cada 2,4 ton de elemento macizo; supuesto editable)"
        ),
    ),
    DefaultIndicator(
        key="corte_especializado_m",
        description_pattern=re.compile(r"\bcorte\b", re.IGNORECASE),
        unit="m",
        units_per_ton=0.20,
        source=(
            "0,20 m/ton de corte lineal especializado en elementos estructurales "
            "(supuesto editable)"
        ),
    ),
    DefaultIndicator(
        key="corte_especializado_und",
        description_pattern=re.compile(r"\bcorte\b", re.IGNORECASE),
        unit="und",
        units_per_ton=0.10,
        source=(
            "0,10 und/ton de cortes puntuales especializados en elementos estructurales "
            "(supuesto editable)"
        ),
    ),
    DefaultIndicator(
        key="acarreo_escombros_m3xm",
        description_pattern=re.compile(r"\b(acarreo|carga|manipulaci\w*|transporte|bote)\b", re.IGNORECASE),
        unit="m3xm",
        units_per_ton=round((1.0 / 1.35) * 20.0, 4),  # 0.7407 m3/ton * 20 m distancia media en patio = 14.8148 m3xm/ton
        source=(
            "14,8148 m3xm/ton (0,7407 m3/ton de escombro suelto a 1,35 t/m3 x 20 m de distancia media "
            "de manipulacion interna; supuesto editable)"
        ),
    ),
    DefaultIndicator(
        key="transporte_carga_escombros_vje",
        description_pattern=re.compile(r"\b(acarreo|carga|transporte|bote|viaje|escombro\w*)\b", re.IGNORECASE),
        unit="vje",
        units_per_ton=0.10,  # Camión volteo estándar ~8 m3 sueltos (~10 ton/viaje) -> 0.10 vje/ton
        source=(
            "0,10 vje/ton equivalentes a 10 ton de escombro suelto por viaje de camion volteo de ~8 m3 "
            "(supuesto editable segun capacidad del camion)"
        ),
    ),
)


def lookup_default_indicator(
    activity_description: str,
    base_description: str,
    unit: str,
) -> Optional[DefaultIndicator]:
    """
    Busca una indicacion por defecto que aplique a la sub-partida (evaluando la descripcion
    de la actividad y la de la base elegida) para la unidad dada.
    """
    u = (
        str(unit or "")
        .strip()
        .lower()
        .replace("\u00b2", "2")
        .replace("\u00b3", "3")
        .replace(".", "x")
        .replace("-", "x")
    )
    combined = f"{activity_description or ''} | {base_description or ''}"
    for entry in INDICATOR_LIBRARY:
        if entry.unit == u and entry.description_pattern.search(combined):
            return entry
    return None
