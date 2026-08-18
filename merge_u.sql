-- =========================================================================
-- FUSION: PROVISIONAL URBANISMO (temp_u) -> BASE MAESTRA (master)
-- =========================================================================

-- 1. Insertar Insumos (Materiales, Equipos, Mano de Obra)
INSERT INTO public.cost360_materials ("CodMat", "Descri", "UniMat", "CosMat")
SELECT "CodMat", "Descri", "UniMat", "CosMat"
FROM temp_u.cost360_materials
ON CONFLICT ("CodMat") DO NOTHING;

INSERT INTO public.cost360_equipment ("CodEqu", "Descri", "CosDia")
SELECT "CodEqu", "Descri", "CosDia"
FROM temp_u.cost360_equipment
ON CONFLICT ("CodEqu") DO NOTHING;

INSERT INTO public.cost360_labor ("CodMan", "Descri", "Jornal", "Bono")
SELECT "CodMan", "Descri", "Jornal", "Bono"
FROM temp_u.cost360_labor
ON CONFLICT ("CodMan") DO NOTHING;

-- 2. Insertar Partidas (APUs)
-- Aseguramos asignar Categoria = 'URBANISMO' para que el filtro de la UI las atrape
INSERT INTO public.cost360_items ("CodPar", "Descri", "CovPar", "UniPar", "PreUni", "RenPar", "Categoria", "TipoActividad")
SELECT "CodPar", "Descri", "CodPar", "UniPar", "PreUni", "RenPar", 'URBANISMO', 'Urbanismo - Otros'
FROM temp_u.cost360_items
ON CONFLICT ("CodPar") DO NOTHING;

-- 3. Insertar Detalles (Rendimientos y Cantidades)
INSERT INTO public.cost360_apu_material ("CodPar", "CodIns", "CanIns", "Desper")
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
