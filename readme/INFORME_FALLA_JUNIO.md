# Diagnóstico de diferencias — Falla / Base Junio

## Archivos comparados

```text
D:\falla original.xlsx
D:\falla actualizado.xlsx
```

Presupuestos en CostBase:

```text
falla original
falla actualizada
falla actualiza a junio en costbase
falla actualiza a junio en costbase v2
```

## Totales

| Fuente | Total |
| :--- | ---: |
| Maprex original (PU mostrado × cantidad) | 274.457,33 |
| Maprex original (fórmula sin redondear PU) | 274.369,74 |
| CostBase falla original | 273.748,81 |
| Maprex actualizado (PU mostrado × cantidad) | 309.872,06 |
| Maprex actualizado (fórmula sin redondear PU) | 309.710,32 |
| CostBase falla actualizada | 309.026,26 |
| CostBase falla actualiza a junio | 188.487,28 |
| CostBase falla actualiza a junio v2 | 186.028,38 |

## Hallazgo 1 — Importación incompleta

En la partida **C.220 S/C — SEÑALIZACIÓN Y CONTROL DE TRÁNSITO (NOCTURNO)**, el Excel tiene 8 equipos y CostBase importó 7.

Falta:

```text
ELE025
CABLE BIPOLAR NO.10 X ML (2X10) TSJ O SIM
cantidad: 100
depreciación: 0.01
precio: 6.61
```

Impacto:

```text
6.61 × 100 × 0.01 = 6.61 por unidad de partida
6.61 × 1.12 × 1.10 × 84 = 684.06
```

Ese es prácticamente el total de la diferencia entre la importación y Maprex.

Causa:

`apu_workbook.py` descartaba filas de equipos cuando el texto contenía `NO.` en cualquier parte. La descripción `CABLE ... NO.10 ...` se interpretaba como encabezado de tabla.

Corrección aplicada:

```text
Solo se descarta la fila si la columna de código está vacía.
```

## Hallazgo 2 — Doble depreciación en la actualización

La base Junio guarda:

```text
LIM009
precio = 20.90
deprec_factor = 0.04
CosDia = 0.836   ← ya está multiplicado por 0.04
```

`sync.py` tomaba `CosDia` y lo guardaba como `precio_unitario`. Luego el cálculo del presupuesto volvía a multiplicar por la depreciación:

```text
0.836 × 0.04 = 0.03344
```

Cuando debería ser:

```text
20.90 × 0.04 = 0.836
```

Casos equivalentes:

```text
SEG004: precio 27.56, dep 0.012, CosDia 0.3307
SEG003: precio 13.21, dep 0.04,  CosDia 0.5284
COP074: precio 42973.35, dep 0.004979, CosDia 213.9643
```

Corrección aplicada:

```text
usar cat_eq["precio"] si existe;
si no, CosDia / deprec_factor.
```

La base Mayo tiene `CosDia = 0` y `precio` con el valor real; con la corrección también queda soportada.

## Hallazgo 3 — Bono de mano de obra borrado

La base Junio tiene:

```text
DTC005 Jornal 27.28 Bono 0
1-1.1  Jornal 2.26  Bono 0
4-3.3  Jornal 2.46  Bono 0
```

El presupuesto Maprex tenía bono `3.22`.

La actualización reemplazaba el bono por el valor cero de la base.

Corrección aplicada:

```text
Si la base trae Bono = 0, conservar el bono que ya tenía el presupuesto.
Solo se reemplaza si la base trae un bono mayor que cero
o si el usuario fija un bono manual.
```

## Hallazgo 4 — FCAS no se actualiza

`falla actualizada` tiene FCAS 988 %, pero `falla actualiza a junio` conserva 895 %.

La causa es que el proceso se ejecutó desde `falla original` (FCAS 895), no desde `falla actualizada` (FCAS 988).

La sincronización con una base no trae FCAS porque el FCAS es una configuración del presupuesto, no del catálogo de insumos.

Para reproducir el total de Maprex actualizado hay que:

```text
1. Partir de falla actualizada, no de falla original.
2. O ajustar el FCAS del presupuesto a 988 %.
```

## Hallazgo 5 — Redondeo

Maprex calcula el total con el precio unitario **mostrado a 2 decimales**:

```text
PU redondeado × cantidad
```

CostBase calcula con el precio unitario sin redondear y redondea el total al final.

Eso explica una diferencia adicional de aproximadamente 162 Bs. en el total de la importación, incluso después de corregir ELE025.

Hay que decidir la regla oficial:

```text
A. Redondear el PU a 2 decimales antes de multiplicar por cantidad.
B. Mantener precisión completa y redondear solo el total.
```

## Correcciones realizadas

```text
backend/app/services/budget_import/apu_workbook.py
- no descartar filas de datos cuyo texto contenga "NO."

backend/app/api/v1/endpoints/budgets/sync.py
- actualizar equipos con "precio", no con "CosDia"
- conservar bono cuando la base trae cero
```

## Prueba siguiente

```text
1. Reimportar falla actualizado.xlsx.
2. Verificar que C.220 nocturno tenga 8 equipos e incluya ELE025.
3. Comparar el total importado con 309.872,06.
4. Crear una nueva versión desde falla actualizada.
5. Ejecutar actualización con Base Junio.
6. Verificar que el total quede cerca de 309.872,06.
```

No conviene corregir a mano el presupuesto `falla actualiza a junio` actual: hay que recrearlo después de desplegar las correcciones.
