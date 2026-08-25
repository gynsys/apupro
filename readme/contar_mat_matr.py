from sqlalchemy import create_engine, text

engine = create_engine('postgresql://apupro_user:apupro_password@costbase.net:5440/apupro_db')
conn = engine.connect()
mat = conn.execute(text('SELECT COUNT(*) FROM cost360_materials WHERE "CodMat" LIKE \'MAT%\'')).scalar()
matr = conn.execute(text('SELECT COUNT(*) FROM cost360_materials WHERE "CodMat" LIKE \'MATR%\'')).scalar()
print(f'MAT: {mat}, MATR: {matr}')
conn.close()