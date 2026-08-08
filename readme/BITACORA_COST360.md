# Documentación Módulo Cost360

## 1. Visión General
**Cost360** es el módulo de estimación de costos y Análisis de Precio Unitario (APU) integrado en la plataforma Arko360. Permite a los ingenieros y arquitectos acceder a una extensa base de datos de partidas constructivas (Extraída de Lulowin/Access) y calcular presupuestos precisos.

## 2. Base de Datos (PostgreSQL)

La base de datos se pobla inicialmente mediante un script ETL (Extract, Transform, Load) desarrollado en Node.js, que extrae la información de una base de datos local (Access) y la sube a nuestro contenedor PostgreSQL en producción. 

Las tablas se estructuraron de manera relacional para facilitar el análisis de precios unitarios (APU). El esquema final dentro de la base de datos `arko360` (esquema `public`) es el siguiente:

### Tablas Principales (Recursos y Partidas)
*   **`cost360_items` (Partidas):** Almacena el encabezado y resumen de cada partida constructiva.
    *   `CodPar` (PK, VARCHAR) - Código único de la partida (Ej. E.311.100.000).
    *   `Descri` (VARCHAR) - Descripción detallada.
    *   `UniPar` (VARCHAR) - Unidad de medida (m2, m3, kg, etc).
    *   `PreUni` (DOUBLE) - Precio Unitario Total.
    *   `RenPar` (DOUBLE) - Rendimiento de la partida.
*   **`cost360_materials` (Materiales):** Catálogo de materiales.
    *   `CodMat` (PK, VARCHAR)
    *   `Descri` (VARCHAR)
    *   `UniMat` (VARCHAR)
    *   `CosMat` (DOUBLE) - Costo unitario.
*   **`cost360_equipment` (Equipos):** Catálogo de maquinaria y equipos.
    *   `CodEqu` (PK, VARCHAR)
    *   `Descri` (VARCHAR)
    *   `CosDia` (DOUBLE) - Costo por día o alquiler.
*   **`cost360_labor` (Mano de Obra):** Catálogo de personal.
    *   `CodMan` (PK, VARCHAR)
    *   `Descri` (VARCHAR)
    *   `Jornal` (DOUBLE) - Costo del jornal diario.
    *   `Bono` (DOUBLE) - Bonos adicionales.

### Tablas Relacionales (El Análisis de Precio Unitario - APU)
Para establecer qué recursos componen cada partida, existen tres tablas pivote:
*   **`cost360_apu_materials`**:
    *   `CodPar` (FK -> cost360_items)
    *   `CodIns` (FK -> cost360_materials)
    *   `CanIns` (DOUBLE) - Cantidad del insumo necesaria.
    *   `Desper` (DOUBLE) - % de Desperdicio.
*   **`cost360_apu_equipment`**:
    *   `CodPar` (FK) / `CodIns` (FK) / `CanIns` (DOUBLE)
*   **`cost360_apu_labor`**:
    *   `CodPar` (FK) / `CodIns` (FK) / `CanIns` (DOUBLE)

## 3. Integración en el Frontend
*   **Tecnología**: React, Vite, Tailwind CSS.
*   **Acceso**: Se añadió un botón "Cost360" en el menú público (Landing Page) junto a ARKO3D.
*   **Diseño**: Se implementó una interfaz *Full-Screen* (Stand-alone), libre de sidebars y footers genéricos para maximizar el espacio de trabajo. Se integró el logo de Arko360 en la parte superior izquierda.
*   **Vistas**:
    *   `Cost360Dashboard.jsx`: Buscador y listado general de partidas (`/admin/cost360`).
    *   `APUViewer.jsx`: Desglose detallado del APU de una partida seleccionada (`/admin/cost360/apu/:id`).

