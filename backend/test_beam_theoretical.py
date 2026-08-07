import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.schemas.fea3d import Topology, Node, Element, Material, Section, LoadAssignment, LoadCombination, Restraint, LoadType
from app.engine.solvers import StructuralSolver
import numpy as np
import json

def run_test():
    # Viga de 5m
    L = 5.0
    nodes = [
        Node(id="1", x=0, y=0, z=0, restraint=Restraint(ux=True, uy=True, uz=True, rx=True, ry=True, rz=True)),
        Node(id="2", x=L, y=0, z=0, restraint=Restraint(ux=True, uy=True, uz=True, rx=True, ry=True, rz=True))
    ]
    
    materials = [
        Material(id="conc", name="Concreto", E=25e9, G=10.4e9, nu=0.2, density=0) # density=0 to ignore self-weight for this test
    ]
    
    sections = [
        Section(id="beam", name="Beam", A=0.12, Iy=0.0016, Ix=0.0009, J=0.001, params={})
    ]
    
    elements = [
        Element(id="1", type="frame", nodes=["1", "2"], material_id="conc", section_id="beam", beta_angle=0)
    ]
    
    # Carga distribuida de -1000 N/m en Z (Uniforme en toda la viga)
    q = -1000.0
    loads = [
        LoadAssignment(id="L1", target_id="1", type=LoadType.DISTRIBUTED, direction="Z", magnitude=0, fx=0, fy=0, fz=q, load_case="CV")
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
    
    # Resultados Computados
    combo_res = res["results"]["combo-test"]
    stations = combo_res["element_forces"]["1"]
    
    v3_start = stations[0]["V3"]
    v3_end = stations[-1]["V3"]
    m2_start = stations[0]["M2"]
    m2_end = stations[-1]["M2"]
    m2_center = stations[10]["M2"] # Station 10 is at L/2 (2.5m)
    
    # Valores Teóricos (Viga empotrada con carga distribuida)
    # Reacciones:
    # R1 = wL/2 (hacia arriba) -> Cortante V3 = +wL/2 = +2500
    # M1 = -wL^2/12 (Tensión arriba, depende de convencion, usualmente -2083.33)
    # M_center = wL^2/24 (Tensión abajo, +1041.67)
    
    v3_start_teo = -q * L / 2
    v3_end_teo = q * L / 2
    m2_start_teo = q * L**2 / 12
    m2_center_teo = -q * L**2 / 24
    
    print("\n" + "="*50)
    print("  CALIBRACIÓN VIGA EMPOTRADA (Carga Z = -1000 N/m)")
    print("="*50)
    print(f"{'Parámetro':<20} | {'Teórico':<12} | {'ARKO3D':<12} | {'Error %'}")
    print("-" * 50)
    
    def print_row(name, teo, calc):
        error = abs((calc - teo)/teo)*100 if teo != 0 else (0 if calc == 0 else 100)
        print(f"{name:<20} | {teo:>12.2f} | {calc:>12.2f} | {error:>6.2f}%")
        
    print_row("Cortante Extremo 1", v3_start_teo, v3_start)
    print_row("Cortante Extremo 2", v3_end_teo, v3_end)
    print_row("Momento Extremo 1", m2_start_teo, m2_start)
    print_row("Momento Centro", m2_center_teo, m2_center)
    print_row("Momento Extremo 2", m2_start_teo, m2_end)
    print("="*50 + "\n")

if __name__ == "__main__":
    run_test()
