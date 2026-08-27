from sqlalchemy import create_engine, text

engine = create_engine('postgresql://apupro_user:apupro_password@costbase.net:5440/apupro_db')

with engine.connect() as conn:
    # Crear tabla historial_precios
    conn.execute(text('''
        CREATE TABLE IF NOT EXISTS historial_precios (
            id SERIAL PRIMARY KEY,
            material_id VARCHAR(50) NOT NULL,
            fecha DATE NOT NULL,
            precio DECIMAL(10,2) NOT NULL,
            fuente VARCHAR(50) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    '''))
    
    conn.commit()
    print("Tabla historial_precios creada exitosamente")

conn.close()
