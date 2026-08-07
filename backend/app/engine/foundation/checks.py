"""
foundation/checks.py
Structural verification mixin: differential settlements, punching shear, design report.

Provides:
  - StructuralChecks mixin class

Units: N, m, Pa  →  outputs reported in kN, mm
"""

from typing import List
import re
import numpy as np

def get_equivalent_rebars_spacing(as_req_cm2_m, min_spacing=10, max_spacing=30):
    diameters = {7: 0.385, 8: 0.503, 10: 0.785, 12: 1.13, 16: 1.99, 19: 2.84}
    options = []
    # 1. Exact calculated options
    for d, area in diameters.items():
        s_m = area / as_req_cm2_m
        s_cm = int(s_m * 100)
        if s_cm > max_spacing:
            s_cm = max_spacing
        if s_cm >= min_spacing:
            opt = f"Ø{d}@{s_cm}cm"
            if opt not in options:
                options.append(opt)
            
    # 2. Standard commercial spacings for live testing (10, 12, 15, 18, 20, 25, 30 cm)
    for d in [7, 8, 10, 12, 16]:
        for s_step in [10, 12, 15, 18, 20, 25, 30]:
            opt = f"Ø{d}@{s_step}cm"
            if opt not in options:
                options.append(opt)

    return options

def get_equivalent_rebars_count(as_req_cm2, min_bars=2, max_bars=6):
    diameters = {10: 0.785, 12: 1.13, 16: 1.99, 19: 2.84}
    options = []
    for d, area in diameters.items():
        n = int(np.ceil(as_req_cm2 / area))
        if n < min_bars:
            n = min_bars
        if n <= max_bars:
            options.append(f"{n}Ø{d}")
    if not options:
        options.append(f"{min_bars}Ø19")
    return options

