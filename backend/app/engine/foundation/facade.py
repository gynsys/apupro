from .grillage_solver import GrillageSolver
from .post_processor import PostProcessor
from .designer import ReinforcementDesigner
from .checks import StructuralChecks
from .renderer import PlanRenderer
from .quantities import QuantitiesComputer

class FoundationSlabDesigner(
    GrillageSolver, 
    PostProcessor, 
    ReinforcementDesigner, 
    StructuralChecks, 
    PlanRenderer, 
    QuantitiesComputer
):
    """
    Diseñador de losa de cimentación por Método de la Grilla.
    Orquestador: combina todos los módulos especializados.
    """
    
    def run_full_analysis(self, extra_uniform_load: float = 0.0) -> dict:
        """Ejecuta el análisis completo: FEM -> post-proceso -> diseño -> verificaciones."""
        self.solve(extra_uniform_load=extra_uniform_load)
        self.compute_moments()
        self.compute_shear()
        self.define_reinforcement_bands()
        self.check_differential_settlements()
        self.check_punching()
        self.check_sliding()
        
        if hasattr(self, 'retaining_walls') and self.retaining_walls:
            self.retaining_wall_designs = [self.design_retaining_wall_stem(rw) for rw in self.retaining_walls]
        else:
            self.retaining_wall_designs = []
            
        if hasattr(self, 'support_beams') and self.support_beams:
            self.support_beam_designs = [self.design_support_beam(sb) for sb in self.support_beams]
        else:
            self.support_beam_designs = []
            
        return self._build_results_dict()
    
    def _build_results_dict(self) -> dict:
        """Construye el diccionario de resultados completo para la API."""
        try:
            import numpy as np
        except ImportError:
            pass

        # Reporte en texto (opcional, útil para debugging o logs)
        self.generate_design_report()

        As_min_val = self.rho_min * 1.0 * self.h

        w_max = float(np.max(np.abs(self.w))) * 1000 if hasattr(self, 'w') else 0.0
        Mx_max = float(np.max(np.abs(self.Mx))) / 1000 if hasattr(self, 'Mx') else 0.0
        My_max = float(np.max(np.abs(self.My))) / 1000 if hasattr(self, 'My') else 0.0
        Vu_max = float(np.max(np.abs(self.Vu))) / 1000 if hasattr(self, 'Vu') else 0.0
        phi_Vc_val = float(np.min(self.phiVc)) / 1000 if hasattr(self, 'phiVc') else 0.0
        shear_ok_val = bool(np.all(self.shear_ok)) if hasattr(self, 'shear_ok') else False

        max_pressure = (w_max / 1000.0) * self.k if hasattr(self, 'w') else 0.0
        soil_ok = max_pressure <= self.q_adm

        results = {
            "inputs": {
                "geometry": {"Lx": self.Lx, "Ly": self.Ly, "h": self.h},
            },
            "displacements": {"w_max_mm": w_max},
            "moments": {"Mx_max_kNm_m": Mx_max, "My_max_kNm_m": My_max},
            "shear": {"Vu_max_kN_m": Vu_max, "phiVc_kN_m": phi_Vc_val, "shear_ok": shear_ok_val},
            "soil_pressure": {
                "max_pressure_kN_m2": max_pressure / 1000.0,
                "q_adm_kN_m2": self.q_adm / 1000.0,
                "ok": soil_ok
            },
            "As_min_cm2_m": As_min_val * 1e4,
            "bands": self.band_data,
            "punching": self.punching_data,
            "settlements": self.settlement_data,
            "sliding": getattr(self, 'sliding_data', {"active": False}),
            "retaining_wall_designs": getattr(self, 'retaining_wall_designs', []),
            "support_beam_designs": getattr(self, 'support_beam_designs', []),
            "svg_plan": self.get_svg_plan(),
            "svg_details": self.get_svg_details(),
            "materials_computation": self._compute_quantities()
        }
        
        # Heatmaps
        if hasattr(self, 'w') and hasattr(self, 'Mx'):
            results["heatmaps"] = {
                "nx": self.n_nodes_x,
                "ny": self.n_nodes_y,
                "w_mm": (self.w * 1000).tolist(),
                "Mx_kNm": (self.Mx / 1000).tolist(),
                "My_kNm": (self.My / 1000).tolist(),
                "Vu_kN": (self.Vu / 1000).tolist()
            }
            results["heatmaps"]["w_max_mm"] = w_max
            
        return results
