import sys
import os
sys.path.insert(0, '.')

import numpy as np
from app.schemas.fea3d import Node, Shell, ShellLoads, Mesh, MeshNode, MeshElement, LoadAssignment, LoadCombination, Material, Section, Topology, Restraint
from app.engine.solvers import StructuralSolver
import app.engine.fem_shell

# Redefinir la función get_quad_shell_local_stiffness con estabilización
def get_quad_shell_local_stiffness_stabilized(nodes_local, E, nu, thickness, alpha=0.05):
    K = np.zeros((24, 24))
    t = thickness
    G = E / (2 * (1 + nu))
    
    D_m = (E * t / (1 - nu**2)) * np.array([
        [1, nu, 0],
        [nu, 1, 0],
        [0, 0, (1 - nu)/2]
    ])
    D_b = (E * t**3 / (12 * (1 - nu**2))) * np.array([
        [1, nu, 0],
        [nu, 1, 0],
        [0, 0, (1 - nu)/2]
    ])
    k_shear = 5.0 / 6.0
    D_s = (k_shear * G * t) * np.array([
        [1, 0],
        [0, 1]
    ])
    
    gps_2 = [-1/np.sqrt(3), 1/np.sqrt(3)]
    x = np.array([n[0] for n in nodes_local])
    y = np.array([n[1] for n in nodes_local])
    
    def shape_funcs(xi, eta):
        N = 0.25 * np.array([
            (1 - xi)*(1 - eta),
            (1 + xi)*(1 - eta),
            (1 + xi)*(1 + eta),
            (1 - xi)*(1 + eta)
        ])
        dN_dxi = 0.25 * np.array([-(1 - eta), (1 - eta), (1 + eta), -(1 + eta)])
        dN_deta = 0.25 * np.array([-(1 - xi), -(1 + xi), (1 + xi), (1 - xi)])
        return N, dN_dxi, dN_deta

    # --- 1. Membrane (2x2) ---
    for xi in gps_2:
        for eta in gps_2:
            N, dN_dxi, dN_deta = shape_funcs(xi, eta)
            J = np.array([
                [np.dot(dN_dxi, x), np.dot(dN_dxi, y)],
                [np.dot(dN_deta, x), np.dot(dN_deta, y)]
            ])
            detJ = abs(np.linalg.det(J))
            invJ = np.linalg.inv(J)
            dN_dx_dy = invJ @ np.vstack((dN_dxi, dN_deta))
            dN_dx = dN_dx_dy[0, :]
            dN_dy = dN_dx_dy[1, :]
            
            B_m = np.zeros((3, 12))
            for i in range(4):
                B_m[0, 3*i] = dN_dx[i]
                B_m[1, 3*i+1] = dN_dy[i]
                B_m[2, 3*i] = dN_dy[i]
                B_m[2, 3*i+1] = dN_dx[i]
            K_m = B_m.T @ D_m @ B_m * detJ
            
            map_m = []
            for i in range(4): map_m.extend([i*6+0, i*6+1, i*6+5])
            for i in range(12):
                for j in range(12):
                    K[map_m[i], map_m[j]] += K_m[i, j]

    # --- 2. Bending (2x2) ---
    for xi in gps_2:
        for eta in gps_2:
            N, dN_dxi, dN_deta = shape_funcs(xi, eta)
            J = np.array([
                [np.dot(dN_dxi, x), np.dot(dN_dxi, y)],
                [np.dot(dN_deta, x), np.dot(dN_deta, y)]
            ])
            detJ = abs(np.linalg.det(J))
            invJ = np.linalg.inv(J)
            dN_dx_dy = invJ @ np.vstack((dN_dxi, dN_deta))
            dN_dx = dN_dx_dy[0, :]
            dN_dy = dN_dx_dy[1, :]
            
            B_b = np.zeros((3, 12))
            for i in range(4):
                B_b[0, 3*i+2] = dN_dx[i]
                B_b[1, 3*i+1] = -dN_dy[i]
                B_b[2, 3*i+1] = -dN_dx[i]
                B_b[2, 3*i+2] = dN_dy[i]
            K_b = B_b.T @ D_b @ B_b * detJ
            
            map_b = []
            for i in range(4): map_b.extend([i*6+2, i*6+3, i*6+4])
            for i in range(12):
                for j in range(12):
                    K[map_b[i], map_b[j]] += K_b[i, j]

    # --- 3. Shear (Stabilized) ---
    # 1x1 integration
    K_s_1x1 = np.zeros((12, 12))
    for xi in [0.0]:
        for eta in [0.0]:
            N, dN_dxi, dN_deta = shape_funcs(xi, eta)
            J = np.array([
                [np.dot(dN_dxi, x), np.dot(dN_dxi, y)],
                [np.dot(dN_deta, x), np.dot(dN_deta, y)]
            ])
            detJ = abs(np.linalg.det(J))
            invJ = np.linalg.inv(J)
            dN_dx_dy = invJ @ np.vstack((dN_dxi, dN_deta))
            dN_dx = dN_dx_dy[0, :]
            dN_dy = dN_dx_dy[1, :]
            
            B_s = np.zeros((2, 12))
            for i in range(4):
                B_s[0, 3*i+0] = dN_dx[i]
                B_s[0, 3*i+2] = N[i]
                B_s[1, 3*i+0] = dN_dy[i]
                B_s[1, 3*i+1] = -N[i]
            K_s_1x1 += B_s.T @ D_s @ B_s * detJ * 4.0

    # 2x2 integration
    K_s_2x2 = np.zeros((12, 12))
    for xi in gps_2:
        for eta in gps_2:
            N, dN_dxi, dN_deta = shape_funcs(xi, eta)
            J = np.array([
                [np.dot(dN_dxi, x), np.dot(dN_dxi, y)],
                [np.dot(dN_deta, x), np.dot(dN_deta, y)]
            ])
            detJ = abs(np.linalg.det(J))
            invJ = np.linalg.inv(J)
            dN_dx_dy = invJ @ np.vstack((dN_dxi, dN_deta))
            dN_dx = dN_dx_dy[0, :]
            dN_dy = dN_dx_dy[1, :]
            
            B_s = np.zeros((2, 12))
            for i in range(4):
                B_s[0, 3*i+0] = dN_dx[i]
                B_s[0, 3*i+2] = N[i]
                B_s[1, 3*i+0] = dN_dy[i]
                B_s[1, 3*i+1] = -N[i]
            K_s_2x2 += B_s.T @ D_s @ B_s * detJ * 1.0

    K_s = (1 - alpha) * K_s_1x1 + alpha * K_s_2x2
    
    map_b = []
    for i in range(4): map_b.extend([i*6+2, i*6+3, i*6+4])
    for i in range(12):
        for j in range(12):
            K[map_b[i], map_b[j]] += K_s[i, j]

    k_drilling = 1e-4 * E * t * abs(np.linalg.det(J))
    for i in range(4):
        K[i*6+5, i*6+5] += k_drilling

    return K

