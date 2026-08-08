# Gestión de Bases de Datos - Cost360

## Fecha de Implementación
Agosto 2026

## Objetivo
Implementar un sistema completo de gestión de bases de datos para el módulo Cost360 que permita:

1. **Selección dinámica** de bases de datos para recuperar APUs (Análisis de Precios Unitarios)
2. **Duplicación de bases de datos** con aplicación de índices de inflación (materiales, mano de obra, equipos)
3. **Eliminación de bases de datos personalizadas**
4. **Gestión centralizada** de todas las bases de datos disponibles

## Descripción del Cambio

### Fase 1: Selección Dinámica (Completada)
Anteriormente, el sistema utilizaba una única "Base Maestra" para recuperar insumos y partidas. Se implementó un sistema de selección dinámica que permite:

1. **Menú desplegable "Base de Datos"** en la hoja de presupuesto (BudgetWorksheetPage)
2. **Selector de base de datos** en el modal de agregar insumos (ComponentSearchModal)
3. **Selector de base de datos** en el modal de búsqueda de partidas
4. **Contexto global** para compartir el estado de la base de datos activa

### Fase 2: Gestión de Bases de Datos (Completada)
Se agregó funcionalidad completa para gestionar múltiples bases de datos:

1. **Página de gestión** (`/cost360/databases`) para crear, listar y eliminar bases de datos
2. **Duplicación con inflación**: Crear nuevas bases aplicando factores de inflación a materiales, mano de obra y equipos
3. **Protección de base maestra**: No se puede modificar ni eliminar la base de datos maestra
4. **Metadatos**: Cada base tiene nombre, descripción, índices de inflación aplicados, fecha de creación, etc.

## Archivos Creados

### Backend

#### `backend/app/db/models/cost360_database.py`
Modelo SQLAlchemy para gestionar múltiples bases de datos Cost360.

```python
class Cost360Database(Base):
    __tablename__ = "cost360_databases"
    
    id = Column(String, primary_key=True)  # 'master', 'personalizada', etc.
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    is_master = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    
    # Índices de inflación aplicados
    material_inflation = Column(Float, default=0.0)
    labor_inflation = Column(Float, default=0.0)
    equipment_inflation = Column(Float, default=0.0)
    
    source_database_id = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True))
    created_by = Column(String, nullable=True)
```

### Frontend

#### `admin/src/contexts/DatabaseContext.jsx`
Contexto global de React para manejar el estado de la base de datos activa. Carga dinámicamente las bases de datos desde el backend.

#### `admin/src/services/cost360DatabaseService.js`
Servicio frontend para interactuar con los endpoints de gestión de bases de datos.

```javascript
export const cost360DatabaseService = {
  getAll: async () => { /* GET /cost360/databases */ },
  getById: async (databaseId) => { /* GET /cost360/databases/:id */ },
  create: async (data) => { /* POST /cost360/databases */ },
  update: async (databaseId, data) => { /* PATCH /cost360/databases/:id */ },
  delete: async (databaseId) => { /* DELETE /cost360/databases/:id */ }
};
```

#### `admin/src/modules/cost360/pages/DatabaseManagementPage.jsx`
Página de gestión de bases de datos con UI para:
- Listar todas las bases de datos en tarjetas
- Crear nuevas bases duplicando con índices de inflación
- Eliminar bases personalizadas (protegiendo la base maestra)
- Ver metadatos de cada base (índices aplicados, fecha de creación, origen)

## Archivos Modificados

### Frontend

#### `admin/src/App.jsx`
- Agregado `DatabaseProvider` para envolver la aplicación y proporcionar el contexto de base de datos

#### `admin/src/pages/admin/BudgetWorksheetPage.jsx`
- Importado `useDatabase` hook y `DATABASES` del contexto
- Agregado estado local `dbDropdownOpen` para controlar el menú desplegable
- Agregado menú desplegable "Base de Datos" en el header de la hoja de presupuesto
- Agregado selector de base de datos en el modal de búsqueda de partidas
- Modificada función `searchDatabase` para incluir el parámetro `database_id` en las peticiones

#### `admin/src/components/ComponentSearchModal.jsx`
- Importado `useDatabase` hook y `DATABASES` del contexto
- Agregado estado local `dbDropdownOpen` para controlar el menú desplegable
- Agregado selector de base de datos en el header del modal que muestra la base de datos activa
- Modificada función `handleSearch` para pasar el `activeDatabase.id` a `budgetService.searchComponents`

#### `admin/src/services/budgetService.js`
- Modificada función `searchComponents` para aceptar un tercer parámetro `databaseId` (default: 'master')
- Agregado parámetro `database_id` a la URL de la petición al backend

### Backend

#### `backend/app/api/v1/endpoints/cost360.py`
- Modificados endpoints `/materials`, `/equipments`, y `/labors` para aceptar el parámetro `database_id`
- Agregado parámetro opcional `database_id: str = "master"` en cada endpoint
- Agregados comentarios explicativos sobre el propósito del parámetro

**Nota:** Actualmente el backend utiliza la misma base de datos para todas las selecciones, pero la infraestructura está lista para soportar múltiples bases de datos cuando se implemente la lógica de routing correspondiente.

## Funcionalidades Implementadas

