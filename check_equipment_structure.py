import psycopg2
import os

# Conexión a la base de datos local (puedes cambiar esto para producción)
DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://apupro_user:apupro_password@localhost:5440/apupro_db')

def check_equipment_structure():
    conn = psycopg2.connect(DATABASE_URL)
    cursor = conn.cursor()
    
    # Consultar estructura de la tabla de equipos
    cursor.execute("""
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'cost360_equipments' 
        ORDER BY ordinal_position;
    """)
    
    columns = cursor.fetchall()
    print("=== ESTRUCTURA DE TABLA cost360_equipments ===")
    for col in columns:
        print(f"{col[0]}: {col[1]}")
    
    # Consultar un registro de ejemplo
    cursor.execute("SELECT * FROM cost360_equipments LIMIT 1")
    sample = cursor.fetchone()
    column_names = [desc[0] for desc in cursor.description]
    
    print("\n=== EJEMPLO DE REGISTRO ===")
    for i, col_name in enumerate(column_names):
        print(f"{col_name}: {sample[i]}")
    
    cursor.close()
    conn.close()

if __name__ == "__main__":
    check_equipment_structure()
