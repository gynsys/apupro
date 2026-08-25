"""
Muestra todos los registros MAT con patrones de puntos entre letras
para validar cuáles deben limpiarse vs cuáles son abreviaturas legítimas.
"""
import re
from sqlalchemy import create_engine, text

DB_URL = 'postgresql://apupro_user:apupro_password@apupro-db:5432/apupro_db'


def main() -> None:
    engine = create_engine(DB_URL)

    with engine.connect() as conn:
        rows = conn.execute(text(
            "SELECT \"CodMat\", \"Descri\" FROM cost360_materials "
            "WHERE \"CodMat\" LIKE 'MAT%' ORDER BY \"CodMat\""
        )).fetchall()

    print(f"Total MAT: {len(rows)}")
    print("\n--- Registros con patrón LETRA.LETRA ---")
    print(f"{'Código':<12} {'Descripción'}")
    print("-" * 80)

    patron = re.compile(r'[A-Z]\.[A-Z]')
    count = 0
    for cod, descri in rows:
        if descri and patron.search(descri.upper()):
            count += 1
            # Marcar el patrón encontrado
            matches = patron.findall(descri.upper())
            unique_matches = list(set(matches))
            print(f"{cod:<12} {descri[:75]}")
            print(f"{'':12} → Patrones: {unique_matches}")

    print(f"\nTotal con patrón: {count}")


if __name__ == '__main__':
    main()
