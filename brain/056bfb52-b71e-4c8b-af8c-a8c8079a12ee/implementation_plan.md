# Plan de Implementación: Gestión de Categorías y Exportación CSV

## User Review Required
Por favor revisa este plan antes de que proceda a ejecutarlo. Específicamente, verifica si la exportación a CSV usando el delimitador `;` es la solución preferida para tu Excel, ya que en la región hispana este suele ser el separador por defecto para separar columnas.

## Proposed Changes

### Componente de Exportación y Mantenimiento (Frontend)

#### [MODIFY] [AdminDatabasePage.jsx](file:///c:/Users/pablo/Documents/apupro_platform/frontend/src/modules/cost360/pages/AdminDatabasePage.jsx)
1. **Exportación CSV (Corrección):**
   - Cambiar el delimitador de las celdas de `,` (coma) a `;` (punto y coma). Esto resuelve el problema donde Excel pone todo en una sola celda.
   - Cambiar el campo a exportar de `CodPar` a `CovPar` (Código Covenin).
   - Corregir el campo `Unidad`, que en la base de datos se llama `UniPar`, no `Unidad`.
2. **Gestión de Categorías:**
   - Añadir una nueva sección en la interfaz de Mantenimiento con una lista de checkboxes (switches) para cada categoría principal (E - Edificaciones, U - Urbanismo, M - Mantenimiento, R - Reparaciones, etc.).
   - Al apagar/prender un switch, se actualizará la configuración global del sitio guardando un arreglo de `hiddenCategories` en el endpoint existente `/arko/admin/config`.

### Componente de Búsqueda (Frontend)

#### [MODIFY] [Cost360SearchBar.jsx](file:///c:/Users/pablo/Documents/apupro_platform/frontend/src/modules/cost360/components/Cost360SearchBar.jsx)
1. **Filtrado Dinámico:**
   - Importar el `SiteConfigContext`.
   - Leer el arreglo `hiddenCategories` desde la configuración global.
   - Modificar la lista desplegable de "Tipo de Obra" para que omita (filtre) las categorías que estén en la lista de `hiddenCategories`, desapareciéndolas de la vista del usuario público.

## Verification Plan
1. Accederemos a Mantenimiento BD y exportaremos un CSV para comprobar que Excel lo abre en celdas separadas con el código Covenin.
2. Apagaremos una categoría (por ejemplo, `R`) y verificaremos que desaparece del menú desplegable del buscador general.
