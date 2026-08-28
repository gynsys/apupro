from sqlalchemy import create_engine, text

engine = create_engine('postgresql://apupro_user:apupro_password@costbase.net:5440/apupro_db')

with engine.connect() as conn:
    # Crear tabla scraping_config
    conn.execute(text('''
        CREATE TABLE IF NOT EXISTS scraping_config (
            id SERIAL PRIMARY KEY,
            max_concurrency INT DEFAULT 25,
            headless BOOLEAN DEFAULT true,
            bypass_cloudflare BOOLEAN DEFAULT true,
            request_delay_ms INT DEFAULT 20000,
            active_portals VARCHAR[] DEFAULT ARRAY['mercadolibre', 'epa'],
            batch_size INT DEFAULT 10,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    '''))
    
    # Insertar configuración por defecto si no existe
    conn.execute(text('''
        INSERT INTO scraping_config (max_concurrency, headless, bypass_cloudflare, request_delay_ms, active_portals, batch_size)
        SELECT 25, true, true, 20000, ARRAY['mercadolibre', 'epa'], 10
        WHERE NOT EXISTS (SELECT 1 FROM scraping_config)
    '''))
    
    conn.commit()
    print("Tabla scraping_config creada exitosamente con configuración por defecto")

conn.close()