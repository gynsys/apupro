-- Partidas que la interfaz cuenta como "Urbanismo" (Categoria = 'URBANISMO' o similar)
SELECT count(*) as total_urbanismo
FROM public.cost360_items
WHERE "Categoria" = 'URBANISMO';

-- Ver todas las categorías que empiezan con U o contienen Urbanismo
SELECT "Categoria", count(*) 
FROM public.cost360_items
WHERE "Categoria" ILIKE '%urban%' OR "Categoria" ILIKE '%vialidad%'
GROUP BY "Categoria"
ORDER BY count(*) DESC;

-- Total de los U* por CodPar vs los que tienen categoria URBANISMO/VIALIDAD
SELECT 
    'CodPar LIKE U%' as metodo, count(*) as total FROM public.cost360_items WHERE "CodPar" LIKE 'U%'
UNION ALL
SELECT 'Categoria URBANISMO', count(*) FROM public.cost360_items WHERE "Categoria" = 'URBANISMO'
UNION ALL
SELECT 'Categoria VIALIDAD', count(*) FROM public.cost360_items WHERE "Categoria" = 'VIALIDAD'
UNION ALL
SELECT 'URBANISMO + VIALIDAD', count(*) FROM public.cost360_items WHERE "Categoria" IN ('URBANISMO','VIALIDAD');
