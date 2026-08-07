import numpy as np
from typing import List, Dict

def get_quad_shell_local_stiffness(nodes_local: List[List[float]], E: float, nu: float, thickness: float) -> np.ndarray:
    """
    Computes the 24x24 local stiffness matrix for a 4-node quadrilateral shell element.
    Nodes must be in counter-clockwise order.
    Formulation:
    - Membrane: Bilinear isoparametric with artificial drilling stiffness (theta_z).
    - Bending: Mindlin-Reissner plate with selective reduced integration to avoid shear locking.
    
    nodes_local: list of 4 [x, y] coordinates in the element's local 2D plane.
    """
    K = np.zeros((24, 24))
    
    # Material properties
    t = thickness
    G = E / (2 * (1 + nu))
    
    # Membrane constitutive matrix (Plane Stress)
    D_m = (E * t / (1 - nu**2)) * np.array([
        [1, nu, 0],
        [nu, 1, 0],
        [0, 0, (1 - nu)/2]
    ])
    
    # Bending constitutive matrix
    D_b = (E * t**3 / (12 * (1 - nu**2))) * np.array([
        [1, nu, 0],
        [nu, 1, 0],
        [0, 0, (1 - nu)/2]
    ])
    
    # Shear constitutive matrix (Mindlin-Reissner)
    k_shear = 5.0 / 6.0 # Shear correction factor
    D_s = (k_shear * G * t) * np.array([
        [1, 0],
        [0, 1]
    ])
    
    # Gauss Integration Points and Weights
    # 2x2 for Membrane and Bending
    gps_2 = [-1/np.sqrt(3), 1/np.sqrt(3)]
    
    # 1x1 for Shear to prevent shear locking (Reduced Integration)
    gps_1 = [0.0]
    
    x = np.array([n[0] for n in nodes_local])
    y = np.array([n[1] for n in nodes_local])
    
    # Helper for Shape Functions and Derivatives
    def shape_funcs(xi, eta):
        N = 0.25 * np.array([
            (1 - xi)*(1 - eta),
            (1 + xi)*(1 - eta),
            (1 + xi)*(1 + eta),
            (1 - xi)*(1 + eta)
        ])
        dN_dxi = 0.25 * np.array([
            -(1 - eta),  (1 - eta), (1 + eta), -(1 + eta)
        ])
        dN_deta = 0.25 * np.array([
            -(1 - xi), -(1 + xi),  (1 + xi),  (1 - xi)
        ])
        return N, dN_dxi, dN_deta

    # --- 1. Membrane Stiffness Integration (2x2) ---
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
            
            # Map 12x12 K_m to global 24x24 (u=0, v=1, rz=5)
            map_m = []
            for i in range(4): map_m.extend([i*6+0, i*6+1, i*6+5])
            
            for i in range(12):
                for j in range(12):
                    K[map_m[i], map_m[j]] += K_m[i, j]

    # --- 2. Bending Stiffness Integration (2x2) ---
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
            
            # Kirchhoff-Mindlin bending B-matrix
            # kappa_x = d(theta_y)/dx  => M11 row uses ry (DOF index 2 in local bending)
            # kappa_y = -d(theta_x)/dy => M22 row uses rx (DOF index 1 in local bending)
            # Local bending DOF order per node: [w(0), rx(1), ry(2)]
            B_b = np.zeros((3, 12))
            for i in range(4):
                B_b[0, 3*i+2] = dN_dx[i]   # M11: d(theta_y)/dx  (ry)
                B_b[1, 3*i+1] = -dN_dy[i]  # M22: -d(theta_x)/dy (rx)
                B_b[2, 3*i+1] = -dN_dx[i]  # M12: -d(theta_x)/dx (rx)
                B_b[2, 3*i+2] = dN_dy[i]   # M12: +d(theta_y)/dy (ry)
                
            K_b = B_b.T @ D_b @ B_b * detJ
            
            # Map 12x12 K_b to global 24x24 (w=2, rx=3, ry=4)
            map_b = []
            for i in range(4): map_b.extend([i*6+2, i*6+3, i*6+4])
            
            for i in range(12):
                for j in range(12):
                    K[map_b[i], map_b[j]] += K_b[i, j]

    # --- 3. Shear Stiffness Integration with Hourglass Stabilization ---
    # We combine 1x1 reduced integration (to prevent shear locking) 
    # with a 5% fraction of 2x2 integration (to stabilize the zero-energy hourglass mode).
    alpha = 0.05
    
    # 1. 1x1 integration part (weight 4.0)
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

    # 2. 2x2 integration part (weight 1.0 per point)
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

    # Combined shear stiffness matrix
    K_s = (1 - alpha) * K_s_1x1 + alpha * K_s_2x2
    
    for i in range(12):
        for j in range(12):
            K[map_b[i], map_b[j]] += K_s[i, j]

    # --- 4. Drilling DOF (Artificial Stiffness for Rz) ---
    # Shell elements naturally lack stiffness around the local Z axis.
    # To prevent singular matrices in 3D assembly, we add a fictitious stiffness.
    k_drilling = 1e-4 * E * t * abs(np.linalg.det(J)) 
    for i in range(4):
        K[i*6+5, i*6+5] += k_drilling

    return K

