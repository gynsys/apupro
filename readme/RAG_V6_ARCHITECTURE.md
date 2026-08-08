# Arquitectura RAG V6 - Búsqueda con Inteligencia Artificial (APUpro)

Esta documentación detalla la implementación técnica del motor de búsqueda V6 con Inteligencia Artificial, también conocido como "Cerebro de IA", para la plataforma APUpro (cost360).

## 1. Concepto y Visión General

El sistema V6 introduce una arquitectura híbrida para la búsqueda de partidas (APUs) que mejora radicalmente los resultados sobre los tradicionales enfoques de búsqueda léxica. La búsqueda combina:

- **Análisis Semántico (RAG/NLP)**: Comprende el "significado" y contexto de las búsquedas en lugar de depender de coincidencias exactas de palabras (usando el modelo `paraphrase-multilingual-MiniLM-L12-v2`).
- **Extracción de Parámetros Técnicos (Regex)**: Capta variables duras de ingeniería civil a partir del query (ej. `resistencia en fc`, `diámetro en pulgadas`).
- **Técnicas Clásicas de Coincidencias de Palabras Clave**: Como capa de corrección final (Boost de keywords) asegurando que descripciones con la palabra exacta reciban bonificación en su score.

## 2. Componentes Clave

### 2.1 Modelo SQLAlchemy Extendido (`backend/app/db/models/cost360.py`)
La base de datos original fue alterada para alojar metadata especializada para la búsqueda:
- `disciplina` (VARCHAR)
- `diametro_pulg` (VARCHAR)
- `resistencia_fc` (FLOAT)
- `material` (VARCHAR)
- `preparacion` (VARCHAR)
- `desc_limpia` (VARCHAR)

### 2.2 Archivos Locales (El Cerebro)
El sistema depende de dos grandes artefactos que se cargan en la RAM del servidor FastAPI:
1. `Base_Datos_IA.csv`: El "cuerpo" que contiene las 13,608 partidas con todas sus variables pre-procesadas. 
2. `embeddings_partidas.npy`: El "cerebro matemático" (una matriz generada por NLP) donde cada partida es representada en 384 dimensiones.

### 2.3 Servicio Inteligente en Memoria (`backend/app/services/ai_search.py`)
Diseñado bajo el patrón de diseño Singleton. Se ejecuta durante el evento de arranque (Startup) de FastAPI (`backend/app/main.py`).
- Carga `SentenceTransformer('sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2')`.
- Carga el vector numpy `embeddings_partidas.npy`.
- Carga un listado rápido de Códigos `CodPar` (referencias) desde el CSV para mapear el ID de un resultado con su índice correspondiente en la matriz.

### 2.4 El Endpoint V6 (`backend/app/api/v1/endpoints/search_v6.py`)
Un router dedicado `GET /api/v1/cost360/v6/buscar`. 
Ejecuta el siguiente algoritmo con cada petición:

1. **Tokenización Inicial**: Limpia Stopwords (y, en, de, los, para...).
2. **Reconocimiento Técnico**: Busca patrones Regex (Ej: `(\d+)\s*psi` o `(\d+(?:/\d+)?)\s*pulg`).
3. **Conversión a Vector**: Toma el query en texto plano y usa el modelo transformer para convertirlo a sus 384 dimensiones flotantes.
4. **Cosine Similarity**: Multiplica y compara el vector con las 13,608 partidas (Operación vectorial extremadamente rápida gracias a Numpy). Retorna el Score Semántico.
5. **Calibración y Penalizaciones (Boost)**:
   - Si la búsqueda incluye una resistencia (Ej. `250 kg/cm2`) y la partida coincide, suma un Boost de `+0.5` al `Tech Score`.
   - Si el diámetro coincide, suma `+0.5` al `Tech Score`.
   - Si las keywords hacen overlap perfecto en descripciones, suma hasta `+0.5`.
6. **Ecuación del Score Final**: 
   `Final Score = (0.7 * Min(TechScore, 1.0)) + (0.3 * SemanticScore)`
7. Se limitan los resultados al parámetro estipulado y se envían de vuelta al cliente.

## 3. Scripts de Mantenimiento

Ubicados en `backend/scripts/`:

- `alter_cost360_items.py`: Realiza el `ALTER TABLE` agregando las nuevas columnas IF NOT EXISTS de manera segura.
- `sync_ia_databases.py`: Toma el archivo `Base_Datos_IA.csv`, convierte el campo de separador de miles con `safe_float`, y ejecuta un `ON CONFLICT (CodPar) DO UPDATE` para inyectar la data enriquecida sin sobreescribir partidas que el cliente hubiese modificado a mano, salvo los campos de metadatos de IA.

## 4. Notas Técnicas de Memoria en Producción

El modelo `MiniLM` ocupa ~90 MB en RAM. La Matriz de embeddings de ~13k partidas ocupa alrededor de ~20 MB. Este stack es perfectamente capaz de correr en una máquina virtual de 1-2GB de RAM (actual Droplet de DigitalOcean) pero se debe monitorear evitar la clonación de Workers (usar Uvicorn con 1 Worker) para no duplicar el uso de la memoria RAM del modelo de NLP en memoria compartida, o implementar la carga del modelo con métodos compartidos si se escala horizontalmente.
