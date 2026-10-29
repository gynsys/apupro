# Base de datos de LULO a PostgreSQL

Esta carpeta reúne la documentación de la base de datos de **Lulowin/Maprex**, su conversión a PostgreSQL y la ubicación de las bases usadas por Costbase.

## Contenido

- [Bitácora Cost360](BITACORA_COST360.md): esquema de `cost360_*`, proceso ETL desde Access/Lulowin/Maprex y mantenimiento.
- [Consultas a la base de datos](DB_CONSULTAS.md): estructura de `cost360_items`, consultas, métricas y mantenimiento.
- [Selección de bases de datos](BITACORA_COST360_DATABASE_SELECTION.md): gestión, duplicación y migración de bases Cost360.
- [Bug de campos nulos](BUG_NULL_DB_FIELDS.md): problema de `cost360_databases` con campos nulos.

## Ubicaciones

### Producción

| Dato | Valor |
|---|---|
| Motor | PostgreSQL 14 |
| Contenedor | `apupro_platform-apupro-db-1` |
| Host interno Docker | `apupro-db:5432` |
| Puerto publicado | `5440` |
| Base de datos | `apupro_db` |
| Usuario | `apupro_user` |
| Esquema principal | `public` |
| Tablas principales | `cost360_items`, `cost360_materials`, `cost360_equipment`, `cost360_labor` |

La cadena de conexión y la contraseña se toman de `backend/.env` y de las variables de `docker-compose.yml`; no se documentan aquí.

### Base local de Maprex

| Dato | Valor |
|---|---|
| Motor | PostgreSQL local |
| Base de datos | `maprex_local` |
| Host | `127.0.0.1` |
| Puerto | `5432` |
| Usuario | `postgres` |
| Origen | `base exportada.mdb` (Access de Lulowin/Maprex) |

### Espejo de producción

```text
produccion_espejo.dump
```

Es el respaldo/espejo usado para comparar la base local de Maprex contra producción.

## Conversión realizada

La base Access original contenía **47 tablas**. Las principales fueron:

| Tabla original | Registros | Equivalente en Cost360 |
|---|---:|---|
| `ObraMate` | 9.946 | `cost360_materials` |
| `ObraPart` | 12.652 | `cost360_items` |
| `ObraMano` | 581 | `cost360_labor` |
| `ObraEqui` | 1.822 | `cost360_equipment` |
| `ObraFami` | 40 | Familias de insumos |
| `ObraIndi` | 7.980 | Indicadores de mercado |
| `ObraPainMate` | 39.599 | Recetas de materiales por APU |
| `ObraPainMano` | 55.458 | Recetas de mano de obra por APU |
| `ObraPainEqui` | 49.086 | Recetas de equipos por APU |

El ETL de producción se hace con los cuatro CSV principales:

```text
Export2024_ObraMate.csv
Export2024_ObraPart.csv
Export2024_ObraMano.csv
Export2024_ObraEqui.csv
```

y el script:

```text
backend/scripts/import_cost360.py
```

## Artefactos técnicos

Los archivos de extracción y comparación están fuera de esta carpeta:

- [`scratch/old_mdb_schema.txt`](../../scratch/old_mdb_schema.txt): esquema de las 47 tablas Access.
- [`scratch/maprex_pg/schema.tsv`](../../scratch/maprex_pg/schema.tsv): esquema generado para PostgreSQL local.
- [`scratch/maprex_pg/csv/`](../../scratch/maprex_pg/csv/): CSV extraídos por tabla.
- [`scratch/maprex_db_export/`](../../scratch/maprex_db_export/): exportaciones de materiales, mano de obra y equipos.
- [`scratch/build_comparison_excel.py`](../../scratch/build_comparison_excel.py): comparación Maprex local vs producción.

## Nota

No existía un documento único que explicara toda la conversión. Esta carpeta centraliza la documentación existente; los artefactos y scripts permanecen en `scratch/` para no mover archivos operativos.
