import json
import traceback
from app.engine.foundation.facade import FoundationSlabDesigner

designer = FoundationSlabDesigner(
    Lx=10.0, Ly=10.0, h=0.2, f_c=25.0, f_y=420.0,
    gamma_horm=2400.0, E=200000.0, nu=0.2, k=20000000.0, q_adm=150000.0,
    cover=0.05, bar_diam=0.012
)
designer.set_mesh(nx=40, ny=40)

try:
    designer.add_retaining_wall(
        x1=0, y1=0, x2=0, y2=5, thickness=0.2, soil_height=2.0,
        soil_density=18000, phi=30, perimeter_wall_height=0
    )
    designer.add_wall(
        x1=0, y1=0, x2=10, y2=0, thickness=0.15, height=2.5, density=1500, load_factor=1.5, wall_type="perimetral"
    )
    designer.add_column(
        x=2, y=2, width=0.2, length=0.2, height=2.5, load_kgf=5000, col_id="C1"
    )
    res = designer.run_full_analysis()
    print("SUCCESS")
except Exception as e:
    traceback.print_exc()
