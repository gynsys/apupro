import os
import sys
import math

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.arko_base import ArkoSessionLocal
from app.db.models.arko import ArkoProject

db = ArkoSessionLocal()
p = db.query(ArkoProject).filter(ArkoProject.slug == 'project-001').first()

if p:
    print(f"Found project: {p.title}")
    nodes_by_id = {n['id']: n for n in p.nodes} if p.nodes else {}
    elems = p.elements if p.elements else []
    
    zero_elems = []
    for e in elems:
        n1_id, n2_id = e['nodes'][0], e['nodes'][1]
        if n1_id in nodes_by_id and n2_id in nodes_by_id:
            n1 = nodes_by_id[n1_id]
            n2 = nodes_by_id[n2_id]
            dist = math.dist([n1['x'], n1['y'], n1['z']], [n2['x'], n2['y'], n2['z']])
            if dist < 1e-5:
                zero_elems.append((e['id'], n1_id, n2_id, n1, n2))
                
    if zero_elems:
        print("Zero length elements found:")
        for z in zero_elems:
            print(z)
    else:
        print("No zero length elements found.")
        
    print(f"Total nodes: {len(p.nodes) if p.nodes else 0}")
    print(f"Total elements: {len(p.elements) if p.elements else 0}")
else:
    print("Project not found.")
db.close()
