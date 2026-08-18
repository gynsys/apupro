-- Revisar las categorías en la base provisional temp_u
SELECT "Categoria", count(*) 
FROM temp_u.cost360_items
GROUP BY "Categoria";

-- Cruce de códigos tomando en cuenta que la interfaz usa Categoria = 'URBANISMO'
SELECT count(*) as total_provisional_urbanismo
FROM temp_u.cost360_items;

-- Partidas que EXISTEN EN AMBAS (duplicados exactos por código)
SELECT 
    m."CodPar" as codigo,
    m."Descri" as desc_maestra,
    t."Descri" as desc_provisional
FROM public.cost360_items m
JOIN temp_u.cost360_items t ON m."CodPar" = t."CodPar";

-- Partidas de la maestra que la interfaz cuenta como URBANISMO pero cuyo código NO empieza con U
SELECT "CodPar", "Descri"
FROM public.cost360_items
WHERE "Categoria" = 'URBANISMO' AND "CodPar" NOT LIKE 'U%'
LIMIT 10;