class StructuralChecks:
    """
    Mixin: ACI 318 / COVENIN structural checks for the foundation slab.

    Requires attributes set by GrillageSolver and PostProcessor
    (w, Mx, My, Vu, Vc, phiVc, shear_ok, Asx_bot, Asy_bot,
     Asx_top, Asy_top, walls, columns, X, Y, nx, ny,
     n_nodes_x, n_nodes_y, dx, dy, d_eff, h, f_c, f_y,
     lambda_aci, phi_punch, gamma_horm, k,
     max_settlement_ratio, band_data, settlement_data, punching_data).
    """

    def check_differential_settlements(self) -> List[dict]:
        """
        Verify differential settlements under each wall.

        Returns
        -------
        list of dicts with keys: id, type, length, delta_w_mm, ratio, ok
        """
        print("\n=== VERIFICACIÓN DE ASENTAMIENTOS DIFERENCIALES ===")
        print(
            f"Criterio: L/Dw >= {self.max_settlement_ratio} "
            "(mampostería/cubierta liviana)"
        )
        print(
            f"{'Muro':<6} {'Tipo':<12} {'Long. (m)':<10} "
            f"{'Dw (mm)':<10} {'Ratio L/Dw':<12} {'Estado':<10}"
        )
        print("-" * 70)

        results: List[dict] = []
        for idx, wall in enumerate(self.walls):
            tol = max(wall.thickness / 2, min(self.dx, self.dy))
            w_vals = []
            for j in range(self.n_nodes_y):
                for i in range(self.n_nodes_x):
                    dps = self._point_segment_distance(
                        self.X[j, i], self.Y[j, i],
                        wall.x1, wall.y1, wall.x2, wall.y2,
                    )
                    if dps <= tol:
                        w_vals.append(self.w[j, i])

            if len(w_vals) < 2:
                continue

            w_arr = np.array(w_vals)
            delta_w = float(np.max(w_arr) - np.min(w_arr))
            delta_w_mm = delta_w * 1000

            ratio = wall.length / delta_w if delta_w > 1e-6 else 99999.0
            ok = ratio >= self.max_settlement_ratio
            status = "OK" if ok else "NO CUMPLE FAIL"

            results.append(
                {
                    "id": int(idx),
                    "type": str(wall.wall_type),
                    "length": float(wall.length),
                    "delta_w_mm": float(delta_w_mm),
                    "ratio": float(ratio),
                    "ok": bool(ok),
                }
            )
            print(
                f"{idx:<6} {wall.wall_type:<12} {wall.length:<10.2f} "
                f"{delta_w_mm:<10.2f} {ratio:<12.1f} {status:<10}"
            )

        self.settlement_data = results
        all_ok = all(r["ok"] for r in results) if results else True
        print(
            f"\nEstado global asentamientos: "
            f"{'CUMPLE OK' if all_ok else 'NO CUMPLE FAIL'}"
        )
        return results

    def check_punching(self) -> List[dict]:
        """
        Simplified two-way punching shear check at corners and machones (ACI 318).

        Returns
        -------
        list of dicts with keys: id, type, Vu_kN, Vc_kN, phiVc_kN, ratio, ok
        """
        print("\n=== VERIFICACIÓN DE PUNZONAMIENTO EN ESQUINAS Y MACHONES ===")
        print(
            f"{'Elemento':<15} {'Vu (kN)':<12} {'Vc (kN)':<12} "
            f"{'phi_Vc (kN)':<12} {'Ratio':<8} {'Estado':<10}"
        )
        print("-" * 75)

        results: List[dict] = []
        d = self.d_eff

        # 1. Machones (Columns / Pilares)
        for col in self.columns:
            # Critical perimeter b0 (ACI 318 Sec 22.6)
            b0 = 2 * (col.width + d) + 2 * (col.length + d)
            area_crit = (col.width + d) * (col.length + d)

            # Net Vu = Pu − q_soil × area_crit  (ACI 318-19 Sec 13.2.7)
            q_soil_avg = float(np.mean(np.abs(self.w) * self.k))  # Pa
            Vu = max(col.P_u - q_soil_avg * area_crit, 0.0)

            # Concrete resistance: vc = 0.33·λ·√f'c  (MPa)
            vc_MPa = 0.33 * self.lambda_aci * np.sqrt(self.f_c)
            Vc = vc_MPa * 1e6 * b0 * d
            phiVc = self.phi_punch * Vc
            ratio = Vu / phiVc if phiVc > 0 else 0.0
            ok = ratio <= 1.0

            results.append(
                {
                    "id": f"Machón {col.id}",
                    "type": "columna",
                    "Vu_kN": float(Vu / 1000),
                    "Vc_kN": float(Vc / 1000),
                    "phiVc_kN": float(phiVc / 1000),
                    "ratio": float(ratio),
                    "ok": bool(ok),
                }
            )
            print(
                f"Machón {col.id:<8} {Vu/1000:<12.1f} {Vc/1000:<12.1f} "
                f"{phiVc/1000:<12.1f} {ratio:<8.2f} "
                f"{'CUMPLE OK' if ok else 'NO CUMPLE FAIL'}"
            )

        # 2. Perimeter wall corners
        corners = []
        for w in self.walls:
            if w.wall_type == "perimetral":
                corners.append((w.x1, w.y1, w.thickness))
                corners.append((w.x2, w.y2, w.thickness))

        # Deduplicate nearby corners (< 0.3 m apart)
        unique_corners = []
        for c in corners:
            xc, yc, t = c
            if not any(
                np.hypot(xc - ux, yc - uy) < 0.3 for ux, uy, _ in unique_corners
            ):
                unique_corners.append((xc, yc, t))

        for idx, (xc, yc, tw) in enumerate(unique_corners):
            side_x = tw + d / 2
            side_y = tw + d / 2
            b0 = side_x + side_y
            area_crit = side_x * side_y

            wall_load = 0.0
            for w in self.walls:
                d1 = np.hypot(w.x1 - xc, w.y1 - yc)
                d2 = np.hypot(w.x2 - xc, w.y2 - yc)
                if d1 < 0.5 or d2 < 0.5:
                    wall_load += w.q_lineal * max(side_x, side_y)

            q_slab = self.h * self.gamma_horm * 9.81 * 1.2 * area_crit
            Vu = wall_load + q_slab

            vc_MPa = 0.33 * self.lambda_aci * np.sqrt(self.f_c)
            Vc = vc_MPa * 1e6 * b0 * d
            phiVc = self.phi_punch * Vc
            ratio = Vu / phiVc if phiVc > 0 else 0.0
            ok = ratio <= 1.0

            results.append(
                {
                    "id": f"Esquina {idx + 1}",
                    "type": "esquina",
                    "Vu_kN": float(Vu / 1000),
                    "Vc_kN": float(Vc / 1000),
                    "phiVc_kN": float(phiVc / 1000),
                    "ratio": float(ratio),
                    "ok": bool(ok),
                }
            )
            print(
                f"Esquina {idx + 1:<7} {Vu/1000:<12.1f} {Vc/1000:<12.1f} "
                f"{phiVc/1000:<12.1f} {ratio:<8.2f} "
                f"{'CUMPLE OK' if ok else 'NO CUMPLE FAIL'}"
            )

        self.punching_data = results
        all_ok = all(r["ok"] for r in results) if results else True
        print(
            f"\nEstado global punzonamiento: "
            f"{'CUMPLE OK' if all_ok else 'NO CUMPLE FAIL'}"
        )
        return results

    def check_sliding(self) -> dict:
        """
        Calculates sliding factor of safety.
        FS_sliding = (Sum_V * friction_coefficient) / Sum_H
        """
        if not hasattr(self, 'retaining_walls') or not self.retaining_walls:
            return {"active": False}
            
        print("\n=== VERIFICACIÓN DE DESLIZAMIENTO ===")
        # 1. Total horizontal force from earth pressure
        total_H_N = sum(rw.v_base * rw.length for rw in self.retaining_walls)
        
        # 2. Total vertical force (Service load approx)
        # Slab weight
        slab_weight_N = self.Lx * self.Ly * self.h * self.gamma_horm * 9.81
        
        # Standard walls weight (q_lineal has load factors, assume avg 1.2)
        walls_weight_N = sum((w.q_lineal / w.load_factor) * w.length for w in self.walls)
        
        # Retaining walls weight
        rw_weight_N = sum((rw.q_vertical / 1.2) * rw.length for rw in self.retaining_walls)
        
        # Columns load (load_kgf * 9.81)
        columns_weight_N = sum(c.load_kgf * 9.81 for c in self.columns)
        
        total_V_N = slab_weight_N + walls_weight_N + rw_weight_N + columns_weight_N
        
        # Friction coefficient mu = tan(phi). Assuming average phi = 30 deg -> tan(30) = 0.577
        # We can use the phi from the first retaining wall
        phi_avg = self.retaining_walls[0].phi if self.retaining_walls else 30.0
        mu = float(np.tan(np.radians(phi_avg)))
        
        fs_sliding = (total_V_N * mu) / total_H_N if total_H_N > 0 else 999.0
        
        ok = fs_sliding >= 1.5
        
        print(f"  Fuerza Horizontal (Empuje): {total_H_N/1000:.2f} kN")
        print(f"  Fuerza Vertical (Peso): {total_V_N/1000:.2f} kN")
        print(f"  Coeficiente de Fricción: {mu:.3f}")
        print(f"  Factor de Seguridad (FS): {fs_sliding:.2f} (Req >= 1.5) -> {'CUMPLE' if ok else 'NO CUMPLE'}")
        
        self.sliding_data = {
            "active": True,
            "total_H_kN": float(total_H_N / 1000),
            "total_V_kN": float(total_V_N / 1000),
            "mu": float(mu),
            "fs": float(fs_sliding),
            "ok": bool(ok)
        }
        return self.sliding_data
    def design_retaining_wall_stem(self, rw) -> dict:
        """
        Design the vertical stem of a cantilever retaining wall.
        Uses 1.6 load factor for earth pressure (ACI 318).
        """
        gamma = rw.soil_density # N/m3
        H = rw.soil_height
        phi_rad = np.radians(rw.phi)
        
        # Ka = tan^2(45 - phi/2)
        Ka = np.tan(np.radians(45) - phi_rad/2)**2
        
        # Ea = 0.5 * gamma * H^2 * Ka
        Ea_N_m = 0.5 * gamma * (H**2) * Ka
        
        # M_o = Ea * H/3 (Volcamiento base)
        Mo_Nm_m = Ea_N_m * (H / 3)
        
        # Factores de carga (ACI-318 empuje suelo = 1.6)
        Mu_Nm_m = 1.6 * Mo_Nm_m
        Vu_N_m = 1.6 * Ea_N_m
        
        b = 1.0 # m
        cover = 0.05 # m
        d = rw.thickness - cover
        
        if d <= 0:
            d = 0.01
            
        # Shear capacity: phi_Vc = 0.75 * 0.17 * sqrt(f_c MPa) * b * d * 1e6
        phi_shear = 0.75
        fc_MPa = self.f_c
        phi_Vc_N_m = phi_shear * 0.17 * np.sqrt(fc_MPa) * b * d * 1e6
        
        shear_ok = bool(Vu_N_m <= phi_Vc_N_m)
        
        # Flexural steel (Whitney)
        phi_flex = 0.90
        # Mu = phi * As * fy * (d - a/2)
        # a = As * fy / (0.85 * f_c * b)
        # Simplify iteratively
        As_m2 = 0.0
        a = 0.0
        fy_Pa = self.f_y * 1e6
        fc_Pa = self.f_c * 1e6
        
        # M_n = Mu / phi
        Mn_req = Mu_Nm_m / phi_flex
        
        if Mn_req > 0:
            for _ in range(10):
                As_m2 = Mn_req / (fy_Pa * (d - a/2))
                a = (As_m2 * fy_Pa) / (0.85 * fc_Pa * b)
            
        # Vertical tension face steel (Cara Interior / Tracción: flexión + min 0.0018 -> 2.70 cm2/m)
        As_trac_min_m2 = 0.0018 * b * rw.thickness
        As_trac_cm2_m = max(As_m2, As_trac_min_m2) * 10000
        trac_options = get_equivalent_rebars_spacing(As_trac_cm2_m)
        
        # Vertical compression face steel (Cara Exterior / Compresión: min 0.0010 -> 1.50 cm2/m)
        As_comp_min_m2 = 0.0010 * b * rw.thickness
        As_comp_cm2_m = As_comp_min_m2 * 10000
        comp_options = get_equivalent_rebars_spacing(As_comp_cm2_m)
        
        # Combine vertical options pairwise with explicit face names
        proposed_rebar_options = []
        for i in range(len(trac_options)):
            comp = comp_options[i] if i < len(comp_options) else comp_options[-1]
            proposed_rebar_options.append(f"Trac (Int): {trac_options[i]} | Comp (Ext): {comp}")
            
        # Horizontal steel per face (ACI 318 Cap 11)
        # Tension face (Interior): 0.0015 * b * t -> 2.25 cm2/m
        As_horiz_trac_cm2_m = 0.0015 * b * rw.thickness * 10000
        horiz_trac_options = get_equivalent_rebars_spacing(As_horiz_trac_cm2_m)

        # Compression face (Exterior): 0.0010 * b * t -> 1.50 cm2/m
        As_horiz_comp_cm2_m = 0.0010 * b * rw.thickness * 10000
        horiz_comp_options = get_equivalent_rebars_spacing(As_horiz_comp_cm2_m)

        # Pairwise horizontal rebar options for both faces independently
        horiz_options = []
        for i in range(len(horiz_trac_options)):
            h_comp = horiz_comp_options[i] if i < len(horiz_comp_options) else horiz_comp_options[-1]
            horiz_options.append(f"Trac (Int): {horiz_trac_options[i]} | Comp (Ext): {h_comp}")
            
        return {
            "id": rw.id if hasattr(rw, 'id') and rw.id else "Muro",
            "H_m": float(H),
            "thickness_m": float(rw.thickness),
            "Mu_kgfm_m": float(Mu_Nm_m / 9.80665),
            "Vu_kgf_m": float(Vu_N_m / 9.80665),
            "phiVc_kgf_m": float(phi_Vc_N_m / 9.80665),
            "shear_ok": shear_ok,
            "As_req_cm2_m": float(As_trac_cm2_m),
            "As_comp_cm2_m": float(As_comp_cm2_m),
            "proposed_rebar": proposed_rebar_options[0] if proposed_rebar_options else "",
            "proposed_rebar_options": proposed_rebar_options,
            "As_horiz_cm2_m": float(As_horiz_trac_cm2_m),
            "As_horiz_comp_cm2_m": float(As_horiz_comp_cm2_m),
            "proposed_rebar_horiz": horiz_options[0] if horiz_options else "",
            "proposed_rebar_horiz_options": horiz_options,
            # Explicit separate fields for constructor table
            "rebar_trac_vert": trac_options[0] if trac_options else "",
            "rebar_trac_vert_options": trac_options,
            "rebar_trac_horiz": horiz_trac_options[0] if horiz_trac_options else "",
            "rebar_trac_horiz_options": horiz_trac_options,
            "rebar_comp_vert": comp_options[0] if comp_options else "",
            "rebar_comp_vert_options": comp_options,
            "rebar_comp_horiz": horiz_comp_options[0] if horiz_comp_options else "",
            "rebar_comp_horiz_options": horiz_comp_options
        }

    def design_support_beam(self, sb) -> dict:
        """
        Design the reinforcement for a support beam embedded in the slab.
        """
        n_points = max(10, int(sb.length / min(self.dx, self.dy)))
        max_M = 0.0
        max_V = 0.0
        
        is_x_dir = abs(sb.x2 - sb.x1) > abs(sb.y2 - sb.y1)
        
        for t in np.linspace(0, 1, n_points):
            xp = sb.x1 + t * (sb.x2 - sb.x1)
            yp = sb.y1 + t * (sb.y2 - sb.y1)
            
            ni = int(np.clip(int(round(xp / self.dx)), 0, self.nx))
            nj = int(np.clip(int(round(yp / self.dy)), 0, self.ny))
            
            if is_x_dir:
                M = abs(self.Mx_raw[nj, ni]) if hasattr(self, 'Mx_raw') else abs(self.Mx[nj, ni])
            else:
                M = abs(self.My_raw[nj, ni]) if hasattr(self, 'My_raw') else abs(self.My[nj, ni])
                
            V = abs(self.Vu[nj, ni]) if hasattr(self, 'Vu') else 0.0
            
            max_M = max(max_M, float(M))
            max_V = max(max_V, float(V))
            
        # Band width for support beam moment integration
        band_w = max(sb.width + 2 * self.d_eff, 0.50)
        Mu_slab = max_M * band_w
        Vu_slab = max_V * band_w

        # Compute direct moment from collinear walls and machones (column point loads)
        def _pt_seg_dist(px, py, x1, y1, x2, y2):
            dx, dy = x2 - x1, y2 - y1
            l2 = dx*dx + dy*dy
            if l2 < 1e-9:
                return float(np.hypot(px - x1, py - y1))
            t = max(0.0, min(1.0, ((px - x1)*dx + (py - y1)*dy)/l2))
            return float(np.hypot(px - (x1 + t*dx), py - (y1 + t*dy)))

        q_wall = 0.0
        for w in getattr(self, 'walls', []):
            w_mid_x = (w.x1 + w.x2) / 2.0
            w_mid_y = (w.y1 + w.y2) / 2.0
            if _pt_seg_dist(w_mid_x, w_mid_y, sb.x1, sb.y1, sb.x2, sb.y2) < 0.4:
                q_wall += getattr(w, 'q_lineal', 0.0)

        P_cols = 0.0
        col_count = 0
        for col in getattr(self, 'columns', []):
            if _pt_seg_dist(col.x, col.y, sb.x1, sb.y1, sb.x2, sb.y2) < 0.4:
                P_cols += getattr(col, 'P_u', 0.0)
                col_count += 1

        q_beam_self = sb.width * sb.depth * self.gamma_horm * 9.81 * 1.2
        q_total_m = q_wall + q_beam_self

        l_span = sb.length / max(col_count - 1, 1) if col_count > 1 else max(1.5, sb.length / 3)
        l_span = min(l_span, 3.0)

        Mu_direct = (q_total_m * (l_span ** 2)) / 8.0
        if col_count > 0 and P_cols > 0:
            P_avg = P_cols / col_count
            Mu_direct += (P_avg * l_span) / 4.0

        Vu_direct = (q_total_m * l_span) / 2.0 + (P_cols / 2.0 if col_count > 0 else 0.0)

        Mu_beam = max(Mu_slab, Mu_direct)
        Vu_beam = max(Vu_slab, Vu_direct)
        
        b = sb.width
        h = sb.depth
        cover = 0.05
        d = h - cover
        if d <= 0: d = 0.01
        
        fc_Pa = self.f_c * 1e6
        fy_Pa = self.f_y * 1e6
        
        phi_flex = 0.90
        Mn_req = Mu_beam / phi_flex
        
        beta1 = 0.85
        if self.f_c > 28.0:
            beta1 = max(0.65, 0.85 - 0.05 * (self.f_c - 28.0) / 7.0)
            
        c_max = 0.375 * d
        a_max = beta1 * c_max
        C_max = 0.85 * fc_Pa * b * a_max
        Mnt_max = C_max * (d - a_max / 2)
        
        # 1.4/fy formula usually has fy in MPa for the constant 1.4 to work.
        # But here self.f_y is in MPa.
        As_min_m2 = max(0.0033 * b * d, (1.4 / self.f_y) * b * d)
        
        # Commercial bar sizes: (diam_mm, area_cm2)
        BAR_SIZES = [(12, 1.13), (10, 0.71), (16, 2.01), (20, 3.14)]
        
        if Mn_req <= Mnt_max:
            # Singly reinforced
            As_m2 = 0.0
            a = 0.0
            if Mn_req > 0:
                for _ in range(10):
                    As_m2 = Mn_req / (fy_Pa * (d - a/2))
                    a = (As_m2 * fy_Pa) / (0.85 * fc_Pa * b)
                    
            As_req_cm2 = max(As_m2, As_min_m2) * 10000
            
            # Fully programmed dynamic rebar combination solver
            bars_catalog = [(10, 0.71), (12, 1.13), (16, 2.01), (20, 3.14)]
            valid_combos = []
            
            # Maximum bars per horizontal layer based on ACI 318 Sec 25.2 (min clear spacing 2.5 cm)
            b_int = max(0.05, b - 2*cover - 0.02)
            max_bars_layer1 = max(2, int((b_int + 0.025) / (0.012 + 0.025))) # 2 bars for b=15cm

            # Maximum reasonable steel provided (don't suggest absurdly oversized options > 1.8x As_req or > As_req + 2.0 cm2)
            max_as_prov = max(As_req_cm2 * 1.8, As_req_cm2 + 2.0)
            if As_req_cm2 < 3.0:
                max_as_prov = min(max_as_prov, 4.2)

            # Single bar combinations (e.g., 2Ø10, 2Ø12, 2Ø16)
            for d1, a1 in bars_catalog:
                for n1 in range(2, max_bars_layer1 + 1):
                    as_prov = round(n1 * a1, 2)
                    if As_req_cm2 - 0.05 <= as_prov <= max_as_prov:
                        valid_combos.append((as_prov, f"{n1}Ø{d1} Inf + 2Ø10 Sup"))

            # Hybrid / 2-layer combinations (e.g., 2Ø12 + 1Ø10 (2 capas) = 2.97 cm2)
            for d1, a1 in [(12, 1.13), (16, 2.01)]:
                for d2, a2 in [(10, 0.71), (12, 1.13)]:
                    if d1 == d2:
                        continue
                    for n_cent in [1, 2]:
                        as_prov = round(2 * a1 + n_cent * a2, 2)
                        if As_req_cm2 - 0.05 <= as_prov <= max_as_prov:
                            valid_combos.append((as_prov, f"2Ø{d1} + {n_cent}Ø{d2} (2 capas) Inf + 2Ø10 Sup"))

            # Sort programmatically by efficiency (smallest provided steel area >= required)
            valid_combos.sort(key=lambda x: x[0])
            
            seen_combos = set()
            proposed_rebar_options = []
            for as_p, lbl in valid_combos:
                if lbl not in seen_combos:
                    seen_combos.add(lbl)
                    proposed_rebar_options.append(lbl)
                    
            if not proposed_rebar_options:
                proposed_rebar_options = ["2Ø16 Inf + 2Ø10 Sup"]
                
            proposed_rebar = proposed_rebar_options[0]
            
            # Determine n_bars_bot and n_bars_top for return dict
            n_bars_top = 2
            if '+' in proposed_rebar.split('Inf')[0]:
                n_bars_bot = 0
                for pt in proposed_rebar.split('Inf')[0].split('+'):
                    m_p = re.search(r'(\d+)Ø', pt)
                    if m_p:
                        n_bars_bot += int(m_p.group(1))
            else:
                m_p = re.search(r'(\d+)Ø', proposed_rebar)
                n_bars_bot = int(m_p.group(1)) if m_p else 2
        else:
            # Doubly reinforced
            Mn2 = Mn_req - Mnt_max
            d_prime = cover
            
            epsilon_s_prime = 0.003 * (c_max - d_prime) / c_max
            fs_prime = min(fy_Pa, 200e9 * epsilon_s_prime)
            if fs_prime <= 0: fs_prime = 1.0 # fallback
            
            As_prime_m2 = Mn2 / (fs_prime * (d - d_prime))
            As1_m2 = C_max / fy_Pa
            As2_m2 = Mn2 / (fy_Pa * (d - d_prime))
            
            As_req_cm2 = max(As1_m2 + As2_m2, As_min_m2) * 10000
            As_prime_cm2 = As_prime_m2 * 10000
            
            best_bot_d = 16
            best_bot_n = 2
            for d_mm, area_bar in [(16, 2.01), (12, 1.13), (20, 3.14)]:
                n_req = int(np.ceil(As_req_cm2 / area_bar))
                if n_req < 2:
                    n_req = 2
                if n_req <= 6:
                    best_bot_d = d_mm
                    best_bot_n = n_req
                    break

            n_bars_bot = best_bot_n
            n_bars_top = int(np.ceil(As_prime_cm2 / 2.01))
            if n_bars_top < 2: n_bars_top = 2
            
            proposed_rebar = f"{n_bars_bot}Ø{best_bot_d} Inf + {n_bars_top}Ø16 Sup"
        
        phi_shear = 0.75
        vc_MPa = 0.17 * np.sqrt(self.f_c)
        Vc = vc_MPa * 1e6 * b * d
        
        Vs_req = max(0.0, (Vu_beam / phi_shear) - Vc)
        
        stirrup_area = 0.71 * 2
        if Vs_req > 0:
            s_req = (stirrup_area / 10000.0) * fy_Pa * d / Vs_req
        else:
            s_req = d / 2
            
        s_cm = min(int(s_req * 100), int(d/2 * 100), 30)
        if s_cm < 10: s_cm = 10
        
        return {
            "id": sb.id if hasattr(sb, 'id') and sb.id else "Viga Apoyo",
            "b_m": float(b),
            "h_m": float(h),
            "length_m": float(sb.length),
            "Mu_kgfm": float(Mu_beam / 9.80665),
            "Vu_kgf": float(Vu_beam / 9.80665),
            "As_req_cm2": float(As_req_cm2),
            "n_bars_bot": int(n_bars_bot),
            "n_bars_top": int(n_bars_top),
            "proposed_rebar": proposed_rebar,
            "proposed_rebar_options": proposed_rebar_options if 'proposed_rebar_options' in locals() else [proposed_rebar],
            "proposed_stirrups": f"Ø10@{s_cm}cm",
            "proposed_stirrups_options": [f"Ø10@{s_cm}cm", f"Ø10@{max(10, s_cm-5)}cm"]
        }

    def generate_design_report(self) -> None:
        """Print a concise design summary to the console."""
        print("\n" + "=" * 80)
        print("RESUMEN DE DISEÑO - LOSA DE CIMENTACIÓN")
        print("=" * 80)
        print(
            f"Geometría: {self.Lx:.1f} x {self.Ly:.1f} m | "
            f"Espesor h = {self.h * 100:.0f} cm"
        )
        print(
            f"Malla: {self.nx}x{self.ny} | d_eff = {self.d_eff * 100:.1f} cm"
        )
        print(
            f"Concreto H-{self.f_c:.0f} | Acero fy = {self.f_y:.0f} MPa"
        )
        print(f"Suelo: k = {self.k / 1e6:.1f} MN/m³")
        print("-" * 80)

        print("\n1. DESPLAZAMIENTOS")
        print(f"   w_max = {np.max(np.abs(self.w)) * 1000:.2f} mm")

        print("\n2. MOMENTOS (cargas ya factorizadas en add_wall/add_column)")
        print(f"   Mx_max = {np.max(np.abs(self.Mx)) / 1000:.2f} kN·m/m")
        print(f"   My_max = {np.max(np.abs(self.My)) / 1000:.2f} kN·m/m")

        print("\n3. CORTANTE")
        print(f"   Vu_max = {np.max(self.Vu) / 1000:.2f} kN/m")
        print(f"   phi_Vc = {self.phiVc / 1000:.2f} kN/m")
        print(
            f"   Estado: {'CUMPLE' if np.all(self.shear_ok) else 'NO CUMPLE'}"
        )

        # Bands, settlements and punching are already printed by their own methods.
        print("\n" + "=" * 80)
