from collections import Counter
import importlib.util
import re
import unicodedata
from pathlib import Path

import pandas as pd
from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("materiales_base", HERE / "generar_lista_materiales.py")
base_mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base_mod)
BASE_ITEMS = base_mod.M

# (categoría, subcategoría, descripción, unidad, prioridad, especificación, precio_min, precio_max)
NEW_ITEMS = [
    # BOMBEO E HIDRONEUMÁTICO
    ("Bombeo e hidroneumático", "Bombas centrífugas", "Bomba centrífuga 1 HP", "und", "Alta", "Agua limpia; 1F/220V", 180, 350),
    ("Bombeo e hidroneumático", "Bombas centrífugas", "Bomba centrífuga 1,5 HP", "und", "Alta", "Agua limpia; 1F/220V", 250, 480),
    ("Bombeo e hidroneumático", "Bombas centrífugas", "Bomba centrífuga 3 HP", "und", "Alta", "Agua limpia; 1F/3F", 450, 850),
    ("Bombeo e hidroneumático", "Bombas centrífugas", "Bomba centrífuga 7,5 HP", "und", "Media", "Agua limpia; 3F", 900, 1600),
    ("Bombeo e hidroneumático", "Bombas centrífugas", "Bomba centrífuga 15 HP", "und", "Media", "Agua limpia; 3F", 1800, 3200),
    ("Bombeo e hidroneumático", "Bombas sumergibles", "Bomba sumergible 4\" 1 HP", "und", "Alta", "Pozo profundo; 1F/3F", 400, 750),
    ("Bombeo e hidroneumático", "Bombas sumergibles", "Bomba sumergible 4\" 1,5 HP", "und", "Alta", "Pozo profundo", 550, 950),
    ("Bombeo e hidroneumático", "Bombas sumergibles", "Bomba sumergible 4\" 2 HP", "und", "Alta", "Pozo profundo", 700, 1200),
    ("Bombeo e hidroneumático", "Bombas sumergibles", "Bomba sumergible 4\" 3 HP", "und", "Alta", "Pozo profundo", 1000, 1800),
    ("Bombeo e hidroneumático", "Bombas sumergibles", "Bomba sumergible 4\" 5 HP", "und", "Alta", "Pozo profundo", 1600, 2800),
    ("Bombeo e hidroneumático", "Bombas sumergibles", "Bomba sumergible 4\" 7,5 HP", "und", "Media", "Pozo profundo", 2200, 3800),
    ("Bombeo e hidroneumático", "Bombas sumergibles", "Bomba sumergible 4\" 10 HP", "und", "Media", "Pozo profundo", 3000, 5000),
    ("Bombeo e hidroneumático", "Bombas jet", "Bomba jet 1/2 HP", "und", "Alta", "Pozo somero", 180, 320),
    ("Bombeo e hidroneumático", "Bombas jet", "Bomba jet 3/4 HP", "und", "Alta", "Pozo somero", 220, 380),
    ("Bombeo e hidroneumático", "Bombas jet", "Bomba jet 1 HP", "und", "Alta", "Pozo somero", 280, 480),
    ("Bombeo e hidroneumático", "Presión constante", "Bomba de presión constante 1 HP", "und", "Alta", "Variador integrado", 500, 900),
    ("Bombeo e hidroneumático", "Presión constante", "Bomba de presión constante 1,5 HP", "und", "Alta", "Variador integrado", 700, 1200),
    ("Bombeo e hidroneumático", "Presión constante", "Bomba de presión constante 2 HP", "und", "Alta", "Variador integrado", 900, 1500),
    ("Bombeo e hidroneumático", "Bombeo solar", "Bomba solar sumergible 1 HP", "und", "Alta", "Con controlador MPPT", 900, 1600),
    ("Bombeo e hidroneumático", "Bombeo solar", "Bomba solar sumergible 2 HP", "und", "Alta", "Con controlador MPPT", 1400, 2400),
    ("Bombeo e hidroneumático", "Hidroneumático", "Hidroneumático 250 gal", "und", "Alta", "Tanque + bomba + control", 4500, 8000),
    ("Bombeo e hidroneumático", "Hidroneumático", "Hidroneumático 300 gal", "und", "Alta", "Tanque + bomba + control", 5500, 9500),
    ("Bombeo e hidroneumático", "Hidroneumático", "Hidroneumático 500 gal", "und", "Media", "Tanque + bomba + control", 8000, 14000),
    ("Bombeo e hidroneumático", "Tanques", "Tanque hidroneumático 20 gal", "und", "Alta", "Membrana/vejiga", 250, 450),
    ("Bombeo e hidroneumático", "Tanques", "Tanque hidroneumático 50 gal", "und", "Alta", "Membrana/vejiga", 450, 800),
    ("Bombeo e hidroneumático", "Tanques", "Tanque hidroneumático 100 gal", "und", "Alta", "Membrana/vejiga", 800, 1400),
    ("Bombeo e hidroneumático", "Tanques", "Tanque hidroneumático 200 gal", "und", "Media", "Membrana/vejiga", 1500, 2600),
    ("Bombeo e hidroneumático", "Tanques", "Tanque de agua 1.000 L", "und", "Alta", "Polietileno", 150, 300),
    ("Bombeo e hidroneumático", "Tanques", "Tanque de agua 5.000 L", "und", "Alta", "Polietileno", 600, 1100),
    ("Bombeo e hidroneumático", "Tanques", "Tanque de agua 10.000 L", "und", "Media", "Polietileno", 1200, 2200),
    ("Bombeo e hidroneumático", "Controles", "Presostato 20-40 psi", "und", "Alta", "Hidroneumático", 25, 60),
    ("Bombeo e hidroneumático", "Controles", "Presostato 30-50 psi", "und", "Alta", "Hidroneumático", 25, 60),
    ("Bombeo e hidroneumático", "Controles", "Presostato 40-60 psi", "und", "Alta", "Hidroneumático", 30, 70),
    ("Bombeo e hidroneumático", "Controles", "Presostato digital", "und", "Media", "Ajuste electrónico", 80, 180),
    ("Bombeo e hidroneumático", "Controles", "Manómetro glicerina 0-100 psi", "und", "Alta", "Conexión 1/4\"", 25, 60),
    ("Bombeo e hidroneumático", "Controles", "Manómetro glicerina 0-200 psi", "und", "Alta", "Conexión 1/4\"", 30, 70),
    ("Bombeo e hidroneumático", "Controles", "Válvula check 1\"", "und", "Alta", "Horizontal/vertical", 15, 40),
    ("Bombeo e hidroneumático", "Controles", "Válvula check 2\"", "und", "Alta", "Horizontal/vertical", 30, 80),
    ("Bombeo e hidroneumático", "Controles", "Válvula check 3\"", "und", "Media", "Horizontal/vertical", 60, 150),
    ("Bombeo e hidroneumático", "Controles", "Válvula check 4\"", "und", "Media", "Horizontal/vertical", 100, 250),
    ("Bombeo e hidroneumático", "Controles", "Válvula de pie 1\"", "und", "Alta", "Con colador", 20, 50),
    ("Bombeo e hidroneumático", "Controles", "Válvula de pie 2\"", "und", "Alta", "Con colador", 40, 90),
    ("Bombeo e hidroneumático", "Controles", "Control de nivel electrónico", "und", "Alta", "Electrodos/sonda", 80, 200),
    ("Bombeo e hidroneumático", "Controles", "Sensor de presión 4-20 mA", "und", "Alta", "0-100 psi", 60, 150),
    ("Bombeo e hidroneumático", "Controles", "Flotador eléctrico", "und", "Alta", "Cable 3 m", 25, 70),
    ("Bombeo e hidroneumático", "Tableros", "Tablero de control bomba 1F", "und", "Alta", "Arranque directo", 150, 350),
    ("Bombeo e hidroneumático", "Tableros", "Tablero de control bomba 3F", "und", "Alta", "Arranque directo", 300, 700),
    ("Bombeo e hidroneumático", "Tableros", "Arrancador directo 3F", "und", "Alta", "Contactor + guardamotor", 250, 600),
    ("Bombeo e hidroneumático", "Tableros", "Guardamotor 5-40 A", "und", "Alta", "Protección térmica", 80, 250),
    ("Bombeo e hidroneumático", "Tableros", "Contactor 3P 40 A", "und", "Alta", "Bobina 220 V", 60, 150),
    ("Bombeo e hidroneumático", "Tableros", "Relé térmico 40 A", "und", "Alta", "Protección de motor", 40, 120),
    ("Bombeo e hidroneumático", "Tableros", "Protector de fase", "und", "Alta", "Monofásico/trifásico", 60, 180),
    ("Bombeo e hidroneumático", "Tableros", "Variador de frecuencia 2 HP", "und", "Alta", "Control de presión", 350, 700),
    ("Bombeo e hidroneumático", "Tableros", "Variador de frecuencia 5 HP", "und", "Alta", "Control de presión", 600, 1200),
    ("Bombeo e hidroneumático", "Tableros", "Variador de frecuencia 10 HP", "und", "Media", "Control de presión", 1000, 2000),
    ("Bombeo e hidroneumático", "Tableros", "Soft starter 10 HP", "und", "Media", "Arranque suave", 400, 900),
    ("Bombeo e hidroneumático", "Cables", "Cable sumergible 3 x 14 AWG", "m", "Alta", "Pozo profundo", 2, 5),
    ("Bombeo e hidroneumático", "Cables", "Cable sumergible 3 x 12 AWG", "m", "Alta", "Pozo profundo", 3, 6),
    ("Bombeo e hidroneumático", "Cables", "Cable sumergible 3 x 10 AWG", "m", "Alta", "Pozo profundo", 4, 8),
    ("Bombeo e hidroneumático", "Cables", "Cable sumergible 3 x 8 AWG", "m", "Media", "Pozo profundo", 6, 12),
    ("Bombeo e hidroneumático", "Cables", "Kit de empalme para cable sumergible", "und", "Alta", "Encapsulado", 30, 80),
    ("Bombeo e hidroneumático", "Cables", "Prensaestopas para cable sumergible", "und", "Alta", "Sellado", 5, 20),

    # POZOS PROFUNDOS
    ("Pozos profundos", "Revestimiento", "Tubería PVC 4\" para pozo", "m", "Alta", "Cédula 40; rosca", 8, 15),
    ("Pozos profundos", "Revestimiento", "Tubería PVC 6\" para pozo", "m", "Alta", "Cédula 40; rosca", 15, 25),
    ("Pozos profundos", "Revestimiento", "Tubería PVC 8\" para pozo", "m", "Media", "Cédula 40; rosca", 25, 40),
    ("Pozos profundos", "Revestimiento", "Filtro/cedazo 4\" para pozo", "m", "Alta", "Acero inox/PVC", 20, 50),
    ("Pozos profundos", "Revestimiento", "Filtro/cedazo 6\" para pozo", "m", "Alta", "Acero inox/PVC", 35, 80),
    ("Pozos profundos", "Revestimiento", "Filtro/cedazo 8\" para pozo", "m", "Media", "Acero inox/PVC", 60, 120),
    ("Pozos profundos", "Relleno", "Grava para pozo", "m3", "Alta", "Grava seleccionada", 60, 120),
    ("Pozos profundos", "Sellado", "Bentonita para sello sanitario", "kg", "Alta", "Sello de pozo", 1, 3),
    ("Pozos profundos", "Cabezal", "Cabezal de pozo 4\"", "und", "Alta", "Acero/PVC", 80, 200),
    ("Pozos profundos", "Cabezal", "Cabezal de pozo 6\"", "und", "Alta", "Acero/PVC", 120, 300),
    ("Pozos profundos", "Cabezal", "Tapa sanitaria de pozo", "und", "Alta", "Hermética", 50, 150),
    ("Pozos profundos", "Cabezal", "Pitless adapter 4\"", "und", "Alta", "Salida lateral", 100, 250),
    ("Pozos profundos", "Accesorios", "Torque arrestor 4\"", "und", "Alta", "Protección de bomba", 80, 200),
    ("Pozos profundos", "Accesorios", "Centralizador 4\"", "und", "Alta", "Alineación de bomba", 30, 80),
    ("Pozos profundos", "Accesorios", "Cable guía de acero inoxidable", "m", "Media", "3/16\"", 2, 5),
    ("Pozos profundos", "Instrumentación", "Sonda de nivel para pozo", "und", "Alta", "Profundidad 100 m", 100, 250),
    ("Pozos profundos", "Instrumentación", "Medidor de nivel de agua", "und", "Media", "Digital", 150, 400),
    ("Pozos profundos", "Accesorios", "Válvula de retención 4\"", "und", "Alta", "Pozo profundo", 100, 250),
    ("Pozos profundos", "Accesorios", "Desarenador para pozo", "und", "Media", "Sedimentos", 80, 200),

    # COMPONENTES ELÉCTRICOS DE BOMBEO
    ("Componentes eléctricos de bombeo", "Transferencia", "ATS 100 A", "und", "Alta", "Transferencia automática", 800, 1800),
    ("Componentes eléctricos de bombeo", "Transferencia", "ATS 200 A", "und", "Media", "Transferencia automática", 1500, 3000),
    ("Componentes eléctricos de bombeo", "Medición", "Medidor de energía kWh trifásico", "und", "Alta", "Con TC", 100, 250),
    ("Componentes eléctricos de bombeo", "Medición", "Transformador de corriente 200/5", "und", "Alta", "Medición", 50, 120),
    ("Componentes eléctricos de bombeo", "Medición", "Amperímetro 96 x 96", "und", "Media", "Analógico/digital", 20, 60),
    ("Componentes eléctricos de bombeo", "Medición", "Voltímetro 96 x 96", "und", "Media", "Analógico/digital", 20, 60),
    ("Componentes eléctricos de bombeo", "Control", "Selector 3 posiciones", "und", "Alta", "22 mm", 20, 50),
    ("Componentes eléctricos de bombeo", "Control", "Piloto LED 24 V", "und", "Alta", "22 mm", 5, 15),
    ("Componentes eléctricos de bombeo", "Control", "Pulsador 22 mm", "und", "Alta", "1NA/1NC", 5, 15),
    ("Componentes eléctricos de bombeo", "Control", "Paro de emergencia 22 mm", "und", "Alta", "Hongos", 15, 35),
    ("Componentes eléctricos de bombeo", "Protecciones", "SPD tipo 2 monofásico", "und", "Alta", "Tablero", 80, 180),
    ("Componentes eléctricos de bombeo", "Protecciones", "SPD tipo 2 trifásico", "und", "Alta", "Tablero", 200, 450),
    ("Componentes eléctricos de bombeo", "Canalización", "Riel DIN", "m", "Alta", "35 mm", 3, 8),
    ("Componentes eléctricos de bombeo", "Canalización", "Canaleta ranurada", "m", "Alta", "40 x 40 mm", 3, 8),
    ("Componentes eléctricos de bombeo", "Conexión", "Bornera DIN", "und", "Alta", "2,5-6 mm²", 2, 6),
    ("Componentes eléctricos de bombeo", "Conexión", "Terminal tubular", "und", "Alta", "Calibre según cable", 1, 3),
    ("Componentes eléctricos de bombeo", "Cables", "Cable de control 2 x 18 AWG apantallado", "m", "Alta", "Señal 4-20 mA", 1, 3),
    ("Componentes eléctricos de bombeo", "Puesta a tierra", "Varilla copperweld 5/8\" x 8'", "und", "Alta", "Puesta a tierra", 15, 35),
    ("Componentes eléctricos de bombeo", "Puesta a tierra", "Electrodo copperweld 5/8\"", "und", "Media", "Puesta a tierra", 15, 35),
    ("Componentes eléctricos de bombeo", "Puesta a tierra", "Soldadura exotérmica", "und", "Alta", "Conexión de tierra", 10, 30),
    ("Componentes eléctricos de bombeo", "Puesta a tierra", "Caja de inspección de tierra", "und", "Media", "Registro", 20, 50),
    ("Componentes eléctricos de bombeo", "Motores", "Motor eléctrico 2 HP", "und", "Alta", "1F/3F", 250, 500),
    ("Componentes eléctricos de bombeo", "Motores", "Motor eléctrico 5 HP", "und", "Alta", "3F", 500, 900),
    ("Componentes eléctricos de bombeo", "Motores", "Motor eléctrico 10 HP", "und", "Media", "3F", 900, 1600),
    ("Componentes eléctricos de bombeo", "Protecciones", "Kit de protección de motor", "und", "Alta", "Guardamotor + relé", 100, 250),
    ("Componentes eléctricos de bombeo", "Control", "Sensor de nivel por electrodos", "und", "Alta", "Pozo/tanque", 50, 150),

    # REFUERZO ESTRUCTURAL CFRP (cotización de proveedor, jul-2026)
    ("Refuerzo estructural CFRP", "Fibras de carbono", "Tela de fibra de carbono HM-60 para refuerzo de columnas", "m2", "Alta", "Cotización: $8.814,00 por 100 m²", 88.14, 88.14),
    ("Refuerzo estructural CFRP", "Fibras de carbono", "Tela de fibra de carbono HM-30 para refuerzo de vigas", "m2", "Alta", "Cotización: $6.695,95 por 100 m²", 66.96, 66.96),
    ("Refuerzo estructural CFRP", "Fibras de carbono", "Tela de fibra de carbono HM-20 para refuerzo de vigas", "m2", "Media", "Cotización: $5.470,56 por 100 m²", 54.71, 54.71),
    ("Refuerzo estructural CFRP", "Morteros", "Mortero nivelador HM-180 CE kit 20 kg", "kit", "Alta", "4 kit/100 m²; $1.107,68/kit", 1107.68, 1107.68),
    ("Refuerzo estructural CFRP", "Imprimantes", "Imprimante epóxico HM-180 C3P kit 30 kg", "kit", "Alta", "Consumo no indicado por el proveedor", 1256.97, 1256.97),
    ("Refuerzo estructural CFRP", "Resinas", "Resina epóxica para saturación de fibra de carbono CFRP", "kg", "Alta", "Consumo ±1 kg/m²; precio referencial", 47.50, 47.50),
]

