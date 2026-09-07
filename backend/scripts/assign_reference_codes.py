import re
import sys
import time
from sqlalchemy import create_engine, text

DB_URL = "postgresql://apupro_user:apupro_password@costbase.net:5440/apupro_db"

def classify_material(desc: str) -> str:
    d = (desc or "").upper()
    
    # 1. Metales y Acero
    if re.search(r'\b(CABILL|ACERO|PERFIL|PLETINA|ANGULO|TUBO ESTRUCTURAL|CONDUVEN|VIGA\b|IPN|UPN|HEB|HEA|MALLA|ALAMBRE|CLAVO|PERNO|TORNILLO|PLATINA|PLANCHA|HIERRO|ELECTRODO|SOLDADURA|ZINC|CANAL|CORREA|VIGUETA|TIRANTE|LAMINA DE ACERO|LAMINA HIERRO)\b', d):
        return "MET"
        
    # 2. Concretos, Agregados y Cementos
    if re.search(r'\b(CONCRETO|CEMENTO|ARENA|PIEDRA|GRAVA|GRAVILLA|POLVILLO|PREMEZCLADO|MORTERO|ADITIVO|SIKA|IMPERMEABILIZ|ASFALT|BREA|EMULSION ASFALTICA)\b', d):
        return "CON"
        
    # 3. Albañilería
    if re.search(r'\b(BLOQUE|LADRILLO|TABIQUE|ARCILLA|YESO|CAL\b|FRISO|REFRACTARIO)\b', d):
        return "ALB"
        
    # 4. Hidráulica, Sanitaria y Plomería
    if re.search(r'\b(TUBERIA|TUBO PVC|TUBO HG|TUBO CPVC|TUBO AGUAS|CODO\b|TE\b|REDUCCION|VALVULA|LLAVE\b|GRIFO|GRIFERIA|SANITARIO|INODORO|WC\b|LAVAMANOS|FREGADERO|DUCHA|SIFON|DRENAJE|TANQUE|BOMBA DE AGUA|BRIDA|SUMIDERO|REGISTRO|FLOTADOR|CANALETA AGUA)\b', d):
        return "HID"
        
    # 5. Electricidad
    if re.search(r'\b(CABLE|CONDUCTOR|THW|THHN|TTU|CONDUIT|BREAKER|DISYUNTOR|TABLERO|TOMACORRIENTE|INTERRUPTOR|LAMPARA|BOMBILLO|FOCO|BALASTRO|TRANSFORMADOR|LUMINARIA|REFLECTOR|CAJA ELECTRICA|CAJA DE PASO|CAJA OCTOGONAL|CAJA RECTANGULAR)\b', d):
        return "ELE"
        
    # 6. Acabados, Pinturas y Revestimientos
    if re.search(r'\b(PINTURA|ESMALTE|BARNIZ|FONDO|CERAMICA|PORCELANATO|GRANITO|MARMOL|PISO\b|CIELO RASO|DRYWALL|MASTIQUE|PASTA PROFESIONAL|ANTICORROSIVO|SELLADOR|LIJA|PEGA PISO|VIDRIO|CRISTAL|VENTANA|CERRADURA|POMO|BISAGRA|PUERTA)\b', d):
        return "ACA"
        
    # 7. Maderas y Encofrados
    if re.search(r'\b(MADERA|TABLA|TABLON|LISTON|CUARTON|PINO|SAQUI|MACHIHEMBRADO|TRIPLAY|CONTRAPLACHADO|MDF|FORMICA|PARQUET|ENCOFRADO)\b', d):
        return "MAD"
        
    return "VAR"

def classify_equipment(desc: str) -> str:
    d = (desc or "").upper()
    
    # 1. Maquinaria Pesada
    if re.search(r'\b(RETROEXCAVADORA|TRACTOR|CAMION|VOLTEO|CHUTO|BATEA|CISTERNA|CARGADOR|MOTONIVELADORA|JUMBO|PALA|GRUA|COMPACTADOR VIBRATORIO|FINISHER|PAVIMENTADORA|DRAGA|PATROL|RODILLO PATA)\b', d):
        return "PES"
        
    # 2. Equipo Menor / Liviano
    if re.search(r'\b(MEZCLADORA|TROMPO|VIBRADOR|BOMBA\b|ACHIQUE|GENERADOR|PLANTA\b|COMPRESOR|APISONADOR|BAILARINA|SAPO|MOTOBOMBA|WINCHE|ELEVADOR|RODILLO MANUAL|GUINCHE)\b', d):
        return "LIV"
        
    # 3. Herramientas y Accesorios
    if re.search(r'\b(ANDAMIO|PUNTAL|TALADRO|ROTOMARTILLO|CORTADORA|ESMERIL|SIERRA|SOLDADORA|SOLDAR|PISTOLA|TECLE|SEÑALIZACION|CONO|CARRETILLA|ENCOFRADO METALICO)\b', d):
        return "HER"
        
    # 4. Transporte y Vehículos
    if re.search(r'\b(CAMIONETA|PICK-UP|PICKUP|VEHICULO|FURGON|JEEP|AUTOMOVIL|AUTOBUS)\b', d):
        return "TRA"
        
    return "GEN"