def recover_shell_stresses(nodes_local: List[List[float]], u_local: np.ndarray, E: float, nu: float, thickness: float) -> Dict[str, float]:
    """
    Recover internal forces/moments (M11, M22, etc.) at the centroid of the element.
    Returns a dictionary of stresses.
    """
    t = thickness
    # Bending constitutive matrix
    D_b = (E * t**3 / (12 * (1 - nu**2))) * np.array([
        [1, nu, 0],
        [nu, 1, 0],
        [0, 0, (1 - nu)/2]
    ])
    
    x = np.array([n[0] for n in nodes_local])
    y = np.array([n[1] for n in nodes_local])
    
    # Evaluate at centroid (xi=0, eta=0)
    xi, eta = 0.0, 0.0
    N = 0.25 * np.array([
        (1 - xi)*(1 - eta),
        (1 + xi)*(1 - eta),
        (1 + xi)*(1 + eta),
        (1 - xi)*(1 + eta)
    ])
    dN_dxi = 0.25 * np.array([-(1 - eta), (1 - eta), (1 + eta), -(1 + eta)])
    dN_deta = 0.25 * np.array([-(1 - xi), -(1 + xi), (1 + xi), (1 - xi)])
    
    J = np.array([
        [np.dot(dN_dxi, x), np.dot(dN_dxi, y)],
        [np.dot(dN_deta, x), np.dot(dN_deta, y)]
    ])
    invJ = np.linalg.inv(J)
    
    dN_dx_dy = invJ @ np.vstack((dN_dxi, dN_deta))
    dN_dx = dN_dx_dy[0, :]
    dN_dy = dN_dx_dy[1, :]
    
    B_b = np.zeros((3, 12))
    for i in range(4):
        B_b[0, 3*i+2] = dN_dx[i]   # M11: d(theta_y)/dx  (ry)
        B_b[1, 3*i+1] = -dN_dy[i]  # M22: -d(theta_x)/dy (rx)
        B_b[2, 3*i+1] = -dN_dx[i]  # M12: -d(theta_x)/dx (rx)
        B_b[2, 3*i+2] = dN_dy[i]   # M12: +d(theta_y)/dy (ry)
        
    # Extract bending DOFs (w, rx, ry) from u_local (24x1)
    u_b = np.zeros(12)
    for i in range(4):
        u_b[3*i+0] = u_local[i*6+2]
        u_b[3*i+1] = u_local[i*6+3]
        u_b[3*i+2] = u_local[i*6+4]
        
    curvature = B_b @ u_b
    moments = -D_b @ curvature  # [M11, M22, M12] Invert sign so sagging (tension at bottom) is positive
    
    # Evaluate principal moments
    M11, M22, M12 = moments[0], moments[1], moments[2]
    M_max = (M11 + M22)/2 + np.sqrt(((M11 - M22)/2)**2 + M12**2)
    M_min = (M11 + M22)/2 - np.sqrt(((M11 - M22)/2)**2 + M12**2)
    
    return {
        "M11": float(M11),
        "M22": float(M22),
        "M12": float(M12),
        "M_max": float(M_max),
        "M_min": float(M_min)
    }