# Precios referenciales para los 229 originales.
CATEGORY_RANGE = {
    "Plomería moderna": (2, 60),
    "Pinturas e impermeabilización": (12, 90),
    "Pisos y revestimientos": (8, 65),
    "Muros, techos y tabiquería": (6, 70),
    "Eléctrico e iluminación": (3, 250),
    "Clima y gas": (15, 450),
    "Energía solar, domótica y seguridad": (20, 900),
    "Baños, cocinas y carpintería": (15, 600),
    "Adhesivos, químicos y consumibles": (3, 80),
}
UNIT_RANGE = {
    "m": (2, 25),
    "m2": (6, 65),
    "und": (8, 250),
    "gln": (12, 90),
    "saco": (8, 30),
    "kg": (3, 40),
    "rollo": (20, 150),
    "kit": (20, 250),
    "caja": (8, 60),
    "frasco": (5, 25),
    "jgo": (15, 120),
    "lt": (3, 25),
    "pza": (5, 100),
}
OVERRIDE_RANGE = {
    "panel solar 600": (250, 450),
    "inversor híbrido 5 kw": (900, 1800),
    "batería lifepo4 5 kwh": (1200, 2400),
    "minisplit inverter 12.000": (450, 800),
    "minisplit inverter 18.000": (650, 1100),
    "minisplit inverter 24.000": (850, 1400),
}

