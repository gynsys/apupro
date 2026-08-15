SELECT substring("CovPar" from '^[A-Z]+') as category, COUNT(*) 
FROM cost360_items 
WHERE "CovPar" LIKE '%.%' 
GROUP BY substring("CovPar" from '^[A-Z]+');
