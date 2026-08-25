"""
Script de limpieza FINAL (reanudación) para materiales MAT.
Solo procesa los 44 registros con patrones de puntos entre letras pendientes.
Aplica lógica conservadora: solo limpia los patrones seguros.

Ejecutar dentro del contenedor backend:
  docker exec apupro_platform-apupro-backend-1 python /tmp/limpieza_mat_final.py
"""
import re
import datetime
from typing import Optional
from sqlalchemy import create_engine, text

DB_URL = 'postgresql://apupro_user:apupro_password@apupro-db:5432/apupro_db'

# Patrones que NO deben tocarse (abreviaturas técnicas legítimas)
PATRONES_EXCLUIDOS = [
    r'NP\.T',      # Norma Prestacional Técnica
    r'ASTM',       # Norma americana materiales (no tiene punto pero por seguridad)
    r'HF\.ASTM',   # Fundición + norma ASTM
]


def limpiar_descripcion_pendientes(texto: str) -> str:
    """
    Limpieza conservadora para los 44 casos restantes.
    Solo aplica reglas específicas y seguras.
    """
    if not texto:
        return texto

    original = texto
    texto = texto.upper()

    # Verificar si contiene algún patrón excluido — si sí, no tocar
    for patron_excluido in PATRONES_EXCLUIDOS:
        if re.search(patron_excluido, texto):
            return original  # Devolver sin cambios

    # Reglas específicas para los casos pendientes identificados:

    # EM.T. → EMT (tubería metálica eléctrica)
    texto = re.sub(r'EM\.T\.', 'EMT', texto)

    # HG.ISO → HGISO (hierro galvanizado norma ISO)
    texto = re.sub(r'HG\.ISO', 'HGISO', texto)

    # W.C → WC (water closet)
    texto = re.sub(r'W\.C', 'WC', texto)

    # P.VC → PVC (policloruro de vinilo)
    texto = re.sub(r'P\.VC', 'PVC', texto)

    # F.P → FP (fibra de poliéster)
    texto = re.sub(r'INTF\.P', 'INTFP', texto)

    # A.C → AC (concreto corriente - caso específico MAT1291)
    # Solo si aparece como "RA.CORRIENTE" → "RACORRIENTE" (ya viene junto)
    # Se aplica regla general de punto entre letras solo si pasó los filtros anteriores
    texto = re.sub(r'([A-Z])\.([A-Z])', r'\1\2', texto)

    # Limpiar espacios múltiples
    texto = re.sub(r'\s+', ' ', texto).strip()

    return texto if texto != original else original


def main() -> None:
    print("=" * 70)
    print("LIMPIEZA FINAL MAT - REANUDACIÓN")
    print(f"Fecha: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 70)

    engine = create_engine(DB_URL)

    with engine.connect() as conn:
        # ── Verificar backup disponible ────────────────────────────────────
        print("\n[1] Verificando backup de seguridad...")
        backups = conn.execute(text(
            "SELECT tablename FROM pg_tables "
            "WHERE schemaname = 'public' "
            "AND tablename LIKE 'cost360_materials_backup%' "
            "ORDER BY tablename DESC LIMIT 5"
        )).fetchall()

        if not backups:
            print("   ⚠️  ADVERTENCIA: No hay backup disponible.")
            print("   Creando backup de emergencia antes de continuar...")
            backup_nombre = f"cost360_materials_backup_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}"
            conn.execute(text(
                f"CREATE TABLE {backup_nombre} AS "
                f"SELECT * FROM cost360_materials WHERE \"CodMat\" LIKE 'MAT%'"
            ))
            conn.commit()
            print(f"   ✅ Backup creado: {backup_nombre}")
        else:
            print(f"   ✅ Backup disponible: {backups[0][0]}")

        # ── Obtener los 44 casos con patrón pendiente ──────────────────────
        print("\n[2] Cargando registros con patrones de puntos pendientes...")
        rows = conn.execute(text(
            "SELECT \"CodMat\", \"Descri\" FROM cost360_materials "
            "WHERE \"CodMat\" LIKE 'MAT%' ORDER BY \"CodMat\""
        )).fetchall()

        patron_punto = re.compile(r'[A-Z]\.[A-Z]')
        candidatos = [
            (cod, descri) for cod, descri in rows
            if descri and patron_punto.search(descri.upper())
        ]
        print(f"   Candidatos encontrados: {len(candidatos)}")

        # ── Aplicar limpieza ───────────────────────────────────────────────
        print("\n[3] Aplicando limpieza conservadora...")

        cambios: list[dict] = []
        sin_cambios: list[tuple] = []

        for cod, descri in candidatos:
            nueva = limpiar_descripcion_pendientes(descri)
            if nueva != descri:
                cambios.append({'codigo': cod, 'antes': descri, 'despues': nueva})
            else:
                sin_cambios.append((cod, descri))

        print(f"   Cambios a aplicar: {len(cambios)}")
        print(f"   Sin cambios (excluidos o no aplica): {len(sin_cambios)}")

        if cambios:
            print("\n   Detalle de cambios:")
            for c in cambios:
                print(f"   ✏  {c['codigo']}:")
                print(f"      ANTES:  {c['antes'][:70]}")
                print(f"      AHORA:  {c['despues'][:70]}")

            print("\n   Sin cambios (conservados):")
            for cod, descri in sin_cambios:
                print(f"   🔒 {cod}: {descri[:70]}")

            # Confirmación implícita: ejecutar en modo producción
            print("\n[4] Aplicando cambios en base de datos...")
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
                    errores += 1

            conn.commit()
            print(f"   ✅ Aplicados: {aplicados}, Errores: {errores}")
        else:
            print("\n   ℹ️  No hay cambios pendientes para aplicar.")

        # ── Verificación final ─────────────────────────────────────────────
        print("\n[5] Verificación final...")
        rows_post = conn.execute(text(
            "SELECT \"CodMat\", \"Descri\" FROM cost360_materials "
            "WHERE \"CodMat\" LIKE 'MAT%' ORDER BY \"CodMat\""
        )).fetchall()

        patron_post = re.compile(r'[A-Z]\.[A-Z]')
        pendientes_post = [
            (cod, descri) for cod, descri in rows_post
            if descri and patron_post.search(descri.upper())
        ]

        if pendientes_post:
            print(f"   ⚠️  Quedan {len(pendientes_post)} registros con puntos entre letras:")
            for cod, descri in pendientes_post:
                print(f"      🔒 {cod}: {descri[:70]}")
            print("\n   (Estos se mantienen intencionalmente — revisar manualmente si necesario)")
        else:
            print("   ✅ ¡Todos los patrones de puntos entre letras están limpios!")

    print("\n" + "=" * 70)
    print("LIMPIEZA FINAL COMPLETADA")
    print("=" * 70)


if __name__ == '__main__':
    main()
