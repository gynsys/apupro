import sys
sys.path.append('.')
from sqlalchemy import create_engine, text

def run_deletion(db_url):
    engine = create_engine(db_url)
    with engine.connect() as conn:
        with conn.begin():
            backup_sql = text('CREATE TABLE IF NOT EXISTS cost360_equipment_backup_huerfanos_20260828 AS SELECT e.* FROM cost360_equipment e LEFT JOIN cost360_apu_equipment ae ON e."CodEqu" = ae."CodIns" WHERE ae."CodIns" IS NULL;')
            conn.execute(backup_sql)
            delete_sql = text('DELETE FROM cost360_equipment WHERE "CodEqu" IN (SELECT "CodEqu" FROM cost360_equipment_backup_huerfanos_20260828);')
            result = conn.execute(delete_sql)
            print(f'Borrados: {result.rowcount} equipos huerfanos.')

if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == '--prod':
        from app.core.config import settings
        db_url = settings.DATABASE_URL
    else:
        db_url = 'postgresql://apupro_user:apupro_password@localhost:5432/apupro_db'
    print('Iniciando limpieza de equipos...')
    run_deletion(db_url)
