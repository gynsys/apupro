# Bitácora de Cambios: Interfaz de Presupuestos y Exportación (Agosto 2026)

Este documento registra los ajustes realizados sobre la hoja de edición de presupuestos (`BudgetWorksheetPage`), el layout de impresión y la generación del archivo de Excel para los APUs.

## 1. Exportación a Excel (`export_utils.py`)
Se detectaron y solucionaron diversos bugs en la generación del archivo Excel de los Análisis de Precios Unitarios (APU).
- **Fórmulas dinámicas:** La fórmula de Costo Unitario Total (`=REDONDEAR(H{mat}+H{eq}+H{mo};2)`) estaba "hardcodeada" apuntando a celdas fijas (ej. H27), lo cual rompía el cálculo matemático si un APU tenía una cantidad variable de insumos. Se modificó el algoritmo para calcular dinámicamente los índices (`start_row`, `mat_end`, `eq_end`, `mo_end`) asegurando que los subtotales siempre coincidan sin importar cuántas filas tenga el análisis.
- **Ancho de columnas:** La columna B ("Código") se ajustó dinámicamente (`ws.column_dimensions['B'].width = 12`) para evitar truncamiento del texto.
- **Códigos Covenin:** Se corrigió la lógica para que la celda `C9` (y otras ubicaciones de metadata) inyectara dinámicamente el identificador universal (`codigo`, `cov_par` o `cod_par`) en lugar de mostrar textos fijos como "C/S/C".

## 2. Configuración e Impresión Frontend
- **PrintAPULayout:** 
  - Se mapearon dinámicamente las variables provenientes del modal de configuración (Color, Obra, Contratante, Mostrar Porcentajes).
  - Los campos "Obra" y "Contratante" quedan en blanco si no se definen en el modal o base de datos.
  - Se eliminó la impresión innecesaria de la dirección en el pie de página.
- **CSS Global (`index.css`):** Se introdujo la regla `@page { margin: 0 }` para suprimir las cabeceras/pies de página (URLs y Fechas) que el navegador web genera automáticamente por defecto al usar `window.print()`.

## 3. Hoja de Presupuesto (`BudgetWorksheetPage.jsx`)
- **Contadores y Numeración:** 
  - Se añadió el badge superior **"Total Partidas: X"**.
  - Se resolvió un bug crítico con la numeración secuencial interactiva generada durante el renderizado de la lista `DragDropContext` (closure de variables de ciclo). Al asignar `const currentNumber = itemNumber`, la numeración se mantiene coherente incluso al reordenar o filtrar las filas.
- **Mejoras Visuales (Hover y Compactado):** 
  - Se compactaron los paddings en la tabla de totales inferiores (Subtotal, IVA, Total) logrando simetría (4px).
  - Se estandarizó el color del efecto "hover" en las filas de las partidas. Tras probar varios esquemas de "contenedores separados", se optó por una solución visual plana (fondo `#FEF3C7` en `<tr>`), más legible, estable a nivel CSS, y con alto contraste.
- **Acciones Inline Integradas (Imprimir y Exportar):** 
  - La columna de **Acciones** se modificó para ser siempre visible, en lugar de aparecer únicamente en hover.
  - Se incorporaron y habilitaron dos nuevos íconos en cada partida del presupuesto: **Impresora** y **Excel**.
  - **Impresión Directa:** Se conectó el ícono de impresión con los componentes `PrintAPUModal` y `PrintAPULayout`, permitiendo que el usuario envíe cualquier partida a la vista de impresión sin necesidad de navegar al Editor de APU.
  - **Exportación Directa:** Se refactorizó e integró `<ExportApuExcelButton>` (con la adición del parámetro `iconSize`) para permitir la descarga del `.xlsx` del APU directamente desde el listado.
