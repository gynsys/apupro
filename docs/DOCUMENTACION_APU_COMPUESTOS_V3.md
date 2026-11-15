# Documentación Técnica: Motor de APUs Compuestos (`v3_compound`)

> Este documento sirve como memoria técnica y referencia operativa de la arquitectura, reglas deterministas y formulación matemática implementadas en CostBase para la descomposición y fusión de **Macro-Partidas y APUs Compuestos**.

---

## 1. Justificación y Propósito

En ingeniería de costos bajo normativa COVENIN / FONDONORMA, existen partidas macro o "llave en mano" (por ejemplo: *Demolición integral de edificio de 4 niveles incluyendo apuntalamiento preventivo, fragmentación mecánica en suelo, oxicorte de perfiles, carga pesada y transporte*) cuya unidad contractual se mide frecuentemente en **toneladas ($t$)** o suma global, pero cuyos procesos constructivos se ejecutan mediante sub-actividades con **unidades naturales heterogéneas** ($m^2$ de apuntalamiento, $m^3$ de concreto demolido, $kg$ de acero cortado, $m^3$ de escombro cargado).

Un APU tradicional del catálogo no puede cotizar esto adecuadamente porque:
1. No existe una partida COVENIN única que englobe toda esa secuencia constructiva.
2. Si un LLM intenta inventar el APU desde cero, suele alucinar cuadrillas fraccionadas (ej. 0.35 obreros), omitir equipos pesados (Payloader, retroexcavadora con martillo), colocar insumos incongruentes o distorsionar los costos de mercado.

El motor **`v3_compound`** resuelve esto mediante un enfoque híbrido:
1. **Descomposición asistida por IA:** Detecta las sub-actividades necesarias con sus unidades naturales.
2. **Respaldo histórico:** Resuelve cada sub-actividad contra el catálogo oficial de CostBase (PostgreSQL).
3. **Fusión matemática determinista:** Convierte todas las sub-actividades a la unidad maestra contractual (toneladas) preservando con exactitud el Costo Directo ($CD$).

---

## 2. Arquitectura de Módulos

### Componentes del Sistema

1. **`backend/app/services/ai_apu_service_v3/compound_detector.py`**
   - Clasifica si la solicitud es compuesta (`is_compound`).
   - Extrae la lista de `SubActivity` con su tag, descripción, unidad natural sugerida y tipo de aportación (`physical`, `lump`, `ferrous`, `non_ferrous`).
   - Detecta ambigüedades técnicas no especificadas (por ejemplo: si se pide apuntalamiento pero no se indica si es madera o puntal metálico).
   - Previene la inyección de sub-partidas duplicadas mediante validación semántica (ej. `has_rubble_load_act`).

2. **`backend/app/services/ai_apu_service_v3/conversion_registry.py`**
   - Diccionario físico y normativo de densidades ($t/m^3$) tanto en estado macizo/en sitio como en estado suelto (aplicando factor de esponjamiento $F_e$).
   - Mapeo de sinónimos de materiales (`escombro_concreto`, `concreto_armado`, `acero`, `madera`, etc.).
   - Parámetros paramétricos de literatura para unidades de área/longitud (ej. apuntalamiento temporal en $m^2/t$).

3. **`backend/app/services/ai_apu_service_v3/compound_service.py`**
   - Orquesta la resolución de cada sub-partida invocando `plan_v3_selection_and_deltas` y `apply_v3_deltas_to_base_apu`.
   - Aplica salvaguardas especializadas (`_ensure_compound_sub_item_equipment`):
     - **Apuntalamiento:** Asigna el código oficial de catálogo `ENC061` (*PUNTAL DE HIERRO P/ENCOFRADO HASTA 4 M-A*) cuando es metálico, eliminando códigos sintéticos `S/C`.
     - **Fragmentación:** Asegura retroexcavadora con martillo hidráulico (`MOV022`), operador y equipo de oxicorte.
     - **Carga de escombros:** Estandariza todo cargador frontal al canónico `COP010` (*CARGADOR DE CAUCHOS CAT 950-F*).
     - **Materiales ferrosos:** Purga retroexcavadoras con martillo y grúas de gran tonelaje, asegurando oxicorte (`HER013`) y apoyo del cargador `COP010` a fracción de jornada ($0.05$ día/t).
   - Maneja aclaratorias con opciones predefinidas (*chips*).
   - Deduplica supuestos técnicos y notas de adaptación.

