"""
foundation/designer.py
Reinforcement design mixin: steel area calculation and bar-proposal logic.

Provides:
  - ReinforcementDesigner mixin class

Units: m, N, Pa  →  outputs in m²/m (stored), cm²/m (reported)
"""

import numpy as np


class ReinforcementDesigner:
    """
    Mixin: ACI 318 flexural steel design for the foundation slab,
    including band-based reinforcement assignment and bar proposals.

    Requires attributes set by GrillageSolver and PostProcessor
    (Mx, My, w, h, d_eff, f_c, f_y, rho_min, phi_flex,
     bar_diameters_mm, bar_areas_mm2, walls, X, Y,
     n_nodes_x, n_nodes_y, band_data, nx, ny).
    """

    def _calc_steel(self, Mu: np.ndarray) -> tuple:
        """
        Calculate required steel area per unit width for a moment array.

        Parameters
        ----------
        Mu : np.ndarray  design moment (N·m/m)

        Returns
        -------
        As     : np.ndarray  required As (m²/m), ≥ As_min
        a      : np.ndarray  compression block depth (m)
        As_calc: np.ndarray  calculated As before applying As_min (m²/m)
        """
        fc = self.f_c * 1e6           # Pa
        fy = self.f_y * 1e6           # Pa
        d = self.d_eff
        phi = self.phi_flex
        b = 1.0                        # unit width (m)
        As_min_val = self.rho_min * b * self.h

        As = np.full_like(Mu, As_min_val)
        a = np.zeros_like(Mu)
        As_calc = np.zeros_like(Mu)

        mask = Mu > 1e-3
        if np.any(mask):
            disc = d**2 - 2 * Mu[mask] / (phi * 0.85 * fc * b)
            disc = np.maximum(disc, 0)
            a[mask] = d - np.sqrt(disc)
            As_calc[mask] = 0.85 * fc * b * a[mask] / fy
            As[mask] = np.maximum(As_calc[mask], As_min_val)

        return As, a, As_calc

    def _propose_bars(self, As_req: float) -> dict:
        """
        Propose a commercial bar diameter + spacing combination.

        Parameters
        ----------
        As_req : float  required steel area (m²/m)

        Returns
        -------
        dict with keys: diam_mm, sep_m, As_prov_cm2_m, As_req_cm2_m, note
        """
        if As_req <= 1e-8:
            return {
                "diam_mm": 0,
                "sep_m": 0,
                "As_prov_cm2_m": 0,
                "note": "Mínimo no requerido",
            }

        best = None
        for d in self.bar_diameters_mm:
            A_bar = self.bar_areas_mm2[d]          # mm²
            s = A_bar / (As_req * 1e6)             # m
            # Round down to nearest 2.5 cm (conservative)
            s_round = np.floor(s / 0.025) * 0.025
            s_min = max(0.10, 1.5 * d / 1000.0)
            s_max = min(0.45, 3 * self.h)

            if s_round > s_max:
                s_round = s_max

            if s_round >= s_min:
                As_prov = A_bar / (s_round * 1e6)   # m²/m
                score = d * s_round                   # prefer smaller diameter
                if best is None or score < best["score"]:
                    best = {
                        "diam_mm": d,
                        "sep_m": round(s_round, 3),
                        "As_prov_cm2_m": round(As_prov * 1e4, 2),
                        "As_req_cm2_m": round(As_req * 1e4, 2),
                        "score": score,
                        "note": "OK",
                    }

        if best is None:
            # Fallback: largest diameter at minimum spacing
            d = max(self.bar_diameters_mm)
            A_bar = self.bar_areas_mm2[d]
            s_min = max(0.10, 1.5 * d / 1000.0)
            As_prov = A_bar / (s_min * 1e6)
            return {
                "diam_mm": d,
                "sep_m": round(s_min, 3),
                "As_prov_cm2_m": round(As_prov * 1e4, 2),
                "As_req_cm2_m": round(As_req * 1e4, 2),
                "note": "REVISAR - Demanda excede capacidad máxima",
            }

        del best["score"]
        return best

    def _print_band_report(self, band_details: list, As_min_val: float) -> None:
        """Print a formatted console table of reinforcement band results."""
        print("\n=== PLANO DE ARMADO - BANDAS DE REFUERZO ===")
        print(f"Armadura mínima fuera de bandas: {As_min_val * 1e4:.2f} cm²/m")
        print("-" * 100)
        print(
            f"{'Muro':<6} {'Tipo':<12} {'Ancho Banda':<12} {'Mx diseño':<12} {'My diseño':<12} "
            f"{'Asx (cm²/m)':<14} {'Prop. X':<18} {'Asy (cm²/m)':<14} {'Prop. Y':<18}"
        )
        print("-" * 100)
        for b in band_details:
            bx = b["bar_x"]
            by = b["bar_y"]
            px = (
                f"Ø{bx['diam_mm']}@{bx['sep_m'] * 100:.0f}cm ({bx['note']})"
                if bx["diam_mm"] > 0
                else "Mínimo"
            )
            py = (
                f"Ø{by['diam_mm']}@{by['sep_m'] * 100:.0f}cm ({by['note']})"
                if by["diam_mm"] > 0
                else "Mínimo"
            )
            print(
                f"{b['id']:<6} {b['type']:<12} {b['band_width']:<12.2f} "
                f"{b['Mx_design_kNm_m']:<12.2f} {b['My_design_kNm_m']:<12.2f} "
                f"{b['Asx_cm2_m']:<14.2f} {px:<18} {b['Asy_cm2_m']:<14.2f} {py:<18}"
            )
        print("-" * 100)

    def define_reinforcement_bands(self, load_factor: float = 1.5) -> tuple:
        """
        Define reinforcement bands under walls and assign design steel areas.

        NOTE: Loads are already factored in add_wall / add_column.
        The ``load_factor`` parameter is kept for API compatibility but is NOT
        re-applied here.

        Parameters
        ----------
        load_factor : float  kept for API compatibility (unused internally)

        Returns
        -------
        Asx_bot, Asy_bot, Asx_top, Asy_top : np.ndarray  (m²/m each)
        """
        Mx = self.Mx
        My = self.My

        # Nodal band masks
        mask_bands = np.zeros((self.n_nodes_y, self.n_nodes_x), dtype=bool)
        band_details = []

        As_min_val = self.rho_min * 1.0 * self.h

        # Initialise with minimum reinforcement everywhere
        self.Asx = np.full_like(self.w, As_min_val)
        self.Asy = np.full_like(self.w, As_min_val)

        for idx, wall in enumerate(self.walls):
            band_mask = np.zeros_like(mask_bands)
            half_bw = wall.band_width / 2.0

            for j in range(self.n_nodes_y):
                for i in range(self.n_nodes_x):
                    dps = self._point_segment_distance(
                        self.X[j, i], self.Y[j, i],
                        wall.x1, wall.y1, wall.x2, wall.y2,
                    )
                    if dps <= half_bw:
                        band_mask[j, i] = True
                        mask_bands[j, i] = True

            Mx_band_max = float(np.max(np.abs(Mx[band_mask]))) if np.any(band_mask) else 0.0
            My_band_max = float(np.max(np.abs(My[band_mask]))) if np.any(band_mask) else 0.0

            Asx_band_arr, ax_band_arr, Asx_calc_band_arr = self._calc_steel(
                np.array([Mx_band_max])
            )
            Asx_band = float(Asx_band_arr[0])
            ax_band = float(ax_band_arr[0])
            Asx_calc_band = float(Asx_calc_band_arr[0])

            Asy_band_arr, ay_band_arr, Asy_calc_band_arr = self._calc_steel(
                np.array([My_band_max])
            )
            Asy_band = float(Asy_band_arr[0])
            ay_band = float(ay_band_arr[0])
            Asy_calc_band = float(Asy_calc_band_arr[0])

            # Assign to band nodes if greater than current minimum
            self.Asx = np.where(band_mask, np.maximum(self.Asx, Asx_band), self.Asx)
            self.Asy = np.where(band_mask, np.maximum(self.Asy, Asy_band), self.Asy)

            bar_x = self._propose_bars(Asx_band)
            bar_y = self._propose_bars(Asy_band)

            band_details.append(
                {
                    "id": int(idx),
                    "type": str(wall.wall_type),
                    "x1": float(wall.x1),
                    "y1": float(wall.y1),
                    "x2": float(wall.x2),
                    "y2": float(wall.y2),
                    "band_width": float(wall.band_width),
                    "Mx_design_kNm_m": float(Mx_band_max / 1000),
                    "My_design_kNm_m": float(My_band_max / 1000),
                    "Asx_cm2_m": float(Asx_band * 1e4),
                    "Asy_cm2_m": float(Asy_band * 1e4),
                    "a_x_cm": float(ax_band * 100),
                    "a_y_cm": float(ay_band * 100),
                    "Asx_calc_cm2_m": float(Asx_calc_band * 1e4),
                    "Asy_calc_cm2_m": float(Asy_calc_band * 1e4),
                    "bar_x": {
                        k: (float(v) if isinstance(v, (np.floating, float)) else v)
                        for k, v in bar_x.items()
                    },
                    "bar_y": {
                        k: (float(v) if isinstance(v, (np.floating, float)) else v)
                        for k, v in bar_y.items()
                    },
                }
            )

        # Enforce minimum across the entire slab
        self.Asx = np.maximum(self.Asx, As_min_val)
        self.Asy = np.maximum(self.Asy, As_min_val)

        # Split bottom / top based on moment sign
        self.Asx_bot = np.where(self.Mx > 0, self.Asx, As_min_val)
        self.Asx_top = np.where(self.Mx < 0, self.Asx, As_min_val)
        self.Asy_bot = np.where(self.My > 0, self.Asy, As_min_val)
        self.Asy_top = np.where(self.My < 0, self.Asy, As_min_val)

        self.band_data = band_details
        self._print_band_report(band_details, As_min_val)
        return self.Asx_bot, self.Asy_bot, self.Asx_top, self.Asy_top
