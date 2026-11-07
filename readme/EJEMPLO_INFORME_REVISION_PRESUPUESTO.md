# INFORME DE REVISIÓN TÉCNICA DE PRESUPUESTO

> **Ejemplo ilustrativo con datos ficticios.**  
> No corresponde a un proyecto real ni constituye una opinión legal.

---

## 1. Datos generales

| Campo | Detalle |
|---|---|
| Informe | RT-2026-018 |
| Proyecto | Rehabilitación de Edificio Administrativo |
| Cliente | Constructora Ejemplo, C.A. |
| Presupuesto revisado | Presupuesto de Obra — Versión 03 |
| Fecha del presupuesto | 28/10/2026 |
| Fecha de revisión | 06/11/2026 |
| Revisor | Ing. [Nombre], CIV [Número] |
| Alcance | Revisión técnica de partidas, APUs, precios y coherencia aritmética |
| Moneda | USD |
| Carácter | Confidencial |

---

## 2. Resumen ejecutivo

Se revisó el presupuesto **Presupuesto de Obra — Versión 03**, compuesto por:

- 8 capítulos.
- 120 partidas.
- 96 APUs.
- Monto total declarado: **USD 248.750,00**.

La revisión se realizó sobre el 100 % de las partidas y APUs suministrados.

### Resultado general

| Indicador | Resultado |
|---|---:|
| Partidas revisadas | 120 |
| APUs revisados | 96 |
| APUs codificados | 82 |
| APUs sin código COVENIN | 14 |
| Hallazgos críticos | 2 |
| Hallazgos altos | 5 |
| Hallazgos medios | 7 |
| Hallazgos informativos | 4 |
| Impacto económico estimado | **USD 8.420,50** |

### Conclusión preliminar

El presupuesto presenta:

- diferencias no justificadas documentalmente en componentes de APUs codificados,
- APUs sin codificación COVENIN,
- diferencias aritméticas,
- una partida duplicada,
- precios y rendimientos que requieren aclaración.

El impacto económico estimado representa aproximadamente **3,39 %** del monto declarado.

No se emite opinión sobre aspectos fuera del alcance de esta revisión.

---

## 3. Objetivo

Verificar que el presupuesto revisado sea:

- técnicamente consistente,
- aritméticamente correcto,
- trazable respecto a la base de precios,
- coherente con los APUs codificados,
- suficientemente documentado,
- razonable en precios, cantidades y rendimientos.

---

## 4. Alcance

La revisión incluyó:

1. Estructura del presupuesto.
2. Capítulos y partidas.
3. Cantidades.
4. Precios unitarios.
5. APUs de materiales, equipos y mano de obra.
6. Rendimientos.
7. Desperdicios.
8. Depreciaciones.
9. Coherencia aritmética.
10. Partidas sin codificación COVENIN.
11. Comparación contra la base maestra de Costbase.

No incluyó:

- verificación física en obra,
- medición de cantidades en campo,
- validación de precios de proveedores,
- análisis legal del contrato,
- revisión de programación de obra,
- auditoría financiera o contable.

---

## 5. Criterios de revisión

Se aplicaron los siguientes criterios:

```text
Precio unitario = materiales + equipos + mano de obra
                 + FCAS + administración + utilidad

Total partida = precio unitario × cantidad

APU codificado = estructura equivalente al APU maestro
Rendimiento > 0
Depreciación entre 0 y 1
Desperdicio dentro del rango permitido
Cantidades positivas
Código único por partida
```

Tolerancias aplicadas:

| Concepto | Tolerancia |
|---|---:|
| Precio unitario vs maestro | ± 3 % |
| Cantidad de material vs maestro | ± 5 % |
| Cantidad de mano de obra vs maestro | ± 5 % |
| Rendimiento vs maestro | ± 5 % |
| Depreciación | 0 a 1 |
| Diferencia aritmética | ± USD 1,00 |

---

## 6. Documentación recibida

| Documento | Formato | Estado |
|---|---|---|
| Presupuesto de Obra — Versión 03 | XLSX | Recibido |
| APUs del presupuesto | XLSX | Recibido |
| Cómputos métricos | XLSX | Recibido |
| Base maestra de APUs | Sistema Costbase | Consultada |
| Especificaciones técnicas | PDF | Recibido |
| Planos | PDF | Recibido |

