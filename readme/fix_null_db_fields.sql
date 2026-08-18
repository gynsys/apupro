-- Script reutilizable: Corregir campos NULL en cost360_databases
-- Bug: NULL_DB_FIELDS
-- Ver readme/BUG_NULL_DB_FIELDS.md para contexto completo

UPDATE public.cost360_databases 
SET 
    material_inflation = COALESCE(material_inflation, 0.0),
    labor_inflation = COALESCE(labor_inflation, 0.0),
    equipment_inflation = COALESCE(equipment_inflation, 0.0),
    is_master = COALESCE(is_master, FALSE),
    is_active = COALESCE(is_active, TRUE)
WHERE 
    material_inflation IS NULL 
    OR labor_inflation IS NULL 
    OR equipment_inflation IS NULL
    OR is_master IS NULL
    OR is_active IS NULL;

-- Verificar resultado
SELECT id, name, is_master, is_active, material_inflation, labor_inflation, equipment_inflation 
FROM public.cost360_databases 
ORDER BY created_at;
