# Plan de Implementación: Configuración de Costos por Usuario

## 📋 Resumen del Objetivo

Implementar un sistema de configuración de costos por usuario para que cada usuario tenga sus propios valores por defecto al crear presupuestos, manteniendo la independencia de cada presupuesto.

---

## 🎯 Arquitectura Actual

### Tablas Existentes

**`arko_users`:**
- Usuarios regulares que contratan planes
- NO tiene configuración de costos
- Se usa para autenticación

**`arko_admins`:**
- Administradores del sistema
- Tiene `site_config` (JSONB) para landing page
- Tiene campos de plan (plan, max_budgets, has_ai_access)
- NO tiene configuración de costos específica

**`budgets`:**
- Presupuestos con configuración independiente
- Campos existentes:
  - `fcas_percent` → FCAS específico
  - `admin_percent` → % Administración (default: 15.0)
  - `profit_percent` → % Utilidad (default: 10.0)
  - `iva_percent` → IVA (default: 16.0)
  - `labor_bonus`, `material_inflation`, `labor_inflation`, `equipment_inflation`
- Cada presupuesto es independiente (ya funciona así)

---

## 🔄 Flujo Deseado

```
Usuario → Configuración Personal (valores por defecto)
            ↓
    Crear Presupuesto → Se usan valores por defecto del usuario
            ↓
    Presupuesto puede modificar sus valores independientemente
```

---

## 📝 Plan de Implementación

### FASE 1: Backend - Modelo de Base de Datos

#### 1.1 Agregar `costos_config` a `arko_users`
- **Archivo:** `backend/app/db/models/arko.py`
- **Cambio:** Agregar columna `costos_config` (JSONB) al modelo `ArkoUser`
- **Valores por defecto:**
  ```json
  {
    "porcentajeUtilidad": 10,
    "porcentajeAdministracion": 15,
    "iva": 16,
    "fcas": 0
  }
  ```

#### 1.2 Agregar `costos_config` a `arko_admins`
- **Archivo:** `backend/app/db/models/arko.py`
- **Cambio:** Agregar columna `costos_config` (JSONB) al modelo `ArkoAdmin`
- **Valores por defecto:** Mismos que arriba

#### 1.3 Crear migración de base de datos
- **Archivo:** `backend/alembic/versions/`
- **Cambio:** Crear migración para agregar las columnas JSONB
- **Comando:** `alembic revision --autogenerate -m "add costos_config to users and admins"`

---

### FASE 2: Backend - Endpoints

#### 2.1 Crear endpoint GET `/api/v1/users/me/costos`
- **Archivo:** `backend/app/api/v1/endpoints/users.py` (crear si no existe)
- **Función:** Devuelve la configuración de costos del usuario autenticado
- **Lógica:**
  - Verificar autenticación (JWT)
  - Buscar usuario en `arko_users` o `arko_admins` según tipo
  - Devolver `costos_config` o valores por defecto si es null

#### 2.2 Crear endpoint PUT `/api/v1/users/me/costos`
- **Archivo:** `backend/app/api/v1/endpoints/users.py`
- **Función:** Actualiza la configuración de costos del usuario autenticado
- **Lógica:**
  - Verificar autenticación
  - Validar valores (no negativos, rangos razonables)
  - Actualizar `costos_config` en BD
  - Devolver config actualizada

#### 2.3 Actualizar endpoint de creación de presupuesto
- **Archivo:** `backend/app/api/v1/endpoints/budgets.py`
- **Cambio:** Al crear presupuesto, usar valores por defecto del usuario
- **Lógica:**
  - Si no se especifican valores, usar `costos_config` del usuario
  - Mantener compatibilidad con envío explícito de valores

---

### FASE 3: Frontend - Context y Estado

#### 3.1 Crear `UserCostosContext`
- **Archivo:** `frontend/src/context/UserCostosContext.jsx` (nuevo)
- **Función:** Proveer configuración de costos del usuario globalmente
- **Estado:**
  - `costosConfig`: Objeto con los 4 valores
  - `setCostosConfig`: Función para actualizar
  - `loading`: Estado de carga
  - `error`: Estado de error

#### 3.2 Integrar en `AppLayout`
- **Archivo:** `frontend/src/components/layout/AppLayout.jsx`
- **Cambio:** Envolver `<Outlet />` con `UserCostosContext.Provider`
- **Lógica:** Cargar config al montar el layout

