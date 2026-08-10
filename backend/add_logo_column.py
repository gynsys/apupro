import sqlite3

conn = sqlite3.connect('app/arko360.db')
cursor = conn.cursor()

try:
    # Verificar si la columna ya existe
    cursor.execute("PRAGMA table_info(budgets)")
    columns = [col[1] for col in cursor.fetchall()]
    
    if 'company_logo' not in columns:
        cursor.execute('ALTER TABLE budgets ADD COLUMN company_logo TEXT')
        conn.commit()
        print('Columna company_logo agregada exitosamente')
    else:
        print('La columna company_logo ya existe')
except Exception as e:
    print(f'Error: {e}')
finally:
    conn.close()
