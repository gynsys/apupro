# arko360_platform/backend/app/design_codes/aci_318.py
import math
from abc import ABC, abstractmethod

class DesignCodeStrategy(ABC):
    @abstractmethod
    def check_flexure(self, mu, section, material): pass
    
    @abstractmethod
    def check_shear(self, vu, section, material): pass

class ACI318_19(DesignCodeStrategy):
    def __init__(self):
        self.phi_flexure = 0.90
        self.phi_shear = 0.75
        self.phi_compression = 0.65 # Para estribos convencionales

    def check_flexure_beam(self, mu_kNm, b_m, h_m, d_m, as_provided_mm2, f_c_mpa, f_y_mpa):
        """
        Calcula la capacidad nominal a flexión phi*Mn (ACI 318-19 22.2)
        """
        mu_u = abs(mu_kNm) * 1e6 # Convertir a N-mm
        f_c = f_c_mpa
        f_y = f_y_mpa
        a_s = as_provided_mm2
        
        # 1. Bloque de compresión de Whitney (a = As*fy / 0.85*f'c*b)
        a = (a_s * f_y) / (0.85 * f_c * (b_m * 1000))
        
        # 2. Momento nominal Mn = As * fy * (d - a/2)
        mn = a_s * f_y * (d_m * 1000 - a / 2)
        
        # 3. Capacidad de diseño
        phi_mn = self.phi_flexure * mn
        
        utilization = mu_u / phi_mn if phi_mn > 0 else 999
        return {
            "capacity_knm": phi_mn / 1e6,
            "demand_knm": mu_kNm,
            "utilization": round(utilization, 3),
            "status": "PASS" if utilization <= 1.0 else "FAIL"
        }

    def check_shear_beam(self, vu_kn, b_m, h_m, d_m, f_c_mpa, s_spacing_m=0.2, av_mm2=142):
        """
        Calcula la resistencia al cortante phi*Vn (ACI 318-19 22.5)
        Vn = Vc + Vs
        """
        vu = abs(vu_kn) * 1000 # N
        bw = b_m * 1000 # mm
        d = d_m * 1000 # mm
        f_c = f_c_mpa
        
        # Vc = 0.17 * lambda * sqrt(f'c) * bw * d (SI units)
        v_c = 0.17 * 1.0 * math.sqrt(f_c) * bw * d
        
        # Vs = (Av * fy * d) / s
        f_yt = 420 # MPa por defecto para estribos
        s = s_spacing_m * 1000
        v_s = (av_mm2 * f_yt * d) / s
        
        phi_vn = self.phi_shear * (v_c + v_s)
        
        utilization = vu / phi_vn if phi_vn > 0 else 999
        return {
            "capacity_kn": phi_vn / 1000,
            "demand_kn": vu_kn,
            "utilization": round(utilization, 3),
            "provision": "ACI 318-19 22.5"
        }

    def check_column_axial(self, pu_kn, ag_mm2, f_c_mpa, f_y_mpa, ast_mm2):
        """
        Resistencia axial pura (ACI 318-19 22.4)
        """
        phi = self.phi_compression
        po = 0.85 * f_c_mpa * (ag_mm2 - ast_mm2) + f_y_mpa * ast_mm2
        # Para columnas estribadas, phi*Pn_max = 0.80 * phi * Po
        phi_pn_max = 0.80 * phi * po
        
        pu = abs(pu_kn) * 1000
        utilization = pu / phi_pn_max
        
        return {
            "capacity_kn": phi_pn_max / 1000,
            "demand_kn": pu_kn,
            "utilization": round(utilization, 3)
        }