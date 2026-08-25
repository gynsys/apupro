from sqlalchemy import create_engine, text

engine = create_engine('postgresql://apupro_user:apupro_password@costbase.net:5440/apupro_db')
conn = engine.connect()

try:
    # Verificar si la tabla cost360_databases existe
    result = conn.execute(text('''
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = 'cost360_databases'
        )
    ''')).scalar()
    
    print(f"Tabla cost360_databases existe: {result}")
    
    if result:
        # Verificar contenido
        count = conn.execute(text('SELECT COUNT(*) FROM cost360_databases')).scalar()
        print(f"Total bases de datos: {count}")
        
        # Mostrar bases de datos
        databases = conn.execute(text('SELECT * FROM cost360_databases LIMIT 5')).fetchall()
        print("Bases de datos:", databases)
    else:
        print("La tabla no existe, creándola...")
        conn.execute(text('''
            CREATE TABLE IF NOT EXISTS cost360_databases (
                id VARCHAR(50) PRIMARY KEY,
                name VARCHAR(200) NOT NULL,
                description TEXT,
                is_master BOOLEAN DEFAULT FALSE,
                is_active BOOLEAN DEFAULT TRUE,
                material_inflation FLOAT DEFAULT 0.0,
                labor_inflation FLOAT DEFAULT 0.0,
                equipment_inflation FLOAT DEFAULT 0.0,
                source_database_id VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_by VARCHAR(100)
            )
        '''))
        conn.commit()
        print("Tabla creada exitosamente")
        
        # Insertar master database
        conn.execute(text('''
            INSERT INTO cost360_databases (id, name, description, is_master, is_active)
            VALUES ('master', 'Base de Datos Maestra', 'Base de datos principal del sistema', TRUE, TRUE)
            ON CONFLICT (id) DO NOTHING
        '''))
        conn.commit()
        print("Base de datos master insertada")
        
except Exception as e:
    print(f"Error: {e}")
    conn.rollback()
finally:
    conn.close()