# Solo coincidencias exactas. Una variante "similar" no se considera existente.
MANUAL_EXACT = {
    "puerta de aluminio": "ACA205",
}

def norm(s):
    s = unicodedata.normalize("NFKD", str(s or ""))
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = re.sub(r"[^a-z0-9]+", " ", s.lower()).strip()
    return re.sub(r"\s+", " ", s)

def match_db(desc, db):
    target = norm(desc)
    if target in MANUAL_EXACT:
        rows = db[db["CodMat"] == MANUAL_EXACT[target]]
        if not rows.empty:
            row = rows.iloc[0]
            return ("Existente", row["CodMat"], row["Descri"], row["CosMat"])
    exact = db[db["_norm"] == target]
    if len(exact):
        row = exact.iloc[0]
        return ("Existente", row["CodMat"], row["Descri"], row["CosMat"])
    return ("No existe", "", "", None)

def estimate_range(item, dbprice=None):
    desc, unit = item[2], item[3]
    low = norm(desc)
    for key, bounds in OVERRIDE_RANGE.items():
        if key in low:
            return bounds
    if len(item) > 6 and item[6] is not None:
        return (item[6], item[7])
    if dbprice is not None and pd.notna(dbprice):
        return (round(float(dbprice) * 0.85, 2), round(float(dbprice) * 1.15, 2))
    cat = item[0]
    return CATEGORY_RANGE.get(cat, UNIT_RANGE.get(unit, (5, 100)))

