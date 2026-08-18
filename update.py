
import psycopg2

try:
    conn = psycopg2.connect('dbname=apupro_db user=apupro_user password=apupro_password host=localhost port=5440')
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute('SET search_path TO temp_m')
    
    cur.execute('UPDATE temp_m_items SET \"PreUni\" = \"PreUni\" / 65.0')
    cur.execute('UPDATE temp_m_materials SET \"PreUni\" = \"PreUni\" / 65.0')
    cur.execute('UPDATE temp_m_equipment SET \"PreUni\" = \"PreUni\" / 65.0')
    
    print('Conversion to USD completed.')
    
except Exception as e:
    print('Error:', e)

