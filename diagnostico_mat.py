"""
Diagnóstico v2 del estado de la limpieza MAT en producción.
Ejecutar dentro del contenedor backend vía docker exec.
"""
import sys
import re
from sqlalchemy import create_engine, text

DB_URL = 'postgresql://apupro_user:apupro_password@apupro-db:5432/apupro_db'


def main() -> None:
    print("=" * 70)
    print("DIAGNÓSTICO v2: ESTADO LIMPIEZA MAT")
    print("=" * 70)

    engine = create_engine(DB_URL)

    with engine.connect() as conn:
        # ── 1. Backups existentes ──────────────────────────────────────────
        print("\n[1] Backups de seguridad encontrados:")
        backups = conn.execute(text(
            "SELECT tablename, "
            "pg_size_pretty(pg_total_relation_size(quote_ident(tablename))) AS size "
            "FROM pg_tables "
            "WHERE schemaname = 'public' "
            "AND tablename LIKE 'cost360_materials_backup%' "
            "ORDER BY tablename DESC LIMIT 10"
        )).fetchall()

        if backups:
            for b in backups:
                print(f"   - {b[0]}  ({b[1]})")
        else:
            print("   ¡NINGÚN BACKUP ENCONTRADO!")

        # ── 2. Total MAT ──────────────────────────────────────────────────
        print("\n[2] Total registros MAT en tabla actual:")
        total_mat = conn.execute(text(
            "SELECT COUNT(*) FROM cost360_materials WHERE \"CodMat\" LIKE 'MAT%'"
        )).scalar()
        print(f"   Total MAT: {total_mat}")

        # ── 3. Obtener todas las descripciones MAT para análisis en Python ─
        print("\n[3] Analizando patrones en descripciones (en Python)...")
        rows = conn.execute(text(
            "SELECT \"CodMat\", \"Descri\" FROM cost360_materials "
            "WHERE \"CodMat\" LIKE 'MAT%' ORDER BY \"CodMat\""
        )).fetchall()

        pendientes = {
            'S/VIDRIO': 0,
            'COMP. (abreviatura)': 0,
            'P.E.A.D': 0,
            'Puntos entre letras (A.B)': 0,
            'KGF': 0,
            'Guiones (-)': 0,
        }
        ejemplos = {k: [] for k in pendientes}

        for cod, descri in rows:
            if not descri:
                continue
            d = descri.upper()
            if 'S/VIDRIO' in d:
                pendientes['S/VIDRIO'] += 1
                if len(ejemplos['S/VIDRIO']) < 3:
                    ejemplos['S/VIDRIO'].append(f"{cod}: {descri[:60]}")
            if 'COMP.' in d:
                pendientes['COMP. (abreviatura)'] += 1
                if len(ejemplos['COMP. (abreviatura)']) < 3:
                    ejemplos['COMP. (abreviatura)'].append(f"{cod}: {descri[:60]}")
            if 'P.E.A.D' in d:
                pendientes['P.E.A.D'] += 1
                if len(ejemplos['P.E.A.D']) < 3:
                    ejemplos['P.E.A.D'].append(f"{cod}: {descri[:60]}")
            if re.search(r'[A-Z]\.[A-Z]', d):
                pendientes['Puntos entre letras (A.B)'] += 1
                if len(ejemplos['Puntos entre letras (A.B)']) < 3:
                    ejemplos['Puntos entre letras (A.B)'].append(f"{cod}: {descri[:60]}")
            if 'KGF' in d:
                pendientes['KGF'] += 1
                if len(ejemplos['KGF']) < 3:
                    ejemplos['KGF'].append(f"{cod}: {descri[:60]}")
            if '-' in descri:
                pendientes['Guiones (-)'] += 1
                if len(ejemplos['Guiones (-)']) < 3:
                    ejemplos['Guiones (-)'].append(f"{cod}: {descri[:60]}")

        print("\n   Patrones pendientes de limpieza:")
        any_pending = False
        for patron, count in pendientes.items():
            if count > 0:
                any_pending = True
                print(f"   ⚠  {patron:<30}: {count} registros")
                for ej in ejemplos[patron]:
                    print(f"      → {ej}")
            else:
                print(f"   ✓  {patron:<30}: LIMPIO")

        if not any_pending:
            print("   ✅ ¡TODOS LOS PATRONES YA ESTÁN LIMPIOS!")

        # ── 4. Muestra primeros 10 MAT ─────────────────────────────────────
        print("\n[4] Muestra de 10 registros MAT actuales:")
        for cod, descri in rows[:10]:
            print(f"   {cod}: {descri}")

        # ── 5. Comparar con backup más reciente ────────────────────────────
        if backups:
            backup_nombre = backups[0][0]
            print(f"\n[5] Comparación con backup más reciente: {backup_nombre}")
            try:
                diff_count = conn.execute(text(
                    f"SELECT COUNT(*) FROM cost360_materials m "
                    f"JOIN {backup_nombre} b ON m.\"CodMat\" = b.\"CodMat\" "
                    f"WHERE m.\"Descri\" != b.\"Descri\" "
                    f"AND m.\"CodMat\" LIKE 'MAT%'"
                )).scalar()
                print(f"   Registros ya modificados (vs backup): {diff_count}")
                print(f"   Registros sin cambios aún:             {total_mat - diff_count}")

                # Muestra de cambios realizados
                if diff_count > 0:
                    print(f"\n   Muestra de cambios ya aplicados:")
                    muestra_diff = conn.execute(text(
                        f"SELECT m.\"CodMat\", b.\"Descri\" AS antes, m.\"Descri\" AS despues "
                        f"FROM cost360_materials m "
                        f"JOIN {backup_nombre} b ON m.\"CodMat\" = b.\"CodMat\" "
                        f"WHERE m.\"Descri\" != b.\"Descri\" "
                        f"AND m.\"CodMat\" LIKE 'MAT%' "
                        f"ORDER BY m.\"CodMat\" LIMIT 5"
                    )).fetchall()
                    for cod, antes, despues in muestra_diff:
                        print(f"   {cod}:")
                        print(f"     ANTES:  {antes[:70]}")
                        print(f"     AHORA:  {despues[:70]}")
            except Exception as e:
                print(f"   Error: {e}")
        else:
            print("\n[5] Sin backup para comparar.")

    print("\n" + "=" * 70)
    print("FIN DEL DIAGNÓSTICO")
    print("=" * 70)


if __name__ == '__main__':
    main()
