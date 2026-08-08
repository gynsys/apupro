# Refactorización de la UI de APU (ApuEditorUI)

## Objetivo
Unificar la interfaz de edición y visualización de Análisis de Precios Unitarios (APU) en todo el sistema. Anteriormente, la lógica de la tabla de insumos, cálculos directos e indirectos estaba duplicada en múltiples vistas (como `BudgetAPUEditorPage` y `AIApuGeneratorPage`), lo que dificultaba el mantenimiento y generaba inconsistencias visuales.

## Cambios Principales

1. **Creación del componente compartido `ApuEditorUI`**
   - **Ruta:** `admin/src/components/ApuEditorUI.jsx`
   - **Responsabilidad:** Renderizar de forma puramente visual (o "dumb component") el listado de Materiales, Equipos y Mano de Obra, así como calcular los totales (Subtotal A, B y Precio Unitario).
   - **Funciones:** Recibe a través de `props` la información (`item`, `settings`) y expone callbacks (`onComponentChange`, `onAddBlankRow`, `onRemoveRow`, etc.) para que la vista padre maneje el estado y la persistencia de forma independiente.
   - **Mejoras:** Soporte nativo para editar los porcentajes de Administración y Utilidad de forma local mediante la prop opcional `onSettingsChange`, útil para APUs huérfanos o personalizados.

2. **Refactorización de `BudgetAPUEditorPage`**
   - **Ruta:** `admin/src/pages/admin/BudgetAPUEditorPage.jsx`
   - **Cambio:** Se eliminó toda la estructura HTML estática (tablas de insumos) y se delegó el renderizado a `<ApuEditorUI />`.
   - **Beneficios:** El autoguardado en tiempo real (al perder el foco `onBlur` o al cambiar un valor) se mantuvo intacto, pero el código de la vista se redujo significativamente (de más de 800 líneas a ~300).

3. **Refactorización de `AIApuGeneratorPage`**
   - **Ruta:** `admin/src/modules/cost360/pages/AIApuGeneratorPage.jsx`
   - **Cambio:** Sustitución de la tabla manual por `<ApuEditorUI />`.
   - **Beneficios:** Los APUs generados por IA o importados como base ahora se visualizan e interactúan exactamente igual que los APUs presupuestados.

## Persistencia de Datos
El componente UI interactúa transparentemente con el backend:
- En `BudgetAPUEditorPage`, se comunican los cambios a las tablas de presupuestos mediante `crud_budgets.py`.
- En `AIApuGeneratorPage`, al pulsar "Guardar APU", se envía un payload JSON que persiste en `CustomCostItem` mediante `crud_cost360.py`. El uso de `ApuEditorUI` no interfiere con esta estructura, ya que respeta los esquemas `materials`, `equipments`, `labors` del modelo Pydantic del backend.

## Correcciones Secundarias y Estabilización (Fase Reciente)
Durante la estabilización e iteración del uso del componente unificado, se realizaron los siguientes ajustes clave:

1. **Cálculo Dinámico del IVA (Estilo Lulo)**
   - El componente `ApuEditorUI` ahora consume `iva_percent` global proveniente de `settings`.
   - Se añadió la fila del IVA (Subtotal C * `iva_percent` / 100) y su respectiva sumatoria en el Precio Unitario (PU = Subtotal C + IVA), replicando el diseño exhaustivo de los resúmenes financieros requeridos.

2. **Unificación del Buscador (Importación / Clonación vs Dashboard)**
   - **Diseño 1:1:** Se refactorizó la interfaz de "Explorar Bases de Datos" en `AIApuGeneratorPage` para ser idéntica al buscador del Visor Maestro (`Cost360Dashboard`).
   - **Lógica de Búsqueda Asíncrona:** Se replicó el comportamiento asíncrono para que reaccione automáticamente a cambios de Categoría (Capítulo) y Base de Datos sin necesidad de enviar el formulario manualmente.
   - **Corrección de Endpoints:** Ambas vistas ahora consumen de manera consistente `cost360Service.fetchItems`, con soporte para el filtro `database_id` (el cual se encontraba ausente en el Dashboard y fue corregido).
   - **Paginación y Metadatos:** Se ajustó la cuenta de "Coincidencias" leyendo el parámetro `data.total` del backend en lugar de la longitud del array truncado por paginación (50).
   - **Nomenclatura Normada:** Se aseguró que los resultados de búsqueda prioricen la visualización del código de Norma Covenin (`CovPar`) sobre el ID interno heredado (`CodPar`).

3. **Correcciones en el Mapeo de Insumos durante Clonación**
   - **Etiqueta HISTORICO:** Se ajustó `renderOrigenTag` para ignorar la distinción de mayúsculas y ocultar limpiamente el tag "historico" introducido por la vista de clonación.
   - **Columna de Referencias:** Se inyectó explícitamente el campo `codigo` al mapear los arrays `materiales`, `equipos` y `labors`, garantizando que la columna "Ref." de la plantilla del APU se llene adecuadamente.
   - **Tabla de Mano de Obra:** Se solucionó una discrepancia de nomenclatura JSON (`manoObra` vs `mano_obra`) que impedía listar el personal al importar partidas base.
   - **Códigos Nativos:** Se eliminó la inyección forzada del prefijo `CUST-` al clonar partidas para permitir una gestión de códigos limpia por parte de los usuarios.
