SET search_path TO temp_u;

UPDATE cost360_materials SET "CosMat" = "CosMat" / 65.0;
UPDATE cost360_equipment SET "CosDia" = "CosDia" / 65.0;
UPDATE cost360_items SET "PreUni" = "PreUni" / 65.0;
