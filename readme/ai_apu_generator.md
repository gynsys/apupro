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

## Tareas Pendientes / Próximos Pasos

- **[PENDIENTE] Implementación de "Portero" MiniLM para Incongruencias:**
  - *Objetivo:* Ahorrar tokens y carga del LLM interceptando incongruencias obvias directamente en Python usando el resultado del modelo MiniLM.
  - *Metodología de Pruebas:* 
    1. Diseñar un set de variaciones de selectores (categorías).
    2. Simular la entrada de palabras incongruentes.
    3. Analizar la precisión (falsos positivos vs verdaderos positivos) de los resultados del MiniLM.
    4. Implementar un umbral matemático en el endpoint de búsqueda que aborte la operación y devuelva un error si el Top 5 de resultados semánticos pertenece a una rama COVENIN totalmente ajena a la seleccionada por el usuario.
