SET search_path TO temp_m;
UPDATE cost360_items SET "PreUni" = "PreUni" / 65.0;
UPDATE cost360_materials SET "CosMat" = "CosMat" / 65.0;
UPDATE cost360_equipment SET "CosDia" = "CosDia" / 65.0;
UPDATE cost360_labor SET "Jornal" = "Jornal" / 65.0, "Bono" = "Bono" / 65.0;
