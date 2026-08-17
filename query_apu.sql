SET search_path TO temp_m;
SELECT item_code, unit, unit_price FROM cost360_items WHERE item_code='M111110000';
SELECT sum(quantity * unit_cost) as mat_total FROM cost360_apu_materials WHERE apu_id='M111110000';
SELECT sum(quantity * unit_cost) as eq_total FROM cost360_apu_equipment WHERE apu_id='M111110000';
SELECT sum(quantity * unit_cost) as lab_total FROM cost360_apu_labor WHERE apu_id='M111110000';
