"""
foundation/post_processor.py
Post-processing mixin: moment and shear computation from displacement field.

Provides:
  - PostProcessor mixin class

Units: N, m, Pa  →  outputs stored as N·m/m and N/m
"""

import numpy as np


class PostProcessor:
    """
    Mixin: compute bending moments and shear forces from the FEM displacement field.

    Requires attributes set by GrillageSolver (w, nx, ny, dx, dy, E, h, nu, G, d_eff,
    f_c, lambda_aci, phi_shear, n_nodes).
    """

    def compute_moments(self) -> tuple:
        """
        Calculate plate bending moments Mx, My, Mxy using FEM shape functions and apply Wood-Armer.
        Returns Wood-Armer design moments.
        """
        from app.engine.fem_shell import get_quad_plate_internal_forces
        
        self.Mx = np.zeros((self.n_nodes_y, self.n_nodes_x))
        self.My = np.zeros((self.n_nodes_y, self.n_nodes_x))
        self.Mxy = np.zeros((self.n_nodes_y, self.n_nodes_x))
        self.Qx = np.zeros((self.n_nodes_y, self.n_nodes_x))
        self.Qy = np.zeros((self.n_nodes_y, self.n_nodes_x))
        counts = np.zeros((self.n_nodes_y, self.n_nodes_x))

        for j in range(self.ny):
            for i in range(self.nx):
                n1 = j * self.n_nodes_x + i
                n2 = j * self.n_nodes_x + (i + 1)
                n3 = (j + 1) * self.n_nodes_x + (i + 1)
                n4 = (j + 1) * self.n_nodes_x + i
                
                nodes_local = [
                    [self.x[i], self.y[j]],
                    [self.x[i+1], self.y[j]],
                    [self.x[i+1], self.y[j+1]],
                    [self.x[i], self.y[j+1]]
                ]
                
                u_local = np.zeros(12)
                for k, nid in enumerate([n1, n2, n3, n4]):
                    u_local[3*k+0] = self.U[3*nid+0]
                    u_local[3*k+1] = self.U[3*nid+1]
                    u_local[3*k+2] = self.U[3*nid+2]
                    
                forces = get_quad_plate_internal_forces(nodes_local, u_local, self.E, self.nu, self.h)
                
                for r, c in [(j,i), (j,i+1), (j+1,i+1), (j+1,i)]:
                    self.Mx[r, c] += forces["Mx"]
                    self.My[r, c] += forces["My"]
                    self.Mxy[r, c] += forces["Mxy"]
                    self.Qx[r, c] += forces["Vx"]
                    self.Qy[r, c] += forces["Vy"]
                    counts[r, c] += 1
                    
        self.Mx /= np.maximum(counts, 1)
        self.My /= np.maximum(counts, 1)
        self.Mxy /= np.maximum(counts, 1)
        self.Qx /= np.maximum(counts, 1)
        self.Qy /= np.maximum(counts, 1)

        # Wood-Armer Equations for design moments (Envelope of top/bottom)
        # Mud_x = |Mx| + |Mxy|
        # Mud_y = |My| + |Mxy|
        self.Mx_raw = self.Mx.copy()
        self.My_raw = self.My.copy()
        
        self.Mx = np.abs(self.Mx) + np.abs(self.Mxy)
        self.My = np.abs(self.My) + np.abs(self.Mxy)

        print(f"  Mx_design_max (Wood-Armer) = {np.max(self.Mx) / 1000:.3f} kN·m/m")
        print(f"  My_design_max (Wood-Armer) = {np.max(self.My) / 1000:.3f} kN·m/m")
        return self.Mx, self.My, self.Mxy

    def compute_shear(self) -> tuple:
        """
        Calculate plate shear forces Qx, Qy (already extracted from FEM) and verify against ACI 318.
        """

        self.Vu = np.maximum(np.abs(self.Qx), np.abs(self.Qy))
        bw_mm = 1000
        d_mm = self.d_eff * 1000
        # ACI 318-19 Eq. 22.5.5.1: Vc = 0.17·λ·√f'c · bw · d  (one-way shear in slabs)
        self.Vc = 0.17 * self.lambda_aci * np.sqrt(self.f_c) * bw_mm * d_mm  # N/m
        self.phiVc = self.phi_shear * self.Vc
        self.shear_ratio = self.Vu / self.phiVc
        self.shear_ok = self.Vu <= self.phiVc

        print("\nVerificación de cortante (ACI 318):")
        print(f"  Vu_max = {np.max(self.Vu) / 1000:.3f} kN/m")
        print(f"  Vc = {self.Vc / 1000:.3f} kN/m")
        print(f"  phi_Vc = {self.phiVc / 1000:.3f} kN/m")
        print(f"  Ratio Vu/phi_Vc max = {np.max(self.shear_ratio):.3f}")
        print(
            f"  Estado: {'CUMPLE OK' if np.all(self.shear_ok) else 'NO CUMPLE FAIL'}"
        )
        if not np.all(self.shear_ok):
            n_fail = int(np.sum(~self.shear_ok))
            print(
                f"  Nodos que no cumplen: {n_fail} de {self.n_nodes} "
                f"({100 * n_fail / self.n_nodes:.1f}%)"
            )
        return self.Qx, self.Qy, self.Vu, self.shear_ok