---

## 7. Resultados generales

### 7.1 Distribución por capítulo

| Capítulo | Partidas | Monto USD | Hallazgos |
|---|---:|---:|---:|
| 01 Obras preliminares | 8 | 18.420,00 | 1 |
| 02 Demoliciones | 12 | 32.150,00 | 3 |
| 03 Movimiento de tierras | 10 | 41.800,00 | 2 |
| 04 Estructuras | 22 | 78.300,00 | 5 |
| 05 Albañilería | 18 | 39.500,00 | 3 |
| 06 Instalaciones | 20 | 24.980,00 | 2 |
| 07 Acabados | 22 | 11.200,00 | 1 |
| 08 Limpieza y cierre | 8 | 2.400,00 | 1 |
| **Total** | **120** | **248.750,00** | **18** |

### 7.2 Hallazgos por severidad

| Severidad | Cantidad |
|---|---:|
| Crítica | 2 |
| Alta | 5 |
| Media | 7 |
| Informativa | 4 |

---

## 8. Hallazgos

### H-01 — Cantidad de mano de obra alterada en APU codificado

| Campo | Detalle |
|---|---|
| Severidad | Alta |
| Partida | 04.07 — Muro de bloques |
| Código | M132421000 |
| Componente | 1-1.1 — Obrero de 1ra |
| Criterio | El APU codificado debe mantener la estructura del APU maestro |
| Condición | El APU revisado registra 4,00 trabajadores; el maestro registra 2,00 |
| Diferencia | +100 % |
| Causa | No se encontró justificación técnica documental |
| Efecto estimado | USD 1.280,00 |
| Evidencia | Archivo APUs, hoja APU-04, fila 18; base maestra M132421000 |
| Respuesta del revisado | Pendiente |

**Recomendación:** solicitar sustento del cambio de cuadrilla o ajustar el APU al maestro.

---

### H-02 — Cantidad de material alterada

| Campo | Detalle |
|---|---|
| Severidad | Alta |
| Partida | 05.03 — Pared de bloque |
| Código | 05.03 |
| Componente | Cemento gris |
| Criterio | La cantidad de material debe corresponder al APU aprobado |
| Condición | El APU revisado indica 0,45 sacos/m2; el maestro indica 0,30 sacos/m2 |
| Diferencia | +50 % |
| Causa | No se encontró memoria de cálculo que justifique el cambio |
| Efecto estimado | USD 1.170,00 |
| Evidencia | Archivo APUs, hoja APU-05, fila 42; base maestra |
| Respuesta del revisado | Pendiente |

**Recomendación:** verificar dosificación y desperdicio; presentar memoria de cálculo.

---

### H-03 — Depreciación de equipo en cero

| Campo | Detalle |
|---|---|
| Severidad | Alta |
| Partida | 03.04 — Excavación con equipo |
| Código | 03.04 |
| Componente | Retroexcavadora |
| Criterio | La depreciación debe estar entre 0 y 1 |
| Condición | El APU revisado registra depreciación 0,00 |
| Diferencia | El maestro registra 1,00 |
| Causa | No se encontró justificación |
| Efecto estimado | USD 2.340,00 |
| Evidencia | Archivo APUs, hoja APU-03, fila 11 |
| Respuesta del revisado | Pendiente |

**Recomendación:** revisar si la depreciación fue eliminada deliberadamente o por error de carga.

---

### H-04 — APU sin codificación COVENIN

| Campo | Detalle |
|---|---|
| Severidad | Media |
| Partida | 06.11 — Rejilla metálica especial |
| Código | CUST-0014 |
| Criterio | Las partidas deben estar codificadas o justificarse como nuevas |
| Condición | El APU no tiene código COVENIN ni equivalente documentado |
| Efecto | No cuantificado |
| Evidencia | Archivo APUs, hoja APU-06, fila 61 |
| Respuesta del revisado | Pendiente |

**Recomendación:** solicitar justificación de partida nueva o codificar según base maestra.

---

### H-05 — Diferencia aritmética en total de capítulo

