UPDATE public.cost360_databases 
SET 
    material_inflation = COALESCE(material_inflation, 0.0),
    labor_inflation = COALESCE(labor_inflation, 0.0),
    equipment_inflation = COALESCE(equipment_inflation, 0.0)
WHERE material_inflation IS NULL OR labor_inflation IS NULL OR equipment_inflation IS NULL;