4. **`backend/app/services/ai_apu_service_v3/compound_merger.py`**
   - Ejecuta la matemática de unificación a $1.00\text{ ton}$.
   - Consolida la cuadrilla por rol/oficio garantizando que cada cantidad sea un **entero positivo $\ge 1$**.
   - Calibra el rendimiento maestro $R_{\text{master}}$ a **máximo 2 decimales** para conservar el costo unitario de mano de obra exacto.
   - Escala materiales y equipos, unificando insumos equivalentes.

5. **`backend/app/services/ai_apu_service_v3/delta_applier.py`** y **`frontend/src/modules/costbase/hooks/useApuGenerator.js`**
   - Garantiza en backend y frontend que la cantidad de obreros sea entera $\ge 1$, los equipos tengan 2 decimales ($\ge 0.01$) y el rendimiento esté truncado/redondeado a 2 decimales.

---

## 3. Formulación Matemática de Fusión a Toneladas

Para fusionar $N$ sub-partidas con rendimientos propios $R_i$ y unidades naturales $U_i$ en un único APU maestro expresado por $1\text{ ton}$:

### 3.1. Factores de Conversión ($f_i$)
Para cada actividad $i$, el factor $f_i$ representa cuántas unidades naturales $U_i$ se requieren por cada tonelada métrica de la partida maestra:

- **Unidades de Masa ($kg, t$):**
  $$f_i = \text{share}_i \times 1000 \quad (\text{si } U_i = kg), \qquad f_i = \text{share}_i \quad (\text{si } U_i = t)$$

- **Unidades de Volumen ($m^3$):**
  $$f_i = \frac{\text{share}_i}{\rho_i}$$
  donde $\rho_i$ es la densidad neta en $t/m^3$ según el estado del material (en sitio o suelto con factor de esponjamiento $F_e$).

- **Unidades Paramétricas de Literatura ($m^2, m$):**
  $$f_i = \text{share}_i \times \text{factor\_literatura}$$
  (Por ejemplo, $0.12\text{ m}^2/t$ para apuntalamiento temporal preventivo).

- **Suma Global ($Gl, pza$):**
  $$f_i = \frac{\text{share}_i}{T_{\text{total}}}$$
  prorrateado entre el total de toneladas de la obra.

---

### 3.2. Consolidación de Mano de Obra en Números Enteros

Cada sub-partida $i$ demanda $d_i = \frac{f_i}{R_i}$ días-cuadrilla por tonelada.

1. **Costo meta unitario de Mano de Obra por tonelada ($TargetMO$):**
   $$TargetMO = \sum_{i=1}^{N} \left( \frac{f_i}{R_i} \times \sum_{l \in \text{labors}_i} (q_{i,l} \times \text{tarifa}_{i,l}) \right)$$

2. **Unificación de Roles:**
   Los trabajadores de todas las sub-partidas se agrupan en roles canónicos mediante `_labor_role_key`:
   - `ROLE::MAESTRO DE OBRA` (unifica Caporal y Maestros de 1ra/2da)
   - `ROLE::OPERADOR DE EQUIPO PESADO`
   - `ROLE::SOLDADOR DE 1RA`
   - `ROLE::AYUDANTE`
   - `ROLE::OBRERO DE 1RA`

3. **Cantidad Entera de Trabajadores:**
   El número de obreros asignado a cada rol es un **número entero $\ge 1$**:
   $$\text{cant}_{\text{rol}} = \max\left(1, \text{round}\left( \frac{\sum (d_i \times q_{i,\text{rol}})}{\sum d_i} \right)\right)$$
   Para oficios transversales (`AYUDANTE`, `OBRERO DE 1RA`) presentes en 2 o más sub-actividades de demolición simultánea, se refuerza la dotación:
   $$\text{cant} = \max(\text{cant}_{\text{promedio}}, \text{cant}_{\text{max}}, \min(8, \text{round}(0.65 \times \sum q)))$$

