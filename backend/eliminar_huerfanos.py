import sys
sys.path.append('.')
from sqlalchemy import create_engine, text
import urllib.parse

def run_deletion(db_url):
    engine = create_engine(db_url)
    with engine.connect() as conn:
        with conn.begin():
            backup_sql = text('CREATE TABLE IF NOT EXISTS cost360_materials_backup_huerfanos_20260828 AS SELECT m.* FROM cost360_materials m LEFT JOIN cost360_apu_materials am ON m."CodMat" = am."CodIns" WHERE am."CodIns" IS NULL;')
            conn.execute(backup_sql)
            delete_sql = text('DELETE FROM cost360_materials WHERE "CodMat" IN (SELECT "CodMat" FROM cost360_materials_backup_huerfanos_20260828);')
            result = conn.execute(delete_sql)
            print(f'Borrados: {result.rowcount} materiales huerfanos.')

if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == '--prod':
        from app.core.config import settings
        db_url = settings.DATABASE_URL
    else:
        db_url = 'postgresql://apupro_user:apupro_password@localhost:5432/apupro_db'
    print('Iniciando...')
    run_deletion(db_url)
