# arko360_platform/backend/app/engine/fem_frame.py
import numpy as np

def get_3d_frame_local_stiffness(E, G, A, J, Iy, Iz, L):
    """
    Genera la matriz de rigidez local 12x12 para un elemento viga 3D.
    Bernoulli-Euler simplificado.
    """
    k = np.zeros((12, 12))
    
    # Rigidez Axial
    axial = E * A / L
    k[0, 0] = k[6, 6] = axial
    k[0, 6] = k[6, 0] = -axial
    
    # Rigidez Torsional
    torsion = G * J / L
    k[3, 3] = k[9, 9] = torsion
    k[3, 9] = k[9, 3] = -torsion
    
    # Flexión en plano XY (sobre eje Z)
    k[1, 1] = k[7, 7] = 12 * E * Iz / L**3
    k[1, 7] = k[7, 1] = -12 * E * Iz / L**3
    k[1, 5] = k[1, 11] = k[5, 1] = k[11, 1] = 6 * E * Iz / L**2
    k[5, 7] = k[11, 7] = k[7, 5] = k[7, 11] = -6 * E * Iz / L**2
    k[5, 5] = k[11, 11] = 4 * E * Iz / L
    k[5, 11] = k[11, 5] = 2 * E * Iz / L
    
    # Flexión en plano XZ (sobre eje Y)
    k[2, 2] = k[8, 8] = 12 * E * Iy / L**3
    k[2, 8] = k[8, 2] = -12 * E * Iy / L**3
    k[2, 4] = k[2, 10] = k[4, 2] = k[10, 2] = -6 * E * Iy / L**2
    k[4, 8] = k[10, 8] = k[8, 4] = k[8, 10] = 6 * E * Iy / L**2
    k[4, 4] = k[10, 10] = 4 * E * Iy / L
    k[4, 10] = k[10, 4] = 2 * E * Iy / L
    
    return k

def get_rotation_matrix(node_i, node_j, beta=0):
    """
    Calcula la matriz de transformación de Local a Global.
    """
    L = np.linalg.norm(node_j - node_i)
    dx, dy, dz = (node_j - node_i) / L
    
    # Caso especial: Columna vertical
    if abs(dx) < 1e-6 and abs(dy) < 1e-6:
        m = 1 if dz > 0 else -1
        T_sub = np.array([
            [0, 0, m],
            [0, 1, 0],
            [-m, 0, 0]
        ])
    else:
        D = np.sqrt(dx**2 + dy**2)
        T_sub = np.array([
            [dx, dy, dz],
            [-dy/D, dx/D, 0],
            [-dx*dz/D, -dy*dz/D, D]
        ])
    
    # Matriz de rotación beta (roll)
    c, s = np.cos(np.radians(beta)), np.sin(np.radians(beta))
    R_beta = np.array([
        [1, 0, 0],
        [0, c, s],
        [0, -s, c]
    ])
    
    T_final = R_beta @ T_sub
    
    # Expandir a 12x12
    T = np.zeros((12, 12))
    for i in range(4):
        T[i*3:(i+1)*3, i*3:(i+1)*3] = T_final
        
    return T

def get_tapered_3d_frame_local_stiffness(E, G, L, ht_start, ht_end, w, t_f, t_w, N=10):
    """
    Genera la matriz de rigidez local 12x12 para un elemento de alma variable.
    Discretiza internamente el elemento en N segmentos prismáticos y usa 
    condensación estática para eliminar los grados de libertad internos.
    """
    num_nodes = N + 1
    K_total = np.zeros((num_nodes * 6, num_nodes * 6))
    L_seg = L / N
    
    for i in range(N):
        # Punto medio del segmento
        x_c = (i + 0.5) * L_seg
        ht_x = ht_start + (ht_end - ht_start) * (x_c / L)
        hw_x = ht_x - 2 * t_f
        
        # Propiedades seccionales en x_c
        A_x = 2 * (w * t_f) + hw_x * t_w
        # Inercia eje débil (Iy local)
        Iy_x = 2 * (t_f * w**3 / 12) + (hw_x * t_w**3 / 12)
        # Inercia eje fuerte (Iz local = Ix en el front)
        Iz_x = 2 * (w * t_f**3 / 12 + w * t_f * ((ht_x - t_f) / 2)**2) + (t_w * hw_x**3 / 12)
        # Constante torsional (aproximación para perfiles abiertos)
        J_x = (2 * w * t_f**3 + hw_x * t_w**3) / 3.0
        
        # Matriz 12x12 del segmento
        k_seg = get_3d_frame_local_stiffness(E, G, A_x, J_x, Iy_x, Iz_x, L_seg)
        
        # Ensamblaje en la matriz total (N segmentos colineales)
        idx = [i*6 + d for d in range(6)] + [(i+1)*6 + d for d in range(6)]
        for r in range(12):
            for c in range(12):
                K_total[idx[r], idx[c]] += k_seg[r, c]
                
    # Nodos externos: 0 (inicio) y N (fin). Nodos internos: 1 a N-1
    ext_dofs = list(range(6)) + list(range(N*6, (N+1)*6))
    int_dofs = list(range(6, N*6))
    
    K_ee = K_total[np.ix_(ext_dofs, ext_dofs)]
    K_ei = K_total[np.ix_(ext_dofs, int_dofs)]
    K_ie = K_total[np.ix_(int_dofs, ext_dofs)]
    K_ii = K_total[np.ix_(int_dofs, int_dofs)]
    
    # Condensación estática: K_eq = K_ee - K_ei * K_ii^-1 * K_ie
    K_condensed = K_ee - K_ei @ np.linalg.solve(K_ii, K_ie)
    return K_condensed