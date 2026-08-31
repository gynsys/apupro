# Refactorización de AdminDatabasePage

## 📋 Resumen Ejecutivo

**Fecha:** 30/08/2026  
**Objetivo:** Reducir el monolito de 1,735 líneas a una arquitectura modular y mantenible  
**Resultado:** Reducción del 90% del código principal (167 líneas) + 21 componentes modulares  
**Estado:** ✅ Refactorización completada y build exitoso  
**Backup:** `AdminDatabasePage.OLD.jsx` disponible para rollback

---

## 🎯 Problemas Resueltos

### Diagnóstico Original
- **Monolito masivo:** 1,735 líneas en un solo componente
- **Violación de SRP:** 7+ responsabilidades en un solo archivo
- **Código duplicado:** Materiales/Equipos/MO con lógica idéntica (~95% duplicado)
- **Lógica de negocio en UI:** XML generation, fetches dispersos en handlers
- **Modales inline:** 4 modales dentro del JSX principal
- **Auth duplicado:** `localStorage.getItem('arko_admin_token')` repetido en cada handler

### Solución Implementada
- **Arquitectura modular:** Separación por responsabilidad
- **Componentes reutilizables:** Eliminación de duplicación
- **Hooks customizados:** Lógica de negocio centralizada
- **Servicios centralizados:** API client unificado
- **Thin orchestrator:** Página principal solo coordina componentes

---

## 📁 Estructura de Archivos Nueva

### Directorio Raíz de Cost360
```
frontend/src/modules/cost360/
├── constants/
│   ├── tabs.config.js          # Configuración de tabs
│   └── prompts.default.js      # Prompt default para IA
├── hooks/
│   ├── useAdminConfig.js       # Hook para configuración de admin
│   ├── useUsers.js             # Hook para gestión de usuarios
│   ├── useBulkUpdate.js        # Hook para actualizaciones masivas
│   └── usePendingItems.js     # Hook para scraping pendiente
├── lib/
│   ├── apiClient.js            # Cliente API centralizado con auth
│   └── exportUtils.js          # Utilidades de exportación
├── components/
│   ├── layout/
│   │   ├── AdminHeader.jsx     # Header con botones de acción
│   │   ├── TabNavigation.jsx   # Navegación de tabs
│   │   └── DatabaseSelector.jsx # Selector de base de datos
│   ├── tabs/
│   │   ├── PartidasTab.jsx     # Tab de partidas
│   │   ├── CatalogTab.jsx      # Tab genérico para catálogos
│   │   ├── ScrapingTab.jsx     # Tab de scraping
│   │   ├── PDFsTab.jsx         # Tab de actualización PDFs
│   │   └── UsuariosTab.jsx     # Tab de gestión de usuarios
│   ├── modals/
│   │   ├── BulkPriceModal.jsx  # Modal de actualización masiva de precios
│   │   ├── BulkDescModal.jsx   # Modal de actualización masiva de descripciones
│   │   ├── EditPartidaModal.jsx # Modal de edición de partidas
│   │   └── EditUserModal.jsx   # Modal de edición de usuarios
│   ├── CategoryManager.jsx    # Gestor de categorías COVENIN
│   ├── scraping/
│   │   ├── ScrapingDashboard.jsx # Dashboard de scraping
│   │   └── ModuloSincronizacionCostos.jsx # Módulo de sincronización
│   └── [componentes existentes sin cambios]
├── pages/
│   ├── AdminDatabasePage.jsx   # Nueva página refactorizada (167 líneas)
│   └── AdminDatabasePage.OLD.jsx # Backup del original (1,735 líneas)
└── [resto de la estructura sin cambios]
```

### Directorios Compartidos
```
frontend/src/
└── components/shared/
    └── GlassCard.jsx           # Componente reutilizable de cards
```

---

## 🔧 Componentes y Funcionalidades

### Fase 1: Constantes y Utilidades

