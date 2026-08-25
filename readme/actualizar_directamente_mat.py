import requests
import json

# Datos que el usuario intentó actualizar
updates = [
    {"codigo": "MAT1402", "precio": 145},
    {"codigo": "MAT1408", "precio": 220},
    {"codigo": "MAT1409", "precio": 195},
    {"codigo": "MAT1417", "precio": 130}
]

# Intentar con el endpoint local primero
try:
    # Primero verifico si puedo conectar directamente a la base de datos
    from sqlalchemy import create_engine, text
    
    engine = create_engine('postgresql://apupro_user:apupro_password@costbase.net:5440/apupro_db')
    conn = engine.connect()
    
    # Verificar si los materiales existen
    for update in updates:
        codigo = update['codigo']
        result = conn.execute(text(f'''
            SELECT "CodMat", "CosMat" FROM cost360_materials 
            WHERE "CodMat" = '{codigo}'
        ''')).fetchone()
        
        if result:
            print(f"{codigo}: Precio actual = ${result[1]}")
        else:
            print(f"{codigo}: NO ENCONTRADO")
    
    conn.close()
    
    # Actualizar directamente
    print("\nActualizando precios directamente...")
    conn = engine.connect()
    
    for update in updates:
        codigo = update['codigo']
        precio = update['precio']
        
        result = conn.execute(text(f'''
            UPDATE cost360_materials 
            SET "CosMat" = {precio}
            WHERE "CodMat" = '{codigo}'
        '''))
        
        print(f"{codigo}: {result.rowcount} filas actualizadas")
    
    conn.commit()
    conn.close()
    print("Actualización completada")
    
except Exception as e:
    print(f"Error: {e}")
