# Documentación de la Funcionalidad "Uso en Partidas" (Sanitización de Base de Datos)

## Propósito
Durante el proceso de depuración y fusión de duplicados en la base de datos (Materiales, Equipos y Mano de Obra), surgió la necesidad crítica de conocer **en cuántas y en cuáles partidas (APUs) se utiliza un recurso específico**. Esto previene borrar recursos que están en uso y romper las partidas, y permite tomar decisiones informadas sobre qué insumo debe quedar como "ganador" durante una fusión.

## Ubicación en la Interfaz (Frontend)
La funcionalidad se encuentra en el módulo **Mantenimiento de Base de Datos** (`AdminDatabasePage.jsx`).
Se implementó dentro del componente de pestañas genérico `CatalogResourceTab.jsx`.

### Componentes Modificados:
- **`frontend/src/modules/cost360/components/CatalogResourceTab.jsx`**
  - **Nueva Columna:** Se añadió una columna condicional (`Uso en Partidas`) a la tabla, que solo se renderiza si el recurso no es de tipo 'items' (es decir, aplica solo a Materiales, Equipos y Mano de Obra).
  - **Botón "Ver Partidas":** Se agregó un botón en cada fila que ejecuta la función `handleViewUses(item)`.
  - **Estado Local:** Se incorporó el estado `usesModal` para gestionar la apertura, carga y datos de las APUs donde se usa el recurso seleccionado.
  - **Modal (UI):** Al final del archivo (antes de cerrar el contenedor principal `flex flex-col`), se insertó un modal flotante. Este modal muestra el código del recurso, su descripción, y una tabla con todas las APUs dependientes, o un mensaje informativo en caso de que el recurso sea huérfano (0 usos).

## API Backend (Endpoints)
Para proveer la información al frontend en tiempo real, se crearon tres (3) nuevos endpoints en el enrutador de Cost360.

### Archivo Modificado:
- **`backend/app/api/v1/endpoints/cost360.py`**
  Se inyectaron los siguientes endpoints al final del archivo:

```python
@router.get("/materials/{material_id}/apus")
def get_material_apus(material_id: str, db: Session = Depends(get_db)):
    """Devuelve las partidas (APUs) donde se usa este material."""
    query = text('''
        SELECT a."CodPar", i."Descri" 
        FROM cost360_apu_materials a 
        JOIN cost360_items i ON a."CodPar" = i."CodPar" 
        WHERE a."CodIns" = :cod
    ''')
    rows = db.execute(query, {"cod": material_id}).fetchall()
    return [{"CodPar": r[0], "Descri": r[1]} for r in rows]

@router.get("/equipments/{equipment_id}/apus")
def get_equipment_apus(equipment_id: str, db: Session = Depends(get_db)):
    """Devuelve las partidas (APUs) donde se usa este equipo."""
    query = text('''
        SELECT a."CodPar", i."Descri" 
        FROM cost360_apu_equipment a 
        JOIN cost360_items i ON a."CodPar" = i."CodPar" 
        WHERE a."CodEqu" = :cod
    ''')
    rows = db.execute(query, {"cod": equipment_id}).fetchall()
    return [{"CodPar": r[0], "Descri": r[1]} for r in rows]

@router.get("/labors/{labor_id}/apus")
def get_labor_apus(labor_id: str, db: Session = Depends(get_db)):
    """Devuelve las partidas (APUs) donde se usa esta mano de obra."""
    query = text('''
        SELECT a."CodPar", i."Descri" 
        FROM cost360_apu_labor a 
        JOIN cost360_items i ON a."CodPar" = i."CodPar" 
        WHERE a."CodMan" = :cod
    ''')
    rows = db.execute(query, {"cod": labor_id}).fetchall()
    return [{"CodPar": r[0], "Descri": r[1]} for r in rows]
```

## Relación con la Fusión / Depuración
Esta funcionalidad trabaja de la mano con el sistema de Deduplicación y Fusión. Antes de aceptar una sugerencia de fusión, el administrador puede buscar los insumos "perdedores" en el módulo de Mantenimiento y visualizar qué APUs dependen de ellos. 
Si el insumo no tiene partidas asociadas (el modal indica "Este recurso no está siendo utilizado"), puede ser eliminado con total seguridad directamente desde la tabla mediante el botón de la papelera, reduciendo la carga del sistema de deduplicación.

## Instrucciones para Mantenimiento Futuro
1. **Si las tablas de relaciones cambian de nombre:** (Por ejemplo, de `cost360_apu_materials` a otro esquema), debes actualizar las queries SQL dentro de `backend/app/api/v1/endpoints/cost360.py`.
2. **Si el frontend no muestra la columna:** Verifica que el prop `resourceType` que se le pasa al componente `CatalogResourceTab` sea distinto de `'items'`.
3. **Carga en grandes bases de datos:** Actualmente las queries devuelven un arreglo simple con todas las partidas. Si un material formara parte de +10,000 partidas, el frontend podría ralentizarse al renderizar. En el futuro, si esto se convierte en un cuello de botella, el endpoint debería ser paginado (incorporando `skip` y `limit` en el endpoint de SQL) y el modal debería tener *infinite scroll*.
