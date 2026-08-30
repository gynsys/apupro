from sqlalchemy import create_engine, text

engine = create_engine('postgresql://apupro_user:apupro_password@costbase.net:5440/apupro_db')

with engine.connect() as conn:
    result = conn.execute(
        text('SELECT "CodMat", "Descri" FROM cost360_materials WHERE "CodMat" = :codigo'),
        {"codigo": "ELE843"}
    ).fetchone()

    if result:
        print(f'{result[0]}: {result[1]}')
        print("\n[OK] Confirmado en produccion")
    else:
        print("[!] No encontrado")
