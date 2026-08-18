-- Reinsertar referencias de mano de obra limpiando 'nan'
-- La fila nan tenia CodMan = 'DESCRIPCION DE LA PARTIDA:' y borró 979 referencias en apu_labor
-- Necesitamos repoblar apu_labor correctamente desde el Excel

-- Verificar cuantas partidas quedaron sin mano de obra (si tenían referencias a ese nan)
SET search_path TO temp_u;
SELECT count(*) as partidas_sin_mano_de_obra
FROM cost360_items i
WHERE NOT EXISTS (
    SELECT 1 FROM cost360_apu_labor al WHERE al."CodPar" = i."CodPar"
);