#### `constants/tabs.config.js`
- **Propósito:** Centralizar configuración de tabs
- **Contenido:** Array de objetos con key, label, Icon
- **Beneficio:** Un solo lugar para configurar tabs

#### `constants/prompts.default.js`
- **Propósito:** Prompt default para generación de APU
- **Contenido:** Template de prompt para IA
- **Beneficio:** Mantenimiento centralizado de prompts

#### `lib/apiClient.js` (ubicado en `cost360/lib/`)
- **Propósito:** Cliente API centralizado con autenticación
- **Funciones:** `apiFetch`, `apiPost`, `apiPut`, `apiDelete`, `apiPostFormData`
- **Auth:** Automáticamente agrega header `Authorization: Bearer {arko_admin_token}`
- **Beneficio:** Elimina código duplicado de autenticación
- **Nota:** Ubicado en `cost360/lib/` para evitar problemas de rutas en Docker

#### `lib/exportUtils.js` (ubicado en `cost360/lib/`)
- **Propósito:** Utilidades de exportación
- **Funciones:** `generatePartidasExcel` - Genera Excel en formato XML
- **Beneficio:** Reutilización de lógica de exportación
- **Nota:** Ubicado en `cost360/lib/` para evitar problemas de rutas en Docker

### Fase 2: Hooks Customizados

#### `hooks/useAdminConfig.js`
- **Propósito:** Gestionar configuración de admin
- **Funciones:** `toggleGlobalCoded`, `toggleCategory`
- **Contexto:** Usa `SiteConfigContext`
- **Beneficio:** Lógica de configuración centralizada

#### `hooks/useUsers.js`
- **Propósito:** Gestionar usuarios y planes
- **Funciones:** `fetchUsers`, `toggleUserStatus`, `updateUserPlan`, `deleteUser`, `createDemoBudget`
- **API:** Usa `apiClient` para llamadas autenticadas
- **Beneficio:** Lógica de usuarios centralizada

#### `hooks/useBulkUpdate.js`
- **Propósito:** Gestionar actualizaciones masivas
- **Funciones:** `submitBulkPrices`, `submitBulkDescriptions`
- **Estado:** Gestiona modales de bulk update
- **Beneficio:** Lógica de bulk update reutilizable

#### `hooks/usePendingItems.js`
- **Propósito:** Gestionar items pendientes de scraping
- **Funciones:** `loadPendingItems`, `triggerVersioning`, `handleAction`
- **API:** Usa endpoints de scraping
- **Beneficio:** Lógica de scraping centralizada

### Fase 3: Modales

#### `modals/BulkPriceModal.jsx`
- **Propósito:** Modal para actualización masiva de precios
- **Input:** Textarea con formato `MAT1234: $1000`
- **Validación:** Parseo de líneas y validación de precios
- **Hook:** Usa `useBulkUpdate`

#### `modals/BulkDescModal.jsx`
- **Propósito:** Modal para actualización masiva de descripciones
- **Input:** Upload de archivo Excel
- **Validación:** Formato .xlsx o .xls
- **Hook:** Usa `useBulkUpdate`

#### `modals/EditPartidaModal.jsx`
- **Propósito:** Modal para edición de partidas
- **Campos:** Descripción, Unidad, Rendimiento
- **Service:** Usa `cost360Service.updateMasterItem`
- **Beneficio:** Formulario de edición reutilizable

#### `modals/EditUserModal.jsx`
- **Propósito:** Modal para edición de usuarios
- **Campos:** Límites de presupuestos, partidas, acceso IA
- **Hook:** Usa callback `onSave` para integración
- **Beneficio:** Formulario de edición de usuarios reutilizable

### Fase 4: Layout Components

#### `layout/AdminHeader.jsx`
- **Propósito:** Header con botones de acción
- **Botones:** "Actualizar Cerebro RAG", "Automatización IA"
- **Componente:** Usa `GlassCard` para estilos
- **Beneficio:** Header reutilizable

