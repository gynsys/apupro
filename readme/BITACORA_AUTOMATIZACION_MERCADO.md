# Bitácora de Automatización de Precios de Mercado y Saneamiento

Esta bitácora documenta el diseño e implementación del módulo de "Automatización de Precios" para la plataforma Cost360, el cual permite mantener actualizados los precios de miles de insumos mediante técnicas avanzadas de relación (dispersión matemática) y web scraping de insumos líderes.

## 1. El Problema Original
La base de datos original (13,872 materiales) creció por la importación de nuevas partidas M y U, dejando materiales sin familias y sin estandarizar. 
Adicionalmente, el antiguo sistema de saneamiento dependía exclusivamente de LLMs (Gemini/ChatGPT), lo que generaba problemas de cuotas (HTTP 429), formatos no deterministas y caídas del servicio (HTTP 500).
Finalmente, aplicar un % de inflación genérico a todos los materiales no es viable en economías volátiles, ya que los precios de materiales de distinta naturaleza varían a distinto ritmo.

## 2. Limpiador por Reglas (Saneamiento Inteligente sin IA)
Para evitar la dependencia exclusiva en la API de Inteligencia Artificial para tareas repetitivas de formateo, se construyó un "Rule-Based Sanitizer" (`backend/app/services/rule_sanitizer.py`):
- **Funcionalidad:** Aplica Regex y diccionarios para estandarizar textos (ej. "tbo p.v.c" -> "TUBO PVC").
- **Categorización:** Analiza las palabras clave de la descripción para asignar la "Familia" sin usar IA.
- **Ventaja:** Instantáneo, masivo y gratuito. Ahora la plataforma puede limpiar miles de materiales por segundo sin consumir tokens.

## 3. Descubrimiento de Clústers (K-Means)
Para entender la naturaleza estadística de la base de datos sin clasificarla subjetivamente, se desarrolló el script `_analyze_materials.py`:
- **Método:** Procesamiento de Lenguaje Natural (NLP) usando `TfidfVectorizer` combinado con clustering `K-Means`.
- **Hallazgo:** El modelo detectó que matemáticamente los 13,872 insumos se agrupaban de forma natural en **35 familias**, validando la posibilidad de simplificar la base de datos a unas pocas raíces principales.

## 4. Insumos Líderes y Factores de Dispersión
Tras el descubrimiento algorítmico, el usuario aportó un archivo semilla (`insumos_familia.xlsx`) con las 23 familias históricas. Se implementó una arquitectura de *Dispersión de Precios*:

### 4.1. Asignación de Familias (`apply_excel_families.py`)
- Se inyectaron las 23 familias originales a la base de datos.
- Se reasignaron los 9,890 insumos originales a su familia exacta.
- Se entrenó un algoritmo de palabras clave (basado en el vocabulario de las 23 familias) para categorizar automáticamente **2,564 materiales nuevos** que antes estaban huérfanos.

### 4.2. Cálculo del Factor Matemático (`seed_dispersion_factors.py`)
- **Insumo Líder (Material Fuerte):** Para cada familia, el sistema identificó el material más utilizado en las partidas APU (ej. `MADERA A LA MEDIDA SAQUI-SAQUI` para la familia Encofrado).
- **Factor de Dispersión:** Se calculó matemáticamente la relación de precio entre el Insumo Líder y todos los demás insumos de su familia (`Factor = Precio_Hijo / Precio_Lider`).
- **Anclaje:** Se añadieron los campos `market_indicator_id` y `market_factor` a la tabla `CostMaterial`.

## 5. El Motor en Cascada (Backend y Frontend)
### Backend (`POST /api/v1/market/update-leader-price`)
Un nuevo endpoint recibe la actualización de precio de un Insumo Líder. Inmediatamente busca a todos los insumos hijos anclados a él y recalcula sus precios multiplicando el nuevo precio del líder por sus factores de dispersión.

### Frontend (`MarketIndicatorsPanel.jsx`)
Un panel moderno e interactivo en React (Vite + TailwindCSS + Lucide) permite al administrador:
1. Ver los Insumos Líderes.
2. Visualizar a cuántos materiales de su familia impactan (ej. `88 insumos`).
3. Modificar manualmente el precio del líder y disparar la actualización en cascada.

## 6. Depuración Final
Se identificó y eliminó una anomalía grave en la importación original: el material `MAT1255`, que tenía un precio de $1,297.40 por tratarse en realidad de una partida entera filtrada ("CONCRETO 200..."). Asimismo, se eliminaron partidas mal estructuradas (serie M111...) y sus dependencias huérfanas mediante el script `delete_apus.py`.
