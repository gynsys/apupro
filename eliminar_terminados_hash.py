"""
Elimina los registros MAT cuya descripción TERMINABA en # (registros incompletos).
Los localiza en el backup porque el patch2 ya les quitó el # del final.

Ejecutar dentro del contenedor backend:
  docker exec apupro_platform-apupro-backend-1 python /tmp/eliminar_terminados_hash.py
"""
import datetime
from sqlalchemy import create_engine, text

DB_URL = 'postgresql://apupro_user:apupro_password@apupro-db:5432/apupro_db'


def main() -> None:
    print("=" * 65)
    print("ELIMINAR MAT QUE TERMINABAN EN #")
    print(f"Fecha: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 65)

    engine = create_engine(DB_URL)

    with engine.connect() as conn:
        # Obtener backup más reciente
        backups = conn.execute(text(
            "SELECT tablename FROM pg_tables "
            "WHERE schemaname='public' AND tablename LIKE 'cost360_materials_backup%' "
            "ORDER BY tablename DESC LIMIT 1"
        )).fetchall()

        if not backups:
            print("ERROR: No hay backup. Abortando.")
            return

        backup = backups[0][0]
        print(f"Backup: {backup}\n")

        # Registros que en el backup TERMINABAN en # y aún existen en la tabla
        candidatos = conn.execute(text(
            f"SELECT b.\"CodMat\", b.\"Descri\" AS descri_original "
            f"FROM {backup} b "
            f"WHERE b.\"CodMat\" LIKE 'MAT%' "
            f"AND TRIM(b.\"Descri\") LIKE '%#' "
            f"AND EXISTS ("
            f"  SELECT 1 FROM cost360_materials m "
            f"  WHERE m.\"CodMat\" = b.\"CodMat\""
            f") "
            f"ORDER BY b.\"CodMat\""
        )).fetchall()

        print(f"Registros que terminaban en # (en backup): {len(candidatos)}")

        if not candidatos:
            print("Ninguno encontrado.")
            return

        for cod, desc in candidatos:
            print(f"  {cod}: '{desc}'")

        # Verificar cuáles tienen referencias en APUs
        print("\nVerificando referencias en APUs...")
        a_eliminar = []
        con_apu    = []

        for cod, desc in candidatos:
            n = conn.execute(text(
                "SELECT COUNT(*) FROM cost360_apu_materials WHERE \"CodIns\" = :c"
            ), {"c": cod}).scalar()
            if n == 0:
                a_eliminar.append((cod, desc))
            else:
                con_apu.append((cod, desc, n))

        print(f"  Sin APUs (ELIMINAR): {len(a_eliminar)}")
        print(f"  Con APUs (conservar): {len(con_apu)}")

        if con_apu:
            print("\n  ADVERTENCIA — tienen APUs, NO se eliminan:")
            for cod, desc, n in con_apu:
                print(f"  {cod} ({n} APUs): '{desc}'")

        if a_eliminar:
            print(f"\nEliminando {len(a_eliminar)} registros...")
            eliminados = 0
            for cod, desc in a_eliminar:
                try:
                    conn.execute(text(
                        "DELETE FROM cost360_materials WHERE \"CodMat\" = :c"
                    ), {"c": cod})
                    print(f"  ELIMINADO: {cod} — '{desc}'")
                    eliminados += 1
                except Exception as e:
                    print(f"  ERROR: {cod}: {e}")

            conn.commit()
            print(f"\nOK Eliminados: {eliminados}")

        total = conn.execute(text(
            "SELECT COUNT(*) FROM cost360_materials WHERE \"CodMat\" LIKE 'MAT%'"
        )).scalar()

        print("\n" + "=" * 65)
        print(f"COMPLETADO — MAT restantes: {total}")
        print("=" * 65)


if __name__ == '__main__':
    main()