#### `layout/TabNavigation.jsx`
- **Propósito:** Navegación de tabs con filtros
- **Props:** `activeTab`, `onTabChange`, `showPartidasFilters`, etc.
- **Filtros:** Filtro público global, filtro local
- **Beneficio:** Navegación centralizada

#### `layout/DatabaseSelector.jsx`
- **Propósito:** Selector de base de datos
- **Opciones:** Master, Personalizada, Provisional, Bases personalizadas
- **Service:** Usa `cost360DatabaseService`
- **Beneficio:** Selector reutilizable

### Fase 5: Tabs

#### `tabs/PartidasTab.jsx`
- **Propósito:** Tab de partidas con búsqueda y exportación
- **Componentes:** `Cost360SearchBar`, `EditPartidaModal`
- **Hook:** Usa `useCost360Search`
- **Exportación:** Usa `generatePartidasExcel`
- **Beneficio:** Tab de partidas modular

#### `tabs/CatalogTab.jsx`
- **Propósito:** Tab genérico para catálogos (Materiales, Equipos, MO)
- **Props:** `title`, `resourceType`, `selectedDatabase`, `config`
- **Componentes:** `CatalogResourceTab`, `BulkPriceModal`, `BulkDescModal`
- **Beneficio:** Elimina duplicación de lógica de catálogos

#### `tabs/ScrapingTab.jsx`
- **Propósito:** Tab de scraping
- **Componentes:** `ScrapingDashboardProvider`, `ScrapingDashboard`
- **Beneficio:** Tab de scraping modular

#### `tabs/PDFsTab.jsx`
- **Propósito:** Tab de actualización de PDFs
- **Componentes:** `PDFUpdaterTab`
- **Beneficio:** Tab de PDFs modular

#### `tabs/UsuariosTab.jsx`
- **Propósito:** Tab de gestión de usuarios
- **Hook:** Usa `useUsers`
- **Componentes:** `EditUserModal`
- **Beneficio:** Tab de usuarios modular

### Componentes Adicionales

#### `CategoryManager.jsx`
- **Propósito:** Gestor de categorías COVENIN
- **Funcionalidad:** Toggle de visibilidad de categorías
- **Hook:** Usa `useAdminConfig.toggleCategory`
- **Beneficio:** Gestión de categorías reutilizable

---

## 🚀 Página Principal Refactorizada

### `pages/AdminDatabasePage.jsx` (167 líneas)

**Responsabilidades:**
- Coordinar estado global (activeTab, database, etc.)
- Integrar componentes de layout
- Renderizar tabs correspondientes
- Gestión de prompt IA

**No contiene:**
- Lógica de negocio específica
- Implementaciones de UI detalladas
- Modales inline
- Fetches dispersos

**Características:**
- Thin orchestrator pattern
- Solo coordina, no implementa
- Fácil de mantener y extender

---

## 🔄 Procedimiento de Rollback

### Si necesita revertir al original:

1. **Restaurar archivo original:**
   ```bash
   cd frontend/src/modules/cost360/pages
   cp AdminDatabasePage.OLD.jsx AdminDatabasePage.jsx
   ```

2. **Rebuild frontend:**
   ```bash
   cd frontend
   npm run build
   ```

3. **Rebuild Docker (si aplica):**
   ```bash
   docker-compose build apupro-frontend
   docker-compose up -d apupro-frontend
   ```

### Si necesita rollback parcial:
- **Solo eliminar componentes específicos** que causen problemas
- **Mantener los componentes funcionales** que no tengan issues
- **Rollback incremental** por componente

---

## 🛠️ Mantenimiento Futuro

### Agregar un nuevo tab:

1. **Crear componente de tab:**
   ```javascript
   // frontend/src/modules/cost360/components/tabs/NuevoTab.jsx
   const NuevoTab = () => {
     return <div>Contenido del nuevo tab</div>;
   };
   export default NuevoTab;
   ```

