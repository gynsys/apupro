
import psycopg2

try:
    conn = psycopg2.connect('dbname=apupro_db user=apupro password=apupro host=localhost')
    cur = conn.cursor()
    cur.execute('SET search_path TO temp_m')
    
    cur.execute('''
        SELECT l.\"Descri\", l.\"Jornal\", al.\"CanIns\" 
        FROM cost360_apu_labors al
        JOIN cost360_labors l ON al.labor_id = l.id
        WHERE al.item_id = 'M.113.111.500'
    ''')
    for row in cur.fetchall():
        print(row)
        
    cur.execute('SELECT \"RenPar\" FROM cost360_items WHERE id = \'M.113.111.500\'')
    print('RenPar:', cur.fetchone())
except Exception as e:
    print('Error:', e)