4. **Calibración del Rendimiento Maestro ($R_{\text{master}}$):**
   Con la cuadrilla consolidada de costo diario total $C_{\text{diario\_cuadrilla}} = \sum (\text{cant}_k \times \text{tarifa}_k)$:
   $$R_{\text{master}} = \text{round}\left( \frac{C_{\text{diario\_cuadrilla}}}{TargetMO}, 2 \right)$$
   $R_{\text{master}}$ se redondea a **2 decimales exactos** (evitando cadenas flotantes de 6 o más decimales).

---

### 3.3. Escalado de Insumos

- **Materiales:**
  $$\text{cant}_{\text{master}} = \sum_{i} (f_i \times \text{cant}_i)$$
- **Equipos:**
  El equipo de cada sub-partida se escala de modo que su costo por tonelada permanezca invariante:
  $$\text{cant}_{\text{master}} = \sum_{i} \left( f_i \times \frac{R_{\text{master}}}{R_i} \times \text{cant}_i \right)$$
  Todas las cantidades resultantes de equipos se redondean a **2 decimales** ($\ge 0.01$).

---

## 4. Reglas de Negocio y Salvaguardas Específicas

| Regla / Incidencia | Causa Raíz Previa | Solución Determinista Aplicada |
| :--- | :--- | :--- |
| **Chips para Aclaratorias** | La IA detenía la generación con preguntas abiertas de texto libre. | Detección de ambigüedades técnicas que devuelve parámetros estructurados con lista de opciones (`options`) para que el frontend renderice botones tipo *chip*. |
| **Puntal Metálico vs Madera** | Los sinónimos expandían *"APUNTALAMIENTO"* a madera de puentes (`ENC006`) o usaban ítems referenciales `S/C`. | Si el usuario elige metálico, se asigna forzosamente `ENC061` (*PUNTAL DE HIERRO...*, $18.00); si es madera, se purgan maderas de puentes no aplicables. |
| **Duplicidad de Carga Mecánica** | La condición `has_rubble_load_act` fallaba si la descripción contenía la palabra *"DEMOLICION"* al final. | Se flexibilizó el regex para reconocer cualquier actividad de carga mecánica y se agregó deduplicación estricta por `tag` y lista de notas. |
| **Conflicto Payloader CAT 950 vs 966** | Sub-partidas distintas traían partidas base con `COP010` (950-F) y `COP009` (966-F), duplicando modelos. | Estandarización canónica en `_ensure_compound_sub_item_equipment` y en `_item_merge_key`: toda variante de cargador frontal se consolida exclusivamente en `COP010`. |
| **Oxicorte vs Martillo en Chatarra** | Se inyectaba la retroexcavadora con martillo en la partida de corte y acopio de acero. | Se purga `MOV022` de `is_ferrous_handling`. En acero, solo interviene oxicorte (`HER013`) y una fracción del cargador `COP010` ($0.05$ día). |
| **Rendimiento con 6 decimales** | La fórmula de calibración utilizaba `.toFixed(6)` o `round(..., 6)`. | Estandarizado a máximo **2 decimales** (`round(..., 2)`) tanto en backend (`compound_merger.py`, `delta_applier.py`) como en frontend (`useApuGenerator.js`). |

---

## 5. Batería de Pruebas Unitarias y Despliegue

La suite de pruebas automatizadas consta de **43 pruebas unitarias** que validan:
- Fusión matemática y conservación del costo directo.
- Consolidación de cuadrillas heterogéneas en enteros positivos $\ge 1$.
- Detección de ambigüedades y generación de opciones interactivas.
- Conversión por densidades y factores de literatura.
- Escalado y no duplicación de insumos.

### Comando de Verificación Local:
```powershell
$env:PYTHONPATH="backend"; python -m unittest backend/tests/test_compound_merger.py backend/tests/test_compound_detector.py backend/tests/test_compound_registry.py backend/tests/test_compound_service.py -v
```

### Procedimiento de Despliegue:
```powershell
("Mensaje descriptivo del commit", "") | .\deploycostbase.bat
```
