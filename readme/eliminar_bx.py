"""
Eliminar letras BX de las descripciones de materiales
"""
from sqlalchemy import create_engine, text

DB_URL = "postgresql://apupro_user:apupro_password@costbase.net:5440/apupro_db"

engine = create_engine(DB_URL)

# Materiales a actualizar (los 9 que modificamos)
codigos = ["ELE843", "ELE844", "ELE901", "ELE902", "ELE903", "ELE904", "ELE905", "ELE906", "ELE908"]

print("Eliminando BX de descripciones...")

with engine.connect() as conn:
    for codigo in codigos:
        # Obtener nombre actual
        result = conn.execute(
            text('SELECT "Descri" FROM cost360_materials WHERE "CodMat" = :codigo'),
            {"codigo": codigo}
        ).fetchone()

        if result:
            nombre_actual = result[0]
            # Eliminar BX (insensible a mayúsculas/minúsculas)
            nombre_sin_bx = nombre_actual.replace("BX", "").replace("bx", "").replace(" B ", " ").replace("  ", " ").strip()

            print(f"\n{codigo}:")
            print(f"  Actual: {nombre_actual}")
            print(f"  Nuevo:  {nombre_sin_bx}")

            # Actualizar
            conn.execute(
                text('UPDATE cost360_materials SET "Descri" = :nuevo WHERE "CodMat" = :codigo'),
                {"nuevo": nombre_sin_bx, "codigo": codigo}
            )
            print(f"  [OK] Actualizado")
        else:
            print(f"\n[!] {codigo} no encontrado en base de datos")

    conn.commit()

print("\n[OK] Todas las actualizaciones completadas")
