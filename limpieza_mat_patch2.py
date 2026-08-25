"""
Patch 2 de limpieza MAT.
Nuevas reglas:
  - TIPO "U" / TIPO "A" etc. → TIPO U / TIPO A (quita comillas en letra sola)
  - Elimina el símbolo # (ej: #10, #12 calibres)
Ejecutar dentro del contenedor backend:
  docker exec apupro_platform-apupro-backend-1 python /tmp/limpieza_mat_patch2.py
"""
import re
import datetime
from sqlalchemy import create_engine, text

DB_URL = 'postgresql://apupro_user:apupro_password@apupro-db:5432/apupro_db'


def aplicar_patch2(texto: str) -> str:
    if not texto:
        return texto

    resultado = texto.upper()

    # Fix 1: TIPO "X" → TIPO X  (una sola letra entre comillas después de TIPO)
    resultado = re.sub(r'\bTIPO\s+"([A-Z])"\s*', r'TIPO \1 ', resultado)

    # Fix 2: Eliminar símbolo # (calibres, números de serie)
    resultado = re.sub(r'#', '', resultado)

    # Fix 3: Limpiar espacios múltiples generados
    resultado = re.sub(r'\s+', ' ', resultado).strip()

    return resultado if resultado != texto.upper() else texto


def main() -> None:
    print("=" * 65)
    print("PATCH 2 — TIPO X + eliminacion #")
    print(f"Fecha: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 65)

    engine = create_engine(DB_URL)

    with engine.connect() as conn:
        rows = conn.execute(text(
            "SELECT \"CodMat\", \"Descri\" FROM cost360_materials "
            "WHERE \"CodMat\" LIKE 'MAT%' ORDER BY \"CodMat\""
        )).fetchall()
        print(f"Total MAT cargados: {len(rows)}")

        cambios: list[dict] = []
        for cod, descri in rows:
            nueva = aplicar_patch2(descri) if descri else descri
            if nueva and nueva != descri:
                cambios.append({'codigo': cod, 'antes': descri, 'despues': nueva})

        print(f"Cambios detectados: {len(cambios)}")

        for c in cambios:
            print(f"  {c['codigo']}")
            print(f"    ANTES: {c['antes'][:80]}")
            print(f"    AHORA: {c['despues'][:80]}")

        if cambios:
            print(f"\nAplicando {len(cambios)} cambios...")
            for cambio in cambios:
                conn.execute(text(
                    "UPDATE cost360_materials SET \"Descri\" = :nueva "
                    "WHERE \"CodMat\" = :cod"
                ), {"nueva": cambio['despues'], "cod": cambio['codigo']})
            conn.commit()
            print("OK Commit realizado.")
        else:
            print("Sin cambios que aplicar.")

    print("\n" + "=" * 65)
    print("PATCH 2 COMPLETADO")
    print("=" * 65)


if __name__ == '__main__':
    main()
