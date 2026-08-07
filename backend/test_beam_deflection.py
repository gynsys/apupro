import sys
import os
sys.path.insert(0, '.')

from app.schemas.fea3d import Topology, Node, Element, Material, Section, LoadAssignment, LoadCombination, Restraint, LoadType
from app.engine.solvers import StructuralSolver

# Pinned-Pinned Beam of 5m
nodes = [
    Node(id="1", x=0, y=0, z=0, restraint=Restraint(ux=True, uy=True, uz=True, rx=True, ry=False, rz=False)),
    Node(id="2", x=5, y=0, z=0, restraint=Restraint(ux=True, uy=True, uz=True, rx=True, ry=False, rz=False))
]

materials = [
    Material(id="conc", name="Concreto", E=25e9, G=10.4e9, nu=0.2, density=0)
]

sections = [
    Section(id="beam", name="Beam", A=0.12, Iy=0.0016, Ix=0.0009, J=0.001, params={})
]

elements = [
    Element(id="1", type="frame", nodes=["1", "2"], material_id="conc", section_id="beam", beta_angle=0)
]

# Downward distributed load of -1000 N/m in Z
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
combo_res = res["results"]["combo-test"]

# We want to look at the displacements at the nodes and the intermediate stations
displacements = combo_res["displacements"]
print("\n=== Node Displacements ===")
print(f"Node 1: {displacements.get('1')}")
print(f"Node 2: {displacements.get('2')}")

print("\n=== Beam Stations Deflections ===")
stations = combo_res["element_forces"]["1"]
for st in stations[::2]: # Print every 2nd station
    print(f"x={st['x']:.2f} m: uy={st['uy']:.6f} m, uz={st['uz']:.6f} m")
print("=================================\n")
