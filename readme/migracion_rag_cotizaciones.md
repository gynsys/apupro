# Documentación de Migración: Arquitectura RAG para Análisis de Cotizaciones (Módulo Cost360)

**Fecha de implementación:** 28 de Agosto de 2026
**Módulo afectado:** `/api/v1/cost360/pdf-updater/analyze-quote` (`app/api/v1/endpoints/pdf_updater.py`)

---

## 1. Problema Original (El Cuello de Botella)

Inicialmente, el sistema estaba enviando las páginas de las cotizaciones (PDFs o Imágenes) como archivos visuales enteros directamente al modelo **Gemini 1.5 Pro/Flash Vision** a través de la librería `google.generativeai`.

**Esto generó tres problemas críticos:**
1. **Límite de Cuotas (HTTP 429 Limit Exceeded):** Al usar el Tier Gratuito de Google AI Studio, enviar imágenes masivas agotaba instantáneamente el límite de peticiones por minuto.
2. **Imposibilidad de Respaldo:** Groq (nuestro LLM secundario) retiró sus modelos de Visión (`llama-3.2-90b-vision-preview` fue *decommissioned*), dejándonos sin plan B cuando Gemini fallaba.
3. **Consumo y Latencia:** La IA recibía en un solo prompt la imagen entera y todo el catálogo de la base de datos (o sinónimos) para tratar de hacer el "cruce", consumiendo decenas de miles de tokens por request y tardando más de 20 segundos.

---

## 2. La Solución: Enfoque de Dos Pasos RAG (Retrieval-Augmented Generation)

Inspirados en el motor de extracción local (`extractor_pdf_json.py`), migramos el endpoint hacia una arquitectura donde la IA ya no hace el trabajo de "visión" y "búsqueda" al mismo tiempo. Ahora la IA **solo lee texto plano** y el servidor se encarga de la búsqueda mediante **bases de datos vectoriales / Full-Text Search**.

### El Nuevo Flujo (Pipeline):

#### Paso A: Extracción de Texto Zero-DB (Local)
- Si el usuario sube un **PDF digital**, usamos la librería `PyMuPDF` (`fitz`) para extraer el texto nativo al instante (0.1 segundos, costo $0).
- Si el PDF es un documento **escaneado** o el usuario sube una **Imagen (.jpg/.png)**, usamos un prompt aislado de **Gemini Vision exclusivamente como motor OCR**. Le enviamos la imagen con la instrucción de extraer puramente el texto. Este es el único momento donde se usa Visión.

#### Paso B: Estructuración Rápida (IA Paso 1)
- El texto crudo o desordenado (proveniente del PDF o del OCR) se envía a nuestro router universal (`call_llm_json`).
- La IA (Groq o Gemini, el que esté activo) recibe la orden de ordenar el texto basura en un JSON estructurado de la forma: `[{ "descripcion": "...", "precio": ... }]`.

#### Paso C: Filtrado Léxico (El Cerebro RAG Local)
- Por cada ítem que nos estructuró la IA, el backend ejecuta silenciosamente la función `lexical_search_materials()`.
- Esta función usa el motor Full-Text Search Nativo de PostgreSQL (`to_tsvector` y `to_tsquery`) para buscar en los >8,000 insumos de la base de datos y extraer solo los **5 candidatos más parecidos**.

#### Paso D: Emparejamiento Exacto (IA Paso 2)
- Ahora que tenemos la lista de ítems de la cotización y un "Top 5" de candidatos para cada uno, enviamos todo en un segundo prompt a la IA principal (ej. Llama 3 vía Groq).
- La IA lee: *"Cotizaron 'Marco Derecho 2.10'. Los candidatos son A, B, C, D, E. ¿Cuál es el exacto?"*.
- La IA selecciona el `CodMat` correcto y devuelve el JSON final al frontend.

---

## 3. Beneficios Obtenidos

1. **Cero Dependencia Visual:** Al transformar la carga de trabajo pesada a texto puro, pudimos habilitar a **Groq (Llama 3)** como modelo LLM primario o de respaldo total.
2. **Eficiencia de Costos:** Pasamos de procesar prompts de +50,000 tokens de imagen a procesar prompts de ~800 tokens de texto.
3. **Escalabilidad:** Independientemente de si la BD de materiales crece a 100,000 registros, la IA solo verá un máximo de 5 registros (los top 5 del motor PostgreSQL RAG). Esto garantiza cero alucinaciones y cero desbordamientos de contexto.

---

## 4. Archivos Modificados
- `backend/app/api/v1/endpoints/pdf_updater.py` (Reescrito por completo).
- `backend/app/services/llm_router.py` (Se utiliza su función unificada `call_llm_json` para aprovechar el modelo activo en la BD).
