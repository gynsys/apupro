INSERT INTO public.cost360_items 
SELECT * FROM temp_m.cost360_items 
ON CONFLICT ("CodPar") DO NOTHING;

INSERT INTO public.cost360_materials 
SELECT * FROM temp_m.cost360_materials 
ON CONFLICT ("CodMat") DO NOTHING;

INSERT INTO public.cost360_equipment 
SELECT * FROM temp_m.cost360_equipment 
ON CONFLICT ("CodEqu") DO NOTHING;

INSERT INTO public.cost360_labor 
SELECT * FROM temp_m.cost360_labor 
ON CONFLICT ("CodMan") DO NOTHING;

INSERT INTO public.cost360_apu_materials 
SELECT a.* FROM temp_m.cost360_apu_materials a
JOIN public.cost360_items i ON a."CodPar" = i."CodPar"
ON CONFLICT ("CodPar", "CodIns") DO NOTHING;

INSERT INTO public.cost360_apu_equipment 
SELECT a.* FROM temp_m.cost360_apu_equipment a
JOIN public.cost360_items i ON a."CodPar" = i."CodPar"
ON CONFLICT ("CodPar", "CodIns") DO NOTHING;

INSERT INTO public.cost360_apu_labor 
SELECT a.* FROM temp_m.cost360_apu_labor a
JOIN public.cost360_items i ON a."CodPar" = i."CodPar"
ON CONFLICT ("CodPar", "CodIns") DO NOTHING;
