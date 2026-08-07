from pydantic import BaseModel
from typing import Dict, Any, Optional, List
from datetime import datetime

class LosaCalculationRunBase(BaseModel):
    nombre_proyecto: str
    tipo_losa: str
    inputs: Dict[str, Any]
    resultados: Dict[str, Any]

class LosaCalculationRunCreate(LosaCalculationRunBase):
    pass

class LosaCalculationRunResponse(LosaCalculationRunBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

class MamposteriaCalculationRunBase(BaseModel):
    nombre_proyecto: str
    inputs: Dict[str, Any]
    resultados: Dict[str, Any]

class MamposteriaCalculationRunCreate(MamposteriaCalculationRunBase):
    pass

class MamposteriaCalculationRunResponse(MamposteriaCalculationRunBase):
    id: int
    user_id: int
    created_at: datetime

    class Config:
        from_attributes = True

# ============ SCHEMAS LOSA DE CIMENTACIÓN ============

class GeometryInput(BaseModel):
    Lx: float
    Ly: float
    h: float

class OpeningInput(BaseModel):
    type: str = "door" # "door" o "window"
    start_m: float
    width_m: float
    height_m: float

class WallInput(BaseModel):
    x1: float
    y1: float
    x2: float
    y2: float
    thickness: float
    height: float
    density: float
    type: str = "perimetral"
    load_factor: float = 1.5
    is_plastered: bool = False
    openings: List[OpeningInput] = []

class BeamInput(BaseModel):
    x1: float
    y1: float
    x2: float
    y2: float
    width: float
    height: float
    type: str = "zuncho"
    load_factor: float = 1.2

class ColumnInput(BaseModel):
    x: float
    y: float
    width: float
    length: float
    height: float
    load_kgf: float
    id: str = ""

class DoorInput(BaseModel):
    wallId: int
    width: float
    x: float
    y: float

class MaterialsInput(BaseModel):
    f_c: float = 25
    f_y: float = 420
    cover: float = 0.05
    bar_diam: float = 0.012
    gamma_horm: float = 2400
    E: float = 25e9
    nu: float = 0.2
    k: float = 20e6
    q_adm: float = 150000.0  # Capacidad portante N/m2 (default 1.5 kg/cm2)
    band_width_m: float = 0.0
    custom_mesh_cm2_m: float = 0.0

class RetainingWallInput(BaseModel):
    x1: float
    y1: float
    x2: float
    y2: float
    thickness: float
    soil_height: float
    soil_density: float = 18000.0 # N/m3
    phi: float = 30.0 # degrees
    perimeter_wall_height: float = 0.0
    id: str = ""

class SupportBeamInput(BaseModel):
    x1: float
    y1: float
    x2: float
    y2: float
    width: float
    depth: float
    id: str = ""

class SlabModelInput(BaseModel):
    project: str = "Losa de Cimentación"
    geometry: GeometryInput
    materials: MaterialsInput = MaterialsInput()
    walls: List[WallInput]
    beams: List[BeamInput] = []
    columns: List[ColumnInput] = []
    doors: List[DoorInput] = []
    retaining_walls: List[RetainingWallInput] = []
    support_beams: List[SupportBeamInput] = []
    mesh_nx: int = 40
    mesh_ny: int = 40
    band_width_factor: float = 1.0
    max_settlement_ratio: float = 500.0
    extra_load: float = 0.0  # N/m2 adicional (piso + sobrecarga)