### 1. Contexto Global de Base de Datos
- Estado compartido entre componentes para la base de datos activa
- Hook `useDatabase()` para acceder al estado y las funciones de actualización
- Lista predefinida de bases de datos disponibles

### 2. Menú Desplegable en Hoja de Presupuesto
- Ubicado en el header de BudgetWorksheetPage
- Muestra la base de datos activa con icono de base de datos
- Permite cambiar entre las bases de datos disponibles
- Estilo consistente con el resto de la UI

### 3. Selector en Modal de Agregar Insumos
- Ubicado en el header de ComponentSearchModal
- Muestra la base de datos activa cuando se abre el modal
- Permite cambiar la base de datos antes de buscar insumos
- La búsqueda utiliza la base de datos seleccionada

### 4. Selector en Modal de Búsqueda de Partidas
- Ubicado en el modal de búsqueda de partidas de BudgetWorksheetPage
- Muestra la base de datos activa cuando se abre el modal
- Permite cambiar la base de datos antes de buscar partidas
- La búsqueda utiliza la base de datos seleccionada

## Flujo de Datos

1. **Usuario selecciona base de datos** → `setActiveDatabase(db)` en el contexto
2. **Componente lee base de datos activa** → `useDatabase()` hook
3. **Petición al backend** → Se incluye `database_id` como parámetro en la URL
4. **Backend recibe parámetro** → `database_id: str = "master"` en el endpoint
5. **Backend procesa petición** → Actualmente usa la misma base de datos (preparado para multi-database)

## Pruebas Recomendadas

1. Abrir una hoja de presupuesto existente
2. Verificar que el menú desplegable "Base de Datos" aparece en el header
3. Cambiar la base de datos seleccionada y verificar que se actualiza
4. Abrir el modal de agregar partida y verificar que muestra la base de datos activa
5. Abrir el modal de agregar insumos (APU Editor) y verificar que muestra la base de datos activa
6. Realizar búsquedas con diferentes bases de datos seleccionadas
7. Verificar que las peticiones incluyen el parámetro `database_id` en la consola del navegador

## Próximos Pasos (Backend)

Para completar la funcionalidad de múltiples bases de datos, se necesita:

1. **Implementar lógica de routing de bases de datos** en el backend:
   - Configurar múltiples conexiones a bases de datos o esquemas
   - Implementar lógica para seleccionar la base de datos según el parámetro `database_id`
   - Considerar usar schemas de PostgreSQL o bases de datos separadas

2. **Migración de datos**:
   - Crear las bases de datos adicionales (Base Personalizada, Base Junio)
   - Poblar las bases de datos con los datos correspondientes
   - Implementar proceso de sincronización entre bases de datos

3. **Validación de permisos**:
   - Verificar que el usuario tiene acceso a la base de datos seleccionada
   - Implementar roles de usuario para restringir acceso a ciertas bases de datos

## Notas Técnicas

- El contexto de base de datos carga dinámicamente las bases de datos desde el backend al iniciar
- El parámetro `database_id` es opcional en el backend, con valor por defecto "master"
- La UI muestra el nombre legible de la base de datos (ej. "Base Maestra") pero envía el ID (ej. "master") al backend
- Los menús desplegables tienen z-index alto para aparecer sobre otros elementos
- El estado del menú desplegable es local a cada componente para evitar conflictos
- La base maestra está protegida contra modificación y eliminación

## Migración de Base de Datos

### Archivo de Migración
`backend/app/db/migrations/create_cost360_databases_table.sql`

### Ejecución de la Migración
Para crear la tabla `cost360_databases` en producción:

```bash
# Método 1: Usando docker-compose exec
docker-compose exec backend python -c "
from app.db.base import engine
from sqlalchemy import text
with engine.connect() as conn:
    with open('app/db/migrations/create_cost360_databases_table.sql', 'r') as f:
        conn.execute(text(f.read()))
    conn.commit()
"

# Método 2: Conectando directamente a PostgreSQL
docker-compose exec db psql -U arko_user -d arko360 -f /dev/stdin < backend/app/db/migrations/create_cost360_databases_table.sql
```

### Estructura de la Tabla
```sql
CREATE TABLE cost360_databases (
    id VARCHAR(255) PRIMARY KEY,           -- ID único (master, personalizada, etc.)
    name VARCHAR(255) NOT NULL,            -- Nombre legible
    description TEXT,                      -- Descripción opcional
    is_master BOOLEAN DEFAULT FALSE,       -- True para base maestra
    is_active BOOLEAN DEFAULT TRUE,        -- Estado activo/inactivo
    material_inflation FLOAT DEFAULT 0.0,  -- % inflación materiales
    labor_inflation FLOAT DEFAULT 0.0,     -- % inflación mano de obra
    equipment_inflation FLOAT DEFAULT 0.0, -- % inflación equipos
    source_database_id VARCHAR(255),       -- ID de base origen
    created_at TIMESTAMP,                   -- Fecha de creación
    created_by VARCHAR(255)                -- Usuario creador
);
```

### Datos Iniciales
La migración inserta automáticamente la base de datos maestra:
- ID: `master`
- Nombre: `Base Maestra`
- Índices de inflación: 0% (todos)
- Estado: Activa
