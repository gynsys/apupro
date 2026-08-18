CREATE SCHEMA IF NOT EXISTS temp_u;
SET search_path TO temp_u;

CREATE TABLE IF NOT EXISTS cost360_items (LIKE public.cost360_items INCLUDING ALL);
CREATE TABLE IF NOT EXISTS cost360_materials (LIKE public.cost360_materials INCLUDING ALL);
CREATE TABLE IF NOT EXISTS cost360_equipment (LIKE public.cost360_equipment INCLUDING ALL);
CREATE TABLE IF NOT EXISTS cost360_labor (LIKE public.cost360_labor INCLUDING ALL);
CREATE TABLE IF NOT EXISTS cost360_apu_materials (LIKE public.cost360_apu_materials INCLUDING ALL);
CREATE TABLE IF NOT EXISTS cost360_apu_equipment (LIKE public.cost360_apu_equipment INCLUDING ALL);
CREATE TABLE IF NOT EXISTS cost360_apu_labor (LIKE public.cost360_apu_labor INCLUDING ALL);

INSERT INTO public.cost360_databases (name, "schema", description) VALUES ('Base Provisional U', 'temp_u', 'Urbanismo') ON CONFLICT DO NOTHING;
