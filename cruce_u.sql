-- Cruce de codigos: Partidas U en Base Maestra vs Base Provisional
-- Objetivo: detectar duplicados para evitar conflictos en la fusión final

-- 1. Conteo total
SELECT 'master' as origen, count(*) FROM public.cost360_items WHERE "CodPar" LIKE 'U%'
UNION ALL
SELECT 'temp_u', count(*) FROM temp_u.cost360_items WHERE "CodPar" LIKE 'U%';

-- 2. Partidas que EXISTEN EN AMBAS (duplicados exactos por código)
SELECT 
    m."CodPar" as codigo,
    m."Descri" as desc_maestra,
    t."Descri" as desc_provisional
FROM public.cost360_items m
JOIN temp_u.cost360_items t ON m."CodPar" = t."CodPar"
WHERE m."CodPar" LIKE 'U%'
ORDER BY m."CodPar";

-- 3. Solo en provisional (las nuevas que se agregarían a la maestra)
SELECT count(*) as solo_en_provisional
FROM temp_u.cost360_items t
WHERE t."CodPar" LIKE 'U%'
AND NOT EXISTS (SELECT 1 FROM public.cost360_items m WHERE m."CodPar" = t."CodPar");
