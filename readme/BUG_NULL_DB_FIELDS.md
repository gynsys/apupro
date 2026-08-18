# BUG: NULL_DB_FIELDS — Bases de Datos No Aparecen en el Dropdown

## Nombre del Bug
**NULL_DB_FIELDS** — Campos nulos en `cost360_databases` causan error 500 al listar bases de datos.

## Historial de Ocurrencias
| Fecha | Causa | Resuelto por |
|---|---|---|
| 2026-08-17 | Inserción de `temp_m` con SQL directo (sin valores de inflación) | fix en BD + reinicio |
| 2026-08-18 | Inserción de `temp_u` con SQL directo (sin valores de inflación) | fix en BD + fix en schema Pydantic |

---

## Síntoma

El dropdown de bases de datos en `costbase.arko360.net/cost360` solo muestra **"Base Maestra (Defecto)"** y no lista las demás bases aunque existan en la tabla `cost360_databases`.

En la consola del navegador aparece:
```
api/v1/cost360/databases:1  Failed to load resource: the server responded with a status of 500
Error al cargar bases de datos: Error: Error al cargar bases de datos
```

En los logs del backend (`docker logs apupro_platform-apupro-backend-1`):
```
fastapi.exceptions.ResponseValidationError: 3 validation errors:
  {'type': 'float_type', 'loc': ('response', 'databases', 0, 'material_inflation'), 'msg': 'Input should be a valid number', 'input': None}
  {'type': 'float_type', 'loc': ('response', 'databases', 0, 'labor_inflation'), 'msg': 'Input should be a valid number', 'input': None}
  {'type': 'float_type', 'loc': ('response', 'databases', 0, 'equipment_inflation'), 'msg': 'Input should be a valid number', 'input': None}
```

---

## Causa Raíz

Cuando se **inserta una fila** en la tabla `public.cost360_databases` **directamente con SQL** (en vez de usar el endpoint POST del backend), los campos opcionales `material_inflation`, `labor_inflation`, `equipment_inflation`, `is_master` e `is_active` quedan como `NULL` en la base de datos.

El schema de Pydantic en `backend/app/schemas/cost360.py` declaraba esos campos como **tipos primitivos obligatorios** (`float`, `bool`), por lo que al intentar serializar una fila con `NULL`, lanzaba un `ResponseValidationError` y toda la respuesta fallaba con `500`.

```
# ANTES (roto): No tolera NULLs de BD
class Cost360DatabaseBase(BaseModel):
    is_master: bool
    is_active: bool
    material_inflation: float
    labor_inflation: float
    equipment_inflation: float
```

---

## Solución Permanente (ya aplicada)

### Paso 1 — Corregir los NULLs en la BD

Ejecutar en el servidor:
```sql
-- Corregir campos de inflación nulos
UPDATE public.cost360_databases 
SET 
    material_inflation = COALESCE(material_inflation, 0.0),
    labor_inflation = COALESCE(labor_inflation, 0.0),
    equipment_inflation = COALESCE(equipment_inflation, 0.0),
    is_master = COALESCE(is_master, FALSE),
    is_active = COALESCE(is_active, TRUE)
WHERE 
    material_inflation IS NULL 
    OR labor_inflation IS NULL 
    OR equipment_inflation IS NULL
    OR is_master IS NULL
    OR is_active IS NULL;
```

Ejecutar vía `ssh_runner.py`:
```bash
python ssh_runner.py --upload fix_inflation.sql /root/fix_inflation.sql
python ssh_runner.py "docker exec -i apupro_platform-apupro-db-1 psql -U apupro_user -d apupro_db < /root/fix_inflation.sql"
```

### Paso 2 — Aplicar el Fix al Schema de Pydantic

En `backend/app/schemas/cost360.py`, la clase `Cost360DatabaseBase` debe declarar todos esos campos como `Optional` con valor por defecto:

```python
# CORRECTO (tolerante a NULLs de BD)
class Cost360DatabaseBase(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    is_master: Optional[bool] = False       # <-- Optional
    is_active: Optional[bool] = True        # <-- Optional
    material_inflation: Optional[float] = 0.0  # <-- Optional
    labor_inflation: Optional[float] = 0.0     # <-- Optional
    equipment_inflation: Optional[float] = 0.0 # <-- Optional
    source_database_id: Optional[str] = None
    created_at: Optional[datetime] = None
    created_by: Optional[str] = None

    class Config:
        from_attributes = True
```

Subir al servidor y reiniciar:
```bash
python ssh_runner.py --upload backend/app/schemas/cost360.py /root/apupro_platform/backend/app/schemas/cost360.py
python ssh_runner.py "docker restart apupro_platform-apupro-backend-1"
```

### Paso 3 — Verificar

Recargar la página `F5` en `costbase.arko360.net/cost360`. El dropdown debe mostrar todas las bases registradas en la tabla.

---

## Prevención Futura

> [!WARNING]
> **Siempre que se inserte una base de datos en `cost360_databases` mediante SQL directo**, incluir explícitamente los campos de inflación y estado:

```sql
-- FORMA CORRECTA de insertar una base de datos provisional
INSERT INTO public.cost360_databases (id, name, description, is_master, is_active, material_inflation, labor_inflation, equipment_inflation) 
VALUES ('temp_x', 'Base Provisional X', 'Descripción', FALSE, TRUE, 0.0, 0.0, 0.0)
ON CONFLICT DO NOTHING;
```

El script `register_db.sql` (en la raíz del proyecto) sirve como plantilla reutilizable.

---

## Archivos Relevantes

| Archivo | Descripción |
|---|---|
| [`backend/app/schemas/cost360.py`](file:///c:/Users/pablo/Documents/apupro_platform/backend/app/schemas/cost360.py) | Schema Pydantic corregido — campos `Optional` |
| [`backend/app/crud/crud_cost360.py`](file:///c:/Users/pablo/Documents/apupro_platform/backend/app/crud/crud_cost360.py) | Función `get_all_databases()` — sin filtros |
| [`frontend/src/contexts/DatabaseContext.jsx`](file:///c:/Users/pablo/Documents/apupro_platform/frontend/src/contexts/DatabaseContext.jsx) | Contexto global de bases de datos |
| `readme/fix_null_db_fields.sql` | Script SQL de corrección reutilizable |
