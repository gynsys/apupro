"""
foundation/models.py
Data-only module: plain dataclasses shared across all foundation engine modules.

Units: N, m, Pa, MPa
"""

from dataclasses import dataclass
from typing import Dict, List


@dataclass
class Wall:
    x1: float
    y1: float
    x2: float
    y2: float
    thickness: float
    height: float
    density: float
    load_factor: float
    wall_type: str
    q_lineal: float = 0.0
    length: float = 0.0
    band_width: float = 0.0
    q_corona_kgf_m: float = 0.0
    openings: List[Dict] = None
    is_plastered: bool = False

    def __post_init__(self) -> None:
        if self.openings is None:
            self.openings = []


@dataclass
class Beam:
    x1: float
    y1: float
    x2: float
    y2: float
    width: float
    height: float
    load_factor: float
    beam_type: str
    q_self: float = 0.0
    length: float = 0.0


@dataclass
class Column:
    x: float
    y: float
    width: float
    length: float
    height: float
    load_kgf: float
    P_u: float = 0.0   # Carga última en N
    id: str = ""

@dataclass
class RetainingWall:
    x1: float
    y1: float
    x2: float
    y2: float
    thickness: float
    soil_height: float
    soil_density: float
    phi: float
    perimeter_wall_height: float
    length: float = 0.0
    q_vertical: float = 0.0
    m_overturning: float = 0.0
    v_base: float = 0.0
    id: str = ""

@dataclass
class SupportBeam:
    x1: float
    y1: float
    x2: float
    y2: float
    width: float
    depth: float
    length: float = 0.0
    I_beam: float = 0.0
    id: str = ""
