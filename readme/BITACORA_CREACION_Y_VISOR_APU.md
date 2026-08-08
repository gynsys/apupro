# Bitácora de Desarrollo: Creación de APUs y Base de Datos Personalizada

**Fecha:** 5 de Agosto de 2026
**Módulo:** Cost360 (Visor de Bases de Datos y Generador de APU)

## 1. Contexto y Problema
El sistema contaba con un visor de partidas (la Base Maestra original) y un módulo de "Generación de APU con IA". 
Sin embargo, se identificaron varios problemas prácticos y de experiencia de usuario:
1. **Orfandad de los APUs creados**: Los APUs generados o adaptados no se guardaban en la base de datos maestra (por protección de integridad) y se iban a la tabla `cost360_custom_items`, pero el visor no tenía cómo mostrarlos. Es decir, los usuarios creaban partidas pero no podían visualizarlas luego.
2. **Limitación de IA exclusiva**: En la realidad, muchos APUs no se generan con IA, sino que se crean desde cero (como un cascarón vacío) o se construyen clonando y modificando una partida histórica existente. La pantalla "Generar APU con IA" era restrictiva.
3. **Visor Incompleto**: El visor de base de datos no mostraba el Precio Unitario (P.U.) en la tabla principal, y la unidad de medida no estaba dispuesta ergonómicamente para una rápida lectura.

## 2. Soluciones Implementadas

### A. Refactorización de la Creación de APUs (`AIApuGeneratorPage.jsx`)
Se convirtió la pantalla en un verdadero **"Editor Multi-modo"**. Se renombró el botón de la barra lateral a "Crear APU" (AppLayout.jsx) y se establecieron 3 pestañas dinámicas (Creation Mode Tabs):
- **Desde Cero (Cascarón):** Inicializa el estado del editor con valores por defecto y un código `CUST-XXXX`. Habilita al usuario para agregar a mano todos los materiales, equipos y mano de obra.
- **Importar Base (Clonación):** Se integró un buscador directo de la base maestra. Al seleccionar una partida, el sistema hace un `fetch` completo (`fetchApuDetails`) y mapea los datos en el editor local. Esto permite usar una partida como "plantilla", alterarle rendimientos o cambiarle un material y guardarla como nueva.
- **Inteligencia Artificial:** Se conservó la funcionalidad del generador LLM Router bajo esta pestaña.

### B. "Base Personalizada" y Motor de Consulta
Para resolver el problema de las partidas huérfanas:
- **Seed en Inicialización:** Se modificó el endpoint de `/cost360/databases/initialize` en `cost360.py`. Al arrancar, si la base `personalizada` no existe, se inserta una automáticamente con `is_master=False`. Esta será el hogar para los APUs manuales.
- **Modificación del CRUD (`crud_cost360.py`):** El método `get_items_paginated` ahora acepta un `database_id`. 
  - Si `database_id != "personalizada"`, consulta normalmente `CostItem` (Base Maestra).
  - Si `database_id == "personalizada"`, redirige la query hacia la tabla `CustomCostItem`. Además, deserializa el campo `apu_data` (JSON) al vuelo para mapearlo en la estructura `CostItemBase` requerida por el front-end (calculando subtotales, desperdicios, jornadas y empaquetándolo como un registro normal).

### C. Ajustes Visuales en el Visor (`Cost360Dashboard.jsx`)
- En cada fila de partida, se insertó la columna `P.U` formateada en divisa local (`es-VE`) basada en `item.PreUni`.
- Se posicionó la viñeta de unidad (`und`, `m2`) a la izquierda del `P.U.`, dándole un aspecto analítico y ordenado.

## 3. Retos Técnicos Resueltos
- **Compatibilidad de Modelos:** `CostItem` y `CustomCostItem` difieren drásticamente. Mientras `CostItem` está normalizada (tablas `materials`, `labors`, `equipments`), `CustomCostItem` usa JSON en el campo `apu_data`. La solución fue extraer el P.U. sumando los arrays de `apu_data` en memoria usando python dentro del `crud_cost360.py`, asegurando compatibilidad con los schemas Pydantic de respuesta.
- **Router `/items/{item_code}/apu`**: Para que el usuario, al hacer clic en un APU personalizado desde el Visor, pudiera ver el detalle y editarlo, se creó una trampa (hook) en el router: Si `item_code` empieza por `CUST-`, lee de `CustomCostItem` e intercepta el flujo.

## 4. Estandarización y Correcciones Visuales (Iteración Actual)

Tras la implementación del flujo base, se detectaron discrepancias entre el buscador general (Visor) y el buscador interno de la vista "Importar Base" (Clonación). Se resolvieron aplicando las siguientes unificaciones:

### A. Unificación del Motor de Búsqueda
- **Diseño Idéntico:** El buscador de Clonación ahora clona exactamente el layout UI del Visor, incluyendo el filtro desplegable de "Categoría" (Capítulo).
- **Asincronía:** Al cambiar de categoría o base de datos en la clonación, la tabla se actualiza de forma reactiva (asíncrona) al instante, igualando la experiencia rápida del Visor.
- **Métricas Reales:** Se ajustó la lectura de las coincidencias de búsqueda. Anteriormente el clonador mostraba solo los registros de la página en curso (ej. "50 coincidencias"), ahora lee la propiedad global `data.total` para mostrar el conteo absoluto (ej. "13.608 coincidencias") incluso cuando los campos están vacíos.
- **Nomenclatura (Norma Covenin):** Se ajustó el mapeo visual de la tabla de clonación para priorizar el código oficial `CovPar` (ej. C.138) sobre el código ID del sistema (`CodPar`), homogeneizándose con el Visor.

### B. Mapeo de Plantillas e Insumos
- **Prefijos Transparentes:** Se removió la inyección forzada del prefijo `CUST-` al clonar partidas; el APU ahora se importa reteniendo su código original para mayor libertad de edición.
- **Correcciones de Referencias:** Al importar un APU a la plantilla `ApuEditorUI`, se solventó un bug donde las columnas "Ref." quedaban vacías. Se forzó el mapeo bidireccional del campo `codigo` (ej. `id: m.codigo, codigo: m.codigo`) en todos los arrays de insumos.
- **Mano de Obra y Tags:** Se rectificó un error de sintaxis en el JSON de respuesta de la API (`manoObra` -> `mano_obra`) que impedía listar al personal. Adicionalmente, se configuró el badge "HISTÓRICO" para ser invisible (case-insensitive) y no causar ruido visual en la plantilla.

---
*Documentación actualizada. Proyecto: Arko360_Platform.*