def get_quad_plate_local_stiffness(nodes_local: List[List[float]], E: float, nu: float, thickness: float) -> np.ndarray:
    """
    Computes the 12x12 local stiffness matrix for a 4-node quadrilateral Plate element.
    Nodes must be in counter-clockwise order.
    Formulation: Mindlin-Reissner plate with selective reduced integration (shear locking prevention).
    DOFs per node: [w, theta_x, theta_y]
    """
    K = np.zeros((12, 12))
    
    # Material properties
    t = thickness
    G = E / (2 * (1 + nu))
    
    # Bending constitutive matrix
    D_b = (E * t**3 / (12 * (1 - nu**2))) * np.array([
        [1, nu, 0],
        [nu, 1, 0],
        [0, 0, (1 - nu)/2]
    ])
    
    # Shear constitutive matrix (Mindlin-Reissner)
    k_shear = 5.0 / 6.0 # Shear correction factor
    D_s = (k_shear * G * t) * np.array([
        [1, 0],
        [0, 1]
    ])
    
    # Gauss Integration Points and Weights
    gps_2 = [-1/np.sqrt(3), 1/np.sqrt(3)] # 2x2 for Bending
    gps_1 = [0.0]                         # 1x1 for Shear
    
    x = np.array([n[0] for n in nodes_local])
    y = np.array([n[1] for n in nodes_local])
    
    def shape_funcs(xi, eta):
        N = 0.25 * np.array([
            (1 - xi)*(1 - eta), (1 + xi)*(1 - eta),
            (1 + xi)*(1 + eta), (1 - xi)*(1 + eta)
        ])
        dN_dxi = 0.25 * np.array([-(1 - eta), (1 - eta), (1 + eta), -(1 + eta)])
        dN_deta = 0.25 * np.array([-(1 - xi), -(1 + xi), (1 + xi), (1 - xi)])
        return N, dN_dxi, dN_deta

    # --- 1. Bending Stiffness Integration (2x2) ---
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
                B_b[0, 3*i+2] = dN_dx[i]   # d(ry)/dx
                B_b[1, 3*i+1] = -dN_dy[i]  # -d(rx)/dy
                B_b[2, 3*i+1] = -dN_dx[i]  # -d(rx)/dx
                B_b[2, 3*i+2] = dN_dy[i]   # d(ry)/dy
                
            K += B_b.T @ D_b @ B_b * detJ

    # --- 2. Shear Stiffness Integration (1x1 Reduced Integration) ---
    for xi in gps_1:
        for eta in gps_1:
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
                
            K += B_s.T @ D_s @ B_s * detJ * 4.0  # Weight = 2 * 2 = 4.0 for 1x1 rule

    return K

def get_quad_plate_internal_forces(nodes_local: List[List[float]], u_local: np.ndarray, E: float, nu: float, thickness: float) -> Dict[str, float]:
    """
    Recover internal forces (Mx, My, Mxy, Vx, Vy) at the centroid of the 12-DOF Plate element.
    u_local is a 12x1 array: [w1, rx1, ry1, w2, rx2, ry2, ...].
    """
    t = thickness
    G = E / (2 * (1 + nu))
    
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
    
    x = np.array([n[0] for n in nodes_local])
    y = np.array([n[1] for n in nodes_local])
    
    # Evaluate at centroid (xi=0, eta=0)
    xi, eta = 0.0, 0.0
    N = 0.25 * np.array([
        (1 - xi)*(1 - eta), (1 + xi)*(1 - eta),
        (1 + xi)*(1 + eta), (1 - xi)*(1 + eta)
    ])
    dN_dxi = 0.25 * np.array([-(1 - eta), (1 - eta), (1 + eta), -(1 + eta)])
    dN_deta = 0.25 * np.array([-(1 - xi), -(1 + xi), (1 + xi), (1 - xi)])
    
    J = np.array([
        [np.dot(dN_dxi, x), np.dot(dN_dxi, y)],
        [np.dot(dN_deta, x), np.dot(dN_deta, y)]
    ])
    invJ = np.linalg.inv(J)
    
    dN_dx_dy = invJ @ np.vstack((dN_dxi, dN_deta))
    dN_dx = dN_dx_dy[0, :]
    dN_dy = dN_dx_dy[1, :]
    
    B_b = np.zeros((3, 12))
    B_s = np.zeros((2, 12))
    
    for i in range(4):
        # Bending
        B_b[0, 3*i+2] = dN_dx[i]
        B_b[1, 3*i+1] = -dN_dy[i]
        B_b[2, 3*i+1] = -dN_dx[i]
        B_b[2, 3*i+2] = dN_dy[i]
        # Shear
        B_s[0, 3*i+0] = dN_dx[i]
        B_s[0, 3*i+2] = N[i]
        B_s[1, 3*i+0] = dN_dy[i]
        B_s[1, 3*i+1] = -N[i]
        
    curvature = B_b @ u_local
    shear_strain = B_s @ u_local
    
    moments = -D_b @ curvature  # [Mx, My, Mxy]
    shears = D_s @ shear_strain # [Vx, Vy]
    
    return {
        "Mx": float(moments[0]),
        "My": float(moments[1]),
        "Mxy": float(moments[2]),
        "Vx": float(shears[0]),
        "Vy": float(shears[1])
    }
