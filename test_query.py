from app.db.base import SessionLocal
from sqlalchemy import text

def check_equ():
    db = SessionLocal()
    
    # Check table structure for equipment
    res = db.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'cost360_equipment'")).fetchall()
    print("Columnas de cost360_equipment:", [r[0] for r in res])
    
    db.close()

if __name__ == '__main__':
    check_equ()
