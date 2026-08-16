SELECT COUNT(*) FROM cost360_items WHERE "CovPar" LIKE 'H%';

SELECT substring("CovPar" from 1 for 3) as prefix, COUNT(*) 
FROM cost360_items 
WHERE "CovPar" LIKE 'H%' 
GROUP BY prefix
ORDER BY prefix;