# Cargar BD
db = pd.read_csv(HERE / "costbase_materials.csv")
db["_norm"] = db["Descri"].map(norm)
db["CosMat"] = pd.to_numeric(db["CosMat"], errors="coerce")

rows = []
# Originales (sin precios explícitos)
for item in BASE_ITEMS:
    cat, sub, desc, unit, prio, spec = item
    state, code, dbdesc, dbprice = match_db(desc, db)
    best_db_price = dbprice if pd.notna(dbprice) else None
    lo, hi = estimate_range(item, best_db_price)
    rows.append({
        "cat": cat, "sub": sub, "desc": desc, "unit": unit, "prio": prio, "spec": spec,
        "state": state, "code": code, "dbdesc": dbdesc, "dbprice": dbprice,
        "lo": lo, "hi": hi, "new": False,
    })

# Nuevos faltantes
for item in NEW_ITEMS:
    cat, sub, desc, unit, prio, spec, lo, hi = item
    state, code, dbdesc, dbprice = match_db(desc, db)
    best_db_price = dbprice if pd.notna(dbprice) else None
    if best_db_price is not None:
        lo2, hi2 = round(best_db_price * 0.85, 2), round(best_db_price * 1.15, 2)
    else:
        lo2, hi2 = lo, hi
    rows.append({
        "cat": cat, "sub": sub, "desc": desc, "unit": unit, "prio": prio, "spec": spec,
        "state": state, "code": code, "dbdesc": dbdesc, "dbprice": dbprice,
        "lo": lo2, "hi": hi2, "new": True,
    })

