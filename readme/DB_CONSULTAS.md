# Guía de Consultas a la Base de Datos (Cost360)

## Resumen
Esta guía documenta la estructura y el script unificado para extraer métricas y revisar la salud de la base de datos `cost360_items` (PostgreSQL). Tras las recientes auditorías, detectamos varias particularidades en los códigos COVENIN.

## El Script Unificado de Consultas

Hemos consolidado las pruebas y conteos dispersos (`check_db.py`, `local_db_test.py`, `test_query.py`, etc.) en un solo script principal llamado **`db_stats.py`** que se ubica en esta misma carpeta `readme/`.

### ¿Qué hace el script?
1. Se conecta a la base de datos maestra (`costbase.arko360.net`).
2. Lee dinámicamente las categorías disponibles en la interfaz gráfica (desde `frontend/src/modules/cost360/data/covenin_tree.json`).
3. Cuenta las partidas filtrándolas por `CovPar` (el código oficial, a diferencia de `CodPar` que es interno de LuloWin).
4. Aplica una expresión regular mejorada (`^[A-Za-z]{1,2}[\.\-]?[0-9\.]+$`) para identificar qué partidas tienen un Código COVENIN "Completo/Válido", soportando tanto los de 1 letra (`E.123456789`) como los de 2 letras (`HS.2.04.02`).
5. Agrupa todas las partidas huérfanas en "OTRAS / SIN CLASIFICAR", permitiendo que la sumatoria total coincida matemáticamente con las partidas reales de la tabla.

### Explicación de las "Otras / Sin Clasificar" con Código Completo
Durante las auditorías, se descubrió un lote de **588 partidas** que están catalogadas como "OTRAS / SIN CLASIFICAR" pero que figuran con "Código COVENIN Completo".
**¿Por qué sucede esto?**
- Son partidas cuyos códigos inician con letras que no están mapeadas en el árbol principal de la interfaz, principalmente con la letra **Z** (ej. `Z990001001 TRANSPORTE Y MANEJO DEL CEMENTO...`, `Z100300101 EXCAVACION EN PRESTAMO...`).
- Al empezar por `Z` y tener los 9 dígitos reglamentarios, el sistema reconoce que el formato COVENIN es perfectamente válido, pero como la letra `Z` (generalmente usada para fletes, transportes y complementos en la norma) no tiene su propio "botón" en el menú de especialidades del frontend, caen en el saco de "Otras".

---

## Cómo Ejecutar el Script de Reporte

Asegúrate de tener instaladas las dependencias:
```bash
pip install pandas sqlalchemy psycopg2-binary
```

Ejecuta el script unificado:
```bash
python readme/db_stats.py
```
*Esto generará automáticamente el archivo `reporte_base_datos_cost360.csv` en la carpeta raíz del proyecto.*