2. **Agregar configuración:**
   ```javascript
   // frontend/src/modules/cost360/constants/tabs.config.js
   export const TABS = [
     // ... tabs existentes
     { key: 'nuevo', label: 'Nuevo Tab', Icon: FiIcon },
   ];
   ```

3. **Integrar en página principal:**
   ```javascript
   // frontend/src/modules/cost360/pages/AdminDatabasePage.jsx
   import NuevoTab from '../components/tabs/NuevoTab';
   
   // En el render:
   {activeTab === 'nuevo' && <NuevoTab />}
   ```

### Modificar un componente existente:

1. **Localizar el componente** en la estructura modular
2. **Editar solo el componente específico**
3. **Rebuild y testear** funcionalidad afectada
4. **No afectar otros componentes** gracias a la separación

### Debuggear problemas:

1. **Identificar el componente** problemático
2. **Revisar imports** y rutas relativas
3. **Verificar hooks** y servicios
4. **Usar el archivo OLD** como referencia de funcionalidad original
5. **Testear en staging** antes de producción

---

## 🧪 Checklist de Verificación

### Funcionalidades a verificar en staging:

#### Partidas Tab
- [ ] Búsqueda por código, descripción e insumos
- [ ] Filtro Público Global funciona y persiste
- [ ] Filtro Local funciona en vista admin
- [ ] Categorías COVENIN se pueden ocultar/mostrar
- [ ] Exportación a Excel funciona
- [ ] Edición de partida abre modal y guarda
- [ ] Eliminación de partida funciona con confirmación

#### Catalog Tabs (Materiales, Equipos, MO)
- [ ] "Actualizar Precios" abre modal
- [ ] "Actualizar Descripciones" abre modal
- [ ] Bulk update de precios procesa correctamente
- [ ] Bulk update de descripciones procesa correctamente
- [ ] Toast de éxito se muestra
- [ ] Componente `CatalogResourceTab` funciona correctamente

#### Scraping Tab
- [ ] Dashboard de scraping carga
- [ ] Control bar funciona
- [ ] Log console muestra logs
- [ ] Config panel funciona
- [ ] Cola de aprobación carga items pendientes
- [ ] Acciones approve/reject funcionan

#### PDFs Tab
- [ ] Tab de actualización PDFs funciona
- [ ] Componente `PDFUpdaterTab` integra correctamente

#### Prompt Tab
- [ ] Prompt IA carga texto default
- [ ] Edición de prompt funciona
- [ ] Guardar en localStorage funciona
- [ ] Copiar al portapapeles funciona
- [ ] Restaurar backend funciona

#### Usuarios Tab
- [ ] Tabla de usuarios carga
- [ ] Toggle de estado activo/inactivo funciona
- [ ] Cambio de plan funciona
- [ ] Edición de límites funciona
- [ ] Eliminación de usuario funciona con confirmación

#### Layout General
- [ ] AdminHeader muestra botones correctos
- [ ] "Actualizar Cerebro RAG" funciona
- [ ] "Automatización IA" navega correctamente
- [ ] TabNavigation muestra todos los tabs
- [ ] DatabaseSelector muestra bases correctas
- [ ] Selección de base de datos funciona

#### Autenticación
- [ ] Todas las llamadas API usan `arko_admin_token`
- [ ] No hay errores 401 Unauthorized
- [ ] Headers de Authorization se envían correctamente

---

## ⚠️ Problemas Conocidos y Soluciones

### Rutas Relativas en Docker
- **Problema:** Las rutas relativas no funcionan correctamente en el entorno Docker
- **Solución:** Archivos de utilidades (`apiClient.js`, `exportUtils.js`) ubicados en `cost360/lib/` en lugar de `src/lib/`
- **Verificación:** Los imports ahora usan rutas más cortas desde el módulo cost360
- **Patrón:** Importar desde `../lib/apiClient` en lugar de `../../../lib/apiClient`