# Código propuesto
prefix = {
    "Plomería moderna": "PLO",
    "Pinturas e impermeabilización": "PIN",
    "Pisos y revestimientos": "PIS",
    "Muros, techos y tabiquería": "MUR",
    "Eléctrico e iluminación": "ELE",
    "Clima y gas": "CLI",
    "Energía solar, domótica y seguridad": "ENS",
    "Baños, cocinas y carpintería": "BCO",
    "Adhesivos, químicos y consumibles": "QUI",
    "Bombeo e hidroneumático": "BOM",
    "Pozos profundos": "POZ",
    "Componentes eléctricos de bombeo": "CEB",
    "Refuerzo estructural CFRP": "REF",
}
counters = Counter()
for row in rows:
    counters[row["cat"]] += 1
    row["code_prop"] = f"MOD-{prefix.get(row['cat'], 'MAT')}-{counters[row['cat']]:03d}"

# =========================
# Workbook 1: lista ampliada
# =========================
wb1 = Workbook()
ws = wb1.active
ws.title = "Materiales"
headers = ["Código propuesto", "Descripción", "Unidad", "Categoría", "Prioridad", "Especificación / uso"]
ws.append(headers)
for r in rows:
    ws.append([r["code_prop"], r["desc"], r["unit"], f"{r['cat']} / {r['sub']}", r["prio"], r["spec"]])

