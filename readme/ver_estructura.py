from sqlalchemy import create_engine, text

engine = create_engine('postgresql://apupro_user:apupro_password@costbase.net:5440/apupro_db')

with engine.connect() as conn:
    result = conn.execute(text("""
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'cost360_apu_materials'
        ORDER BY ordinal_position
    """)).fetchall()
    for row in result:
        print(f"{row[0]}: {row[1]}")
