from sqlalchemy import create_engine, text

DB_URL = "postgresql://apupro_user:apupro_password@costbase.net:5440/apupro_db"

def main():
    engine = create_engine(DB_URL)
    with engine.connect() as conn:
        print("="*70)
        print("VERIFICACIÓN DE APUS CON NUEVAS REFERENCIAS EN PRODUCCIÓN")
        print("="*70)
        
        # 1. Tomar una partida emblemática de concreto (E.311.110.150 o similar)
        item = conn.execute(text("""
            SELECT i."CodPar", i."CovPar", i."Descri", i."UniPar", i."PreUni"
            FROM cost360_items i
            JOIN cost360_apu_materials m ON i."CodPar" = m."CodPar"
            WHERE i."CovPar" LIKE 'E.31%'
            LIMIT 1
        """)).fetchone()
        
        if not item:
            item = conn.execute(text('SELECT "CodPar", "CovPar", "Descri", "UniPar", "PreUni" FROM cost360_items LIMIT 1')).fetchone()
            
        print(f"Partida de prueba: [{item.CovPar or item.CodPar}] {item.Descri[:60]}...")
        print(f"ID interno: {item.CodPar} | Unidad: {item.UniPar} | Precio Unitario: ${item.PreUni}")
        print()
        
        # 2. Consultar sus materiales con la nueva columna ref_code
        print("--- MATERIALES DEL APU ---")
        mats = conn.execute(text("""
            SELECT m."CodMat", m.ref_code, m."Descri", m."UniMat", rel."CanIns", m."CosMat"
            FROM cost360_apu_materials rel
            JOIN cost360_materials m ON rel."CodIns" = m."CodMat"
            WHERE rel."CodPar" = :par
        """), {"par": item.CodPar}).fetchall()
        
        for m in mats:
            print(f"  [Ref: {m.ref_code}] (id legacy: {m.CodMat}) - {m.Descri[:40]} | Cant: {m.CanIns} {m.UniMat} @ ${m.CosMat}")
            assert m.ref_code is not None and m.ref_code.startswith("MAT-"), f"Error en ref_code: {m.ref_code}"
            
        # 3. Consultar sus equipos
        print("\n--- EQUIPOS DEL APU ---")
        eqs = conn.execute(text("""
            SELECT e."CodEqu", e.ref_code, e."Descri", rel."CanIns", e."CosDia"
            FROM cost360_apu_equipment rel
            JOIN cost360_equipment e ON rel."CodIns" = e."CodEqu"
            WHERE rel."CodPar" = :par
        """), {"par": item.CodPar}).fetchall()
        
        for e in eqs:
            print(f"  [Ref: {e.ref_code}] (id legacy: {e.CodEqu}) - {e.Descri[:40]} | Cant: {e.CanIns} @ ${e.CosDia}/día")
            assert e.ref_code is not None and e.ref_code.startswith("EQU-"), f"Error en ref_code: {e.ref_code}"

        # 4. Consultar su mano de obra
        print("\n--- MANO DE OBRA DEL APU ---")
        mos = conn.execute(text("""
            SELECT mo."CodMan", mo.ref_code, mo."Descri", rel."CanIns", mo."Jornal", mo."Bono"
            FROM cost360_apu_labor rel
            JOIN cost360_labor mo ON rel."CodIns" = mo."CodMan"
            WHERE rel."CodPar" = :par
        """), {"par": item.CodPar}).fetchall()
        
        for mo in mos:
            print(f"  [Ref: {mo.ref_code}] (id legacy: {mo.CodMan}) - {mo.Descri[:40]} | Cant: {mo.CanIns} | Jornal: ${mo.Jornal}")
            assert mo.ref_code is not None and mo.ref_code.startswith("MO-"), f"Error en ref_code: {mo.ref_code}"

        print("\n" + "="*70)
        print("VERIFICACIÓN EXITOSA: Todos los insumos del APU tienen su nueva referencia asignada.")
        print("="*70)

if __name__ == "__main__":
    main()