# Estilos
header_fill = PatternFill("solid", fgColor="1E3A8A")
header_font = Font(color="FFFFFF", bold=True, size=11)
thin = Side(style="thin", color="CBD5E1")
border = Border(left=thin, right=thin, top=thin, bottom=thin)
for cell in ws[1]:
    cell.fill = header_fill
    cell.font = header_font
    cell.alignment = Alignment(horizontal="center", vertical="center")
    cell.border = border
for row in ws.iter_rows(min_row=2, max_row=ws.max_row):
    for cell in row:
        cell.border = border
        cell.alignment = Alignment(vertical="center", wrap_text=True)
    row[0].font = Font(name="Consolas", size=9)
    if row[4].value == "Alta":
        row[4].fill = PatternFill("solid", fgColor="DCFCE7")
for i, width in enumerate([18, 58, 10, 46, 10, 45], start=1):
    ws.column_dimensions[get_column_letter(i)].width = width
ws.freeze_panes = "A2"
ws.auto_filter.ref = f"A1:F{ws.max_row}"

# =========================
# Workbook 2: verificación vs BD
# =========================
wb2 = Workbook()
vs = wb2.active
vs.title = "Verificados"
vheaders = [
    "Código propuesto", "Descripción", "Unidad", "Categoría", "Prioridad",
    "Estado en BD", "Código BD", "Descripción en BD", "Precio BD USD",
    "Precio mercado mín USD", "Precio mercado máx USD", "Precio promedio estimado USD",
    "Observación",
]
vs.append(vheaders)
for r in rows:
    avg = round((r["lo"] + r["hi"]) / 2, 2) if r["hi"] else None
    obs = ""
    if r["state"] == "Existente":
        obs = "Coincidencia exacta en BD"
    else:
        obs = "No existe con la misma descripción en BD; precio estimado de mercado"
    vs.append([
        r["code_prop"], r["desc"], r["unit"], f"{r['cat']} / {r['sub']}", r["prio"],
        r["state"], r["code"], r["dbdesc"],
        round(float(r["dbprice"]), 2) if pd.notna(r["dbprice"]) else None,
        r["lo"], r["hi"], avg, obs,
    ])