## 4. Backend (API FastAPI)
*El backend se desarrolló bajo un patrón modular en `backend/app/cost360`.*
*   **Modelos**: SQLAlchemy mapeando las 7 tablas del ETL (con `relationships` para hacer *Eager Loading* de los APUs completos).
*   **Endpoints**:
    *   `GET /api/v1/cost360/items`: Busca y lista las partidas (soporta paginación y filtrado por nombre/código).
    *   `GET /api/v1/cost360/items/{id}`: Trae una partida y todos sus materiales, equipos y mano de obra anidados.

---

## 5. Mantenimiento y Prevención de Errores (Proceso ETL)

Para actualizar los precios de la base de datos de producción con una nueva exportación desde Lulowin/Access, es indispensable seguir el proceso estructurado que hemos implementado y documentado aquí para evitar inconsistencias:

### 5.1 Extracción de CSVs
1. **Separador de Decimales**: Los archivos exportados (como `base_mayo.mdb`) suelen traer precios con comas (ej. `2,55`). El script de migración en Python ya está parcheado para limpiar estos datos usando `str.replace(',', '.')`, pero es importante asegurarse de que el archivo CSV original utilice codificación `UTF-8` para evitar corrupción en caracteres especiales.
2. **Tablas Mínimas Requeridas**: Se deben tener al menos los siguientes 4 archivos en la carpeta `cost360/`:
   - `Export2024_ObraMano.csv` (Mano de obra, donde la columna `Salari` se mapea a `Jornal`).
   - `Export2024_ObraMate.csv` (Materiales).
   - `Export2024_ObraEqui.csv` (Equipos, mapea `CostEq` a `CosDia`).
   - `Export2024_ObraPart.csv` (Partidas).

### 5.2 Despliegue en el VPS (run_import.py)
**NUNCA** se deben intentar migrar los datos a producción conectándose a la base de datos remotamente desde el entorno local, ya que PostgreSQL tiene bloqueado el acceso externo por seguridad y por velocidad de transferencia. En su lugar, usa el script `run_import.py`:

```bash
# Estando en el directorio principal del proyecto
python run_import.py
```
**¿Qué hace este script?**
1. Instala dependencias (`pandas`) dinámicamente dentro del contenedor backend en producción.
2. Copia los scripts y los 4 archivos CSV al directorio temporal `/tmp` del servidor y luego los inyecta dentro del contenedor de Docker en `/app/cost360/`.
3. Ejecuta el archivo `backend/scripts/import_cost360.py` directamente dentro del contenedor, insertando todas las filas de forma nativa e instantánea a PostgreSQL. Si modificas un solo CSV localmente pero no actualizas los demás, ocurrirá una desincronización de precios. **Siempre deben actualizarse las 4 tablas en conjunto.**

### 5.3 Configuración Global de Inflación
Para flexibilizar la variación de precios sin tener que re-correr el ETL completo desde Lulowin cada día, hemos agregado en el backend (modelo `Budget`) tres índices dinámicos:
- `material_inflation`
- `labor_inflation`
- `equipment_inflation`

Estos parámetros se configuran desde la pestaña de Configuración (engranaje) en la hoja del Presupuesto, y su cálculo se aplica de forma matemática a nivel del frontend (`calculatePU`) multiplicando el costo base individual por el porcentaje de inflación.

---

## 5. Roadmap a Futuro (Cost360 V2)

### Corto Plazo (1-2 Semanas)
- [ ] **Exportación a Excel/PDF:** Permitir que los ingenieros descarguen el APU de una partida formateado listo para presentarse en licitaciones.
- [x] **Actualización Masiva de Precios:** (Desde Panel Admin) Opción para aplicar factor de inflación a materiales y mano de obra sin necesidad de re-correr el ETL completo. (Completado: `material_inflation`, `labor_inflation`, `equipment_inflation`).
- [ ] **Caché en Redis:** Cachear las respuestas de la tabla de Partidas para acelerar la carga del dashboard cuando hay múltiples usuarios concurrentes.