def classify_labor(desc: str) -> str:
    d = (desc or "").upper()
    
    # 1. Dirección / Supervisión
    if re.search(r'\b(MAESTRO|TOPOGRAFO|CADENERO|SUPERVISOR|INSPECTOR|CAPORAL|ENCARGADO|JEFE)\b', d):
        return "DIR"
        
    # 2. Operadores y Choferes
    if re.search(r'\b(OPERADOR|CHOFER|CHOFFER|CONDUCTOR|MAQUINISTA)\b', d):
        return "OPR"
        
    # 3. Oficiales Especializados
    if re.search(r'\b(OFICIAL|ALBAÑIL|CARPINTERO|CABILLERO|ELECTRICISTA|PLOMERO|SOLDADOR|HERRERO|PINTOR|TUBERO|MONTADOR|MECANICO|TABIQUERO|CRISTALERO|PULIDOR|INSTALADOR)\b', d):
        return "OFI"
        
    # 4. Obreros y Ayudantes
    if re.search(r'\b(OBRERO|AYUDANTE|AUXILIAR|PEON|VIGILANTE)\b', d):
        return "OBR"
        
    # 5. Cuadrillas
    if re.search(r'\b(CUADRILLA|EQUIPO)\b', d):
        return "CUA"
        
    return "GEN"

def bulk_batch_update(conn, table: str, pk_col: str, updates: list, batch_size: int = 1000):
    total = len(updates)
    for i in range(0, total, batch_size):
        batch = updates[i:i + batch_size]
        values_parts = []
        for item in batch:
            # Sanitizar comillas simples
            cod = item['cod'].replace("'", "''")
            ref = item['ref'].replace("'", "''")
            values_parts.append(f"('{cod}', '{ref}')")
            
        values_str = ", ".join(values_parts)
        sql = f"""
            UPDATE {table} AS t
            SET ref_code = v.ref
            FROM (VALUES {values_str}) AS v(cod, ref)
            WHERE t."{pk_col}" = v.cod;
        """
        conn.execute(text(sql))
        print(f"   Actualizados {min(i + batch_size, total)}/{total} registros...", flush=True)

