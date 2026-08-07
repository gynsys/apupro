from app.engine.foundation.facade import FoundationSlabDesigner

slab = FoundationSlabDesigner(
    Lx=5.0,
    Ly=5.0,
    h=0.2,
    E=20e9,
    nu=0.2,
    k=20000000,
    f_c=25.0,
    f_y=420.0,
    cover=0.05,
    bar_diam=0.012
)
slab.set_mesh(10, 10)
slab.run_full_analysis()
print("Success!")
