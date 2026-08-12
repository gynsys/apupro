# Generador de APU con Inteligencia Artificial (Cost360)

## Descripción General
El Generador de APU con IA es una herramienta que combina dos tecnologías de Inteligencia Artificial para crear Análisis de Precios Unitarios (APU) técnicos y precisos, basándose en la normativa COVENIN 2000:1992 y los antecedentes históricos de la base de datos de APUPro.

## Arquitectura Híbrida (Doble IA)

La plataforma utiliza una arquitectura RAG (Retrieval-Augmented Generation) compuesta por:

1. **IA Residente (Motor de Búsqueda RAG):** 
   - **Modelo:** `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` cargado en la memoria RAM del servidor.
   - **Función:** Convierte las descripciones de las partidas en vectores matemáticos y busca semánticamente en la base de datos de 13,000 partidas para encontrar los antecedentes históricos, rendimientos e insumos base más parecidos a la solicitud del usuario en microsegundos.
   
2. **IA Generativa (LLM Router):**
   - **Modelo:** Interfaz agnóstica que soporta Google Gemini, Groq, OpenAI o modelos locales, administrable desde `/admin/llm-providers`.
   - **Función:** Recibe los datos matemáticos recuperados por la IA residente y se encarga del análisis lógico, detección de incongruencias y ensamblaje final del archivo JSON con la partida y sus insumos. Está fuertemente restringida mediante prompts de sistema para **no inventar insumos** y utilizar únicamente lo provisto por la búsqueda.

## Flujo Conversacional y Manejo de Errores

Se ha implementado un flujo interactivo que impide la generación de APUs deficientes o alucinados:

- **Rechazo por Incongruencia:** Si el usuario selecciona una categoría COVENIN (ej. E43 Herrería) pero la descripción es diametralmente opuesta (ej. "Cerámica"), el LLM rechaza la solicitud de forma explícita.
- **Clarificación de Especificaciones Técnicas:** Si faltan datos críticos (ej. no especifica resistencia del concreto o dimensiones del material), la IA devuelve opciones clickables obligando al usuario a especificar.
- **UI Autocontenida:** Las opciones técnicas son botones rápidos que bloquean el ingreso manual de texto, evitando respuestas ambiguas y roturas en el flujo.

## Implementación del Motor Híbrido RAG V6 Finalizada 🚀

Hemos integrado con éxito el motor semántico MiniLM y el LLM Generativo para que trabajen en equipo:

1. **El Cerebro Matemático (`ai_search.py`)**:
   - Implementamos la función `calculate_similarity_for_subset`.
   - Ahora MiniLM solo extrae y compara las distancias matemáticas (similitud semántica) *estrictamente* dentro del grupo de partidas filtradas por los selectores COVENIN (ej. E43701). Nunca procesa la base de datos completa a la vez.

2. **Preprocesamiento RAG (`preprocessing_service.py`)**:
   - Eliminamos el antiguo "filtro ciego" que buscaba con consultas SQL puras (`LIKE %vidrio%`) y que arrojaba 0 resultados y obligaba a generar APUs de cero.
   - Integramos la llamada directa a MiniLM. 
   - **El Portero Matemático:** Activamos la validación por umbral (Score < 15%). Si pides algo ilógico para esa categoría (ej. Cerámica en Herrería), el proceso se detiene en seco con el error `incongruencia_matematica`.

3. **El Analista LLM (`ai_apu_service.py`)**:
   - **Cero Tokens Perdidos:** Se configuró el cortocircuito para que, si el "portero" manda una alerta de incongruencia, devuelva la advertencia directamente al usuario sin hacer llamadas a Gemini/OpenAI.
   - **Confirmación Interactiva (Híbrido):** Se modificó el prompt de instrucciones del LLM. Ahora, cuando recibe el "Top 3" de partidas históricas más parecidas desde MiniLM (ej. Puertas de hierro con vidrio), el LLM no genera el APU a lo loco. Primero detiene el flujo, saluda al usuario, le dice qué encontró, y le presenta las partidas exactas en botones interactivos para que el usuario sea quien apruebe y decida cuál es la base histórica definitiva.