def main():
    start_time = time.time()
    print("Conectando a la base de datos...", flush=True)
    engine = create_engine(DB_URL)
    
    with engine.begin() as conn:
        print("1. Verificando/Creando columnas ref_code e índices...", flush=True)
        conn.execute(text("ALTER TABLE cost360_materials ADD COLUMN IF NOT EXISTS ref_code VARCHAR(30);"))
        conn.execute(text("ALTER TABLE cost360_equipment ADD COLUMN IF NOT EXISTS ref_code VARCHAR(30);"))
        conn.execute(text("ALTER TABLE cost360_labor ADD COLUMN IF NOT EXISTS ref_code VARCHAR(30);"))
        
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_materials_ref_code ON cost360_materials(ref_code);"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_equipment_ref_code ON cost360_equipment(ref_code);"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_labor_ref_code ON cost360_labor(ref_code);"))
        print("   Columnas e índices listos.", flush=True)

        # ======================================================================
        # 2. PROCESAR MATERIALES
        # ======================================================================
        print("\n2. Procesando Materiales (cost360_materials)...", flush=True)
        materials = conn.execute(text('SELECT "CodMat", "Descri" FROM cost360_materials ORDER BY "Descri" ASC, "CodMat" ASC')).fetchall()
        print(f"   Total materiales leídos: {len(materials)}", flush=True)
        
        mat_by_family = {}
        for row in materials:
            fam = classify_material(row.Descri)
            mat_by_family.setdefault(fam, []).append(row.CodMat)
            
        mat_updates = []
        assigned_mat_codes = set()
        for fam, codmats in sorted(mat_by_family.items()):
            for idx, cod_mat in enumerate(codmats, start=1):
                ref_code = f"MAT-{fam}-{idx:04d}"
                if ref_code in assigned_mat_codes:
                    raise ValueError(f"Código duplicado generado: {ref_code}")
                assigned_mat_codes.add(ref_code)
                mat_updates.append({"cod": cod_mat, "ref": ref_code})
            print(f"   - Familia {fam}: {len(codmats)} materiales (desde MAT-{fam}-0001 hasta MAT-{fam}-{len(codmats):04d})", flush=True)
            
        print(f"   Actualizando {len(mat_updates)} materiales en lotes de 1000...", flush=True)
        bulk_batch_update(conn, "cost360_materials", "CodMat", mat_updates, batch_size=1000)
        print("   [OK] 100% de Materiales actualizados.", flush=True)

        # ======================================================================
        # 3. PROCESAR EQUIPOS
        # ======================================================================
        print("\n3. Procesando Equipos (cost360_equipment)...", flush=True)
        equipments = conn.execute(text('SELECT "CodEqu", "Descri" FROM cost360_equipment ORDER BY "Descri" ASC, "CodEqu" ASC')).fetchall()
        print(f"   Total equipos leídos: {len(equipments)}", flush=True)
        
        eq_by_type = {}
        for row in equipments:
            t = classify_equipment(row.Descri)
            eq_by_type.setdefault(t, []).append(row.CodEqu)
            
        eq_updates = []
        assigned_eq_codes = set()
        for eq_type, codequs in sorted(eq_by_type.items()):
            for idx, cod_equ in enumerate(codequs, start=1):
                ref_code = f"EQU-{eq_type}-{idx:03d}"
                if ref_code in assigned_eq_codes:
                    raise ValueError(f"Código duplicado generado: {ref_code}")
                assigned_eq_codes.add(ref_code)
                eq_updates.append({"cod": cod_equ, "ref": ref_code})
            print(f"   - Tipo {eq_type}: {len(codequs)} equipos (desde EQU-{eq_type}-001 hasta EQU-{eq_type}-{len(codequs):03d})", flush=True)
            
        print(f"   Actualizando {len(eq_updates)} equipos en lotes de 1000...", flush=True)
        bulk_batch_update(conn, "cost360_equipment", "CodEqu", eq_updates, batch_size=1000)
        print("   [OK] 100% de Equipos actualizados.", flush=True)

        # ======================================================================
        # 4. PROCESAR MANO DE OBRA
        # ======================================================================
        print("\n4. Procesando Mano de Obra (cost360_labor)...", flush=True)
        labors = conn.execute(text('SELECT "CodMan", "Descri" FROM cost360_labor ORDER BY "Descri" ASC, "CodMan" ASC')).fetchall()
        print(f"   Total mano de obra leídos: {len(labors)}", flush=True)
        
        mo_by_cat = {}
        for row in labors:
            c = classify_labor(row.Descri)
            mo_by_cat.setdefault(c, []).append(row.CodMan)
            
        mo_updates = []
        assigned_mo_codes = set()
        for cat, codmans in sorted(mo_by_cat.items()):
            for idx, cod_man in enumerate(codmans, start=1):
                ref_code = f"MO-{cat}-{idx:02d}"
                if ref_code in assigned_mo_codes:
                    raise ValueError(f"Código duplicado generado: {ref_code}")
                assigned_mo_codes.add(ref_code)
                mo_updates.append({"cod": cod_man, "ref": ref_code})
            print(f"   - Categoría {cat}: {len(codmans)} cargos (desde MO-{cat}-01 hasta MO-{cat}-{len(codmans):02d})", flush=True)
            
        print(f"   Actualizando {len(mo_updates)} cargos en lotes de 1000...", flush=True)
        bulk_batch_update(conn, "cost360_labor", "CodMan", mo_updates, batch_size=1000)
        print("   [OK] 100% de Mano de Obra actualizada.", flush=True)

    # ======================================================================
    # 5. AUDITORÍA POST-ACTUALIZACIÓN
    # ======================================================================
    with engine.connect() as conn:
        print("\n" + "="*70, flush=True)
        print("5. AUDITORÍA POST-ACTUALIZACIÓN (CERO NULOS, CERO DUPLICADOS)", flush=True)
        print("="*70, flush=True)
        
        checks = [
            ("cost360_materials", "Materiales"),
            ("cost360_equipment", "Equipos"),
            ("cost360_labor", "Mano de Obra")
        ]
        
        for table, label in checks:
            res = conn.execute(text(f"""
                SELECT 
                    COUNT(*) as total,
                    COUNT(ref_code) as con_ref,
                    SUM(CASE WHEN ref_code IS NULL OR TRIM(ref_code) = '' THEN 1 ELSE 0 END) as sin_ref,
                    COUNT(DISTINCT ref_code) as unicos
                FROM {table}
            """)).fetchone()
            
            print(f"[{label}]", flush=True)
            print(f"  Total registros:         {res.total}", flush=True)
            print(f"  Con ref_code asignado:   {res.con_ref}", flush=True)
            print(f"  Sin ref_code (nulos):    {res.sin_ref}", flush=True)
            print(f"  Códigos únicos:          {res.unicos}", flush=True)
            assert res.total == res.con_ref, f"Error: {label} tiene registros sin ref_code"
            assert res.sin_ref == 0, f"Error: {label} tiene registros nulos"
            assert res.total == res.unicos, f"Error: {label} tiene códigos duplicados"
            print(f"  VERIFICACIÓN: 100% PERFECTO.", flush=True)
            print("", flush=True)
            
    elapsed = time.time() - start_time
    print("="*70, flush=True)
    print(f"MIGRACIÓN Y ASIGNACIÓN COMPLETADA EXITOSAMENTE EN {elapsed:.2f} SEGUNDOS", flush=True)
    print("="*70, flush=True)

if __name__ == "__main__":
    main()
