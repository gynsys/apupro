BEGIN;

UPDATE cost360_items 
SET "CovPar" = REPLACE("CovPar", '.', ''),
    "CodPar" = REPLACE("CodPar", '.', '')
WHERE "CovPar" LIKE '%.%' OR "CodPar" LIKE '%.%';

COMMIT;
