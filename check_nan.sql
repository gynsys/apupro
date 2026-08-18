-- 1. Limpiar valores 'nan' en descripcion de mano de obra de temp_u
SET search_path TO temp_u;

-- Ver cuántas filas tienen 'nan'
SELECT 'cost360_labor' as tabla, count(*) as nan_count FROM cost360_labor WHERE "Descri" = 'nan' OR "Descri" LIKE '%nan%'
UNION ALL
SELECT 'cost360_materials', count(*) FROM cost360_materials WHERE "Descri" = 'nan' OR "Descri" LIKE '%nan%'
UNION ALL
SELECT 'cost360_equipment', count(*) FROM cost360_equipment WHERE "Descri" = 'nan' OR "Descri" LIKE '%nan%'
UNION ALL
SELECT 'cost360_items', count(*) FROM cost360_items WHERE "Descri" = 'nan' OR "Descri" LIKE '%nan%';
