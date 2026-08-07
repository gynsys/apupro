-- Migración: Crear tabla cost360_databases
-- Fecha: Agosto 2026
-- Descripción: Tabla para gestionar múltiples bases de datos de Cost360 con índices de inflación

CREATE TABLE IF NOT EXISTS cost360_databases (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_master BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    material_inflation FLOAT DEFAULT 0.0,
    labor_inflation FLOAT DEFAULT 0.0,
    equipment_inflation FLOAT DEFAULT 0.0,
    source_database_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255)
);

-- Insertar la base de datos maestra por defecto
INSERT INTO cost360_databases (id, name, description, is_master, is_active, material_inflation, labor_inflation, equipment_inflation)
VALUES (
    'master',
    'Base Maestra',
    'Base de datos oficial de Cost360 con precios actualizados',
    TRUE,
    TRUE,
    0.0,
    0.0,
    0.0
) ON CONFLICT (id) DO NOTHING;

-- Crear índice para búsquedas por estado activo
CREATE INDEX IF NOT EXISTS idx_cost360_databases_is_active ON cost360_databases(is_active);

-- Crear índice para búsquedas por base maestra
CREATE INDEX IF NOT EXISTS idx_cost360_databases_is_master ON cost360_databases(is_master);
