CREATE SCHEMA IF NOT EXISTS temp_m;

-- Mover y renombrar items
ALTER TABLE public.temp_m_items SET SCHEMA temp_m;
ALTER TABLE temp_m.temp_m_items RENAME TO cost360_items;

-- Mover y renombrar materiales
ALTER TABLE public.temp_m_materials SET SCHEMA temp_m;
ALTER TABLE temp_m.temp_m_materials RENAME TO cost360_materials;

-- Mover y renombrar equipos
ALTER TABLE public.temp_m_equipment SET SCHEMA temp_m;
ALTER TABLE temp_m.temp_m_equipment RENAME TO cost360_equipment;

-- Mover y renombrar mano de obra
ALTER TABLE public.temp_m_labor SET SCHEMA temp_m;
ALTER TABLE temp_m.temp_m_labor RENAME TO cost360_labor;

-- Mover y renombrar APU materiales
ALTER TABLE public.temp_m_apu_materials SET SCHEMA temp_m;
ALTER TABLE temp_m.temp_m_apu_materials RENAME TO cost360_apu_materials;

-- Mover y renombrar APU equipos
ALTER TABLE public.temp_m_apu_equipment SET SCHEMA temp_m;
ALTER TABLE temp_m.temp_m_apu_equipment RENAME TO cost360_apu_equipment;

-- Mover y renombrar APU mano de obra
ALTER TABLE public.temp_m_apu_labor SET SCHEMA temp_m;
ALTER TABLE temp_m.temp_m_apu_labor RENAME TO cost360_apu_labor;

-- Registrar la base de datos para que aparezca en el UI
INSERT INTO public.cost360_databases (id, name, description, is_master, is_active)
VALUES ('temp_m', 'Base Provisional M (Bs)', 'Base de datos provisional migrada de Construcciones Menores. Precios sin conversion (en Bs).', FALSE, TRUE)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;
