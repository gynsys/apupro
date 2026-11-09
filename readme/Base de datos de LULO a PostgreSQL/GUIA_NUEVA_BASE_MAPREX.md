# Guía para extraer y publicar una nueva base Maprex/Lulo

> Estado: procedimiento operativo basado en los scripts existentes en `scratch/`.
> La documentación histórica está incompleta: menciona `run_import.py` e
> `import_cost360.py`, pero esos archivos no están en el repositorio actual.

## 1. Qué existe hoy

| Elemento | Ubicación | Estado |
|---|---|---|
| Documentación general | `readme/Base de datos de LULO a PostgreSQL/README.md` | Describe la conversión, no el procedimiento repetible |
| Bitácora ETL | `readme/Base de datos de LULO a PostgreSQL/BITACORA_COST360.md` | Menciona 4 CSV y `run_import.py`; el script no existe |
| Exportación Access | `scratch/export_maprex_all.ps1` | Funciona, pero tiene ruta fija a Agosto 2026 |
| Importación local | `scratch/import_maprex_pg.py` | Funciona, pero tiene base fija `maprex_local` |
| Base Agosto en producción | esquema `base_agosto` | 12.652 partidas, 9.946 materiales, 1.822 equipos, 581 mano de obra |

La base `base_agosto` coincide con los conteos nativos de Maprex, por lo que es
una importación directa del Access de Agosto, no una copia de la Base Maestra.
Su campo `source_database_id = master` es solo metadato y no debe interpretarse
como que sus datos provienen de la Base Maestra.

## 2. Antes de empezar

1. Confirmar la fuente:

```text
Archivo .mdb o .accdb
Mes/corte
Moneda
Fecha de extracción
Responsable
```

2. Hacer respaldo de producción:

```bash
docker exec apupro_platform-apupro-db-1 \
  pg_dump -U apupro_user -d apupro_db -Fc \
  -f /tmp/apupro_db_antes_<corte>.dump
```

3. No cargar la nueva base sobre `public` ni sobre `master`.
   Crear un esquema nuevo, por ejemplo `base_octubre`.

## 3. Exportar el Access a CSV

Copiar el nuevo `.mdb` a una carpeta de trabajo, por ejemplo:

```text
scratch/maprex_octubre/base exportada.mdb
```

Editar `scratch/export_maprex_all.ps1`:

```powershell
$dbPath = 'C:\...\scratch\maprex_octubre\base exportada.mdb'
$outDir = 'C:\...\scratch\maprex_octubre\pg'
```

Ejecutar en Windows con el driver DAO disponible:

```powershell
powershell -ExecutionPolicy Bypass -File scratch\export_maprex_all.ps1
```

El script genera:

```text
scratch/maprex_octubre/pg/csv/*.csv
scratch/maprex_octubre/pg/schema.tsv
```

Verificar que existan las 7 tablas necesarias:

```text
ObraPart
ObraMate
ObraEqui
ObraMano
ObraPainMate
ObraPainEqui
ObraPainMano
```

## 4. Importar a un PostgreSQL de staging

No importar directo a producción sin staging.

Opción A: crear una base local:

```sql
CREATE DATABASE maprex_octubre;
```

Modificar en `scratch/import_maprex_pg.py`:

```python
BASE = Path(r"C:\...\scratch\maprex_octubre\pg")
DB_NAME = "maprex_octubre"
```

Ejecutar:

```powershell
python scratch\import_maprex_pg.py
```

Opción B: cargar directamente en un esquema de staging de producción:

```sql
CREATE SCHEMA maprex_octubre_staging;
```

y usar `COPY` desde los CSV.

## 5. Validar antes de publicar

Comparar contra el Access y contra la base vigente:

```text
Cantidad de partidas
Cantidad de materiales
Cantidad de equipos
Cantidad de mano de obra
Cantidad de recetas APU
Códigos duplicados
Códigos colisionados
Unidades vacías
Rendimientos cero o negativos
Precios cero
Materiales sin receta
Partidas sin APU
```

Como mínimo deben coincidir los conteos de `ObraPart`, `ObraMate`,
`ObraEqui` y `ObraMano`.

## 6. Publicar como nueva base Cost360

Crear el esquema definitivo:

```sql
CREATE SCHEMA base_octubre;
```

Crear las 7 tablas con la estructura de la base maestra:

```sql
CREATE TABLE base_octubre.cost360_items
  (LIKE public.cost360_items INCLUDING ALL);

CREATE TABLE base_octubre.cost360_materials
  (LIKE public.cost360_materials INCLUDING ALL);

CREATE TABLE base_octubre.cost360_equipment
  (LIKE public.cost360_equipment INCLUDING ALL);

CREATE TABLE base_octubre.cost360_labor
  (LIKE public.cost360_labor INCLUDING ALL);

CREATE TABLE base_octubre.cost360_apu_materials
  (LIKE public.cost360_apu_materials INCLUDING ALL);

CREATE TABLE base_octubre.cost360_apu_equipment
  (LIKE public.cost360_apu_equipment INCLUDING ALL);

CREATE TABLE base_octubre.cost360_apu_labor
  (LIKE public.cost360_apu_labor INCLUDING ALL);
```

Cargar en este orden:

```text
1. cost360_materials
2. cost360_equipment
3. cost360_labor
4. cost360_items
5. cost360_apu_materials
6. cost360_apu_equipment
7. cost360_apu_labor
```

Registrar la base:

```sql
INSERT INTO public.cost360_databases
  (id, name, description, is_master, is_active,
   source_database_id, created_at)
VALUES
  ('base_octubre', 'Base Octubre',
   'Base Maprex corte octubre 2026',
   false, true, 'master', now());
```

El backend usa `database_id` como nombre de esquema y hace:

```sql
SET LOCAL search_path TO "base_octubre", public;
```

Por eso el `id` debe ser exactamente el nombre del esquema.

## 7. Verificar en la aplicación

1. Abrir la hoja de presupuesto.
2. Abrir el selector de base de datos.
3. Confirmar que aparece `Base Octubre`.
4. Buscar una partida y verificar descripción, unidad y precio.
5. Abrir un APU y comparar materiales, equipos y mano de obra.
6. Comparar una partida conocida contra `base_agosto`.
7. Revisar que `base_octubre` no tenga filas mezcladas de `public`.

## 8. Rollback

Si algo falla:

```sql
DROP SCHEMA base_octubre CASCADE;

DELETE FROM public.cost360_databases
WHERE id = 'base_octubre';
```

Nunca borrar `public` ni `master` para “volver atrás”.

## 9. Diferencias que hay que corregir en la documentación

La documentación actual dice:

```text
python run_import.py
```

y:

```text
backend/scripts/import_cost360.py
```

Pero esos archivos no existen en el repositorio. Los scripts reales son los de
`scratch/`. Antes de operar en producción hay que crear un script único,
parametrizado y probado.

## 10. Próximo paso recomendado

Crear tres scripts reutilizables:

```text
scripts/maprex_export.py
scripts/maprex_stage.py
scripts/costbase_publish.py
```

Con parámetros:

```text
--mdb
--out
--schema
--name
--cutoff
--dry-run
--validate-only
```

Y un comando único:

```bash
python scripts/costbase_publish.py \
  --mdb "ruta/base exportada.mdb" \
  --schema base_octubre \
  --name "Base Octubre" \
  --cutoff 2026-10-31
```

Ese comando debería:

1. Exportar.
2. Validar conteos.
3. Cargar staging.
4. Comparar.
5. Crear esquema.
6. Registrar la base.
7. Generar reporte.
