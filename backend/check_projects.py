import os
import sys

# Add backend app to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.db.session import get_db_session
from app.db.models.arko import ArkoProject3D

db = next(get_db_session())
projects = db.query(ArkoProject3D).all()
print(f"FOUND {len(projects)} PROJECTS:")
for p in projects:
    print(f"ID: {p.id}, NAME: {p.name}")
    # Print node count and cantilever nodes
    topology = p.topology
    if topology:
        nodes = topology.get("nodes", [])
        cantilever_nodes = [n for n in nodes if "cantilever" in n]
        print(f"  Nodes: {len(nodes)}, Cantilever nodes: {len(cantilever_nodes)}")
        for cn in cantilever_nodes:
            print(f"    Node {cn['id']}: x={cn['x']}, y={cn['y']}, z={cn['z']}, cantilever={cn['cantilever']}")
