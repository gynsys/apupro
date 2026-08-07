"""
foundation/grillage_solver.py
Grillage FEM solver mixin: mesh setup, load assembly, stiffness assembly, and linear solve.

Provides:
  - GrillageSolver mixin class (holds __init__ and all FEM internals)

Units: N, m, Pa
"""

import warnings
from typing import List, Optional

import numpy as np
from scipy.sparse import lil_matrix
from scipy.sparse.linalg import spsolve

from .models import Beam, Column, Wall, RetainingWall, SupportBeam
from app.engine.fem_shell import get_quad_plate_local_stiffness


class GrillageSolver:
    """
    Mixin: Grillage FEM solver for a rectangular foundation slab on a Winkler elastic subgrade.

    DOF per node: w (vertical), θx (rotation about x-axis), θy (rotation about y-axis)
    All geometry in metres, forces in Newtons, moments in N·m.
    """

    def __init__(
        self,
        Lx: float,
        Ly: float,
        h: float,
        E: float,
        nu: float,
        k: float,
        f_c: float,
        f_y: float,
        cover: float,
        bar_diam: float,
        gamma_horm: float = 2400,
        include_self_weight: bool = True,
        lambda_aci: float = 1.0,
        band_width_factor: float = 1.0,
        max_settlement_ratio: float = 500.0,
        bar_diameters_mm: Optional[List[float]] = None,
        q_adm: float = 150000.0,
        band_width_m: float = 0.0,
        custom_mesh_cm2_m: float = 0.0,
    ) -> None:
        """
        Parameters
        ----------
        Lx, Ly          : slab dimensions in metres
        h                : slab thickness (m)
        E                : concrete elastic modulus (Pa)
        nu               : Poisson ratio
        k                : Winkler subgrade modulus (N/m³)
        f_c              : concrete compressive strength (MPa)
        f_y              : steel yield strength (MPa)
        cover            : concrete cover (m)
        bar_diam         : bar diameter for d_eff calc (m)
        gamma_horm       : concrete unit weight (kg/m³)
        include_self_weight : add slab self-weight as uniform load
        lambda_aci       : lightweight-concrete factor (ACI 318)
        band_width_factor : multiplier on base band width (thickness + 2*d_eff)
        max_settlement_ratio : maximum L/Δs ratio for differential settlement check
        bar_diameters_mm : list of available bar diameters in mm
        q_adm            : admissible soil pressure (Pa)
        band_width_m     : fixed band width override (m); 0 = auto
        custom_mesh_cm2_m : custom base mesh steel area (cm²/m); 0 = use rho_min
        """
        self.Lx = Lx
        self.Ly = Ly
        self.h = h
        self.E = E
        self.nu = nu
        self.k = k
        self.f_c = f_c        # MPa
        self.f_y = f_y        # MPa
        self.cover = cover
        self.bar_diam = bar_diam
        self.gamma_horm = gamma_horm
        self.include_self_weight = include_self_weight
        self.lambda_aci = lambda_aci
        self.band_width_factor = band_width_factor
        self.max_settlement_ratio = max_settlement_ratio
        self.q_adm = q_adm
        self.band_width_m = band_width_m
        self.custom_mesh_cm2_m = custom_mesh_cm2_m

        self.G = E / (2 * (1 + nu))
        self.d_eff = h - cover - bar_diam / 2
        self.rho_min = 0.0018
        self.phi_flex = 0.9
        self.phi_shear = 0.75
        self.phi_punch = 0.75

        if bar_diameters_mm is None:
            self.bar_diameters_mm: List[float] = [7, 8, 10, 12, 16, 20, 25]
        else:
            self.bar_diameters_mm = bar_diameters_mm

        # Áreas de barras comerciales (mm²)
        self.bar_areas_mm2 = {d: np.pi * (d**2) / 4 for d in self.bar_diameters_mm}

        self.walls: List[Wall] = []
        self.beams: List[Beam] = []
        self.columns: List[Column] = []
        self.retaining_walls: List[RetainingWall] = []
        self.support_beams: List[SupportBeam] = []
        self.band_data: list = []
        self.settlement_data: list = []
        self.punching_data: list = []

    # ------------------------------------------------------------------
    # Mesh setup
    # ------------------------------------------------------------------

    def set_mesh(self, nx: int, ny: int) -> None:
        """Define the grillage mesh (nx × ny elements)."""
        if nx < 10 or ny < 10:
            warnings.warn("Malla muy gruesa. Se recomienda nx, ny >= 20 para precisión.")
        self.nx = nx
        self.ny = ny
        self.dx = self.Lx / nx
        self.dy = self.Ly / ny

        self.n_nodes_x = nx + 1
        self.n_nodes_y = ny + 1
        self.n_nodes = self.n_nodes_x * self.n_nodes_y
        self.ndof = 3 * self.n_nodes

        self.x = np.linspace(0, self.Lx, self.n_nodes_x)
        self.y = np.linspace(0, self.Ly, self.n_nodes_y)
        self.X, self.Y = np.meshgrid(self.x, self.y)

        print(
            f"Grilla: {nx}x{ny} elementos | dx={self.dx:.3f}m, "
            f"dy={self.dy:.3f}m | Nodos={self.n_nodes}"
        )

    # ------------------------------------------------------------------
    # Add structural elements
    # ------------------------------------------------------------------

    def add_wall(
        self,
        x1: float,
        y1: float,
        x2: float,
        y2: float,
        thickness: float,
        height: float,
        material_density: float,
        load_factor: float = 1.0,
        wall_type: str = "perimetral",
        is_plastered: bool = False,
        openings: Optional[List] = None,
    ) -> None:
        """Add a masonry wall and compute its linear load (N/m)."""
        length = np.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
        if length < 1e-6:
            return

        # Plaster weight: ~40 kg/m² per side → 80 kg/m² total
        plaster_kg_m2 = 80 if is_plastered else 0

        # Carga Muerta cubierta liviana (D=15 kg/m²) + Carga Viva (L=40 kg/m²)
        # con ancho tributario promedio de 2.5 m (COVENIN)
        trib_width = 2.5
        q_techo_kgf_m = (15 + 40) * trib_width

        # Viga de corona (amarre) 10×13 cm
        q_corona_kgf_m = 0.10 * 0.13 * 2400

        op_area = sum(
            op.get("width_m", 0) * op.get("height_m", 0)
            for op in (openings or [])
        )
        net_area = max(0, length * height - op_area)
        effective_height = net_area / length if length > 0 else height

        q_lineal = (
            (thickness * material_density + plaster_kg_m2) * effective_height
            + q_techo_kgf_m
            + q_corona_kgf_m
        ) * 9.81 * load_factor

        # Ancho de banda de refuerzo: espesor + 2*d_eff, mínimo racional ~0.33 m
        base_band = max(thickness + 2 * self.d_eff, 0.33)
        if hasattr(self, "band_width_m") and self.band_width_m > 0:
            band_width = max(self.band_width_m, base_band)
        else:
            band_width = base_band * self.band_width_factor

        self.walls.append(
            Wall(
                x1=x1, y1=y1, x2=x2, y2=y2,
                thickness=thickness, height=height,
                density=material_density, load_factor=load_factor,
                wall_type=wall_type, q_lineal=q_lineal,
                length=length, band_width=band_width,
                q_corona_kgf_m=q_corona_kgf_m,
                openings=openings or [],
                is_plastered=is_plastered,
            )
        )
        print(
            f"  Muro {wall_type}: ({x1:.2f},{y1:.2f})->({x2:.2f},{y2:.2f}) | "
            f"q={q_lineal/1000:.2f} kN/m | Banda={band_width:.2f}m"
        )

    def add_beam(
        self,
        x1: float,
        y1: float,
        x2: float,
        y2: float,
        width: float,
        height: float,
        load_factor: float = 1.0,
        beam_type: str = "zuncho",
    ) -> None:
        """Add a tie beam and compute its self-weight linear load (N/m)."""
        length = np.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
        if length < 1e-6:
            return
        q_self = width * height * self.gamma_horm * 9.81 * load_factor

        self.beams.append(
            Beam(
                x1=x1, y1=y1, x2=x2, y2=y2,
                width=width, height=height,
                load_factor=load_factor, beam_type=beam_type,
                q_self=q_self, length=length,
            )
        )
        print(
            f"  Viga {beam_type}: ({x1:.2f},{y1:.2f})->({x2:.2f},{y2:.2f}) | "
            f"{width*100:.0f}x{height*100:.0f} cm | q={q_self/1000:.2f} kN/m"
        )

    def add_column(
        self,
        x: float,
        y: float,
        width: float,
        length: float,
        height: float,
        load_kgf: float,
        id: str = "",
    ) -> None:
        """Add a column with a point load."""
        P_u = load_kgf * 9.81 * 1.5  # 1.5 load factor
        self.columns.append(
            Column(
                x=x, y=y, width=width, length=length, height=height,
                load_kgf=load_kgf, P_u=P_u, id=id
            )
        )
        print(f"  Columna {id}: ({x:.2f},{y:.2f}) | {width*100:.0f}x{length*100:.0f} cm | Pu={P_u/1000:.2f} kN")

    def add_retaining_wall(
        self,
        x1: float,
        y1: float,
        x2: float,
        y2: float,
        thickness: float,
        soil_height: float,
        soil_density: float,
        phi: float,
        perimeter_wall_height: float,
        rw_id: str = ""
    ) -> None:
        """Add a retaining wall on top of the slab."""
        length = np.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
        if length < 1e-6:
            return
            
        # Active earth pressure coefficient
        K_a = np.tan(np.radians(45 - phi / 2)) ** 2
        
        # Overturning moment per linear meter (kN.m/m -> N.m/m)
        # M = 1/6 * gamma * H^3 * K_a
        m_overturning = (1/6) * soil_density * (soil_height ** 3) * K_a
        
        # Base shear per linear meter (kN/m -> N/m)
        v_base = (1/2) * soil_density * (soil_height ** 2) * K_a
        
        # Vertical load from concrete retaining wall and perimeter wall
        # Retaining wall: concrete 24000 N/m3
        weight_concrete = thickness * soil_height * 24000.0
        # Perimeter wall: block ~1500 N/m2 -> 1500 * height
        weight_perimeter = perimeter_wall_height * 1500.0
        q_vertical = (weight_concrete + weight_perimeter) * 1.2 # 1.2 dead load factor

        self.retaining_walls.append(
            RetainingWall(
                x1=x1, y1=y1, x2=x2, y2=y2,
                thickness=thickness, soil_height=soil_height,
                soil_density=soil_density, phi=phi,
                perimeter_wall_height=perimeter_wall_height,
                length=length, q_vertical=q_vertical,
                m_overturning=m_overturning, v_base=v_base,
                id=rw_id
            )
        )
        print(f"  Muro Contención: ({x1:.2f},{y1:.2f})->({x2:.2f},{y2:.2f}) | H={soil_height:.2f}m | M={m_overturning/1000:.2f} kNm/m")

    def add_support_beam(
        self,
        x1: float,
        y1: float,
        x2: float,
        y2: float,
        width: float,
        depth: float,
        sb_id: str = ""
    ) -> None:
        """Add a support beam (viga de apoyo) to stiffen the edge."""
        length = np.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
        if length < 1e-6:
            return
            
        I_beam = (width * (depth ** 3)) / 12.0
        
        self.support_beams.append(
            SupportBeam(
                x1=x1, y1=y1, x2=x2, y2=y2,
                width=width, depth=depth,
                length=length, I_beam=I_beam,
                id=sb_id
            )
        )
        print(f"  Viga de Apoyo: ({x1:.2f},{y1:.2f})->({x2:.2f},{y2:.2f}) | {width*100:.0f}x{depth*100:.0f} cm")

    # ------------------------------------------------------------------
    # Index helpers
    # ------------------------------------------------------------------

    def _node_idx(self, i: int, j: int) -> int:
        """Global node index from grid coordinates (i, j)."""
        return j * self.n_nodes_x + i

    def _dof(self, node: int, local_dof: int) -> int:
        """Global DOF index (0=w, 1=θx, 2=θy)."""
        return 3 * node + local_dof

    # ------------------------------------------------------------------
    # Element stiffness matrices
    # ------------------------------------------------------------------

    def _beam_stiffness_x(self, EI: float, GJ: float, L: float) -> np.ndarray:
        """6×6 stiffness matrix for a beam aligned in the x-direction."""
        k_flex = EI / L**3 * np.array([
            [12,   0,    6*L,   -12,  0,    6*L],
            [0,    0,    0,     0,    0,    0  ],
            [6*L,  0,    4*L**2, -6*L, 0,   2*L**2],
            [-12,  0,   -6*L,   12,   0,   -6*L],
            [0,    0,    0,     0,    0,    0  ],
            [6*L,  0,    2*L**2, -6*L, 0,   4*L**2],
        ])
        k_tors = GJ / L * np.array([
            [0,  0,  0,  0,  0,  0],
            [0,  1,  0,  0, -1,  0],
            [0,  0,  0,  0,  0,  0],
            [0,  0,  0,  0,  0,  0],
            [0, -1,  0,  0,  1,  0],
            [0,  0,  0,  0,  0,  0],
        ])
        return k_flex + k_tors

    def _beam_stiffness_y(self, EI: float, GJ: float, L: float) -> np.ndarray:
        """6×6 stiffness matrix for a beam aligned in the y-direction."""
        k_flex = EI / L**3 * np.array([
            [12,   6*L,  0,  -12,   6*L,  0],
            [6*L,  4*L**2, 0, -6*L, 2*L**2, 0],
            [0,    0,    0,   0,    0,    0],
            [-12, -6*L,  0,   12,  -6*L,  0],
            [6*L,  2*L**2, 0, -6*L, 4*L**2, 0],
            [0,    0,    0,   0,    0,    0],
        ])
        k_tors = GJ / L * np.array([
            [0,  0,  0,  0,  0,  0],
            [0,  0,  0,  0,  0,  0],
            [0,  0,  1,  0,  0, -1],
            [0,  0,  0,  0,  0,  0],
            [0,  0,  0,  0,  0,  0],
            [0,  0, -1,  0,  0,  1],
        ])
        return k_flex + k_tors

    # ------------------------------------------------------------------
    # Geometry helper
    # ------------------------------------------------------------------

    @staticmethod
    def _point_segment_distance(
        px: float, py: float,
        x1: float, y1: float,
        x2: float, y2: float,
    ) -> float:
        """Perpendicular distance from point (px, py) to segment (x1,y1)-(x2,y2)."""
        dx = x2 - x1
        dy = y2 - y1
        len2 = dx * dx + dy * dy
        if len2 < 1e-18:
            return float(np.hypot(px - x1, py - y1))
        t = max(0.0, min(1.0, ((px - x1) * dx + (py - y1) * dy) / len2))
        projx = x1 + t * dx
        projy = y1 + t * dy
        return float(np.hypot(px - projx, py - projy))

    # ------------------------------------------------------------------
    # System assembly
    # ------------------------------------------------------------------

    def _build_system(self, extra_uniform_load: float = 0.0):
        """Assemble global stiffness matrix K and load vector F."""
        K = lil_matrix((self.ndof, self.ndof))
        F = np.zeros(self.ndof)

        # 1. Peso propio de losa + sobrecarga uniforme extra
        q_total = extra_uniform_load
        if self.include_self_weight:
            q_total += self.h * self.gamma_horm * 9.81

        for j in range(self.n_nodes_y):
            for i in range(self.n_nodes_x):
                node = self._node_idx(i, j)
                area = self.dx * self.dy
                if i == 0 or i == self.nx:
                    area /= 2
                if j == 0 or j == self.ny:
                    area /= 2
                F[self._dof(node, 0)] += q_total * area

        # 2. Cargas de muros — distribución concentrada al nodo más cercano
        for wall in self.walls:
            n_seg = int(np.ceil(wall.length / (self.dx / 2.0)))
            if n_seg == 0:
                continue
            dl = wall.length / n_seg
            for seg_k in range(n_seg):
                t = (seg_k + 0.5) / n_seg
                dist_from_start = t * wall.length

                q_eff = wall.q_lineal
                for op in wall.openings:
                    op_start = op.get("start_m", 0)
                    op_w = op.get("width_m", 0)
                    op_h = op.get("height_m", 0)
                    if op_start <= dist_from_start <= (op_start + op_w):
                        plaster_kg = 80 if wall.is_plastered else 0
                        gamma_w = wall.thickness * wall.density + plaster_kg
                        q_vano = gamma_w * op_h * 9.81 * wall.load_factor
                        q_eff = max(0, q_eff - q_vano)

                x_p = wall.x1 + t * (wall.x2 - wall.x1)
                y_p = wall.y1 + t * (wall.y2 - wall.y1)

                ni = int(round(x_p / self.dx))
                nj = int(round(y_p / self.dy))
                ni = int(np.clip(ni, 0, self.nx))
                nj = int(np.clip(nj, 0, self.ny))

                node = self._node_idx(ni, nj)
                F[self._dof(node, 0)] += q_eff * dl

        # 2.4 Muros de contención
        for rw in self.retaining_walls:
            n_seg = int(np.ceil(rw.length / (self.dx / 2.0)))
            if n_seg == 0:
                continue
            dl = rw.length / n_seg
            dx_dir = rw.x2 - rw.x1
            dy_dir = rw.y2 - rw.y1
            cos_a = dx_dir / rw.length
            sin_a = dy_dir / rw.length
            
            for seg_k in range(n_seg):
                t = (seg_k + 0.5) / n_seg
                x_p = rw.x1 + t * dx_dir
                y_p = rw.y1 + t * dy_dir

                ni = int(np.clip(int(round(x_p / self.dx)), 0, self.nx))
                nj = int(np.clip(int(round(y_p / self.dy)), 0, self.ny))
                node = self._node_idx(ni, nj)
                
                # Vertical load
                F[self._dof(node, 0)] += rw.q_vertical * dl
                
                # Overturning moment
                # Moment is perpendicular to the wall direction.
                # If wall is along X (cos=1, sin=0), earth pressure pushes along Y.
                # Overturning moment makes it rotate around X axis (DOF 1).
                # Actually, moment vector M_x = m_overturning * cos_a, M_y = m_overturning * sin_a
                F[self._dof(node, 1)] += rw.m_overturning * dl * cos_a
                F[self._dof(node, 2)] += rw.m_overturning * dl * sin_a

        # 2.5 Cargas puntuales (machones / columnas)
        for col in self.columns:
            ni = int(round(col.x / self.dx))
            nj = int(round(col.y / self.dy))
            ni = int(np.clip(ni, 0, self.nx))
            nj = int(np.clip(nj, 0, self.ny))
            node = self._node_idx(ni, nj)
            F[self._dof(node, 0)] += col.P_u

        # 3. Cargas de vigas de amarre
        for beam in self.beams:
            x1, y1, x2, y2 = beam.x1, beam.y1, beam.x2, beam.y2
            q_self = beam.q_self
            n_seg = max(int(beam.length / min(self.dx, self.dy)), 50)
            seg_len = beam.length / n_seg

            for t in np.linspace(0, 1, n_seg + 1)[:-1]:
                xm = x1 + (t + 0.5 / n_seg) * (x2 - x1)
                ym = y1 + (t + 0.5 / n_seg) * (y2 - y1)
                ni = int(np.clip(int(round(xm / self.dx)), 0, self.nx))
                nj = int(np.clip(int(round(ym / self.dy)), 0, self.ny))
                node = self._node_idx(ni, nj)
                F[self._dof(node, 0)] += q_self * seg_len

        # 4 & 5. Rigidez de la losa (Elementos Finitos Placa Mindlin 12x12)
        nu_concrete = 0.2
        for j in range(self.ny):
            for i in range(self.nx):
                # Nodos del cuadrilátero (orden Anti-horario: BL, BR, TR, TL)
                n1 = self._node_idx(i, j)
                n2 = self._node_idx(i + 1, j)
                n3 = self._node_idx(i + 1, j + 1)
                n4 = self._node_idx(i, j + 1)
                
                nodes_local = [
                    [self.x[i], self.y[j]],
                    [self.x[i+1], self.y[j]],
                    [self.x[i+1], self.y[j+1]],
                    [self.x[i], self.y[j+1]]
                ]
                
                # Check for support beams
                h_eff = self.h
                cx = self.x[i] + self.dx / 2.0
                cy = self.y[j] + self.dy / 2.0
                for sb in self.support_beams:
                    dist = self._point_segment_distance(cx, cy, sb.x1, sb.y1, sb.x2, sb.y2)
                    if dist <= max(self.dx, self.dy) * 0.75:
                        h_eff = max(h_eff, sb.depth)
                
                k_elem = get_quad_plate_local_stiffness(nodes_local, self.E, nu_concrete, h_eff)
                
                dofs = (
                    [self._dof(n1, d) for d in range(3)] +
                    [self._dof(n2, d) for d in range(3)] +
                    [self._dof(n3, d) for d in range(3)] +
                    [self._dof(n4, d) for d in range(3)]
                )
                
                for r in range(12):
                    for c in range(12):
                        K[dofs[r], dofs[c]] += k_elem[r, c]

        # 6. Rigidez adicional de vigas de amarre perimetrales
        for beam in self.beams:
            x1, y1, x2, y2 = beam.x1, beam.y1, beam.x2, beam.y2
            width_b = beam.width
            height_b = beam.height
            EI_beam = self.E * (width_b * height_b**3) / 12
            J_beam = width_b * height_b**3 / 3.0
            GJ_beam = self.G * J_beam
            n_seg = max(int(beam.length / min(self.dx, self.dy)), 1)

            def _find_node(xp: float, yp: float) -> int:
                ni = int(np.clip(int(round(xp / self.dx)), 0, self.nx))
                nj = int(np.clip(int(round(yp / self.dy)), 0, self.ny))
                return self._node_idx(ni, nj)

            for t in np.linspace(0, 1, n_seg + 1)[:-1]:
                xp1 = x1 + t * (x2 - x1)
                yp1 = y1 + t * (y2 - y1)
                xp2 = x1 + (t + 1 / n_seg) * (x2 - x1)
                yp2 = y1 + (t + 1 / n_seg) * (y2 - y1)

                n1 = _find_node(xp1, yp1)
                n2 = _find_node(xp2, yp2)
                if n1 != n2:
                    L_seg = float(np.sqrt((xp2 - xp1) ** 2 + (yp2 - yp1) ** 2))
                    if abs(x2 - x1) > abs(y2 - y1):
                        k_elem = self._beam_stiffness_x(EI_beam, GJ_beam, L_seg)
                    else:
                        k_elem = self._beam_stiffness_y(EI_beam, GJ_beam, L_seg)
                    dofs = (
                        [self._dof(n1, d) for d in range(3)]
                        + [self._dof(n2, d) for d in range(3)]
                    )
                    for r in range(6):
                        for c in range(6):
                            K[dofs[r], dofs[c]] += k_elem[r, c]

        # 7. Resortes de suelo Winkler
        for j in range(self.n_nodes_y):
            for i in range(self.n_nodes_x):
                node = self._node_idx(i, j)
                area = self.dx * self.dy
                if i == 0 or i == self.nx:
                    area /= 2
                if j == 0 or j == self.ny:
                    area /= 2
                K[self._dof(node, 0), self._dof(node, 0)] += self.k * area

        return K.tocsr(), F

    # ------------------------------------------------------------------
    # Linear solve
    # ------------------------------------------------------------------

    def solve(self, extra_uniform_load: float = 0.0) -> np.ndarray:
        """Assemble and solve the linear system; stores w, thetax, thetay."""
        print("\nResolviendo sistema de grillage...")
        K, F = self._build_system(extra_uniform_load)
        U = spsolve(K, F)
        self.U = U

        self.w = U[0::3].reshape(self.n_nodes_y, self.n_nodes_x)
        self.thetax = U[1::3].reshape(self.n_nodes_y, self.n_nodes_x)
        self.thetay = U[2::3].reshape(self.n_nodes_y, self.n_nodes_x)

        print(f"  w_max = {np.max(np.abs(self.w)) * 1000:.4f} mm")
        return self.w
