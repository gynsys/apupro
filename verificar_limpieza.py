import re
from sqlalchemy import create_engine, text

DB_URL = 'postgresql://apupro_user:apupro_password@apupro-db:5432/apupro_db'
e = create_engine(DB_URL)

with e.connect() as conn:
    rows = conn.execute(text(
        "SELECT \"CodMat\", \"Descri\" FROM cost360_materials "
        "WHERE \"CodMat\" LIKE 'MAT%' ORDER BY \"CodMat\""
    )).fetchall()

    p_punto = re.compile(r'[A-Z]\.[A-Z]')
    p_rem   = re.compile(r'^(?:REM|EDF)[\s\-]\d{4}', re.IGNORECASE)
    p_stc   = re.compile(r'SUM[\.]?TRANS', re.IGNORECASE)

    sucios = [(c, d) for c, d in rows if d and (
        p_punto.search(d.upper()) or
        p_rem.match(d.upper()) or
        p_stc.search(d.upper())
    )]

    print(f"Total MAT: {len(rows)}")
    print(f"Con patrones sucios restantes: {len(sucios)}")
    if sucios:
        print("Listado:")
        for cod, desc in sucios:
            print(f"  {cod}: {desc[:70]}")
    else:
        print("LIMPIEZA COMPLETA - Sin patrones sucios.")