for cell in vs[1]:
    cell.fill = header_fill
    cell.font = header_font
    cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    cell.border = border
for row in vs.iter_rows(min_row=2, max_row=vs.max_row):
    for cell in row:
        cell.border = border
        cell.alignment = Alignment(vertical="center", wrap_text=True)
    row[0].font = Font(name="Consolas", size=9)
    if row[5].value == "Existente":
        row[5].fill = PatternFill("solid", fgColor="DCFCE7")
    else:
        row[5].fill = PatternFill("solid", fgColor="FEE2E2")
for i, width in enumerate([18, 48, 9, 40, 9, 13, 13, 48, 14, 16, 16, 18, 42], start=1):
    vs.column_dimensions[get_column_letter(i)].width = width
vs.freeze_panes = "A2"
vs.auto_filter.ref = f"A1:M{vs.max_row}"

# Hoja estudio
study = wb2.create_sheet("Estudio_DB")
study.append(["Sistema / componente", "Coincidencias en BD", "Hallazgo principal"])
study_rows = [
    ("Bombas", int(db["Descri"].fillna("").str.upper().str.contains("BOMBA").sum()), "Hay bombas centrífugas, sumergibles y dosificadoras, pero faltan tamaños comerciales y bombas solares/de presión constante."),
    ("Hidroneumáticos", int(db["Descri"].fillna("").str.upper().str.contains("HIDRONEUM").sum()), "Existen equipos de 20 a 700 gal, pero faltan configuraciones dúplex/tríplex y controles modernos."),
    ("Tanques", int(db["Descri"].fillna("").str.upper().str.contains("TANQUE").sum()), "Hay tanques de agua y pulmón; faltan capacidades intermedias y tanques con membrana."),
    ("Pozos profundos", int(db["Descri"].fillna("").str.upper().str.contains("POZO|MECHA|PERFORACION").sum()), "La BD cubre perforación y entubado parcial; faltan filtros, cabezales, pitless, torque arrestor y sellos."),
    ("Presostatos / manómetros", int(db["Descri"].fillna("").str.upper().str.contains("PRESOSTATO|MANOMETRO").sum()), "Cobertura mínima; faltan rangos comerciales y modelos digitales."),
    ("Controles de bomba", int(db["Descri"].fillna("").str.upper().str.contains("CONTACTOR|GUARDAMOTOR|ARRANCADOR|VARIADOR|RELE").sum()), "Hay contactores y tableros, pero no guardamotores, variadores, soft starters ni protección de fase."),
    ("Breakers", int(db["Descri"].fillna("").str.upper().str.contains("BREAKER").sum()), "Cobertura amplia; faltan protecciones diferenciales y SPD específicos."),
    ("Cables", int(db["Descri"].fillna("").str.upper().str.contains("CABLE").sum()), "Cobertura amplia en THW/THHN; falta cable sumergible para pozo y cable de control apantallado."),
]
for r in study_rows:
    study.append(r)
for cell in study[1]:
    cell.fill = header_fill
    cell.font = header_font
    cell.alignment = Alignment(horizontal="center", wrap_text=True)
for row in study.iter_rows(min_row=2, max_row=study.max_row):
    for cell in row:
        cell.border = border
        cell.alignment = Alignment(vertical="center", wrap_text=True)
for i, width in enumerate([26, 20, 100], start=1):
    study.column_dimensions[get_column_letter(i)].width = width

# Detalle de lo que ya existe en la BD
detail = wb2.create_sheet("BD_Existente")
detail.append(["Código BD", "Descripción", "Unidad", "Precio BD USD", "Sistema"])
for _, row in db.iterrows():
    desc = str(row["Descri"] or "")
    up = desc.upper()
    system = None
    if any(x in up for x in ("BOMBA", "HIDRONEUM", "TANQUE", "PRESOSTATO", "MANOMETRO")):
        system = "Bombeo / hidroneumático"
    elif any(x in up for x in ("POZO", "MECHA", "PERFORACION", "GRAVA", "VALVULA CHECK", "FILTRO DE NYLON")):
        system = "Pozos profundos"
    elif any(x in up for x in ("CONTACTOR", "GUARDAMOTOR", "ARRANCADOR", "VARIADOR", "RELE", "TABLERO ARRANQUE", "BREAKER", "CABLE THW", "CABLE THHN", "SENSOR DE NIVEL", "FLOTADOR", "SPD", "SUPRESOR")):
        system = "Componentes eléctricos"
    if system:
        detail.append([
            row["CodMat"], row["Descri"], row["UniMat"],
            round(float(row["CosMat"]), 2) if pd.notna(row["CosMat"]) else None,
            system,
        ])
