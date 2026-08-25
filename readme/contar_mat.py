from sqlalchemy import create_engine, text

engine = create_engine('postgresql://apupro_user:apupro_password@costbase.net:5440/apupro_db')
conn = engine.connect()
count = conn.execute(text('SELECT COUNT(*) FROM cost360_materials WHERE "CodMat" LIKE \'MAT%\'')).scalar()
print(f'Total MAT en base de datos: {count}')
conn.close()