-- Analizar el formato de CovPar en las 494 partidas
SELECT 
    length("CovPar") as longitud_codigo,
    count(*) as cantidad,
    MIN("CovPar") as ejemplo_1,
    MAX("CovPar") as ejemplo_2
FROM public.cost360_items 
WHERE "CovPar" LIKE 'U%'
GROUP BY length("CovPar")
ORDER BY length("CovPar") DESC;

-- Partidas que no cumplen el formato estandar de 10 u 11 caracteres
SELECT "CodPar", "CovPar", "Descri"
FROM public.cost360_items 
WHERE "CovPar" LIKE 'U%' AND length("CovPar") NOT IN (10, 11)
LIMIT 10;
