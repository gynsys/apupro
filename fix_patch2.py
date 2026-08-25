"""
Corrección del Patch 2:
  1. Revierte el cambio de # (restaura descripciones que tenían # en el medio)
  2. Elimina registros MAT cuya descripción TERMINA en # (registros incompletos)
  3. Conserva los cambios de TIPO "X" → TIPO X (esos sí eran correctos)

Ejecutar dentro del contenedor backend:
  docker exec apupro_platform-apupro-backend-1 python /tmp/fix_patch2.py
"""
import re
import datetime
from sqlalchemy import create_engine, text

DB_URL = 'postgresql://apupro_user:apupro_password@apupro-db:5432/apupro_db'


def main() -> None:
    print("=" * 70)
    print("FIX PATCH 2 — Revertir # del medio + Eliminar terminados en #")
    print(f"Fecha: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 70)

    engine = create_engine(DB_URL)

    with engine.connect() as conn:
        # Obtener el backup más reciente para comparar
        backups = conn.execute(text(
            "SELECT tablename FROM pg_tables "
            "WHERE schemaname='public' AND tablename LIKE 'cost360_materials_backup%' "
            "ORDER BY tablename DESC LIMIT 1"
        )).fetchall()

        if not backups:
            print("ERROR: No hay backup disponible para revertir. Abortando.")
            return

        backup = backups[0][0]
        print(f"\nBackup de referencia: {backup}")

        # ── PASO 1: Identificar registros donde se quitó el # del medio ──────
        # Son los que en el backup tienen # pero en la actual NO tienen #
        # Y la descripción NO termina en # (esos serán eliminados en paso 2)
        print("\n[1] Identificando registros con # removido incorrectamente del medio...")

        afectados = conn.execute(text(
            f"SELECT m.\"CodMat\", b.\"Descri\" AS descri_original, m.\"Descri\" AS descri_actual "
            f"FROM cost360_materials m "
            f"JOIN {backup} b ON m.\"CodMat\" = b.\"CodMat\" "
            f"WHERE m.\"CodMat\" LIKE 'MAT%' "
            f"AND b.\"Descri\" LIKE '%#%' "           # backup tenía #
            f"AND m.\"Descri\" NOT LIKE '%#%' "       # actual NO tiene #
            f"AND TRIM(b.\"Descri\") NOT LIKE '%#' "  # NO terminaba en # (esos se eliminan)
            f"ORDER BY m.\"CodMat\""
        )).fetchall()

        print(f"   Registros a revertir (# en medio): {len(afectados)}")

        for cod, original, actual in afectados[:10]:
            print(f"   {cod}:")
            print(f"     REVERTIR: '{actual[:60]}' → '{original[:60]}'")

        if len(afectados) > 10:
            print(f"   ... y {len(afectados) - 10} más")

        # Revertir: restaurar la descripción original del backup
        # pero aplicando también el cambio de TIPO "X" → TIPO X si aplica
        revertidos = 0
        for cod, original, actual in afectados:
            # Aplicar SOLO el cambio de TIPO "X" → TIPO X sobre el original
            restaurada = re.sub(
                r'\bTIPO\s+"([A-Z])"\s*', r'TIPO \1 ',
                original.upper()
            )
            restaurada = re.sub(r'\s+', ' ', restaurada).strip()

            try:
                conn.execute(text(
                    "UPDATE cost360_materials SET \"Descri\" = :d "
                    "WHERE \"CodMat\" = :c"
                ), {"d": restaurada, "c": cod})
                revertidos += 1
            except Exception as e:
                print(f"   ERROR revirtiendo {cod}: {e}")

        conn.commit()
        print(f"   OK Revertidos: {revertidos}")

        # ── PASO 2: Encontrar MAT cuya descripción TERMINA en # ──────────────
        print("\n[2] Buscando registros MAT con descripcion que TERMINA en #...")

        terminan_hash = conn.execute(text(
            "SELECT \"CodMat\", \"Descri\" FROM cost360_materials "
            "WHERE \"CodMat\" LIKE 'MAT%' "
            "AND TRIM(\"Descri\") LIKE '%#' "
            "ORDER BY \"CodMat\""
        )).fetchall()

        print(f"   Encontrados: {len(terminan_hash)}")
        for cod, desc in terminan_hash:
            print(f"   {cod}: '{desc}'")

        if not terminan_hash:
            print("   (Ninguno encontrado — puede que ya estaban en el backup con #)")
            # Buscar también en el backup los que terminaban en #
            terminan_hash_bk = conn.execute(text(
                f"SELECT b.\"CodMat\", b.\"Descri\" FROM {backup} b "
                f"WHERE b.\"CodMat\" LIKE 'MAT%' "
                f"AND TRIM(b.\"Descri\") LIKE '%#' "
                f"ORDER BY b.\"CodMat\""
            )).fetchall()

            print(f"\n   En el backup, terminaban en #: {len(terminan_hash_bk)}")
            for cod, desc in terminan_hash_bk:
                print(f"   {cod}: '{desc}'")

            # Reconstruir la lista final a eliminar (los del backup que aún existen)
            terminan_hash = [
                (cod, desc) for cod, desc in terminan_hash_bk
                if conn.execute(text(
                    "SELECT 1 FROM cost360_materials WHERE \"CodMat\" = :c"
                ), {"c": cod}).fetchone()
            ]

        if terminan_hash:
            # Verificar si alguno está referenciado en APUs
            print("\n[3] Verificando si alguno está referenciado en APUs...")
            con_apu = []
            sin_apu = []
            for cod, desc in terminan_hash:
                n = conn.execute(text(
                    "SELECT COUNT(*) FROM cost360_apu_materials "
                    "WHERE \"CodIns\" = :c"
                ), {"c": cod}).scalar()
                if n > 0:
                    con_apu.append((cod, desc, n))
                else:
                    sin_apu.append((cod, desc))

            print(f"   Sin referencias en APU (se pueden eliminar): {len(sin_apu)}")
            print(f"   Con referencias en APU (conservar por ahora): {len(con_apu)}")

            if con_apu:
                print("\n   ATENCION - estos tienen APUs y NO se eliminaran:")
                for cod, desc, n in con_apu:
                    print(f"   {cod} ({n} refs): '{desc}'")

            if sin_apu:
                print(f"\n[4] Eliminando {len(sin_apu)} registros sin APU...")
                eliminados = 0
                for cod, desc in sin_apu:
                    try:
                        conn.execute(text(
                            "DELETE FROM cost360_materials WHERE \"CodMat\" = :c"
                        ), {"c": cod})
                        print(f"   ELIMINADO: {cod} — '{desc}'")
                        eliminados += 1
                    except Exception as e:
                        print(f"   ERROR eliminando {cod}: {e}")

                conn.commit()
                print(f"   OK Eliminados: {eliminados}")
        else:
            print("\n   No se encontraron registros terminados en # para eliminar.")

        # ── RESUMEN FINAL ─────────────────────────────────────────────────────
        total_mat = conn.execute(text(
            "SELECT COUNT(*) FROM cost360_materials WHERE \"CodMat\" LIKE 'MAT%'"
        )).scalar()

        print("\n" + "=" * 70)
        print("FIX COMPLETADO")
        print(f"MAT restantes en tabla: {total_mat}")
        print("=" * 70)


if __name__ == '__main__':
    main()