| Campo | Detalle |
|---|---|
| Severidad | Media |
| Capítulo | 04 Estructuras |
| Criterio | La suma de partidas debe coincidir con el total del capítulo |
| Condición | Suma de partidas: USD 78.300,00; total declarado: USD 79.540,00 |
| Diferencia | USD 1.240,00 |
| Causa | Error de suma o ajuste no documentado |
| Efecto estimado | USD 1.240,00 |
| Evidencia | Archivo presupuesto, hoja Presupuesto, fila 87 |
| Respuesta del revisado | Pendiente |

**Recomendación:** corregir la suma o documentar el ajuste.

---

### H-06 — Partida duplicada

| Campo | Detalle |
|---|---|
| Severidad | Media |
| Partida | 02.08 y 02.14 |
| Criterio | No deben existir partidas duplicadas sin justificación |
| Condición | Ambas partidas tienen la misma descripción, unidad y cantidad |
| Efecto estimado | USD 2.390,50 |
| Evidencia | Archivo presupuesto, hoja Presupuesto, filas 32 y 38 |
| Respuesta del revisado | Pendiente |

**Recomendación:** confirmar si son frentes distintos o eliminar la duplicidad.

---

### H-07 — Rendimiento atípico

| Campo | Detalle |
|---|---|
| Severidad | Informativa |
| Partida | 07.02 — Pintura de paredes |
| Código | 07.02 |
| Criterio | El rendimiento debe ser razonable para la actividad |
| Condición | Rendimiento declarado: 80 m2/día; referencia histórica: 35–45 m2/día |
| Efecto | No cuantificado |
| Evidencia | Archivo APUs, hoja APU-07, fila 8 |
| Respuesta del revisado | Pendiente |

**Recomendación:** solicitar sustento del rendimiento o ajustar el APU.

---

## 9. Impacto económico estimado

| Hallazgo | Impacto USD |
|---|---:|
| H-01 Mano de obra | 1.280,00 |
| H-02 Material | 1.170,00 |
| H-03 Depreciación | 2.340,00 |
| H-05 Diferencia aritmética | 1.240,00 |
| H-06 Duplicidad | 2.390,50 |
| **Total** | **8.420,50** |

El impacto es estimado y no representa necesariamente un cobro indebido. Algunas diferencias podrían tener sustento técnico no suministrado.

---

## 10. Conclusiones

1. El presupuesto revisado presenta diferencias en APUs codificados que no fueron justificadas documentalmente.
2. Se identificaron 14 APUs sin codificación COVENIN.
3. Existe una diferencia aritmética en el capítulo 04.
4. Se detectó una posible partida duplicada.
5. El impacto económico estimado asciende a **USD 8.420,50**.
6. La documentación recibida no permite concluir que las diferencias sean errores definitivos; se requiere respuesta del revisado.

---

## 11. Recomendaciones

1. Solicitar memoria de cálculo de los APUs con diferencias.
2. Verificar la dosificación de materiales del capítulo 05.
3. Revisar la depreciación de equipos del capítulo 03.
4. Corregir o documentar la diferencia aritmética del capítulo 04.
5. Confirmar la duplicidad de las partidas 02.08 y 02.14.
6. Codificar o justificar los 14 APUs sin código COVENIN.
7. Remitir las aclaraciones antes del cierre del informe.

---

## 12. Limitaciones

- La revisión es documental.
- No se verificaron cantidades en campo.
- No se validaron precios con proveedores.
- No se recibieron todas las memorias de cálculo.
- Las diferencias señaladas pueden tener sustento no suministrado.
- El informe no constituye dictamen legal ni certificación de obra.

---

## 13. Anexos

| Anexo | Contenido |
|---|---|
| A | Presupuesto revisado |
| B | APUs revisados |
| C | Comparación contra base maestra |
| D | Detalle de hallazgos |
| E | Evidencia documental |
| F | Cálculo del impacto económico |

---

## 14. Aprobación

```text
Revisor: ______________________________
Nombre:  Ing. [Nombre]
CIV:     [Número]
Fecha:   06/11/2026
Firma:   ______________________________
```

---

## Nota sobre la lista interna

Este informe **no incluye** la lista interna de sugerencias del revisor.

La lista interna es un documento separado, de uso personal, que contiene:

- dudas,
- hipótesis,
- preguntas para el revisado,
- prioridades de reunión,
- puntos a verificar,
- estrategia de negociación.

El informe formal solo contiene hallazgos sustentados y evidencia verificable.
