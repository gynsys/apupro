COPY (
    SELECT "CodPar", "Descri"
    FROM public.cost360_items
    WHERE "Categoria" = 'URBANISMO' AND "CodPar" NOT LIKE 'U%'
    ORDER BY "CodPar"
) TO '/tmp/partidas_urbanismo_no_u.csv' WITH CSV HEADER;
