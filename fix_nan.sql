-- Limpiar fila 'nan' en cost360_labor de temp_u
-- Esta fila fantasma aparece cuando una partida no tiene mano de obra en el Excel
SET search_path TO temp_u;

-- Ver qué fila es exactamente
SELECT * FROM cost360_labor WHERE "Descri" = 'nan' OR "Descri" LIKE '%nan%';

-- Eliminar la referencia en apu_labor primero (integridad referencial)
DELETE FROM cost360_apu_labor WHERE "CodIns" IN (
    SELECT "CodMan" FROM cost360_labor WHERE "Descri" = 'nan' OR "CodMan" = 'nan'
);

-- Luego eliminar el registro fantasma de labor
DELETE FROM cost360_labor WHERE "Descri" = 'nan' OR "CodMan" = 'nan';
