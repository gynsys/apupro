# Guía de Consultas a la Base de Datos (Cost360) y Mantenimiento

## Resumen
Esta guía documenta la estructura de la base de datos `cost360_items` (PostgreSQL), el script unificado para extraer métricas y revisar la salud de los datos, así como los nuevos **"Superpoderes" de Administrador** para el mantenimiento en vivo de la plataforma.

## El Script Unificado de Consultas

Hemos consolidado las pruebas y conteos dispersos en un solo script principal llamado **`db_stats.py`** que se ubica en esta misma carpeta `readme/`. Adicionalmente, creamos un script de extracción y validación de partidas (ej. `extract_codes.py` usado para Urbanismo) que se encuentra en los registros temporales.

### ¿Qué hace `db_stats.py`?
1. Se conecta a la base de datos maestra (`costbase.arko360.net` o localmente si se configura el `.env`).
2. Lee dinámicamente las categorías disponibles en la interfaz gráfica.
3. Cuenta las partidas filtrándolas por `CovPar` (el código oficial).
4. Aplica una expresión regular mejorada (`^[A-Za-z]{1,2}[\.\-]?[0-9\.]+$`) para identificar qué partidas tienen un Código COVENIN "Completo/Válido", soportando los de 1 letra (`E.123456789`) y de 2 letras (`HS.2.04.02`).
5. Agrupa todas las partidas huérfanas en "OTRAS / SIN CLASIFICAR", permitiendo que la sumatoria total coincida matemáticamente con las partidas reales de la tabla.

### Actualización sobre las partidas "Z" y "U" (Urbanismo/Telecomunicaciones)
Durante auditorías iniciales, se detectó que existían 26 partidas con el prefijo `Z` que generaban ruido. Dichas partidas fueron **eliminadas permanentemente** de la base maestra.
Posteriormente (Agosto 2026), se realizó una limpieza exhaustiva de las partidas de Urbanismo (prefijo `U`). Se cruzaron 614 registros de origen (494 únicos) contra producción y se **eliminaron en cascada 26 registros inválidos** que empezaban por "U" pero no cumplían el formato oficial COVENIN de 9 dígitos. Tras esta limpieza, la base de datos de producción quedó con exactamente 494 partidas de Urbanismo válidas, perfectamente alineadas con el Excel maestro.

---

## Superpoderes de Administrador (Mantenimiento BD)

Se ha creado un panel de control exclusivo para el administrador del sistema que permite depurar y actualizar la base de datos maestra en vivo sin requerir acceso directo a PostgreSQL.

### 1. Acceso Exclusivo
Solo el usuario `admin@arko360.net` puede ver el botón **"Mantenimiento BD"** en la barra lateral. El Backend verifica un JWT token especial y el rol del usuario antes de autorizar cualquier cambio.

### 2. Funciones de la Interfaz
- **Filtro Estricto:** Un switch "Solo Partidas Codificadas" permite ocultar miles de registros temporales/vacíos (descripciones LuloWin) y mostrar únicamente partidas con formato COVENIN válido.
- **Edición en Caliente:** Permite modificar la Descripción, la Unidad (UND) y el Rendimiento de una partida maestra directamente.
- **Eliminación en Cascada:** Al eliminar una partida maestra, el sistema borra automáticamente en cascada sus relaciones (insumos, materiales, equipos y mano de obra) asociados a esa APU Maestra. Esto *no afecta* a las partidas clonadas por otros usuarios en sus bases de datos personalizadas (`custom_cost360_items`).

### 3. Actualización de Insumos Maestros
Navegando a las pestañas de Materiales, Equipos y Mano de Obra dentro del Mantenimiento BD, el Admin puede modificar el **Costo Unitario ($)**, **Costo Diario ($)** o **Jornal ($)** de los insumos. Estos precios actualizan la tabla maestra y se usarán como referencia para futuros presupuestos.

---

## Cómo Ejecutar el Script de Reporte

Asegúrate de tener instaladas las dependencias y la base de datos corriendo localmente (Docker):
```bash
pip install pandas sqlalchemy psycopg2-binary
```

Exporta la variable de entorno si trabajas local:
```bash
# En PowerShell
$env:DATABASE_URL="postgresql://apupro_user:apupro_password@localhost:5440/apupro_db"
```

Ejecuta el script unificado:
```bash
python readme/db_stats.py
```
*Esto generará automáticamente el archivo `reporte_base_datos_cost360.csv` en la carpeta raíz del proyecto.*
