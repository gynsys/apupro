from sqlalchemy import create_engine, text
DB = 'postgresql://apupro_user:apupro_password@apupro-db:5432/apupro_db'
e = create_engine(DB)
with e.connect() as c:
    r1 = c.execute(text("SELECT COUNT(*) FROM cost360_apu_materials WHERE \"CodIns\" LIKE 'MAT%'")).scalar()
    r2 = c.execute(text("SELECT COUNT(DISTINCT \"CodPar\") FROM cost360_apu_materials WHERE \"CodIns\" LIKE 'MAT%'")).scalar()
    r3 = c.execute(text("SELECT COUNT(DISTINCT \"CodIns\") FROM cost360_apu_materials WHERE \"CodIns\" LIKE 'MAT%'")).scalar()
    print(f"Referencias MAT en APUs: {r1}")
    print(f"Partidas (CodPar) afectadas: {r2}")
    print(f"Materiales MAT distintos usados en APUs: {r3}")
    sample = c.execute(text("SELECT \"CodIns\", COUNT(*) as usos FROM cost360_apu_materials WHERE \"CodIns\" LIKE 'MAT%' GROUP BY \"CodIns\" ORDER BY usos DESC LIMIT 10")).fetchall()
    print("\nTop 10 MAT más usados en APUs:")
    for cod, usos in sample:
        print(f"  {cod}: {usos} APUs")
