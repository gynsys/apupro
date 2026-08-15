-- normalize_covenin_codes.sql
-- Este script normaliza los códigos COVENIN en la base de datos maestra (cost360_items)
-- eliminando los puntos intermedios (ej. M.122 -> M122) para que coincidan perfectamente
-- con el árbol JSON del Frontend.

BEGIN;

-- Actualizamos los códigos que empiezan con M.
UPDATE cost360_items 
SET "CovPar" = REPLACE("CovPar", '.', ''),
    "CodPar" = REPLACE("CodPar", '.', '')
WHERE "CovPar" LIKE 'M.%' OR "CodPar" LIKE 'M.%';

-- NOTA: Si existen otras categorías que sufran del mismo problema (ej. E.1, P.1), 
-- se pueden agregar aquí de manera similar:
-- UPDATE cost360_items 
-- SET "CovPar" = REPLACE("CovPar", '.', ''),
--     "CodPar" = REPLACE("CodPar", '.', '')
-- WHERE "CovPar" LIKE 'E.%' OR "CodPar" LIKE 'E.%';

COMMIT;
