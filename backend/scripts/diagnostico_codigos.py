import sys
from sqlalchemy import create_engine, text

# Conexión directa a producción puerto 5440
DB_URLS = [
    "postgresql://apupro_user:apupro_password@costbase.net:5440/apupro_db",
    "postgresql://apupro_user:apupro_password@167.172.115.154:5440/apupro_db",
    "postgresql://apupro_user:apupro_password@localhost:5432/apupro_db"
]

engine = None
for url in DB_URLS:
    try:
        e = create_engine(url, connect_args={"connect_timeout": 5})
        with e.connect() as conn:
            conn.execute(text("SELECT 1"))
        engine = e
        print(f"Conectado exitosamente a: {url.split('@')[-1]}")
        break
    except Exception as err:
        print(f"No se pudo conectar a {url.split('@')[-1]}: {err}")

if not engine:
    print("Error: No se pudo conectar a ninguna base de datos.")
    sys.exit(1)

with engine.connect() as conn:
    print("\n" + "="*70)
    print("1. VERIFICACIÓN DE CÓDIGOS (CodMat, CodEqu, CodMan, CodPar, CovPar)")
    print("="*70)
    
    tables = [
        ("cost360_materials", "CodMat", "Materiales"),
        ("cost360_equipment", "CodEqu", "Equipos"),
        ("cost360_labor", "CodMan", "Mano de Obra"),
        ("cost360_items", "CodPar", "Partidas (CodPar)"),
        ("cost360_items", "CovPar", "Partidas (CovPar)")
    ]
    
    for table, col, name in tables:
        sql = text(f"""
            SELECT 
                COUNT(*) as total,
                COUNT("{col}") as con_valor,
                SUM(CASE WHEN "{col}" IS NULL OR TRIM("{col}") = '' THEN 1 ELSE 0 END) as sin_codigo,
                COUNT(DISTINCT "{col}") as unicos
            FROM {table}
        """)
        row = conn.execute(sql).fetchone()
        print(f"[{name}]")
        print(f"  Total registros: {row.total}")
        print(f"  Con código:      {row.con_valor}")
        print(f"  Sin código:      {row.sin_codigo}")
        print(f"  Códigos únicos:  {row.unicos}")
        if row.sin_codigo > 0:
            print(f"  ALERTA: Existen {row.sin_codigo} registros sin código.")
        else:
            print(f"  OK: 100% de los registros tienen código asignado.")
        print()

    print("="*70)
    print("2. VERIFICACIÓN DE INSUMOS EN TABLAS PIVOTE APU")
    print("="*70)
    pivots = [
        ("cost360_apu_materials", "cost360_materials", "CodMat", "Materiales en APU"),
        ("cost360_apu_equipment", "cost360_equipment", "CodEqu", "Equipos en APU"),
        ("cost360_apu_labor", "cost360_labor", "CodMan", "Mano de Obra en APU")
    ]
    for pivot, ref_table, ref_pk, label in pivots:
        sql = text(f"""
            SELECT 
                COUNT(*) as total_filas,
                COUNT(DISTINCT p."CodIns") as insumos_distintos,
                SUM(CASE WHEN p."CodIns" IS NULL OR TRIM(p."CodIns") = '' THEN 1 ELSE 0 END) as insumos_sin_codigo,
                SUM(CASE WHEN m."{ref_pk}" IS NULL THEN 1 ELSE 0 END) as insumos_no_encontrados_en_catalogo
            FROM {pivot} p
            LEFT JOIN {ref_table} m ON p."CodIns" = m."{ref_pk}"
        """)
        row = conn.execute(sql).fetchone()
        print(f"[{label}]")
        print(f"  Filas relacionales en APU: {row.total_filas}")
        print(f"  Insumos distintos usados:   {row.insumos_distintos}")
        print(f"  Insumos con CodIns vacío:   {row.insumos_sin_codigo}")
        print(f"  Insumos no encontrados:     {row.insumos_no_encontrados_en_catalogo}")
        if row.insumos_no_encontrados_en_catalogo > 0:
            print(f"  ALERTA: Hay {row.insumos_no_encontrados_en_catalogo} filas apuntando a insumos inexistentes.")
        else:
            print(f"  OK: Todos los insumos del APU están debidamente catalogados.")
        print()

    print("="*70)
    print("3. EXISTENCIA DE COLUMNA ref_code")
    print("="*70)
    for t in ["cost360_materials", "cost360_equipment", "cost360_labor"]:
        sql = text(f"""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = '{t}' AND column_name = 'ref_code'
        """)
        col = conn.execute(sql).fetchone()
        if col:
            print(f"  {t}: YA TIENE columna ref_code ({col.data_type})")
        else:
            print(f"  {t}: NO tiene columna ref_code todavía.")
    print("="*70)
