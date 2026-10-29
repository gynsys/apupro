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

## Arquitectura de Conexión y Espejos Locales (Agosto 2026)

Esta sección explica a cualquier técnico o IA cómo interactuar con la base de datos de Producción de forma segura y cómo funciona el entorno de desarrollo local.

### 1. Servidor de Producción (DigitalOcean)
- **Host:** `167.172.115.154`
- **Proyecto:** Ubicado en `/root/apupro_platform/`
- **Docker Compose:** La plataforma corre nativamente en Docker. El contenedor de la base de datos se llama `apupro_platform-apupro-db-1` y expone el puerto `5440` hacia el host de producción.
- **Credenciales DB:** `postgresql://apupro_user:apupro_password@localhost:5440/apupro_db`

### 2. Uso del `ssh_runner.py` (La Llave Maestra)
Si un Agente (IA) necesita hacer consultas a Producción durante el desarrollo para verificar la integridad de los datos, **no debe intentar conectarse por puertos públicos de forma insegura**. Debe usar el script `ssh_runner.py` que se encuentra en la raíz del proyecto.
Este script tiene 3 modos:
1. **Ejecutar comandos:** `python ssh_runner.py "docker exec apupro_platform-apupro-db-1 psql -U apupro_user -d apupro_db -c 'SELECT...'"`
2. **Subir scripts (SCP):** `python ssh_runner.py --upload script_local.py /root/script_remoto.py`
3. **Descargar data (SCP):** `python ssh_runner.py --download /root/dump.sql local_dump.sql`

*Estrategia Recomendada para Consultas Complejas:* En lugar de lidiar con escapes de comillas en bash, es mejor escribir un script `.py` local, usar `--upload` para subirlo al servidor, y ejecutarlo en el backend remoto mediante `docker exec apupro_platform-apupro-backend-1 python /app/script.py`.

### 3. Espejo Local Nativo (PostgreSQL for Windows)
Debido a que correr Docker Desktop en Windows puede consumir demasiada memoria o fallar, el entorno de desarrollo local utiliza un **PostgreSQL Instalado Nativamente en Windows**.
- **Ventaja:** Velocidad instantánea de consultas, servicio ligero de fondo y 100% compatible.
- **Sincronización:** Cuando se requiere auditar datos masivos (ej: deduplicación de 14.000 materiales), se recomienda usar `ssh_runner.py` para invocar un `pg_dump` en el servidor, descargarlo y usar `pg_restore` en el Postgres nativo local.
- **Credenciales Locales:** Al instalar Postgres, siempre se debe usar la clave `apupro_password` y el puerto por defecto `5432` para que coincida con el `.env` del backend local y no romper el código.

### 4. Alternativa Ultra-Ligera (SQLite)
Si la IA solo necesita cruzar datos rápidamente (Data Science) sin encender el Backend, puede hacer un volcado de las tablas `cost360_materials` y `cost360_items` desde producción hacia un archivo `.sqlite3` local utilizando un script de Python. Esto permite hacer queries complejas (Fuzzy Matching, Levenshtein) usando librerías nativas sin retraso de red.
