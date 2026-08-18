-- Listar las partidas de Urbanismo cuyos códigos NO empiezan por U
SELECT "CodPar", "Descri"
FROM public.cost360_items
WHERE "Categoria" = 'URBANISMO' AND "CodPar" NOT LIKE 'U%'
ORDER BY "CodPar";
