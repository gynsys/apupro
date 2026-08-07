from pydantic import BaseModel, Field
from typing import List, Dict, Optional
from enum import Enum

class LoadType(str, Enum):
    POINT = "point"
    DISTRIBUTED = "distributed"
    AREA = "area"

class Restraint(BaseModel):
    ux: bool = False
    uy: bool = False
    uz: bool = False
    rx: bool = False
    ry: bool = False
    rz: bool = False

class Node(BaseModel):
    id: str
    x: float
    y: float
    z: float
    restraint: Optional[Restraint] = None

class Element(BaseModel):
    id: str
    type: str # "frame"
    nodes: List[str]
    section_id: str
    material_id: str
    beta_angle: float = 0.0

class ShellLoads(BaseModel):
    CM: float = 0.0
    CV: float = 0.0

class MeshNode(BaseModel):
    id: str
    x: float
    y: float
    z: float

class MeshElement(BaseModel):
    id: str
    type: str # "quad" or "triangle"
    nodeIds: List[str]

class Mesh(BaseModel):
    nodes: List[MeshNode]
    elements: List[MeshElement]

class Shell(BaseModel):
    id: str
    type: str = "shell"
    nodes: List[str]
    thickness: float
    material_id: str
    loads: ShellLoads
    mesh: Optional[Mesh] = None

class LoadCombination(BaseModel):
    id: str
    name: str
    factors: Dict[str, float] # e.g. {"CM": 1.2, "CV": 1.6}

class LoadAssignment(BaseModel):
    id: str
    type: str
    target_id: str # ID del nudo o elemento
    fx: float = 0.0
    fy: float = 0.0
    fz: float = 0.0
    mx: float = 0.0
    my: float = 0.0
    mz: float = 0.0
    load_case: str = "Dead"
    offset: float = 0.5 # Para cargas puntuales en elementos (0 a 1)
    offset_x: float = 0.0 # Posición absoluta X para shells
    offset_y: float = 0.0 # Posición absoluta Y para shells
    end_x: float = 0.0 # Coordenada fin X para cargas de área en shells
    end_y: float = 0.0 # Coordenada fin Y para cargas de área en shells

class Material(BaseModel):
    id: str
    E: float
    G: float
    nu: float
    density: float

class Section(BaseModel):
    id: str
    A: float
    Ix: float
    Iy: float
    J: float
    params: Dict[str, float] # {"b": 0.3, "h": 0.5}

class Topology(BaseModel):
    nodes: List[Node]
    elements: List[Element]
    shells: List[Shell] = []
    materials: List[Material]
    sections: List[Section]
    loads: List[LoadAssignment] = []
    combinations: List[LoadCombination] = []

class ProjectResults(BaseModel):
    displacements: Dict[str, List[float]]
    element_forces: Dict[str, Dict]
    shell_forces: Optional[Dict[str, Dict]] = None
    design_checks: Dict[str, Dict]