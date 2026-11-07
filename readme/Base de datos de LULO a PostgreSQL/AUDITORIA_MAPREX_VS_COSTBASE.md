# Auditoría Forense: Base Reconstruida de Maprex (`maprex_local`) vs. Base Actual de CostBase (`apupro_db`)

> **Aclaratoria sobre las bases de datos evaluadas:**
> Se descartó `produccion_espejo` (espejo inicial con 7.970 materiales) y se ejecutó el cruce directamente entre:
> 1. **`maprex_local` (PostgreSQL):** Base nativa de DataLaing MaPreX en PostgreSQL (47 tablas originales: `ObraPart`, `ObraMate`, `ObraEqui`, `ObraMano`, `ObraPainMate`, `ObraPainEqui`, `ObraPainMano`, etc.).
> 2. **`apupro_db` (PostgreSQL CostBase actual):** Base activa de CostBase (`public` con **17.320 partidas** y **8.301 materiales**, más el esquema `bd_17_septiembre_36484dce` con **17.343 partidas** y **8.500 materiales**).

---

## 1. Genealogía de CostBase: ¿Qué vino de Maprex y qué se completó con otras fuentes?

De las **17.320 partidas** que hoy conforman el catálogo maestro de CostBase (`public.cost360_items`), el cruce exacto contra `maprex_local."ObraPart"` (**12.652 partidas**) demuestra el origen de cada bloque:

| Origen / Fuente de Datos | Cantidad de Partidas | % de CostBase | Patrón de Códigos (`CodPar` / `CovPar`) | Explicación Técnica |
| :--- | :---: | :---: | :--- | :--- |
| **1. Base Nativa Maprex (código exacto)** | **11.431** | **66,0 %** | `E...`, `C...`, `U...`, `I...`, `S...` | Núcleo fundacional de CostBase importado directamente de `ObraPart` conservando el mismo `CodPar`. |
| **2. COVENIN Mantenimiento (`M`)** | **1.376** | **7,9 %** | `CodPar = CovPar` (`M111110000` a `M91...`) | Agregadas posteriormente para cubrir el manual COVENIN de Mantenimiento (ausente en `maprex_local`). |
| **3. LULOWin / IP3 — Reparaciones (`R`)** | **1.029** | **5,9 %** | `CodPar` Hex de 8 dígitos (`E0075665`, `300CF6C3`) con `CovPar = R...` | Partidas de reparaciones generales y acarreos manuales importadas desde LULOWin/IP3 generando un hash hexadecimal de 8 caracteres como `CodPar`. |
| **4. COVENIN Urbanismo (`U`)** | **980** | **5,7 %** | `CodPar = CovPar` (`U41...`, `U47...`, `U50...`, `U90...`) | Partidas de urbanismo ingresadas con su código COVENIN completo como `CodPar` (en Maprex muchas tenían códigos cortos como `UP327`). |
| **5. LULOWin / IP3 — Ambiental y Vialidad (`A`)** | **603** | **3,5 %** | `CodPar` Hex de 8 dígitos (`101868D0`, `C03348A6`) con `CovPar = A...` | Partidas de vialidad, alcantarillas y obras ambientales con hash hexadecimal como `CodPar`. |
| **6. Redes Eléctricas CADAFE / CORPOELEC (`RA`)** | **527** | **3,0 %** | `CodPar` Hex de 8 dígitos (`3085A7F0`, `C086C1DB`) con `CovPar = ...RA` | Normas de distribución eléctrica (`2100RA`, `3607RA`, `4408RA`) importadas con hash hexadecimal. |
| **7. Torres y Telecomunicaciones (`TOR`)** | **531** | **3,1 %** | `TOR001` a `TOR556` | Catálogo especializado de torres eléctricas/telecomunicaciones agregado a CostBase. |
| **8. Edificaciones Corporativas y Banca (`EAP`, `ESA`, `EST`, `EIB`, `B`, `BAN`, `V`)** | **843** | **4,9 %** | `EAP`, `ESA`, `EST`, `EIB`, `EII`, `EIJ`, `B01..B13`, `BAN`, `V10..V30` | Partidas corporativas, remodelación de agencias bancarias y mobiliario (CANTV/Banca). |
| **TOTAL COSTBASE (`apupro_db`)** | **17.320** | **100 %** | — | — |

---

