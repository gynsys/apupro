"""
Fase 1 - Limpieza final de descripciones MAT (44 registros pendientes).
Reglas confirmadas por el usuario el 2026-08-24.

Ejecutar dentro del contenedor backend:
  docker exec apupro_platform-apupro-backend-1 python /tmp/limpieza_mat_final_v2.py
"""
import re
import datetime
from sqlalchemy import create_engine, text

DB_URL = 'postgresql://apupro_user:apupro_password@apupro-db:5432/apupro_db'

# ─────────────────────────────────────────────────────────────────────────────
# Reglas en orden de prioridad (más específicas primero)
# ─────────────────────────────────────────────────────────────────────────────

def limpiar_descripcion(texto: str) -> str:
    """Aplica las reglas de limpieza confirmadas a una descripción MAT."""
    if not texto:
        return texto

    resultado = texto.upper()

    # ── Regla 1: SUM.TRANS.COLOC. y variantes → S/T/C ─────────────────────
    # Aplica antes que la regla general de puntos para capturar el patrón completo
    resultado = re.sub(
        r'SUM[\.]?TRANS[\.]?(?:INST[\.]?)?(?:COLOC[\.]?)?',
        'S/T/C',
        resultado
    )
    # Forma abreviada: S.T.C o S.T.C. → S/T/C
    resultado = re.sub(r'\bS\.T\.C\.?\b', 'S/T/C', resultado)

    # ── Regla 2: Eliminar prefijo REM-XXXX (REM + guion + 4 dígitos) ───────
    # Ej: "REM 9014 IE.TUBHIERGALV..." → "IE TUBHIERGALV..."
    # Ej: "REM-9014 IE.TUBHIERGALV..." → "IE TUBHIERGALV..."
    # Ej: "EDF 9014 IE.TUBHIERGALV..." → "IE TUBHIERGALV..."
    resultado = re.sub(r'^(?:REM|EDF)[\s\-]\d{4}\s*', '', resultado)

    # ── Regla 3: NP.T → NPT ────────────────────────────────────────────────
    resultado = re.sub(r'\bNP\.T\b', 'NPT', resultado)

    # ── Regla 4: EM.T. → EMT ───────────────────────────────────────────────
    resultado = re.sub(r'\bEM\.T\.?\b', 'EMT', resultado)

    # ── Regla 5: HG.ISO → HG ISO ───────────────────────────────────────────
    resultado = re.sub(r'\bHG\.ISO\.?\b', 'HG ISO', resultado)

    # ── Regla 6: HF.ASTM → HF ASTM ────────────────────────────────────────
    resultado = re.sub(r'\bHF\.ASTM\b', 'HF ASTM', resultado)

    # ── Regla 7: W.CASIENTO → WC CON ASIENTO ──────────────────────────────
    # El texto original viene comprimido: "W.CASIENTO" = "W.C" + "ASIENTO"
    resultado = re.sub(r'\bW\.C\s*ASIENTO\b', 'WC CON ASIENTO', resultado)
    resultado = re.sub(r'\bW\.CASIENTO\b', 'WC CON ASIENTO', resultado)
    # W.C genérico restante → WC
    resultado = re.sub(r'\bW\.C\b', 'WC', resultado)

    # ── Regla 8: P.VC → PVC ────────────────────────────────────────────────
    resultado = re.sub(r'\bP\.VC\b', 'PVC', resultado)

    # ── Regla 9: INTF.P → INTFP (lámina elastomérica) ─────────────────────
    resultado = re.sub(r'\bINTF\.P\b', 'INTFP', resultado)

    # ── Regla 10: IS.S → ISS (suma, instalación sanitaria) ─────────────────
    resultado = re.sub(r'\bIS\.S\b', 'ISS', resultado)

    # ── Regla 11: IE.T → IET (instalación eléctrica tubería) ───────────────
    resultado = re.sub(r'\bIE\.T\b', 'IET', resultado)

    # ── Regla 12: Puntos generales entre letras (A.B → AB) ─────────────────
    # Aplicar dos veces para encadenamientos: A.B.C → ABC
    resultado = re.sub(r'([A-Z])\.([A-Z])', r'\1\2', resultado)
    resultado = re.sub(r'([A-Z])\.([A-Z])', r'\1\2', resultado)

    # ── Regla 13: Limpiar espacios múltiples y extremos ────────────────────
    resultado = re.sub(r'\s+', ' ', resultado).strip()

    return resultado if resultado != texto.upper() else texto.upper()


