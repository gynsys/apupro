SET search_path TO temp_m;
SELECT 'Materials' as type, COUNT(*) FROM cost360_apu_materials WHERE "CodPar" = 'M111110000'
UNION ALL
SELECT 'Equipment', COUNT(*) FROM cost360_apu_equipment WHERE "CodPar" = 'M111110000'
UNION ALL
SELECT 'Labor', COUNT(*) FROM cost360_apu_labor WHERE "CodPar" = 'M111110000';
