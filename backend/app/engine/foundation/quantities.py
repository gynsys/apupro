"""
foundation/quantities.py
Quantities / materials computation mixin.

Provides:
  - QuantitiesComputer mixin class with _compute_quantities()

Extracted from the run_full_analysis method (lines ~1478–1566 of the original file).
All values are returned as a dict matching the 'materials_computation' key
in the original API response.
"""

import numpy as np


class QuantitiesComputer:
    """
    Mixin: compute concrete/steel quantities and superstructure material take-offs.

    Requires attributes set by GrillageSolver, PostProcessor, and
    ReinforcementDesigner (Lx, Ly, h, rho_min, custom_mesh_cm2_m,
    Asx, Asy, dx, dy, walls, columns, bar_diameters_mm, bar_areas_mm2).
    """

    def _compute_quantities(self) -> dict:
        """
        Compute materials quantities for the slab and superstructure.

        Returns
        -------
        dict
            Matches the 'materials_computation' key returned by run_full_analysis.
            Keys:
                concrete_vol_m3          : float
                general_slab_steel       : dict  {bar_x: str, bar_y: str}
                steel_weight_general_kg  : float
                steel_weight_bands_kg    : float
                general_bars_6m          : int
                bands_bars_6m            : int
                total_bars_6m            : int
                diam_base_mm             : float
                superstructure           : dict
        """
        As_min_cm2_normativo = float(self.rho_min * 1.0 * self.h * 1e4)
        As_min_cm2 = (
            max(As_min_cm2_normativo, float(self.custom_mesh_cm2_m))
            if self.custom_mesh_cm2_m > 0
            else As_min_cm2_normativo
        )
        As_min_m2 = float(As_min_cm2 / 1e4)

        general_slab_steel_x = self._propose_bars(As_min_m2)
        general_slab_steel_y = self._propose_bars(As_min_m2)

        concrete_vol_m3 = float(self.Lx * self.Ly * self.h)

        # General slab steel (both directions)
        general_steel_vol_m3 = 2 * As_min_m2 * self.Lx * self.Ly
        steel_weight_general_kg = float(general_steel_vol_m3 * 7850)

        # Total actual steel from the FEM grid
        total_steel_vol_m3 = float(np.sum(self.Asx + self.Asy) * self.dx * self.dy)
        steel_weight_total_kg = float(total_steel_vol_m3 * 7850)

        # Additional steel in bands (difference above minimum)
        extra_Asx = np.maximum(0, self.Asx - As_min_m2)
        extra_Asy = np.maximum(0, self.Asy - As_min_m2)
        extra_steel_vol_m3 = float(np.sum(extra_Asx + extra_Asy) * self.dx * self.dy)
        if extra_steel_vol_m3 < 1e-6:
            extra_steel_vol_m3 = 0.0
        steel_weight_bands_kg = float(extra_steel_vol_m3 * 7850)

        # Estimate number of 6-metre bars (based on base diameter)
        diam_base = general_slab_steel_x["diam_mm"]
        if self.custom_mesh_cm2_m > 0:
            if self.custom_mesh_cm2_m == 0.61:
                diam_base = 3.43
            elif self.custom_mesh_cm2_m in (1.41, 1.88):
                diam_base = 6.0
            elif self.custom_mesh_cm2_m == 2.51:
                diam_base = 8.0
            elif self.custom_mesh_cm2_m in (3.93, 5.24):
                diam_base = 10.0

        bar_vol_m3 = (
            (np.pi * (diam_base / 1000.0) ** 2 / 4.0) * 6.0
            if diam_base > 0
            else 1e-6
        )
        general_bars_6m = int(np.ceil(general_steel_vol_m3 / bar_vol_m3)) if general_steel_vol_m3 > 1e-6 else 0
        bands_bars_6m = int(np.ceil(extra_steel_vol_m3 / bar_vol_m3)) if extra_steel_vol_m3 > 1e-6 else 0
        total_bars_6m = general_bars_6m + bands_bars_6m

        # --- Superstructure ---
        area_rustica_m2 = 0.0
        area_lisa_m2 = 0.0
        bloques_15_m2 = 0.0
        bloques_12_m2 = 0.0
        vol_vigas_corona_m3 = 0.0
        longitud_perimetral_m = 0.0

        for w in self.walls:
            op_area = (
                sum(
                    op.get("width_m", 0) * op.get("height_m", 0)
                    for op in w.openings
                )
                if w.openings
                else 0
            )
            net_area = max(0, w.length * w.height - op_area)

            if abs(w.thickness - 0.15) < 0.01:
                bloques_15_m2 += net_area
            else:
                bloques_12_m2 += net_area

            if w.wall_type == "perimetral":
                area_rustica_m2 += net_area   # exterior face
                area_lisa_m2 += net_area      # interior face
                longitud_perimetral_m += w.length
            else:
                area_lisa_m2 += net_area * 2  # both sides

        # Corona beams (10×13 cm — consistent with q_corona_kgf_m in add_wall)
        vol_vigas_corona_m3 = longitud_perimetral_m * 0.10 * 0.13

        # Ø10 mm longitudinal bars (3 per linear metre of perimeter)
        longitud_varilla_10mm = longitud_perimetral_m * 3
        corona_10mm_bars = int(np.ceil(longitud_varilla_10mm / 6.0))

        # Ø5.2 mm stirrups every 20 cm
        num_estribos = int(np.ceil(longitud_perimetral_m / 0.20))
        longitud_varilla_5_2mm = num_estribos * 0.50
        corona_5_2mm_bars = int(np.ceil(longitud_varilla_5_2mm / 6.0))

        # --- Machones (columns) ---
        vol_machones_m3 = float(
            sum(c.width * c.length * c.height for c in self.columns)
        )

        machones_10mm_len = 0.0
        machones_5_2mm_len = 0.0
        for c in self.columns:
            machones_10mm_len += 4 * (c.height + 0.30)      # 4 main bars + 30 cm anchor
            n_estribos_col = int(np.ceil(c.height / 0.15))  # stirrups every 15 cm
            len_estribo_col = 2 * (c.width + c.length) - 0.10
            machones_5_2mm_len += n_estribos_col * len_estribo_col

        machones_10mm_bars = int(np.ceil(machones_10mm_len / 6.0))
        machones_5_2mm_bars = int(np.ceil(machones_5_2mm_len / 6.0))

        # Accumulate column bars into corona totals (same bar schedule)
        corona_10mm_bars += machones_10mm_bars
        corona_5_2mm_bars += machones_5_2mm_bars

        return {
            "concrete_vol_m3": concrete_vol_m3,
            "general_slab_steel": {
                "bar_x": (
                    f"Ø{general_slab_steel_x['diam_mm']}"
                    f"@{int(general_slab_steel_x['sep_m'] * 100)}cm"
                ),
                "bar_y": (
                    f"Ø{general_slab_steel_y['diam_mm']}"
                    f"@{int(general_slab_steel_y['sep_m'] * 100)}cm"
                ),
            },
            "steel_weight_general_kg": steel_weight_general_kg,
            "steel_weight_bands_kg": steel_weight_bands_kg,
            "general_bars_6m": general_bars_6m,
            "bands_bars_6m": bands_bars_6m,
            "total_bars_6m": total_bars_6m,
            "diam_base_mm": diam_base,
            "superstructure": {
                "area_rustica_m2": area_rustica_m2,
                "area_lisa_m2": area_lisa_m2,
                "bloques_15_m2": bloques_15_m2,
                "bloques_12_m2": bloques_12_m2,
                "vol_vigas_corona_m3": vol_vigas_corona_m3,
                "corona_10mm_bars": corona_10mm_bars,
                "corona_5_2mm_bars": corona_5_2mm_bars,
                "vol_machones_m3": vol_machones_m3,
                "machones_10mm_bars": machones_10mm_bars,
                "machones_5_2mm_bars": machones_5_2mm_bars,
            },
        }
