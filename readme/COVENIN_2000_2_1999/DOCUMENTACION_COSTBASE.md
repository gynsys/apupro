# Documentación base para Costbase
## COVENIN-MINDUR 2000-2:1999

### 1. Identificación

```text
Norma:      COVENIN-MINDUR 2000-2:1999
Título:     Sector construcción. Mediciones y codificación de partidas para
            estudios, proyectos y construcción. Parte 2: Edificaciones.
Suplemento: COVENIN-MINDUR 2000/II.A-92
Carácter:   Provisional
Fuente:     2000-2-1999-codficacion-y-mediciones-edificaciones.pdf
Páginas:    131
```

Esta norma establece los criterios para:

- determinar los cómputos métricos,
- codificar las partidas,
- describir las partidas,
- medir las partidas,

para el presupuesto de proyecto y construcción de edificaciones nuevas.

### 2. Alcance

La norma se aplica a edificaciones nuevas y a obras temporales o provisionales.

Este documento corresponde a la **Parte II.A2**:

```text
Parte II.A1 → I + 9 dígitos
Parte II.A2 → E + 9 dígitos   ← esta norma
Parte II.A3 → M + 9 dígitos
Parte II.B1 → R + 9 dígitos
Parte II.B2 → P + 9 dígitos
```

La Parte II.A2 cubre edificaciones nuevas con un área de construcción entre
**1.000 m² y 10.000 m²**.

Para áreas mayores se usa la Parte II.A1 (`I`); para áreas menores, la Parte
II.A3 (`M`).

### 3. Estructura del código

El código de una partida tiene:

```text
E + 9 dígitos
EXXXXXXXXX
```

Interpretación:

```text
E     → Parte II.A2, edificaciones entre 1.000 y 10.000 m²
1er dígito  → Capítulo
2do dígito  → Subcapítulo
3er dígito  → Subcapítulo cuando aplica
6 dígitos restantes → tipo de elemento, material, dimensión, acabado,
                      forma de ejecución, actividad u otro parámetro
```

Ejemplo tomado de la norma:

```text
E333308125
m²
LOSA MACIZA, e = 8 cm CON CONCRETO Fc 250 kgf/cm² A LOS 28 DÍAS,
ACABADO CORRIENTE.
```

### 4. Reglas de codificación

Toda partida queda definida por:

```text
1. Código
2. Descripción completa
3. Unidad de medida
```

La omisión o modificación de cualquiera de estos tres elementos invalida la
partida para efectos de la norma.

No está permitido:

- usar “suma global” (S.G.) como unidad de medida;
- establecer equivalencias entre partidas;
- fraccionar partidas;
- combinar partidas o fracciones para crear nuevas partidas.

Se pueden crear partidas no incluidas en la norma si:

- se agrupan lógicamente las variables,
- se siguen los esquemas de codificación,
- se definen detalladamente en las especificaciones particulares,
- el organismo contratante las aprueba.

### 5. Criterios de descripción

- No se deben indicar marcas ni modelos en la descripción de la partida.
- Se indican las características específicas.
- Las marcas y modelos se definen en el análisis de precios unitarios.
- La inspección debe verificar que se coloque en obra la marca o modelo aprobado.
- Salvo indicación contraria, la partida incluye elaboración completa y puesta
  en obra.
- No se repiten términos como “construcción”, “elaboración”, “fabricación”,
  salvo que la partida contemple etapas separadas.

### 6. Criterios de medición

#### 6.1 Unidad y redondeo

- Se usa el sistema MKS: metro, kilogramo-fuerza, segundo.
- Se prefiere el punto como separador decimal.
- En general se usan **dos cifras decimales redondeadas**.
- En estructuras metálicas se conservan las dimensiones en milímetros para los
  cálculos intermedios y se redondea al final.

#### 6.2 Áreas

- Se mide el área en desarrollo, es decir, el verdadero tamaño.
- No se mide en proyección horizontal.
- Se descuentan vacíos y áreas descontables, cualquiera sea su tamaño:
  columnas, muros, ventanas, luminarias, etc.
- Las áreas de remates de revestimientos se incluyen en la partida
  correspondiente y se consideran en el rendimiento.

#### 6.3 Intersecciones

Todo elemento que se intercepte —nodos, paredes, etc.— se cuenta **una sola vez**.

#### 6.4 Desperdicios

No se miden en la partida:

- desperdicio,
- esponjamiento,
- densificación.

Estos conceptos se consideran en el análisis de precios unitarios cuando
apliquen.

#### 6.5 Transporte

- El transporte se mide una sola vez, de origen a destino.
- Las partidas de transporte son excluyentes entre sí.
- Una misma operación de transporte no puede pagarse por varias partidas.
- El transporte de escombros y agregados se mide en estado suelto, sobre camión.
- La unidad habitual es `m³·km` o `m²·km` según el material.

#### 6.6 Partidas ejecutadas

Para medir en obra, la partida debe estar completamente ejecutada y cumplir:

- alcance,
- pruebas,
- garantías.

Casos especiales:

- armaduras de refuerzo: se consideran ejecutadas al vaciar el concreto;
- encofrados: se consideran ejecutados al desencofrar;
- instalaciones sanitarias, eléctricas y electromecánicas: se miden una vez
  ejecutadas y probadas.

### 7. Capítulos incluidos en este suplemento

```text
E1  Obras preliminares
E3  Estructuras
E4  Obras arquitectónicas
E6  Instalaciones sanitarias y especiales
E9  Transportes
```

El suplemento no desarrolla todos los capítulos de la norma original. Para
partidas de vialidad o hidráulica se remite a las normas COVENIN 2000-91.

### 8. Modelo de datos para Costbase

Campos mínimos recomendados:

```text
codigo              TEXT
descripcion         TEXT
unidad              TEXT
capitulo            TEXT
subcapitulo         TEXT
pagina_pdf          INTEGER
fuente              TEXT
vigencia            TEXT
observaciones       TEXT
```

Ejemplo:

```csv
codigo,descripcion,unidad,capitulo,subcapitulo,pagina_pdf,fuente
E333308125,"LOSA MACIZA, e = 8 cm CON CONCRETO Fc 250 kgf/cm² A LOS 28 DÍAS, ACABADO CORRIENTE.",m2,E3,E33,50,COVENIN 2000-2:1999
```

### 9. Flujo de carga recomendado

```text
1. Extraer las partidas de las páginas de tablas.
2. Normalizar unidades:
   m?  → m²
   m*  → m³
   kgfl cm? → kgf/cm²
3. Revisar descripciones que ocupen varias líneas.
4. Validar cada código contra el PDF.
5. Importar en Costbase como catálogo de partidas.
6. Asociar el APU y los insumos.
```

### 10. Limitaciones de esta transcripción

Este documento es una **base de trabajo**, no una transcripción oficial.

- El PDF es escaneado.
- El OCR puede confundir símbolos, tablas y esquemas.
- Las páginas rotadas pueden estar incompletas.
- Las unidades y códigos deben validarse contra el PDF original.

Para una importación definitiva, contrastar cada partida con la página indicada
en `INDICE.md` y con `texto_por_pagina/`.
