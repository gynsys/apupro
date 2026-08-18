
import sys
sys.path.append('c:/Users/pablo/Documents/apupro_platform/backend')
from app.db.session import SessionLocal
from sqlalchemy import text

db = SessionLocal()
try:
    db.execute(text('SET search_path TO temp_m'))
    
    res = db.execute(text('''
        SELECT * FROM cost360_apu_labors
        JOIN cost360_labors ON cost360_apu_labors.labor_id = cost360_labors.id
        WHERE item_id = 'M.113.111.500'
    ''')).fetchall()
    
    for row in res:
        print(row)
        
    item = db.execute(text('''
        SELECT * FROM cost360_items WHERE id = 'M.113.111.500'
    ''')).fetchone()
    print('Item:', item)
except Exception as e:
    print(e)
finally:
    db.close()

