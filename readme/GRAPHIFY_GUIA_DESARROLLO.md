# Guía de Graphify para Desarrolladores y Agentes de IA

Esta guía documenta la instalación, arquitectura y uso de **Graphify** en el proyecto **APUPro Platform** (`apupro_platform`), sirviendo como referencia para desarrolladores y futuros agentes de IA que colaboren en el repositorio.

---

## 1. ¿Qué es Graphify y por qué está en este proyecto?

**Graphify** es una herramienta de análisis de código basada en **Árboles de Sintaxis Abstracta (AST)** mediante **Tree-sitter**. Transforma la base de código completa (FastAPI en `backend/` y React en `frontend/`) en un **Grafo de Conocimiento (Knowledge Graph)** estructurado y navegable.

### Beneficios principales:
- **Navegación relacional**: Rastrear de forma inmediata qué componentes de React llaman a qué endpoints y qué modelos de SQLAlchemy o tablas de PostgreSQL están involucrados.
- **Análisis de impacto**: Identificar qué partes del sistema se ven afectadas antes de refactorizar una función, tabla o servicio.
- **Ahorro de tokens para agentes de IA**: Evita realizar búsquedas a ciegas (`grep` recursivo o lectura de archivos enteros) para inferir dependencias.
- **100% local y privado**: Todo el análisis se ejecuta localmente en la máquina del desarrollador; el código nunca se transmite a servidores de terceros.

---

## 2. Resumen de la Instalación y Configuración

Graphify fue instalado en el entorno local del sistema mediante `uv`:

```powershell
uv tool install "graphifyy[mcp]"
```

### Componentes instalados:
- **Ejecutables**:
  - `graphify.exe`: CLI principal para extracción, consultas y exportación.
  - `graphify-mcp.exe`: Servidor bajo el estándar **Model Context Protocol (MCP)** para comunicación por `stdio` con agentes de IA.
- **Ubicación binaria**: `C:\Users\<Usuario>\.local\bin\`
- **Integración Antigravity**:
  - Reglas del agente: [`.agents/rules/graphify.md`](../.agents/rules/graphify.md)
  - Workflows del agente: [`.agents/workflows/graphify.md`](../.agents/workflows/graphify.md)
  - Skill global: `~/.gemini/config/skills/graphify/SKILL.md`
  - Configuración MCP: `~/.gemini/config/mcp_config.json` y `~/.gemini/antigravity/mcp_config.json`
- **Control de versiones**:
  - Las carpetas generadas `graphify-out/` y `.graphify/` están estrictamente ignoradas en `.gitignore`.

---

## 3. Estado Actual del Grafo de APUPro

La primera extracción local sobre los 429 archivos de código del proyecto arrojó:
- **2.811 nodos**: Definiciones de funciones, clases, modelos y componentes.
- **6.887 aristas (edges)**: Relaciones de llamada (`calls`), importación (`imports`), contención (`contains`) y dependencias.
- **145 comunidades arquitectónicas**.

---

## 4. Visualización en Navegador (Para Humanos)

Para explorar visualmente el mapa interactivo del proyecto sin levantar servidores:

1. Abrir en cualquier navegador el archivo:
   `graphify-out/graph.html`
2. Características del visor:
   - Exploración por nodos (clases, funciones, archivos).
   - Filtrado por comunidades o capas del sistema (frontend, backend, DB).
   - Búsqueda de símbolos y dependencias directas.

Para regenerar este visualizador tras cambios de código:
```powershell
graphify export html
```

---

## 5. Guía de Comandos Útiles

### 5.1. Consultas y Búsqueda de Rutas
- **Buscar conexiones de un concepto o entidad**:
  ```powershell
  graphify query "equipments"
  graphify query "budgets"
  ```
- **Calcular la ruta más corta entre dos entidades** (ideal para ver cómo el frontend se conecta a una tabla):
  ```powershell
  graphify path "ComponentSelectorModal" "CostEquipment"
  ```
- **Explicar un nodo o componente**:
  ```powershell
  graphify explain "search_equipments_paginated"
  ```

### 5.2. Actualización Incremental (Mantenimiento)
Cuando se agreguen nuevas funciones, tablas o endpoints:
```powershell
# Actualización rápida incremental basada únicamente en AST (sin costo de API):
graphify update .

# O re-extracción estructural completa en modo código:
graphify extract . --code-only
```

---

## 6. Directrices para Agentes de IA

Los agentes que trabajen en este repositorio deben acatar la directriz configurada en `.agents/rules/graphify.md`:

1. **Cuándo usar Graphify**:
   - Preguntas sobre la arquitectura del sistema.
   - Diagnóstico de flujo de datos entre frontend y backend.
   - Refactorizaciones donde se deba evaluar el impacto en dependencias externas.
   - Búsqueda de funciones o componentes reutilizables existentes.
2. **Cuándo NO es necesario usar Graphify**:
   - Ediciones puntuales de estilos CSS o textos de interfaz.
   - Arreglos cosméticos en archivos ya identificados.
   - Tareas directas indicadas explícitamente con ruta de archivo y número de línea.
3. **Buenas prácticas post-edición**:
   - Si se realizaron cambios estructurales importantes (nuevos módulos, rutas o modelos), ejecutar `graphify update .` al finalizar la sesión.
