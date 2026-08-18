SELECT 
    m."CodPar" as master_code, 
    m."Descri" as master_desc, 
    t."CodPar" as staging_code 
FROM public.cost360_items m 
LEFT JOIN temp_m.cost360_items t ON m."CodPar" = t."CodPar" 
WHERE m."CodPar" LIKE 'M%' OR m."Categoria" = 'M';
