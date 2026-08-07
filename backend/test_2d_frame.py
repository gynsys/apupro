import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.schemas.fea3d import Topology, Node, Element, Material, Section, LoadAssignment, LoadCombination, Restraint, LoadType
from app.engine.solvers import StructuralSolver
import numpy as np

def run_test():
    # 1 bay of 5m width, 1 floor of 3m height
    nodes = [
        Node(id="1", x=0, y=0, z=0, restraint=Restraint(ux=True, uy=True, uz=True, rx=True, ry=True, rz=True)),
        Node(id="2", x=5, y=0, z=0, restraint=Restraint(ux=True, uy=True, uz=True, rx=True, ry=True, rz=True)),
        Node(id="3", x=0, y=0, z=3, restraint=None),
        Node(id="4", x=5, y=0, z=3, restraint=None)
    ]
    
    # Material E=25 GPa
    materials = [
        Material(id="conc", name="Concreto", E=25e9, G=10.4e9, nu=0.2, density=2400)
    ]
    
    # Typical columns 40x40cm, Beams 30x40cm
    # A_col = 0.16, Ix = Iy = 0.002133
    sections = [
        Section(id="col", name="Col", A=0.16, Iy=0.002133, Ix=0.002133, J=0.003, params={}),
        Section(id="beam", name="Beam", A=0.12, Iy=0.0016, Ix=0.0009, J=0.001, params={})
    ]
    
    elements = [
        Element(id="1", type="frame", nodes=["1", "3"], material_id="conc", section_id="col"),
        Element(id="2", type="frame", nodes=["2", "4"], material_id="conc", section_id="col"),
        Element(id="3", type="frame", nodes=["3", "4"], material_id="conc", section_id="beam")
    ]
    
    # 100 kN (100000 N) lateral force at node 3 in +X direction
    # We will use "CV" and combination 1.0 CV
    loads = [
        LoadAssignment(id="L1", target_id="3", type=LoadType.POINT, direction="X", magnitude=100000, fx=100000, load_case="CV")
    ]
    
    combos = [
        LoadCombination(id="combo-test", name="1.0 CV", factors={"CM": 0.0, "CV": 1.0})
    ]
    
    topo = Topology(
        nodes=nodes,
        elements=elements,
        materials=materials,
        sections=sections,
        loads=loads,
        combinations=combos
    )
    
    solver = StructuralSolver(topo)
    res = solver.solve()
    
    print("--- 2D PORTAL FRAME RESULTS ---")
    print(res)

if __name__ == "__main__":
    run_test()
