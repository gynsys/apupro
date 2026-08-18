-- Solo la parte que falló
INSERT INTO public.cost360_apu_materials ("CodPar", "CodIns", "CanIns", "Desper")
SELECT "CodPar", "CodIns", "CanIns", "Desper"
FROM temp_u.cost360_apu_material
ON CONFLICT ("CodPar", "CodIns") DO NOTHING;

INSERT INTO public.cost360_apu_equipment ("CodPar", "CodIns", "CanIns", "Deprec")
SELECT "CodPar", "CodIns", "CanIns", "Deprec"
FROM temp_u.cost360_apu_equipment
ON CONFLICT ("CodPar", "CodIns") DO NOTHING;

INSERT INTO public.cost360_apu_labor ("CodPar", "CodIns", "CanIns")
SELECT "CodPar", "CodIns", "CanIns"
FROM temp_u.cost360_apu_labor
ON CONFLICT ("CodPar", "CodIns") DO NOTHING;