def main() -> None:
    print("=" * 70)
    print("LIMPIEZA FINAL MAT v2 — Fase 1 Completación")
    print(f"Fecha: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 70)

    engine = create_engine(DB_URL)

    with engine.connect() as conn:
        # ── Verificar backup ───────────────────────────────────────────────
        print("\n[1] Verificando backup de seguridad...")
        backups = conn.execute(text(
            "SELECT tablename FROM pg_tables "
            "WHERE schemaname='public' AND tablename LIKE 'cost360_materials_backup%' "
            "ORDER BY tablename DESC LIMIT 3"
        )).fetchall()

        if backups:
            print(f"   ✅ Backup disponible: {backups[0][0]}")
        else:
            backup_nombre = f"cost360_materials_backup_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}"
            print(f"   ⚠️  Sin backup. Creando: {backup_nombre}...")
            conn.execute(text(
                f"CREATE TABLE {backup_nombre} AS "
                f"SELECT * FROM cost360_materials WHERE \"CodMat\" LIKE 'MAT%'"
            ))
            conn.commit()
            print(f"   ✅ Backup creado: {backup_nombre}")

        # ── Cargar TODOS los MAT ───────────────────────────────────────────
        print("\n[2] Cargando todos los registros MAT...")
        rows = conn.execute(text(
            "SELECT \"CodMat\", \"Descri\" FROM cost360_materials "
            "WHERE \"CodMat\" LIKE 'MAT%' ORDER BY \"CodMat\""
        )).fetchall()
        print(f"   Total MAT: {len(rows)}")

        # ── Aplicar limpieza y detectar cambios ───────────────────────────
        print("\n[3] Aplicando reglas de limpieza...")

        cambios: list[dict] = []
        for cod, descri in rows:
            nueva = limpiar_descripcion(descri) if descri else descri
            if nueva and nueva != descri:
                cambios.append({'codigo': cod, 'antes': descri, 'despues': nueva})

        print(f"   Registros que cambian: {len(cambios)}")
        print(f"   Registros sin cambio:  {len(rows) - len(cambios)}")

        # ── Mostrar detalle ────────────────────────────────────────────────
        if cambios:
            print("\n   Detalle de cambios:")
            for c in cambios:
                print(f"   ✏  {c['codigo']}")
                print(f"      ANTES:  {c['antes'][:75]}")
                print(f"      AHORA:  {c['despues'][:75]}")

            # ── Aplicar en BD ──────────────────────────────────────────────
            print(f"\n[4] Persistiendo {len(cambios)} cambios en la base de datos...")
            aplicados = 0
            errores = 0

            for cambio in cambios:
                try:
                    conn.execute(text(
                        "UPDATE cost360_materials "
                        "SET \"Descri\" = :nueva "
                        "WHERE \"CodMat\" = :cod"
                    ), {"nueva": cambio['despues'], "cod": cambio['codigo']})
                    aplicados += 1
                except Exception as e:
                    print(f"   ❌ Error en {cambio['codigo']}: {e}")
                    conn.rollback()
                    errores += 1

            conn.commit()
            print(f"   ✅ Aplicados: {aplicados}  |  ❌ Errores: {errores}")
        else:
            print("\n   ℹ️  No se detectaron cambios pendientes.")

        # ── Verificación final: ¿quedan patrones sucios? ──────────────────
        print("\n[5] Verificación final de patrones:")
        rows_post = conn.execute(text(
            "SELECT \"CodMat\", \"Descri\" FROM cost360_materials "
            "WHERE \"CodMat\" LIKE 'MAT%' ORDER BY \"CodMat\""
        )).fetchall()

        patron_punto = re.compile(r'[A-Z]\.[A-Z]')
        patron_rem   = re.compile(r'^(?:REM|EDF)[\s\-]\d{4}', re.IGNORECASE)
        patron_stc   = re.compile(r'SUM[\.]?TRANS', re.IGNORECASE)

        pendientes = [
            (cod, descri) for cod, descri in rows_post
            if descri and (
                patron_punto.search(descri.upper()) or
                patron_rem.match(descri.upper()) or
                patron_stc.search(descri.upper())
            )
        ]

        if pendientes:
            print(f"   ⚠️  Quedan {len(pendientes)} registros con posibles patrones:")
            for cod, descri in pendientes:
                print(f"      {cod}: {descri[:70]}")
        else:
            print("   ✅ ¡Sin patrones sucios detectados! Limpieza completada.")

    print("\n" + "=" * 70)
    print("FASE 1 COMPLETADA")
    print("=" * 70)


if __name__ == '__main__':
    main()
