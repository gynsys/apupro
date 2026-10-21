from app.db.session import SessionLocal
from sqlalchemy import text

db = SessionLocal()
# get all table names
tables = db.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'")).fetchall()
print(f"Total tables: {len(tables)}")
found = False
for (tname,) in tables:
    try:
        # search for 224.67 in table
        cols = db.execute(text(f"SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '{tname}'")).fetchall()
        for col, dtype in cols:
            if 'char' in dtype or 'text' in dtype:
                q = f"SELECT {col} FROM {tname} WHERE {col} LIKE '%224.67%' OR {col} LIKE '%224,67%'"
                res = db.execute(text(q)).fetchall()
                if res:
                    print(f"FOUND text in {tname}.{col}: {res[:3]}")
                    found = True
            elif 'numeric' in dtype or 'double' in dtype or 'real' in dtype:
                q = f"SELECT {col} FROM {tname} WHERE ABS({col} - 224.67) < 0.01"
                res = db.execute(text(q)).fetchall()
                if res:
                    print(f"FOUND num in {tname}.{col}: {res[:3]}")
                    found = True
    except Exception as e:
        pass
if not found:
    print("224.67 was NOT found in any column of any table in PostgreSQL.")
