from sqlalchemy import create_engine, text

engine = create_engine('postgresql://apupro_user:apupro_password@costbase.net:5440/apupro_db')

with engine.connect() as conn:
    result = conn.execute(text("""
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'cost360_items'
        ORDER BY ordinal_position
    """)).fetchall()
    print("=== cost360_items ===")
    for row in result:
        print(f"{row[0]}: {row[1]}")

    result = conn.execute(text("""
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'budget_apu_materials'
        ORDER BY ordinal_position
    """)).fetchall()
    print("\n=== budget_apu_materials ===")
    for row in result:
        print(f"{row[0]}: {row[1]}")