#### 3.3 Actualizar `AuthContext`
- **Archivo:** `frontend/src/context/AuthContext.jsx`
- **Cambio:** Agregar carga de costos al hacer login
- **Lógica:** Después de autenticación, llamar endpoint GET `/api/v1/users/me/costos`

---

### FASE 4: Frontend - Componentes

#### 4.1 Actualizar `TabNavigation`
- **Archivo:** `frontend/src/modules/cost360/components/layout/TabNavigation.jsx`
- **Cambio:** Usar `UserCostosContext` en lugar de estado local
- **Lógica:**
  - Leer valores del contexto
  - Al modificar, llamar endpoint PUT `/api/v1/users/me/costos`
  - Actualizar contexto después de guardar

#### 4.2 Actualizar `CalculadoraFCAS`
- **Archivo:** `frontend/src/components/tools/CalculadoraFCAS.jsx`
- **Cambio:** Botón "Usar FCAS" actualiza config del usuario
- **Lógica:**
  - Llamar endpoint PUT `/api/v1/users/me/costos` con nuevo valor FCAS
  - Actualizar contexto global
  - Mostrar toast de éxito

#### 4.3 Actualizar `AdminDatabasePage`
- **Archivo:** `frontend/src/modules/cost360/pages/AdminDatabasePage.jsx`
- **Cambio:** Usar `UserCostosContext` en lugar de estado local
- **Lógica:** Eliminar estado local de costos, usar contexto

#### 4.4 Actualizar creación de presupuesto
- **Archivo:** `frontend/src/pages/admin/BudgetHomePage.jsx` o similar
- **Cambio:** Al crear presupuesto, usar valores por defecto del contexto
- **Lógica:** Si el usuario no especifica valores, usar de `UserCostosContext`

---

### FASE 5: Backend - Valores por Defecto Configurables

#### 5.1 Agregar costos a `DEFAULT_SITE_CONFIG`
- **Archivo:** `backend/app/api/v1/endpoints/arko.py`
- **Cambio:** Agregar sección `costos` con valores por defecto
- **Lógica:** Estos valores se usan para nuevos usuarios/admins

#### 5.2 Endpoint para super-admin configurar defaults
- **Archivo:** `backend/app/api/v1/endpoints/arko.py`
- **Cambio:** PUT `/arko/admin/config` ya existe, solo asegurar que acepte sección `costos`
- **Lógica:** Super-admin puede modificar valores por defecto globales

---

### FASE 6: Testing y Validación

#### 6.1 Pruebas unitarias backend
- Validar endpoints GET/PUT de costos
- Validar creación de presupuesto con defaults

#### 6.2 Pruebas integración frontend
- Validar carga de config al login
- Validar actualización desde TabNavigation
- Validar actualización desde CalculadoraFCAS
- Validar creación de presupuesto con defaults

#### 6.3 Pruebas de regresión
- Verificar que presupuestos existentes no se afecten
- Verificar que landing page config no se afecte

---

## 🔒 Consideraciones de Seguridad

1. **Autenticación:** Todos los endpoints requieren JWT válido
2. **Validación:** Validar rangos de valores (0-100 para porcentajes)
3. **Autorización:** Solo super-admin puede modificar defaults globales
4. **Migración:** Crear backup antes de ejecutar migración

---

## 📊 Mapeo de Campos

| Campo en Usuario | Campo en Budget | Descripción |
|------------------|-----------------|-------------|
| `porcentajeUtilidad` | `profit_percent` | % Utilidad |
| `porcentajeAdministracion` | `admin_percent` | % Administración |
| `iva` | `iva_percent` | IVA |
| `fcas` | `fcas_percent` | Factor de Costos Asociados al Salario |

---

## 🚀 Orden de Ejecución

1. FASE 1: Backend - Modelo (migración BD)
2. FASE 2: Backend - Endpoints
3. FASE 3: Frontend - Context
4. FASE 4: Frontend - Componentes
5. FASE 5: Backend - Defaults configurables
6. FASE 6: Testing

---

## ⚠️ Riesgos y Mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| Migración falla | Backup previo de BD |
| Context no actualiza | Verificar useEffect y eventos |
| Presupuestos existentes se rompen | No modificar estructura de budgets |
| Performance | Cargar config una vez al login, cachear |
| Conflictos con AuthContext | Separar claramente responsabilidades |

---

## 📝 Notas Adicionales

- Los presupuestos YA son independientes, no necesitamos cambiar eso
- Solo agregamos una capa de "valores por defecto por usuario"
- Cada presupuesto puede seguir modificando sus valores libremente
- El sistema de eventos personalizados actual se puede eliminar (no es necesario con contexto)