for cell in detail[1]:
    cell.fill = header_fill
    cell.font = header_font
    cell.alignment = Alignment(horizontal="center", wrap_text=True)
for row in detail.iter_rows(min_row=2, max_row=detail.max_row):
    for cell in row:
        cell.border = border
        cell.alignment = Alignment(vertical="center", wrap_text=True)
for i, width in enumerate([16, 70, 10, 14, 30], start=1):
    detail.column_dimensions[get_column_letter(i)].width = width
detail.freeze_panes = "A2"
detail.auto_filter.ref = f"A1:E{detail.max_row}"

# Faltantes priorizados
missing = wb2.create_sheet("Faltantes")
missing.append(["Código propuesto", "Descripción", "Unidad", "Categoría", "Prioridad", "Precio promedio estimado USD", "Especificación"])
for r in rows:
    if r["state"] != "No existe":
        continue
    avg = round((r["lo"] + r["hi"]) / 2, 2) if r["hi"] else None
    missing.append([r["code_prop"], r["desc"], r["unit"], r["cat"], r["prio"], avg, r["spec"]])
for cell in missing[1]:
    cell.fill = header_fill
    cell.font = header_font
    cell.alignment = Alignment(horizontal="center", wrap_text=True)
for row in missing.iter_rows(min_row=2, max_row=missing.max_row):
    for cell in row:
        cell.border = border
        cell.alignment = Alignment(vertical="center", wrap_text=True)
for i, width in enumerate([18, 60, 10, 34, 10, 18, 44], start=1):
    missing.column_dimensions[get_column_letter(i)].width = width
missing.freeze_panes = "A2"
missing.auto_filter.ref = f"A1:G{missing.max_row}"

# Resumen
summary = wb2.create_sheet("Resumen")
summary.append(["Categoría", "Materiales", "Existentes", "No existen"])
for cell in summary[1]:
    cell.fill = header_fill
    cell.font = header_font
    cell.alignment = Alignment(horizontal="center")
    cell.border = border
for cat in prefix:
    cat_rows = [r for r in rows if r["cat"] == cat]
    summary.append([
        cat,
        len(cat_rows),
        sum(1 for r in cat_rows if r["state"] == "Existente"),
        sum(1 for r in cat_rows if r["state"] == "No existe"),
    ])
for row in summary.iter_rows(min_row=2, max_row=summary.max_row):
    for cell in row:
        cell.border = border
        cell.alignment = Alignment(vertical="center", wrap_text=True)
for i, width in enumerate([46, 12, 12, 12], start=1):
    summary.column_dimensions[get_column_letter(i)].width = width

# Notas
notes = wb2.create_sheet("Notas")
notes["A1"] = "Lista ampliada y verificada contra la Base Maestra CostBase"
notes["A1"].font = Font(bold=True, size=14, color="1E3A8A")
notes_rows = [
    ("Base revisada", "7.957 materiales"),
    ("Materiales en esta lista", len(rows)),
    ("Nuevos faltantes", sum(1 for r in rows if r["new"])),
    ("Faltantes por descripción", sum(1 for r in rows if r["state"] == "No existe")),
    ("Verificación", "Solo se considera existente la coincidencia exacta de descripción. Las variantes no se cuentan como existentes."),
    ("Precios", "USD referenciales de mercado (estimación). No son cotizaciones ni precios de compra."),
    ("Códigos propuestos", "MOD-...; deben validarse antes de cargar a producción."),
    ("Duplicados", "Las variantes con otra descripción, medida o modelo se listan como faltantes."),
]
r = 3
for label, value in notes_rows:
    notes[f"A{r}"] = label
    notes[f"B{r}"] = value
    notes[f"A{r}"].font = Font(bold=True)
    r += 1
notes.column_dimensions["A"].width = 26
notes.column_dimensions["B"].width = 100

path1 = HERE / "Lista_Materiales_Modernos_Ampliada_v3.xlsx"
path2 = HERE / "Materiales_Verificados_vs_BD_v3.xlsx"
wb1.save(path1)
wb2.save(path2)
print(path1)
print(path2)
print(f"total={len(rows)} nuevos={sum(1 for r in rows if r['new'])}")
