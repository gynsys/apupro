# Tareas: Gestión de Categorías y CSV

- [/] Modificar exportación CSV en `AdminDatabasePage.jsx`
  - Cambiar delimitador a `;`
  - Utilizar el campo `CovPar`
  - Utilizar el campo `UniPar` en lugar de `Unidad`
- [ ] Implementar UI de checkboxes para Categorías en `AdminDatabasePage.jsx`
  - Añadir sección en la configuración global para renderizar categorías
  - Vincular al API `/arko/admin/config` (guardar en `hiddenCategories`)
- [ ] Filtrar categorías en `Cost360SearchBar.jsx`
  - Importar `SiteConfigContext`
  - Ocultar categorías que existan en `config.hiddenCategories`
- [ ] Verificación manual
