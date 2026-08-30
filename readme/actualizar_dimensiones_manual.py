"""
Actualizar dimensiones basadas en patrones detectados en partidas
"""
from sqlalchemy import create_engine, text

DB_URL = "postgresql://apupro_user:apupro_password@costbase.net:5440/apupro_db"

engine = create_engine(DB_URL)

# Mapeo basado en análisis de partidas
actualizaciones = {
    "ELE843": "TUBO DE ELECTRICIDAD GALVANIZADO FLEXIBLE BX 3/4 PLG (19 MM)",
    "ELE844": "TUBO DE ELECTRICIDAD GALVANIZADO FLEXIBLE BX 1 PLG (25 MM)",
    "ELE901": "TUBO ELECTRICIDAD GALVANIZADO FLEXIBLE BX 2 PLG (51 MM)",
    "ELE902": "TUBO ELECTRICIDAD GALVANIZADO FLEXIBLE BX 2-1/2 PLG (64 MM)",
    "ELE903": "TUBO ELECTRICIDAD GALVANIZADO FLEXIBLE BX 3 PLG (76 MM)",
    "ELE904": "TUBO ELECTRICIDAD GALVANIZADO FLEXIBLE BX 4 PLG (102 MM)",
    "ELE905": "TUBO PVC ELECTRICIDAD CORRUGADO FLEXIBLE 3/4 PLG (19 MM)",
    "ELE906": "TUBO PVC ELECTRICIDAD CORRUGADO FLEXIBLE 1 PLG (25 MM)",
    "ELE908": "TUBO PVC ELECTRICIDAD CORRUGADO FLEXIBLE 2 PLG (51 MM)",
}

print("Actualizando materiales...")

with engine.connect() as conn:
    for codigo, nuevo_nombre in actualizaciones.items():
        # Verificar nombre actual
        result = conn.execute(
            text('SELECT "Descri" FROM cost360_materials WHERE "CodMat" = :codigo'),
            {"codigo": codigo}
        ).fetchone()

        if result:
            nombre_actual = result[0]
            print(f"\n{codigo}:")
            print(f"  Actual: {nombre_actual}")
            print(f"  Nuevo:  {nuevo_nombre}")

            # Actualizar
            conn.execute(
                text('UPDATE cost360_materials SET "Descri" = :nuevo WHERE "CodMat" = :codigo'),
                {"nuevo": nuevo_nombre, "codigo": codigo}
            )
            print(f"  [OK] Actualizado")
        else:
            print(f"\n[!] {codigo} no encontrado en base de datos")

    conn.commit()

print("\n[OK] Todas las actualizaciones completadas")