### Mediano Plazo (1 Mes)
- [x] **Armado de Presupuestos:** Funcionalidad para que el usuario pueda "Añadir partida al carrito/presupuesto", indicando metrajes (cantidades de obra), generando un Presupuesto Total. (Implementado a través del sistema global de Presupuestos y la unificación de Plantillas).
- [x] **Modificación "On-The-Fly" (Modo Simulador):** Permitir al usuario duplicar una partida y alterar el rendimiento o los costos de los materiales temporalmente para analizar escenarios. (Completado: Posibilidad de clonar y guardar como base personalizada desde `AIApuGeneratorPage` y editar con `ApuEditorUI`).
- [ ] **Integración con ARKO3D:** Conectar los cómputos métricos obtenidos del modelo 3D (ej. volumen de concreto de la losa) y enviarlos directamente al módulo Cost360 para obtener el presupuesto estructural automático.

### Largo Plazo (3+ Meses)
- [ ] **Análisis de Dispersión de Precios:** IA predictiva que analice las fluctuaciones históricas de precios de materiales (acero, cemento) y genere alertas o pronósticos.
- [ ] **Multitenancy Completo:** Cada tenant (empresa de construcción) puede subir su propia base de datos Lulowin personalizada para Cost360, aislada de la pública.

---

## 6. Auditoría y Depuración de Base de Datos (Julio 2026)

Durante el proceso de sincronización de datos con los archivos Excel (Mano de Obra, Equipos y Materiales), se realizaron auditorías de integridad de datos:

### 6.1. Problema con el Jornal (Mano de Obra)
Se detectó que varios registros de la tabla de Mano de Obra (Labor) tenían valores en cero (0.00) tanto en *Jornal* como en *Bono*.
- **Diagnóstico:** Los datos base del servidor importados de LuloWin/Maprex contenían códigos antiguos (824 registros) que no existían en el Excel oficial del cliente (785 registros). 
- **Solución:** Se corrió un script para limpiar la base de datos eliminando de forma segura los 39 códigos obsoletos (huérfanos) no utilizados, dejando la BD en perfecta sincronía (785 registros válidos con Jornal y Bono actualizados).

### 6.2. Auditoría de Equipos y Materiales
- **Equipos:** Se cruzó el Excel contra la BD. Habían 13 equipos excedentes en BD sin precio (.00). Se comprobó que no tenían uso en ningún APU y fueron depurados.
- **Materiales:** Se validaron 12.106 materiales con 100% de precisión en precios. Se encontraron 53 materiales excedentes en BD. 34 se conservaron por estar anclados a la receta de las APUs, y 19 se eliminaron.

---

## 7. Notas Conocidas / Problemas Actuales (Julio 2026)

### 7.1. Problema Persistente de Redirecciones (Caché React/Vite)
- **Descripción:** Actualmente, al iniciar sesión desde /app/login o al presionar el botón *Cost360* de la Landing Page, algunos navegadores siguen redirigiendo erróneamente hacia la ruta obsoleta /cost360 (Base Maestra) en lugar de llevar al usuario a la vista de /budgets (Presupuestos).
- **Causa:** Agresivo caché local del frontend en los navegadores cliente y en el Service Worker. Aunque el código fuente en Login.jsx y Navbar.jsx ya apunta a /budgets y /app/login respectivamente, el caché interfiere con el flujo.
- **Acuerdo (DO NOT MODIFY):** Se ha decidido **NO volver a modificar** la lógica de enrutamiento ni los componentes de React por este problema. Simplemente se mantendrá documentado. El usuario final debe forzar una recarga profunda (Ctrl+F5) si se le presenta este problema.

### 7.2. Problemas con los Botones Pegajosos (Sticky Buttons)
- **Descripción:** Se ha documentado la presencia de comportamientos anómalos (glitches visuales) con botones que poseen posicionamiento sticky o ixed a lo largo de las vistas de edición y el Dashboard. Estos botones tienden a solaparse o no fijarse correctamente al hacer scroll bajo ciertas condiciones de layout.
