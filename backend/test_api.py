from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

payload = {
    "project": "Losa de Cimentación",
    "geometry": {"Lx": 10.0, "Ly": 10.0, "h": 0.2},
    "materials": {
        "E": 200000.0, "nu": 0.2, "k": 20000000.0, "f_c": 25.0, "f_y": 420.0,
        "gamma_horm": 2400.0, "q_adm": 150000.0, "cover": 0.05, "bar_diam": 0.012,
        "band_width_m": 0, "custom_mesh_cm2_m": 0
    },
    "walls": [],
    "beams": [],
    "columns": [],
    "doors": [],
    "retaining_walls": [
        {
            "x1": 0, "y1": 0, "x2": 0, "y2": 5, "thickness": 0.2,
            "soil_height": 2.0, "soil_density": 18000, "phi": 30,
            "perimeter_wall_height": 0
        }
    ],
    "support_beams": [
        {
            "x1": 2, "y1": 2, "x2": 2, "y2": 8, "width": 0.3, "depth": 0.5, "id": "viga-1"
        }
    ],
    "mesh_nx": 40,
    "mesh_ny": 40,
    "band_width_factor": 1.0,
    "max_settlement_ratio": 500.0,
    "extra_load": 0.0
}

response = client.post("/api/v1/calculadora-losas/losa_fundacion/analyze", json=payload)
print(response.status_code)
if response.status_code == 500:
    print(response.json())
else:
    print("Success. support_beam_designs length:", len(response.json().get("support_beam_designs", [])))
