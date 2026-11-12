# COVENIN-MINDUR 2000-2:1999 — Texto extraído

## Archivo fuente

```text
2000-2-1999-codficacion-y-mediciones-edificaciones.pdf
131 páginas
PDF escaneado, sin capa de texto
```

Título:

```text
Sector construcción. Mediciones y codificación de partidas para estudios,
proyectos y construcción. Parte 2: Edificaciones.
Suplemento de la Norma COVENIN-MINDUR 2000/II.A-92
COVENIN 2000-2:1999
```

## Método

El PDF no tenía texto seleccionable. Se rasterizó cada página a 250 DPI y se
procesó con Tesseract OCR en español:

```text
Tesseract 5
Idioma: spa
PSM: 6
DPI: 250
```

La salida se guardó como UTF-8 conservando acentos.

## Archivos generados

```text
texto_por_pagina/
  pagina_001.txt ... pagina_131.txt

texto_completo.txt
  Texto OCR completo con separadores de página.

ocr_metadata.json
  Páginas, caracteres, estado y tiempos del OCR.

INDICE.md
  Índice temático de la norma.

DOCUMENTACION_COSTBASE.md
  Borrador de documentación estructurada para Costbase.

partidas_ocr.csv
  Extracción preliminar de 841 partidas con código, descripción, unidad,
  capítulo, subcapítulo y página PDF.
  La columna requiere_revision marca 333 filas con unidad ambigua o texto
  dudoso. Requiere revisión antes de importar.

TABLAS_LEGIBLES.pdf
  Reimpresión de las 55 páginas de tablas y 5 esquemas rotados, en alta
  resolución y con el texto espejo eliminado. Es la versión más cómoda para
  leer las tablas.

tablas_mejoradas/
  TABLAS_LEGIBLES.md
    Tablas reconstruidas por columnas, página por página.
  pagina_XXX.md
    Una tabla Markdown por página.
  esquema_XXX.txt
    Texto de los esquemas que estaban girados 90°.

partidas_mejoradas.csv
  Re-OCR de 802 partidas. Mejora la separación código/unidad/descripción
  respecto a partidas_ocr.csv, pero todavía requiere revisión.
```

## Columnas de partidas_ocr.csv

```text
codigo
descripcion
unidad
capitulo
subcapitulo
pagina_pdf
fuente
requiere_revision
```

## Mapa de páginas

La numeración impresa de la norma no coincide de forma constante con la página
del PDF. Hay páginas preliminares en números romanos y secciones con distinto
desplazamiento.

Por eso, para ubicar una sección se debe usar:

```text
INDICE.md
```

y contrastar con el número que aparece en el encabezado del PDF.

Ejemplo:

```text
La tabla de partidas E333... está en la página PDF 50,
aunque el encabezado impreso dice 51.
```

## Calidad del OCR

- El texto es utilizable para búsqueda, lectura y elaboración de documentación.
- Los acentos y la ñ se conservan.
- Las tablas pueden perder columnas o separadores.
- Las páginas con esquemas rotados o dibujos pueden salir incompletas.
- Algunos símbolos se reconocen de forma imperfecta:

```text
m²  →  m?
m³  →  m*
kgf/cm² → kgfl cm?
```

Por eso, para códigos, unidades y descripciones que vayan a alimentar una base
de datos de Costbase, se debe contrastar cada partida con la página del PDF.

## Cómo usarlo en Costbase

1. Usar `DOCUMENTACION_COSTBASE.md` como marco de la norma.
2. Buscar el código o la descripción en `texto_completo.txt`.
3. Verificar la página indicada contra el PDF original.
4. Cargar la partida en Costbase con:

```text
código
descripción
unidad
capítulo
subcapítulo
página de la norma
```

## Uso recomendado

Para una importación masiva:

```text
1. Extraer primero las partidas de las páginas de tablas.
2. Revisar unidades y descripciones dudosas.
3. Generar un CSV de importación.
4. Validar contra el PDF.
```

No se debe importar el OCR directamente como catálogo definitivo sin revisión.
