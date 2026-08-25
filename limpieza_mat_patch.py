"""
Patch de limpieza MAT - Correcciones adicionales identificadas.
Ejecutar dentro del contenedor backend:
  docker exec apupro_platform-apupro-backend-1 python /tmp/limpieza_mat_patch.py
"""
import re
import datetime
from sqlalchemy import create_engine, text

DB_URL = 'postgresql://apupro_user:apupro_password@apupro-db:5432/apupro_db'


def aplicar_patch(texto: str) -> str:
    """
    Aplica correcciones adicionales identificadas tras revisión del Excel.
    NO repite reglas ya aplicadas (limpieza_mat_final_v2.py).
    """
    if not texto:
        return texto

    resultado = texto.upper()

    # ── Fix 1: Coma entre letra entre comillas y dimensión ─────────────────
    # TIPO "A", D=3/4"  →  TIPO "A" D=3/4"
    # También "U", D=2" → "U" D=2"
    resultado = re.sub(r'"\s*,\s*(D=|E=|L=|N=)', r'" \1', resultado)
    # Coma suelta después de comilla doble seguida de espacio
    resultado = re.sub(r'",\s+', '" ', resultado)

    # ── Fix 2: Punto flotante después de sigla (HF. → HF) ─────────────────
    # ADAPTADOR PVC HF. ACUEDUCTO → ADAPTADOR PVC HF ACUEDUCTO
    # Solo cuando el punto va seguido de espacio o fin (no es decimal)
    resultado = re.sub(r'\b([A-Z]{2,})\.(?=\s|$)', r'\1', resultado)

    # ── Fix 3: Separador de miles (18.000 → 18000, 24.000 → 24000) ─────────
    # Regla: dígito(s).3dígitos sin más dígitos a la derecha → juntar
    resultado = re.sub(r'(\d{1,3})\.(\d{3})(?!\d)', r'\1\2', resultado)

    # ── Fix 4: ACONDCOMPUERTA[LETRA] → ACONDICIONADO COMPUERTA [LETRA] ─────
    # Causado por: ACOND.COMP.ACT → reglas anteriores unieron sin espacios
    resultado = re.sub(r'ACONDCOMPUERTA([A-Z])', r'ACONDICIONADO COMPUERTA \1', resultado)
    # ACOND standalone → ACONDICIONADO
    resultado = re.sub(r'\bACOND\b', 'ACONDICIONADO', resultado)
    # Si quedó COMPUERTA pegado a siguiente palabra
    resultado = re.sub(r'COMPUERTA([A-Z])', r'COMPUERTA \1', resultado)

    # ── Fix 5: Limpiar espacios múltiples y extremos ────────────────────────
    resultado = re.sub(r'\s+', ' ', resultado).strip()

    return resultado if resultado != texto.upper() else texto


def main() -> None:
    print("=" * 70)
    print("PATCH DE LIMPIEZA MAT — Correcciones adicionales")
    print(f"Fecha: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 70)

    engine = create_engine(DB_URL)

    with engine.connect() as conn:
        # Verificar backup
        backups = conn.execute(text(
            "SELECT tablename FROM pg_tables "
            "WHERE schemaname='public' AND tablename LIKE 'cost360_materials_backup%' "
            "ORDER BY tablename DESC LIMIT 1"
        )).fetchall()
        print(f"\n[0] Backup disponible: {backups[0][0] if backups else 'NINGUNO'}")

        # Cargar todos los MAT
        print("\n[1] Cargando registros MAT...")
        rows = conn.execute(text(
            "SELECT \"CodMat\", \"Descri\" FROM cost360_materials "
            "WHERE \"CodMat\" LIKE 'MAT%' ORDER BY \"CodMat\""
        )).fetchall()
        print(f"   Total MAT: {len(rows)}")

        # Detectar cambios
        print("\n[2] Detectando cambios con nuevas reglas...")
        cambios: list[dict] = []
        for cod, descri in rows:
            nueva = aplicar_patch(descri) if descri else descri
            if nueva and nueva != descri:
                cambios.append({'codigo': cod, 'antes': descri, 'despues': nueva})

        print(f"   Registros que cambian: {len(cambios)}")

        if cambios:
            print("\n   Detalle de cambios:")
            for c in cambios:
                print(f"   ✏  {c['codigo']}")
                print(f"      ANTES:  {c['antes'][:80]}")
                print(f"      AHORA:  {c['despues'][:80]}")

            print(f"\n[3] Aplicando {len(cambios)} cambios en BD...")
            aplicados = 0
            errores = 0
            for cambio in cambios:
                try:
                    conn.execute(text(
                        "UPDATE cost360_materials SET \"Descri\" = :nueva "
                        "WHERE \"CodMat\" = :cod"
                    ), {"nueva": cambio['despues'], "cod": cambio['codigo']})
                    aplicados += 1
                except Exception as e:
                    print(f"   ERROR en {cambio['codigo']}: {e}")
                    errores += 1
            conn.commit()
            print(f"   OK Aplicados: {aplicados}  |  Errores: {errores}")
        else:
            print("\n   Sin cambios detectados con estas reglas.")

    print("\n" + "=" * 70)
    print("PATCH COMPLETADO")
    print("=" * 70)


if __name__ == '__main__':
    main()