## 2. ¿Qué hay en `maprex_local` que NO está con el mismo `CodPar` en CostBase?

En `maprex_local` existen **1.221 partidas** cuyo `CodPar` no aparece directamente en `public.cost360_items`:
- **421 partidas `UP1..UP5` (Urbanismo)** sí están en CostBase, pero en Maprex usan el código corto (`UP327`) y en CostBase usan el código COVENIN largo (`U500000045`) como `CodPar`.
- **800 partidas exclusivas de `maprex_local`** corresponden a series específicas de DataLaing (`ESY` 120, `GMV` 109 Gran Misión Vivienda, `HSC` 82, `EP1` 78, `LAI` 72, `EP2` 52, `EPO` 43, `ECS` 41, `B16` 23, `MIX` 23, `ACARR` acarreos).

---

## 3. Discrepancias Detectadas en las 11.431 Partidas Comunes (Maprex vs. CostBase)

### 3.1. Colisión de Códigos (`132 partidas` donde el mismo `CodPar` significa otra partida distinta)
En **132 códigos**, CostBase reutilizó o sobrescribió el `CodPar` con una partida diferente a la de Maprex:
- `ARB034`: Maprex (`M3`, Bases y sub-bases de granzón cernido) vs. CostBase (`PZA`, Grama artificial H=15mm).
- `CCS228..CCS231`: Maprex (`M3`/`KGF`, Cunetas de concreto, demolición de gaviones, tensores) vs. CostBase (`M2`, Geotextiles Goetex 200/240-R/250).
- `CMT176`: Maprex (`HECTO`, Tendido de conductor ARV 2) vs. CostBase (`M3`, Excavación a mano y compactación con rana).

### 3.2. Diferencias de Rendimiento (`RenPar`) (`143 partidas`)
Ejemplos representativos:
- `B02003`: Maprex `3,50` vs. CostBase `3,00`
- `B03038`: Maprex `10,00` vs. CostBase `7,00`
- `B03039`: Maprex `10,00` vs. CostBase `8,00`
- `B09003`: Maprex `5,00` vs. CostBase `4,00`
- `B11017`: Maprex `10,00` vs. CostBase `12,00`
- `CCR036`: Maprex `12,00` vs. CostBase `120,00`
- `CCS002`: Maprex `4,00` vs. CostBase `5,00`

### 3.3. Diferencias de Unidad (`UniPar`) (`59 partidas`)
- Diferencias de formato (`DIA` vs. `XDIA` vs. `DÍA`, `UND` vs. `PZA`).
- Diferencias reales derivadas de las colisiones de código (`ARB034`, `CCS228..231`, `CMT176`).

---

## 4. Discrepancias en Insumos y Recetas APU

| Catálogo / Receta | En `maprex_local` | En `apupro_db` (`public`) | En `apupro_db` (`bd_17_sep`) | Códigos Comunes (`public`) | Solo en Maprex | Solo en CostBase (`public`) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Materiales (`CodMat`)** | 9.946 | 8.301 | 8.500 | **5.654** | 4.292 | 2.647 |
| **Equipos (`CodEqu`)** | 1.822 | 1.388 | 1.639 | **1.002** | 820 | 386 |
| **Mano de Obra (`CodMan`)** | 581 | 817 | 859 | **478** | 103 | 339 |
| **Recetas APU Materiales (pares)** | 39.599 | 52.849 | 53.373 | **32.530** | 7.069 | 20.319 |
| **Recetas APU Equipos (pares)** | 49.086 | 65.926 | 66.312 | **42.535** | 6.551 | 23.391 |
| **Recetas APU Mano de Obra (pares)** | 55.458 | 77.710 | 77.939 | **49.336** | 6.122 | 28.374 |

- **Depreciación de Equipos (`Deprec` vs `deprec_factor`):** 8 equipos de catálogo (`ALB153`, `COM010`, `COM014`, `COM015`, `COM016`, `ESP012`, `PLO020`, `VEH005`) y **343 pares `(CodPar, CodIns)`** en `ObraPainEqui` tienen `Deprec = 1.0` en Maprex y `0.0025..0.02` en CostBase.
- **Cantidades en recetas comunes (`CanIns`):** Solo difieren **51 pares** en materiales, **23 pares** en equipos y **87 pares** en mano de obra (más del 99,8 % de las recetas comunes son idénticas).
