import numpy as np
from scipy.sparse import csr_matrix
from scipy.sparse.linalg import spsolve
from app.engine.fem_frame import get_3d_frame_local_stiffness, get_tapered_3d_frame_local_stiffness, get_rotation_matrix
from app.schemas.fea3d import LoadType, Topology
import time
import json
import os

class StructuralSolver:
    def __init__(self, topology: Topology) -> None:
        self.nodes = list(topology.nodes)
        self.elements = list(topology.elements)
        self.shells = getattr(topology, 'shells', [])
        self.materials = {m.id: m for m in topology.materials}
        self.sections = {s.id: s for s in topology.sections}
        self.loads = topology.loads
        
        # Cargar combinaciones enviadas por frontend, o crear 2 por defecto
        self.combinations = getattr(topology, 'combinations', [])
        if not self.combinations:
            from app.schemas.fea3d import LoadCombination
            self.combinations = [
                LoadCombination(id="combo-1", name="1.4 CM", factors={"CM": 1.4, "CV": 0.0}),
                LoadCombination(id="combo-2", name="1.2 CM + 1.6 CV", factors={"CM": 1.2, "CV": 1.6})
            ]
        
        self.mesh_node_mapping = {} # maps mesh_node.id -> global_node.id
        
        # Append mesh nodes to global nodes
        for shell in self.shells:
            if shell.mesh and shell.mesh.nodes:
                for mn in shell.mesh.nodes:
                    # Check distance to existing nodes to merge corners
                    matched = False
                    for existing_n in self.nodes:
                        dist = ((mn.x - existing_n.x)**2 + (mn.y - existing_n.y)**2 + (mn.z - existing_n.z)**2)**0.5
                        if dist < 1e-4:
                            self.mesh_node_mapping[mn.id] = existing_n.id
                            matched = True
                            break
                    if not matched:
                        from app.schemas.fea3d import Node
                        self.mesh_node_mapping[mn.id] = mn.id
                        self.nodes.append(Node(id=mn.id, x=mn.x, y=mn.y, z=mn.z))

        # Subdividir elementos de pórtico (vigas/columnas) que tengan nodos del mesh sobre su longitud
        self.segment_to_original = {}
        self.original_element_lengths = {}
        self.segment_start_offset = {}
        
        subdivided_elements = []
        from app.schemas.fea3d import Element
        
        for elem in self.elements:
            n1 = next((n for n in self.nodes if n.id == elem.nodes[0]), None)
            n2 = next((n for n in self.nodes if n.id == elem.nodes[1]), None)
            if not n1 or not n2:
                subdivided_elements.append(elem)
                self.segment_to_original[elem.id] = elem.id
                self.segment_start_offset[elem.id] = 0.0
                continue
                
            p1 = np.array([n1.x, n1.y, n1.z])
            p2 = np.array([n2.x, n2.y, n2.z])
            v = p2 - p1
            v_len = np.linalg.norm(v)
            v_len_sq = np.dot(v, v)
            
            if v_len < 1e-4:
                subdivided_elements.append(elem)
                self.segment_to_original[elem.id] = elem.id
                self.segment_start_offset[elem.id] = 0.0
                continue
                
            self.original_element_lengths[elem.id] = v_len
                
            # Encontrar nodos de malla que yacen sobre el segmento n1-n2
            intermediate_nodes = []
            for existing_n in self.nodes:
                if existing_n.id == n1.id or existing_n.id == n2.id:
                    continue
                p = np.array([existing_n.x, existing_n.y, existing_n.z])
                w = p - p1
                t = np.dot(w, v) / v_len_sq
                if 1e-4 < t < 1 - 1e-4:
                    p_proj = p1 + t * v
                    dist = np.linalg.norm(p - p_proj)
                    if dist < 1e-4:
                        intermediate_nodes.append((t, existing_n.id))
            
            if not intermediate_nodes:
                subdivided_elements.append(elem)
                self.segment_to_original[elem.id] = elem.id
                self.segment_start_offset[elem.id] = 0.0
            else:
                intermediate_nodes.sort(key=lambda x: x[0])
                segment_nodes = [n1.id] + [nid for _, nid in intermediate_nodes] + [n2.id]
                segment_projections = [0.0] + [t for t, _ in intermediate_nodes] + [1.0]
                
                for i in range(len(segment_nodes) - 1):
                    seg_id = f"{elem.id}_seg_{i}"
                    seg = Element(
                        id=seg_id,
                        type=elem.type,
                        nodes=[segment_nodes[i], segment_nodes[i+1]],
                        section_id=elem.section_id,
                        material_id=elem.material_id,
                        beta_angle=elem.beta_angle
                    )
                    subdivided_elements.append(seg)
                    self.segment_to_original[seg_id] = elem.id
                    self.segment_start_offset[seg_id] = segment_projections[i] * v_len
                    
        self.elements = subdivided_elements
        
        self.num_nodes = len(self.nodes)
        self.ndof = self.num_nodes * 6
        self.node_map = {node.id: i for i, node in enumerate(self.nodes)}

    def assemble_global_stiffness(self):
        row, col, data = [], [], []
        for elem in self.elements:
            mat = self.materials[elem.material_id]
            sec = self.sections[elem.section_id]
            n1 = next(n for n in self.nodes if n.id == elem.nodes[0])
            n2 = next(n for n in self.nodes if n.id == elem.nodes[1])
            
            p1 = np.array([n1.x, n1.y, n1.z])
            p2 = np.array([n2.x, n2.y, n2.z])
            L = np.linalg.norm(p2 - p1)
            
            if getattr(sec, 'type', '') == 'Tapered I/Wide Flange' or sec.id.startswith('TAPERED_'):
                # Note: schema.Section might not have type defined in backend, so we check ID or type
                p_dict = sec.params or {}
                ht_start = p_dict.get('ht_start', 0.5)
                ht_end = p_dict.get('ht_end', 0.5)
                w = p_dict.get('w2', 0.2)
                t_f = p_dict.get('t3', 0.015)
                t_w = p_dict.get('t2', 0.01)
                k_loc = get_tapered_3d_frame_local_stiffness(mat.E, mat.G, L, ht_start, ht_end, w, t_f, t_w)
            else:
                k_loc = get_3d_frame_local_stiffness(mat.E, mat.G, sec.A, sec.J, sec.Iy, sec.Ix, L)
            T = get_rotation_matrix(p1, p2, elem.beta_angle)
            k_glob_elem = T.T @ k_loc @ T
            
            idx = []
            for node_id in [n1.id, n2.id]:
                node_idx = self.node_map[node_id]
                for d in range(6): idx.append(node_idx * 6 + d)
            
            for i in range(12):
                for j in range(12):
                    row.append(idx[i]); col.append(idx[j]); data.append(k_glob_elem[i, j])
                    
        from app.engine.fem_shell import get_quad_shell_local_stiffness
        
        # Assemble Shell Elements
        for shell in self.shells:
            if not shell.mesh or not shell.mesh.elements:
                continue
            mat = self.materials[shell.material_id]
            
            for fe in shell.mesh.elements:
                if fe.type == "quad" and len(fe.nodeIds) == 4:
                    mapped_ids = [self.mesh_node_mapping.get(nid, nid) for nid in fe.nodeIds]
                    n1 = next(n for n in self.nodes if n.id == mapped_ids[0])
                    n2 = next(n for n in self.nodes if n.id == mapped_ids[1])
                    n3 = next(n for n in self.nodes if n.id == mapped_ids[2])
                    n4 = next(n for n in self.nodes if n.id == mapped_ids[3])
                    
                    nodes_local = [[n1.x, n1.y], [n2.x, n2.y], [n3.x, n3.y], [n4.x, n4.y]]
                    k_loc = get_quad_shell_local_stiffness(nodes_local, mat.E, mat.nu, shell.thickness)
                    
                    idx = []
                    for node_id in [n1.id, n2.id, n3.id, n4.id]:
                        node_idx = self.node_map[node_id]
                        for d in range(6): idx.append(node_idx * 6 + d)
                        
                    for i in range(24):
                        for j in range(24):
                            row.append(idx[i]); col.append(idx[j]); data.append(k_loc[i, j])
                    
        return csr_matrix((data, (row, col)), shape=(self.ndof, self.ndof))

    def assemble_load_vector(self, factors: dict) -> tuple:
        F = np.zeros(self.ndof)
        g = 9.81
        factor_cm = factors.get("CM", 1.0)
        factor_cv = factors.get("CV", 1.0)
        
        element_local_loads = {elem.id: {"px": 0.0, "py": 0.0, "pz": 0.0, "f_fixed_local": np.zeros(12), "point_loads": []} for elem in self.elements}
        
        # 1. Peso Propio de Vigas/Columnas (CM)
        for elem in self.elements:
            mat = self.materials[elem.material_id]
            sec = self.sections[elem.section_id]
            n1 = next(n for n in self.nodes if n.id == elem.nodes[0])
            n2 = next(n for n in self.nodes if n.id == elem.nodes[1])
            L = np.linalg.norm(np.array([n2.x-n1.x, n2.y-n1.y, n2.z-n1.z]))
            weight = sec.A * mat.density * g * L * factor_cm
            F[self.node_map[n1.id]*6 + 2] -= weight / 2
            F[self.node_map[n2.id]*6 + 2] -= weight / 2

        # 2. Transferencia de Cargas de Losas (Áreas Tributarias -> Carga Equivalente Uniforme)
        for shell in self.shells:
            mat = self.materials[shell.material_id]
            n_coords = [next(n for n in self.nodes if n.id == nid) for nid in shell.nodes]
            if len(n_coords) < 3: continue
            
            # Área de la losa (Shoelace en XY)
            n0, n1, n2, n3 = n_coords[0], n_coords[1], n_coords[2], n_coords[3] if len(n_coords)>3 else n_coords[0]
            area = 0.5 * abs(n0.x*(n1.y-n3.y) + n1.x*(n2.y-n0.y) + n2.x*(n3.y-n1.y) + n3.x*(n0.y-n2.y))
            
            # Cargas en kgf/m2 (1 kgf = 9.81 N)
            pp_losa_kgf = shell.thickness * mat.density  # kg/m2 = kgf/m2
            cm_total_N = (pp_losa_kgf + shell.loads.CM) * g
            cv_total_N = shell.loads.CV * g
            
            # Carga factorizada total en N/m2
            q_factored = (cm_total_N * factor_cm) + (cv_total_N * factor_cv)
            if shell.mesh and shell.mesh.elements:
                # Caso Con Malla (Meshing): Distribuir carga uniformemente a nudos de la malla directly
                for fe in shell.mesh.elements:
                    if fe.type == "quad" and len(fe.nodeIds) == 4:
                        mapped_ids = [self.mesh_node_mapping.get(nid, nid) for nid in fe.nodeIds]
                        n1 = next(n for n in self.nodes if n.id == mapped_ids[0])
                        n2 = next(n for n in self.nodes if n.id == mapped_ids[1])
                        n3 = next(n for n in self.nodes if n.id == mapped_ids[2])
                        n4 = next(n for n in self.nodes if n.id == mapped_ids[3])
                        
                        # Área del quad (fórmula de Shoelace en XY)
                        area_fe = 0.5 * abs(
                            n1.x * (n2.y - n4.y) +
                            n2.x * (n3.y - n1.y) +
                            n3.x * (n4.y - n2.y) +
                            n4.x * (n1.y - n3.y)
                        )
                        load_per_node = q_factored * area_fe / 4.0
                        for nid in mapped_ids:
                            node_idx = self.node_map[nid]
                            F[node_idx * 6 + 2] -= load_per_node
                            
                    elif (fe.type == "triangle" or len(fe.nodeIds) == 3) and len(fe.nodeIds) == 3:
                        mapped_ids = [self.mesh_node_mapping.get(nid, nid) for nid in fe.nodeIds]
                        n1 = next(n for n in self.nodes if n.id == mapped_ids[0])
                        n2 = next(n for n in self.nodes if n.id == mapped_ids[1])
                        n3 = next(n for n in self.nodes if n.id == mapped_ids[2])
                        
                        # Área del triángulo
                        area_fe = 0.5 * abs(
                            n1.x * (n2.y - n3.y) +
                            n2.x * (n3.y - n1.y) +
                            n3.x * (n1.y - n2.y)
                        )
                        load_per_node = q_factored * area_fe / 3.0
                        for nid in mapped_ids:
                            node_idx = self.node_map[nid]
                            F[node_idx * 6 + 2] -= load_per_node
            else:
                # Caso Sin Malla (Membrana): Transferir a vigas perimetrales o a nudos principales
                total_load_N = q_factored * area
                
                # Repartir a vigas perimetrales (o nudos)
                edges = [(shell.nodes[0], shell.nodes[1]), (shell.nodes[1], shell.nodes[2]), 
                         (shell.nodes[2], shell.nodes[3]), (shell.nodes[3], shell.nodes[0])]
                
                perimeter_elements = []
                edges_lengths = []
                for edge in edges:
                    nA = next((n for n in self.nodes if n.id == edge[0]), None)
                    nB = next((n for n in self.nodes if n.id == edge[1]), None)
                    if not nA or not nB: continue
                    pA = np.array([nA.x, nA.y, nA.z])
                    pB = np.array([nB.x, nB.y, nB.z])
                    v_edge = pB - pA
                    v_edge_len = np.linalg.norm(v_edge)
                    v_edge_sq = np.dot(v_edge, v_edge)
                    
                    if v_edge_len < 1e-4: continue
                    edges_lengths.append(v_edge_len)
                    
                    for elem in self.elements:
                        en1 = next((n for n in self.nodes if n.id == elem.nodes[0]), None)
                        en2 = next((n for n in self.nodes if n.id == elem.nodes[1]), None)
                        if not en1 or not en2: continue
                        
                        p_en1 = np.array([en1.x, en1.y, en1.z])
                        w_en1 = p_en1 - pA
                        t_en1 = np.dot(w_en1, v_edge) / v_edge_sq
                        
                        p_en2 = np.array([en2.x, en2.y, en2.z])
                        w_en2 = p_en2 - pA
                        t_en2 = np.dot(w_en2, v_edge) / v_edge_sq
                        
                        if -1e-4 <= t_en1 <= 1 + 1e-4 and -1e-4 <= t_en2 <= 1 + 1e-4:
                            dist_en1 = np.linalg.norm(p_en1 - (pA + t_en1 * v_edge))
                            dist_en2 = np.linalg.norm(p_en2 - (pA + t_en2 * v_edge))
                            if dist_en1 < 1e-4 and dist_en2 < 1e-4:
                                perimeter_elements.append((elem, v_edge_len))
                
                if perimeter_elements:
                    # Método de Líneas de Rotura (Yield Line Equivalent Uniform Loads)
                    Ls = min(edges_lengths) if edges_lengths else 0
                    Ll = max(edges_lengths) if edges_lengths else 0
                    
                    for elem, v_edge_len in perimeter_elements:
                        en1 = next(n for n in self.nodes if n.id == elem.nodes[0])
                        en2 = next(n for n in self.nodes if n.id == elem.nodes[1])
                        l = np.linalg.norm(np.array([en2.x-en1.x, en2.y-en1.y, en2.z-en1.z]))
                        
                        # Determinar carga equivalente según lado (Corto=Triángulo, Largo=Trapecio)
                        is_short = abs(v_edge_len - Ls) < 0.1
                        if is_short:
                            w_eq = q_factored * (Ls / 3.0)
                        else:
                            if Ll > 1e-4:
                                w_eq = q_factored * (Ls / 2.0) * (1.0 - (1.0/3.0) * (Ls / Ll)**2)
                            else:
                                w_eq = 0
                        
                        p1 = np.array([en1.x, en1.y, en1.z])
                        p2 = np.array([en2.x, en2.y, en2.z])
                        T = get_rotation_matrix(p1, p2, elem.beta_angle)
                        
                        # El peso de la losa va hacia abajo en global Z (-Z).
                        # Mapeamos la carga global -Z a local.
                        q_global = np.array([0, 0, -w_eq])
                        q_local = T[0:3, 0:3] @ q_global
                        
                        # Guardamos la carga local para los diagramas
                        element_local_loads[elem.id]["px"] += q_local[0]
                        element_local_loads[elem.id]["py"] += q_local[1]
                        element_local_loads[elem.id]["pz"] += q_local[2]
                        
                        f_fixed_local = np.zeros(12)
                        # Carga distribuida local en Y
                        f_fixed_local[1] = q_local[1] * l / 2
                        f_fixed_local[5] = q_local[1] * l**2 / 12
                        f_fixed_local[7] = q_local[1] * l / 2
                        f_fixed_local[11] = -q_local[1] * l**2 / 12
                        # Carga distribuida local en Z
                        f_fixed_local[2] = q_local[2] * l / 2
                        f_fixed_local[4] = -q_local[2] * l**2 / 12
                        f_fixed_local[8] = q_local[2] * l / 2
                        f_fixed_local[10] = q_local[2] * l**2 / 12
                        
                        # Carga axial
                        f_fixed_local[0] = q_local[0] * l / 2
                        f_fixed_local[6] = q_local[0] * l / 2
                        
                        element_local_loads[elem.id]["f_fixed_local"] += f_fixed_local
                        
                        f_fixed_global = T.T @ f_fixed_local
                        
                        idx1 = self.node_map[en1.id] * 6
                        idx2 = self.node_map[en2.id] * 6
                        F[idx1:idx1+6] += f_fixed_global[0:6]
                        F[idx2:idx2+6] += f_fixed_global[6:12]
                else:
                    # Si no hay vigas, enviar a los nudos directamente
                    f_node = total_load_N / len(shell.nodes)
                    for nid in shell.nodes:
                        F[self.node_map[nid]*6 + 2] -= f_node

        # 3. Cargas Manuales (Puntuales y Distribuidas)
        for load in self.loads:
            # Asumimos que las cargas manuales son CM para este prototipo (o leer load.load_case)
            factor = factor_cm if load.load_case.upper() == "CM" or load.load_case.upper() == "DEAD" else factor_cv
            
            if load.type == "point":
                if load.target_id not in self.node_map:
                    continue
                node_idx = self.node_map[load.target_id]
                F[node_idx * 6 + 0] += load.fx * factor
                F[node_idx * 6 + 1] += load.fy * factor
                F[node_idx * 6 + 2] += load.fz * factor
                F[node_idx * 6 + 3] += load.mx * factor
                F[node_idx * 6 + 4] += load.my * factor
                F[node_idx * 6 + 5] += load.mz * factor
            
            elif load.type == "distributed":
                target_segments = [e for e in self.elements if self.segment_to_original.get(e.id) == load.target_id]
                for elem in target_segments:
                    n1 = next((n for n in self.nodes if n.id == elem.nodes[0]), None)
                    n2 = next((n for n in self.nodes if n.id == elem.nodes[1]), None)
                    if not n1 or not n2: continue
                    p1 = np.array([n1.x, n1.y, n1.z])
                    p2 = np.array([n2.x, n2.y, n2.z])
                    l = np.linalg.norm(p2 - p1)
                    
                    q_global = np.array([load.fx * factor, load.fy * factor, load.fz * factor])
                    T = get_rotation_matrix(p1, p2, elem.beta_angle)
                    q_local = T[0:3, 0:3] @ q_global
                    
                    element_local_loads[elem.id]["px"] += q_local[0]
                    element_local_loads[elem.id]["py"] += q_local[1]
                    element_local_loads[elem.id]["pz"] += q_local[2]
                    
                    f_fixed_local = np.zeros(12)
                    # Carga axial
                    f_fixed_local[0] = q_local[0] * l / 2
                    f_fixed_local[6] = q_local[0] * l / 2
                    # Carga Y local
                    f_fixed_local[1] = q_local[1] * l / 2
                    f_fixed_local[5] = q_local[1] * l**2 / 12
                    f_fixed_local[7] = q_local[1] * l / 2
                    f_fixed_local[11] = -q_local[1] * l**2 / 12
                    # Carga Z local
                    f_fixed_local[2] = q_local[2] * l / 2
                    f_fixed_local[4] = -q_local[2] * l**2 / 12
                    f_fixed_local[8] = q_local[2] * l / 2
                    f_fixed_local[10] = q_local[2] * l**2 / 12
                    
                    element_local_loads[elem.id]["f_fixed_local"] += f_fixed_local
                    
                    f_fixed_global = T.T @ f_fixed_local
                    idx1 = self.node_map[n1.id] * 6
                    idx2 = self.node_map[n2.id] * 6
                    F[idx1:idx1+6] += f_fixed_global[0:6]
                    F[idx2:idx2+6] += f_fixed_global[6:12]

            elif load.type == "point_frame":
                total_len = self.original_element_lengths.get(load.target_id)
                if total_len is None or total_len < 1e-4:
                    continue
                point_dist = total_len * load.offset
                
                target_segments = [e for e in self.elements if self.segment_to_original.get(e.id) == load.target_id]
                
                selected_elem = None
                relative_offset = 0.0
                seg_len = 0.0
                
                for elem in target_segments:
                    start_off = self.segment_start_offset.get(elem.id, 0.0)
                    n1 = next((n for n in self.nodes if n.id == elem.nodes[0]), None)
                    n2 = next((n for n in self.nodes if n.id == elem.nodes[1]), None)
                    if not n1 or not n2: continue
                    l = np.linalg.norm(np.array([n2.x-n1.x, n2.y-n1.y, n2.z-n1.z]))
                    if start_off - 1e-4 <= point_dist <= start_off + l + 1e-4:
                        selected_elem = elem
                        seg_len = l
                        relative_offset = (point_dist - start_off) / (l if l > 1e-6 else 1.0)
                        relative_offset = max(0.0, min(1.0, relative_offset))
                        break
                        
                if not selected_elem:
                    continue
                    
                elem = selected_elem
                n1 = next((n for n in self.nodes if n.id == elem.nodes[0]), None)
                n2 = next((n for n in self.nodes if n.id == elem.nodes[1]), None)
                if not n1 or not n2: continue
                p1 = np.array([n1.x, n1.y, n1.z])
                p2 = np.array([n2.x, n2.y, n2.z])
                l = seg_len
                
                a = l * relative_offset
                b = l - a
                
                q_global = np.array([load.fx * factor, load.fy * factor, load.fz * factor])
                T = get_rotation_matrix(p1, p2, elem.beta_angle)
                q_local = T[0:3, 0:3] @ q_global
                
                f_fixed_local = np.zeros(12)
                # Axial
                f_fixed_local[0] = q_local[0] * b / l
                f_fixed_local[6] = q_local[0] * a / l
                # Transverse Y
                f_fixed_local[1] = q_local[1] * (b**2) * (3*a + b) / (l**3)
                f_fixed_local[5] = q_local[1] * a * (b**2) / (l**2)
                f_fixed_local[7] = q_local[1] * (a**2) * (a + 3*b) / (l**3)
                f_fixed_local[11] = -q_local[1] * (a**2) * b / (l**2)
                # Transverse Z
                f_fixed_local[2] = q_local[2] * (b**2) * (3*a + b) / (l**3)
                f_fixed_local[4] = -q_local[2] * a * (b**2) / (l**2)
                f_fixed_local[8] = q_local[2] * (a**2) * (a + 3*b) / (l**3)
                f_fixed_local[10] = q_local[2] * (a**2) * b / (l**2)
                
                element_local_loads[elem.id]["point_loads"].append({
                    "a": a,
                    "px": q_local[0],
                    "py": q_local[1],
                    "pz": q_local[2]
                })
                element_local_loads[elem.id]["f_fixed_local"] += f_fixed_local
                
                f_fixed_global = T.T @ f_fixed_local
                idx1 = self.node_map[n1.id] * 6
                idx2 = self.node_map[n2.id] * 6
                F[idx1:idx1+6] += f_fixed_global[0:6]
                F[idx2:idx2+6] += f_fixed_global[6:12]

            elif load.type == "point_shell":
                shell = next((s for s in self.shells if s.id == load.target_id), None)
                if not shell or not shell.mesh or not shell.mesh.elements:
                    continue
                px = load.offset_x
                py = load.offset_y
                
                # Find which element contains (px, py)
                # Using a simple bounding box check per quad
                for fe in shell.mesh.elements:
                    if fe.type == "quad" and len(fe.nodeIds) == 4:
                        n1 = next((n for n in self.nodes if n.id == fe.nodeIds[0]), None)
                        n2 = next((n for n in self.nodes if n.id == fe.nodeIds[1]), None)
                        n3 = next((n for n in self.nodes if n.id == fe.nodeIds[2]), None)
                        n4 = next((n for n in self.nodes if n.id == fe.nodeIds[3]), None)
                        if not n1 or not n2 or not n3 or not n4: continue
                        
                        fminX = min(n1.x, n2.x, n3.x, n4.x)
                        fmaxX = max(n1.x, n2.x, n3.x, n4.x)
                        fminY = min(n1.y, n2.y, n3.y, n4.y)
                        fmaxY = max(n1.y, n2.y, n3.y, n4.y)
                        
                        if fminX - 1e-4 <= px <= fmaxX + 1e-4 and fminY - 1e-4 <= py <= fmaxY + 1e-4:
                            # Found the element!
                            # Distribute load to 4 nodes using bilinear shape functions
                            L_x = fmaxX - fminX
                            L_y = fmaxY - fminY
                            if L_x == 0 or L_y == 0: continue
                            
                            xi = (px - fminX) / L_x
                            eta = (py - fminY) / L_y
                            
                            # Standard shape functions (N1=BL, N2=BR, N3=TR, N4=TL)
                            N = [
                                (1 - xi) * (1 - eta),
                                xi * (1 - eta),
                                xi * eta,
                                (1 - xi) * eta
                            ]
                            
                            # Assuming nodes are ordered CCW from Bottom-Left
                            mapped_ids = [self.mesh_node_mapping.get(nid, nid) for nid in [fe.nodeIds[0], fe.nodeIds[1], fe.nodeIds[2], fe.nodeIds[3]]]
                            nodes_idx = [self.node_map[nid] for nid in mapped_ids]
                            
                            for i, n_idx in enumerate(nodes_idx):
                                F[n_idx * 6 + 0] += load.fx * factor * N[i]
                                F[n_idx * 6 + 1] += load.fy * factor * N[i]
                                F[n_idx * 6 + 2] += load.fz * factor * N[i]
                            break

            elif load.type == "area_shell":
                shell = next((s for s in self.shells if s.id == load.target_id), None)
                if not shell or not shell.mesh or not shell.mesh.elements:
                    continue
                
                # Coordenadas absolutas del parche
                minX = min(load.offset_x, load.end_x)
                maxX = max(load.offset_x, load.end_x)
                minY = min(load.offset_y, load.end_y)
                maxY = max(load.offset_y, load.end_y)
                
                Lx = maxX - minX
                Ly = maxY - minY
                if Lx <= 0 or Ly <= 0:
                    continue
                
                # Densidad de carga (por m2)
                q_x = load.fx * factor
                q_y = load.fy * factor
                q_z = load.fz * factor
                
                # Parámetros de discretización (Grid Integration)
                # Vamos a crear una rejilla de sub-puntos cada 10 cm, o al menos 3x3 puntos si es muy pequeña
                grid_size = 0.10 # 10 cm
                nx = max(3, int(np.ceil(Lx / grid_size)))
                ny = max(3, int(np.ceil(Ly / grid_size)))
                
                dx = Lx / nx
                dy = Ly / ny
                sub_area = dx * dy
                
                # Fuerza tributaria de cada sub-punto
                F_sub_x = q_x * sub_area
                F_sub_y = q_y * sub_area
                F_sub_z = q_z * sub_area
                
                # Iterar sobre cada sub-punto en el centro de cada celda de la rejilla
                for i_grid in range(nx):
                    for j_grid in range(ny):
                        px = minX + dx/2 + i_grid * dx
                        py = minY + dy/2 + j_grid * dy
                        
                        # Buscar en qué elemento finito cae este sub-punto
                        for fe in shell.mesh.elements:
                            if fe.type == "quad" and len(fe.nodeIds) == 4:
                                n1 = next((n for n in self.nodes if n.id == fe.nodeIds[0]), None)
                                n2 = next((n for n in self.nodes if n.id == fe.nodeIds[1]), None)
                                n3 = next((n for n in self.nodes if n.id == fe.nodeIds[2]), None)
                                n4 = next((n for n in self.nodes if n.id == fe.nodeIds[3]), None)
                                if not n1 or not n2 or not n3 or not n4: continue
                                
                                fminX = min(n1.x, n2.x, n3.x, n4.x)
                                fmaxX = max(n1.x, n2.x, n3.x, n4.x)
                                fminY = min(n1.y, n2.y, n3.y, n4.y)
                                fmaxY = max(n1.y, n2.y, n3.y, n4.y)
                                
                                if fminX - 1e-4 <= px <= fmaxX + 1e-4 and fminY - 1e-4 <= py <= fmaxY + 1e-4:
                                    # Encontrado! Distribuir la mini-carga a los 4 nudos
                                    L_fe_x = fmaxX - fminX
                                    L_fe_y = fmaxY - fminY
                                    if L_fe_x == 0 or L_fe_y == 0: continue
                                    
                                    xi = (px - fminX) / L_fe_x
                                    eta = (py - fminY) / L_fe_y
                                    
                                    N = [
                                        (1 - xi) * (1 - eta),
                                        xi * (1 - eta),
                                        xi * eta,
                                        (1 - xi) * eta
                                    ]
                                    
                                    mapped_ids = [self.mesh_node_mapping.get(nid, nid) for nid in [fe.nodeIds[0], fe.nodeIds[1], fe.nodeIds[2], fe.nodeIds[3]]]
                                    nodes_idx = [self.node_map[nid] for nid in mapped_ids]
                                    
                                    for i, n_idx in enumerate(nodes_idx):
                                        F[n_idx * 6 + 0] += F_sub_x * N[i]
                                        F[n_idx * 6 + 1] += F_sub_y * N[i]
                                        F[n_idx * 6 + 2] += F_sub_z * N[i]
                                    break # Romper loop de elementos para este sub-punto

        return F, element_local_loads

    def solve(self):
        K = self.assemble_global_stiffness()
        
        # Aplicar apoyos en la matriz K (Penalty Method)
        for node in self.nodes:
            if node.restraint:
                node_idx = self.node_map[node.id]
                dofs = [node.restraint.ux, node.restraint.uy, node.restraint.uz, node.restraint.rx, node.restraint.ry, node.restraint.rz]
                for d, is_fixed in enumerate(dofs):
                    if is_fixed:
                        idx = node_idx * 6 + d
                        K[idx, idx] = 1e30
        
        K_csr = K.tocsr()
        results_by_combo = {}
        
        # Iterar sobre las combinaciones de carga
        for combo in self.combinations:
            F, local_loads = self.assemble_load_vector(combo.factors)
            
            # Aplicar Penalty Method en F
            for node in self.nodes:
                if node.restraint:
                    node_idx = self.node_map[node.id]
                    dofs = [node.restraint.ux, node.restraint.uy, node.restraint.uz, node.restraint.rx, node.restraint.ry, node.restraint.rz]
                    for d, is_fixed in enumerate(dofs):
                        if is_fixed:
                            idx = node_idx * 6 + d
                            F[idx] = 0
            
            U = spsolve(K_csr, F)
            displacements = {n.id: U[i*6:(i+1)*6].tolist() for i, n in enumerate(self.nodes)}
            
            # Include aliases for mesh nodes that were merged with structural nodes
            for mesh_id, mapped_id in self.mesh_node_mapping.items():
                if mesh_id != mapped_id and mapped_id in displacements:
                    displacements[mesh_id] = displacements[mapped_id]
            
            seg_element_forces = {}
            for elem in self.elements:
                n1 = next(n for n in self.nodes if n.id == elem.nodes[0])
                n2 = next(n for n in self.nodes if n.id == elem.nodes[1])
                mat = self.materials[elem.material_id]
                sec = self.sections[elem.section_id]
                p1 = np.array([n1.x, n1.y, n1.z])
                p2 = np.array([n2.x, n2.y, n2.z])
                l = np.linalg.norm(p2 - p1)
                
                if getattr(sec, 'type', '') == 'Tapered I/Wide Flange' or sec.id.startswith('TAPERED_'):
                    p_dict = sec.params or {}
                    ht_start = p_dict.get('ht_start', 0.5)
                    ht_end = p_dict.get('ht_end', 0.5)
                    w = p_dict.get('w2', 0.2)
                    t_f = p_dict.get('t3', 0.015)
                    t_w = p_dict.get('t2', 0.01)
                    from app.engine.fem_frame import get_tapered_3d_frame_local_stiffness
                    k_loc = get_tapered_3d_frame_local_stiffness(mat.E, mat.G, l, ht_start, ht_end, w, t_f, t_w)
                else:
                    k_loc = get_3d_frame_local_stiffness(mat.E, mat.G, sec.A, sec.J, sec.Iy, sec.Ix, l)
                T = get_rotation_matrix(p1, p2, elem.beta_angle)
                
                idx1 = self.node_map[n1.id] * 6
                idx2 = self.node_map[n2.id] * 6
                u_glob = np.zeros(12)
                u_glob[0:6] = U[idx1:idx1+6]
                u_glob[6:12] = U[idx2:idx2+6]
                
                u_loc = T @ u_glob
                
                qx = local_loads[elem.id]["px"]
                qy = local_loads[elem.id]["py"]
                qz = local_loads[elem.id]["pz"]
                f_fixed_local = local_loads[elem.id]["f_fixed_local"]
                point_loads = local_loads[elem.id]["point_loads"]
                
                f_loc_end = k_loc @ u_loc + f_fixed_local
                
                # Estaciones base
                xs_base = list(np.linspace(0, l, 21))
                
                # Añadir estaciones exactamente antes y después de cada carga puntual para dibujar caídas verticales
                for pt in point_loads:
                    a = pt["a"]
                    if 0 < a < l:
                        xs_base.append(a - 1e-5)
                        xs_base.append(a + 1e-5)
                
                xs = sorted(list(set(xs_base)))
                
                stations = []
                for x in xs:
                    P = -f_loc_end[0] + qx * x
                    V2 = -f_loc_end[1] + qy * x
                    V3 = -f_loc_end[2] + qz * x
                    T_tors = -f_loc_end[3]
                    
                    # Classic internal force sign convention:
                    # M2 = f_loc_end[4] + f_loc_end[2]*x - qz*x^2/2
                    # M3 = f_loc_end[5] - f_loc_end[1]*x + qy*x^2/2
                    M2 = f_loc_end[4] + f_loc_end[2] * x - qz * (x**2) / 2
                    M3 = f_loc_end[5] - f_loc_end[1] * x + qy * (x**2) / 2
                    
                    for pt in point_loads:
                        if x > pt["a"]:
                            dist = x - pt["a"]
                            P += pt["px"]
                            V2 += pt["py"]
                            V3 += pt["pz"]
                            M2 -= pt["pz"] * dist
                            M3 += pt["py"] * dist
                    
                    # Deflexión local (Funciones de forma de Hermite)
                    xi = x / l if l > 0 else 0
                    N1 = 1 - 3*xi**2 + 2*xi**3
                    N2 = l * (xi - 2*xi**2 + xi**3)
                    N3 = 3*xi**2 - 2*xi**3
                    N4 = l * (-xi**2 + xi**3)
                    
                    v_x = (1 - xi) * u_loc[0] + xi * u_loc[6]
                    v_y = N1 * u_loc[1] + N2 * u_loc[5] + N3 * u_loc[7] + N4 * u_loc[11]
                    v_z = N1 * u_loc[2] - N2 * u_loc[4] + N3 * u_loc[8] - N4 * u_loc[10]
                    
                    stations.append({
                        "x": float(x),
                        "P": float(P),
                        "V2": float(V2),
                        "V3": float(V3),
                        "T": float(T_tors),
                        "M2": float(M2),
                        "M3": float(M3),
                        "ux": float(v_x),
                        "uy": float(v_y),
                        "uz": float(v_z)
                    })
                
                seg_element_forces[elem.id] = stations

            # Reconstruir element_forces para los elementos originales combinando sus segmentos
            element_forces = {}
            orig_to_segs = {}
            for seg_id, orig_id in self.segment_to_original.items():
                if orig_id not in orig_to_segs:
                    orig_to_segs[orig_id] = []
                orig_to_segs[orig_id].append(seg_id)
                
            for orig_id, seg_ids in orig_to_segs.items():
                if len(seg_ids) == 1 and seg_ids[0] == orig_id:
                    element_forces[orig_id] = seg_element_forces.get(orig_id, [])
                    continue
                    
                seg_ids.sort(key=lambda sid: self.segment_start_offset.get(sid, 0.0))
                
                combined_stations = []
                for seg_id in seg_ids:
                    seg_stations = seg_element_forces.get(seg_id, [])
                    start_off = self.segment_start_offset.get(seg_id, 0.0)
                    for st in seg_stations:
                        if combined_stations and abs(combined_stations[-1]["x"] - (st["x"] + start_off)) < 1e-4:
                            continue
                        new_st = dict(st)
                        new_st["x"] = float(st["x"] + start_off)
                        combined_stations.append(new_st)
                        
                element_forces[orig_id] = combined_stations
                
            shell_forces = {}
            from app.engine.fem_shell import recover_shell_stresses
            for shell in self.shells:
                if not shell.mesh or not shell.mesh.elements:
                    continue
                mat = self.materials[shell.material_id]
                for fe in shell.mesh.elements:
                    if fe.type == "quad" and len(fe.nodeIds) == 4:
                        mapped_ids = [self.mesh_node_mapping.get(nid, nid) for nid in fe.nodeIds]
                        n1 = next(n for n in self.nodes if n.id == mapped_ids[0])
                        n2 = next(n for n in self.nodes if n.id == mapped_ids[1])
                        n3 = next(n for n in self.nodes if n.id == mapped_ids[2])
                        n4 = next(n for n in self.nodes if n.id == mapped_ids[3])
                        
                        nodes_local = [[n1.x, n1.y], [n2.x, n2.y], [n3.x, n3.y], [n4.x, n4.y]]
                        
                        u_loc = np.zeros(24)
                        nodes_idx = [self.node_map[nid] for nid in mapped_ids]
                        for i, n_idx in enumerate(nodes_idx):
                            u_loc[i*6:(i+1)*6] = U[n_idx*6:(n_idx+1)*6]
                            
                        stresses = recover_shell_stresses(nodes_local, u_loc, mat.E, mat.nu, shell.thickness)
                        shell_forces[fe.id] = stresses
                
            deformed_shell_nodes = {}
            for shell in self.shells:
                if not shell.mesh or not shell.mesh.nodes:
                    continue
                shell_nodes_deformed = {}
                for mn in shell.mesh.nodes:
                    mapped_id = self.mesh_node_mapping.get(mn.id, mn.id)
                    u = displacements.get(mapped_id, [0, 0, 0, 0, 0, 0])
                    shell_nodes_deformed[mn.id] = {
                        "x": float(mn.x + u[0]),
                        "y": float(mn.y + u[1]),
                        "z": float(mn.z + u[2])
                    }
                deformed_shell_nodes[shell.id] = shell_nodes_deformed
                
            results_by_combo[combo.id] = {
                "displacements": displacements,
                "element_forces": element_forces,
                "shell_forces": shell_forces,
                "deformed_shell_nodes": deformed_shell_nodes
            }
            
        # Generar archivo de auditoría
        audit_data = {
            "timestamp": time.time(),
            "nodes_count": self.num_nodes,
            "elements_count": len(self.elements),
            "shells_count": len(self.shells),
            "ndof": self.ndof,
            "combinations": [c.dict() for c in self.combinations],
            "solver_info": "ARKO3D Stiffness Matrix Method",
            "formulas_aplicadas": {
                "matriz_rigidez_local": "[k_loc] = f(E, G, A, J, Iy, Ix, L)",
                "transformacion_coordenadas": "[K_global] = [T]^T * [k_loc] * [T]",
                "ensamblaje_global": "Sumatoria de [K_global_elem] para todos los elementos",
                "ecuacion_principal": "[K] * {U} = {F}",
                "penalty_method": "Multiplicación de la diagonal de [K] por 1e30 en los Grados de Libertad restringidos",
                "recuperacion_fuerzas_locales": "{f_local} = [k_loc] * {u_local} + {f_fixed_local}",
                "teoria_aplicada_barras": "Flexión 3D de Euler-Bernoulli y Torsión de Saint-Venant",
                "teoria_aplicada_losas": "Elemento Finito Quad-4 Isoparamétrico. Membrana (Plane Stress) + Flexión (Mindlin-Reissner con Integración Reducida Selectiva) + Rigidez Ficticia de Drilling (Rz)"
            },
            "results_summary": {
                combo_id: {
                    "max_displacement": max([max(abs(np.array(u))) for u in res["displacements"].values()]) if res["displacements"] else 0
                }
                for combo_id, res in results_by_combo.items()
            }
        }
        
        audit_filename = f"auditoria_arko3d_{int(time.time()*1000)}.json"
        with open(audit_filename, "w") as f:
            json.dump(audit_data, f, indent=2)
            
        return {"results": results_by_combo, "combinations": [c.dict() for c in self.combinations], "audit_file": audit_filename}