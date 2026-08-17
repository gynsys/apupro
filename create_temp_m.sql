DROP TABLE IF EXISTS temp_m_apu_materials;
DROP TABLE IF EXISTS temp_m_apu_equipment;
DROP TABLE IF EXISTS temp_m_apu_labor;
DROP TABLE IF EXISTS temp_m_items;
DROP TABLE IF EXISTS temp_m_materials;
DROP TABLE IF EXISTS temp_m_equipment;
DROP TABLE IF EXISTS temp_m_labor;

CREATE TABLE temp_m_items AS SELECT * FROM cost360_items WHERE 1=0;
ALTER TABLE temp_m_items ADD PRIMARY KEY ("CodPar");

CREATE TABLE temp_m_materials AS SELECT * FROM cost360_materials WHERE 1=0;
ALTER TABLE temp_m_materials ADD PRIMARY KEY ("CodMat");

CREATE TABLE temp_m_equipment AS SELECT * FROM cost360_equipment WHERE 1=0;
ALTER TABLE temp_m_equipment ADD PRIMARY KEY ("CodEqu");

CREATE TABLE temp_m_labor AS SELECT * FROM cost360_labor WHERE 1=0;
ALTER TABLE temp_m_labor ADD PRIMARY KEY ("CodMan");

CREATE TABLE temp_m_apu_materials AS SELECT * FROM cost360_apu_materials WHERE 1=0;
CREATE TABLE temp_m_apu_equipment AS SELECT * FROM cost360_apu_equipment WHERE 1=0;
CREATE TABLE temp_m_apu_labor AS SELECT * FROM cost360_apu_labor WHERE 1=0;
