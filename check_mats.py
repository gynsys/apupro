from sqlalchemy import create_engine, text

engine = create_engine('postgresql://apupro_user:apupro_password@localhost:5440/apupro_db')
with engine.connect() as conn:
    result = conn.execute(text('SELECT "CodMat", "Descri" FROM cost360_materials LIMIT 5'))
    for row in result:
        print(row)
