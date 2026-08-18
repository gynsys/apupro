# ALERTA: Confusión entre `CodPar` y `CovPar`

> [!WARNING]
> **Peligro de pérdida de tiempo por mala interpretación de filtros.**
> Hemos perdido tiempo valioso asumiendo que los filtros de la interfaz y la estructura de la base de datos se comportan de forma idéntica respecto al código de la partida. **No es así.**

## El Problema

Al intentar contar las partidas de una categoría específica (ej. Urbanismo `U`), hay una discrepancia enorme entre mirar la base de datos directamente y lo que dice la interfaz.

Por ejemplo, al migrar las partidas de Urbanismo:
- Un `SELECT count(*) FROM cost360_items WHERE "CodPar" LIKE 'U%'` devolvía **324** partidas.
- La interfaz (y su respectivo contador total) mostraba **494** partidas bajo la selección `U - URBANISMO`.

Esto generó la falsa impresión de que había colisiones, duplicados invisibles, o errores en la migración.

## La Verdad Oculta

En la tabla `cost360_items`, **existen dos columnas diferentes para el código**:

1. **`CodPar` (Código de Partida Interno):** Es el código principal (Primary Key) que usa el sistema para identificar la partida y vincular insumos. Muchas veces este código es un invento interno o viene de bases de datos viejas no estandarizadas (ej. `ARB021`, `CCA032`, `LAI566`).
2. **`CovPar` (Código COVENIN):** Es el código normativo oficial que clasifica a qué capítulo o subcapítulo estándar pertenece la partida.

### ¿Cómo funciona la interfaz?

El **Buscador y los Filtros de la Interfaz (Cost360SearchBar)** **NO** filtran por `CodPar` ni por `Categoria`.
Cuando el usuario selecciona un capítulo en el árbol (ej. `U - URBANISMO`), el frontend envía la petición al backend con el parámetro `covenin_search="U"`.

El backend entonces hace:
```python
query = query.filter(CostItem.CovPar.startswith(covenin))
```

> [!IMPORTANT]
> **La interfaz filtra estrictamente por `CovPar` (Código COVENIN), no por `CodPar`.**

Esas 170 partidas de diferencia (`494` vs `324`) eran partidas con `CodPar` raros (ej. `LAI566`), pero a las cuales **se les había asignado un `CovPar` normativo que empezaba por `U`**. Por lo tanto, la interfaz las agrupaba correctamente bajo Urbanismo.

## Reglas de Oro para Futuras Migraciones

1. **Nunca** uses `CodPar LIKE 'Letra%'` para saber cuántas partidas hay de una familia Covenin. Usa **`CovPar LIKE 'Letra%'`**.
2. **Para verificar colisiones**, sí debes usar `CodPar`, ya que es el identificador único (Primary Key) por el cual chocarían las bases de datos al hacer el `INSERT`.
3. Al importar nuevas partidas desde Excel, asegúrate de mapear o clonar el código en ambas columnas (`CodPar` = `CovPar`) si se trata de una base de datos estandarizada Covenin.
