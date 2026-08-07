import os
import sys

# Add the directory containing the 'app' package to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.arko_base import ArkoSessionLocal
from app.db.models.arko import ArkoProject3D

def run_diagnostics() -> None:
    db = ArkoSessionLocal()
    try:
        p = db.query(ArkoProject3D).filter(ArkoProject3D.name == "losadeformada").first()
        if p:
            print(f"PROJECT NAME: {p.name}")
            topology = p.topology or {}
            nodes = topology.get("nodes", [])
            elements = topology.get("elements", [])
            shells = topology.get("shells", [])
            
            print(f"--- NODES ({len(nodes)}) ---")
            for n in nodes:
                print(f"Node {n.get('id')}: x={n.get('x')}, y={n.get('y')}, z={n.get('z')}, cantilever={n.get('cantilever')}")
                
            print(f"--- ELEMENTS ({len(elements)}) ---")
            for e in elements:
                print(f"Element {e.get('id')}: type={e.get('type')}, nodes={e.get('nodes')}, cantileverId={e.get('cantileverId')}")

            print(f"--- SHELLS ({len(shells)}) ---")
            for s in shells:
                print(f"Shell {s.get('id')}: nodes={s.get('nodes')}, cantileverId={s.get('cantileverId')}")
        else:
            print("Project 'losadeformada' not found.")
    finally:
        db.close()

if __name__ == "__main__":
    run_diagnostics()
