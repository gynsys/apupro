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

3. **Filtro Inteligente (Smart Selector - `smart_selector_service.py`)**:
   - **Cero Tokens en Decisiones Técnicas:** En lugar de que el LLM trate de adivinar o haga preguntas consumiendo saldo, este nuevo servicio analiza matemáticamente las partidas de la categoría COVENIN filtrada.
   - **Árbol de Decisión Dinámico (TF-IDF):** Detecta variables discriminantes (ej: concreto vs mampostería, mano vs equipo) basándose en las frecuencias de palabras y le genera al usuario botones de respuesta. Cada clic filtra la base de datos hasta encontrar la "Partida Base Histórica" más parecida, todo de manera local y ultrarrápida.

4. **El Analista LLM (`ai_apu_service.py`)**:
   - **Adaptación sobre Base Real (Menos Alucinaciones):** Una vez que el Filtro Inteligente selecciona una partida base, el sistema recupera el APU completo (con todos sus insumos, cantidades y precios reales) y se lo entrega al LLM con un prompt estricto: *No inventes un APU desde cero, ADAPTA este APU real para que cumpla con la solicitud del usuario, conservando los precios intactos y ajustando solo lo necesario*.
   - **Cero Tokens Perdidos:** Se configuró el cortocircuito para el modo "Preproceso" y para las validaciones tempranas. Si el sistema detecta incongruencias matemáticas desde el inicio (ej. el score de MiniLM es casi 0), detiene el proceso sin llamar a Gemini/OpenAI.
