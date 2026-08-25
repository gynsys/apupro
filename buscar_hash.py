"""
Busca en TODOS los backups disponibles registros MAT que terminaban en #.
"""
from sqlalchemy import create_engine, text

DB_URL = 'postgresql://apupro_user:apupro_password@apupro-db:5432/apupro_db'

engine = create_engine(DB_URL)
with engine.connect() as conn:
    backups = conn.execute(text(
        "SELECT tablename FROM pg_tables "
        "WHERE schemaname='public' AND tablename LIKE 'cost360_materials_backup%' "
        "ORDER BY tablename ASC"
    )).fetchall()

    print(f"Backups disponibles: {[b[0] for b in backups]}\n")

    for backup in backups:
        bk = backup[0]
        rows = conn.execute(text(
            f"SELECT \"CodMat\", \"Descri\" FROM {bk} "
            f"WHERE \"CodMat\" LIKE 'MAT%' "
            f"AND TRIM(\"Descri\") LIKE '%#' "
            f"ORDER BY \"CodMat\""
        )).fetchall()
        print(f"{bk}: {len(rows)} con # al final")
        for cod, desc in rows:
            print(f"  {cod}: '{desc}'")

    # Buscar también en la tabla actual cualquier # al final
    current = conn.execute(text(
        "SELECT \"CodMat\", \"Descri\" FROM cost360_materials "
        "WHERE \"CodMat\" LIKE 'MAT%' "
        "AND TRIM(\"Descri\") LIKE '%#' "
        "ORDER BY \"CodMat\""
    )).fetchall()
    print(f"\nTabla actual: {len(current)} con # al final")
    for cod, desc in current:
        print(f"  {cod}: '{desc}'")

    # Muestra de MAT con # en cualquier posicion
    sample = conn.execute(text(
        "SELECT \"CodMat\", \"Descri\" FROM cost360_materials "
        "WHERE \"CodMat\" LIKE 'MAT%' "
        "AND \"Descri\" LIKE '%#%' "
        "ORDER BY \"CodMat\" LIMIT 20"
    )).fetchall()
    print(f"\nMAT con # en cualquier posicion (muestra 20):")
    for cod, desc in sample:
        print(f"  {cod}: '{desc}'")