### Auth Tokens
- **Problema:** Algunos componentes usaban `token` en lugar de `arko_admin_token`
- **Solución:** `apiClient.js` usa siempre `arko_admin_token`
- **Verificación:** Revisar que no queden llamadas directas a `localStorage.getItem('token')`

### Import de GlassCard
- **Problema:** Import debe ser default, no named
- **Solución:** `import GlassCard from '...'` no `import { GlassCard } from '...'`
- **Verificación:** Verificar que `GlassCard.jsx` usa `export default`

### Hooks Dependencies
- **Problema:** Hooks customizados pueden tener dependencias faltantes
- **Solución:** Verificar imports de hooks y servicios
- **Verificación:** Build error de "Could not resolve" indica dependencia faltante

### Build Docker vs Local
- **Problema:** Build Docker puede fallar por rutas que funcionan localmente
- **Solución:** Utilizar estructura de archivos dentro del módulo cost360
- **Verificación:** Testear builds en ambos entornos

---

## 📈 Métricas de Mejora

### Antes de Refactorización:
- **Archivo principal:** 1,735 líneas
- **Responsabilidades:** 7+ en un solo componente
- **Duplicación:** ~95% entre Materiales/Equipos/MO
- **Mantenibilidad:** Difícil (monolito)
- **Testabilidad:** Difícil (acoplado)

### Después de Refactorización:
- **Archivo principal:** 167 líneas (90% reducción)
- **Responsabilidades:** 1 por componente (SRP)
- **Duplicación:** Eliminada con `CatalogTab`
- **Mantenibilidad:** Fácil (modular)
- **Testabilidad:** Posible (desacoplado)

### Archivos Creados:
- **Total:** 21 nuevos archivos modulares
- **Reutilizables:** Todos los componentes son reutilizables
- **Testeables:** Cada componente puede testearse independientemente

---

## 📝 Notas para Desarrolladores

### Patrones Utilizados:
- **Thin Orchestrator:** Página principal solo coordina
- **Composition:** Componentes se componen entre sí
- **Custom Hooks:** Lógica reutilizable en hooks
- **Service Layer:** Lógica de API en servicios
- **Prop Drilling:** Props se pasan explícitamente

### Convenciones:
- **Nomenclatura:** PascalCase para componentes, camelCase para funciones
- **Rutas:** Relativas desde ubicación del componente
- **Auth:** Siempre usar `apiClient` para llamadas autenticadas
- **Estilos:** Usar Tailwind CSS y GlassCard cuando sea posible

### Testing:
- **Unit Tests:** Testear hooks y modales independientemente
- **Integration Tests:** Testear tabs en contexto de página
- **E2E Tests:** Testear flujo completo en staging

---

## 📞 Contacto y Soporte

### Para dudas sobre la refactorización:
- **Documentación:** Este archivo y código fuente
- **Referencia:** `AdminDatabasePage.OLD.jsx` para funcionalidad original
- **Componentes:** Cada archivo tiene comentarios de propósito

### Para rollback:
- **Procedimiento:** Ver sección "Procedimiento de Rollback"
- **Backup:** `AdminDatabasePage.OLD.jsx` siempre disponible
- **Validación:** Verificar en staging antes de producción

---

## 🎯 Próximos Pasos Sugeridos

### Mejoras Futuras:
1. **Agregar tests unitarios** para hooks y modales
2. **Migrar a TypeScript** para mejor type safety
3. **Implementar lazy loading** para tabs
4. **Agregar error boundaries** para mejor error handling
5. **Optimizar bundle size** con code splitting

### Monitoreo:
1. **Verificar performance** en producción
2. **Monitorear errores** con logging
3. **Revisar bundle size** después de cambios
4. **Mantener documentación** actualizada

---

**Última actualización:** 30/08/2026  
**Estado:** ✅ Refactorización completada y documentada  
**Próxima revisión:** Después de verificación en staging
