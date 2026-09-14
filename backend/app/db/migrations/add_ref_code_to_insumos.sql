-- Migración: Añadir ref_code a materiales, equipos y mano de obra
ALTER TABLE cost360_materials ADD COLUMN IF NOT EXISTS ref_code VARCHAR(30);
ALTER TABLE cost360_equipment ADD COLUMN IF NOT EXISTS ref_code VARCHAR(30);
ALTER TABLE cost360_labor ADD COLUMN IF NOT EXISTS ref_code VARCHAR(30);

CREATE INDEX IF NOT EXISTS idx_materials_ref_code ON cost360_materials(ref_code);
CREATE INDEX IF NOT EXISTS idx_equipment_ref_code ON cost360_equipment(ref_code);
CREATE INDEX IF NOT EXISTS idx_labor_ref_code ON cost360_labor(ref_code);