# Testear para diferentes alphas
for alpha in [0.0, 0.05, 0.1, 0.2, 1.0]:
    # Sobrescribir la función de rigidez del modulo importado
    app.engine.fem_shell.get_quad_shell_local_stiffness = lambda nl, E, nu, thick: get_quad_shell_local_stiffness_stabilized(nl, E, nu, thick, alpha)
    
    # Placa 4x4m
    R_pin = Restraint(ux=False, uy=False, uz=True, rx=False, ry=False, rz=False)
    nodes = [
        Node(id='N1', x=0, y=0, z=0, restraint=R_pin),
        Node(id='N2', x=4, y=0, z=0, restraint=R_pin),
        Node(id='N3', x=4, y=4, z=0, restraint=R_pin),
        Node(id='N4', x=0, y=4, z=0, restraint=R_pin),
    ]
    mat = Material(id='M1', E=2e7, G=8e6, nu=0.2, density=2400, name='Concreto')
    sec = Section(id='S1', A=0.09, Ix=6.75e-4, Iy=6.75e-4, J=1e-6, name='Col', params={'b': 0.3, 'h': 0.3})

    mesh_nodes, mesh_elements, grid, nc = [], [], {}, 0
    for j in range(5):
        for i in range(5):
            nc += 1
            nid = f'G-{nc}'
            grid[(i, j)] = nid
            mesh_nodes.append(MeshNode(id=nid, x=i * 1.0, y=j * 1.0, z=0.0))

    for j in range(4):
        for i in range(4):
            ei = j * 4 + i + 1
            mesh_elements.append(MeshElement(
                id=f'E-{ei}', type='quad',
                nodeIds=[grid[(i, j)], grid[(i+1, j)], grid[(i+1, j+1)], grid[(i, j+1)]]
            ))

    shell = Shell(
        id='SH1', nodes=['N1', 'N2', 'N3', 'N4'],
        material_id='M1', thickness=0.2,
        loads=ShellLoads(CM=0, CV=0),
        mesh=Mesh(nodes=mesh_nodes, elements=mesh_elements)
    )

    loads = [LoadAssignment(
        id='L1', type='point_shell', target_id='SH1',
        offset_x=2.0, offset_y=2.0,
        fx=0, fy=0, fz=-10000, mx=0, my=0, mz=0, load_case='CV'
    )]

    combo = LoadCombination(id='C1', name='1CV', factors={'CM': 0.0, 'CV': 1.0})
    topo = Topology(
        nodes=nodes, elements=[], shells=[shell],
        materials=[mat], sections=[sec],
        loads=loads, combinations=[combo]
    )

    solver = StructuralSolver(topo)
    results = solver.solve()
    disp = results['results']['C1']['displacements']

    print(f"\n=== Grid of Uz Displacements (alpha = {alpha}) ===")
    for j in reversed(range(5)):
        row_str = ""
        for i in range(5):
            nid = grid[(i, j)]
            uz = disp.get(nid, [0]*6)[2]
            row_str += f"{uz:10.6f} "
        print(row_str)
    print("==================================================")
