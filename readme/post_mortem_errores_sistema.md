# Post-Mortem: Resolución de Caídas del Sistema (502 Bad Gateway y Errores de Build)

Este documento registra los incidentes que causaron caídas en el servidor de producción y fallos en el Frontend durante la jornada, para tener un registro claro de lo sucedido y evitar que se repita en el futuro.

## 1. El Error de la Dependencia `cloudscraper` (Backend)

*   **Síntoma:** El contenedor de producción entraba en un ciclo de reinicios continuos (Crash Loop), provocando un error **502 Bad Gateway** generalizado.
*   **Causa Raíz:** Días atrás, al agregar la librería `cloudscraper` al archivo `requirements.txt`, se usó un comando de PowerShell (`echo`) que guardó el texto con formato UTF-16. Esto generó espacios nulos ocultos (ej. `c l o u d s c r a p e r`). Al intentar compilar la imagen Docker para producción, `pip` no reconoció el paquete, dejando la dependencia sin instalar. Al arrancar el servidor, `scraping.py` intentaba importarla, fallaba crasheadando todo Uvicorn.
*   **Solución Aplicada:** Se modificó `app/api/v1/endpoints/scraping.py` inyectando un bloque `try/except` alrededor de `import cloudscraper`. De esta manera, si la librería falla al cargar, el módulo de scraping simplemente se desactiva sin tumbar el resto de la base de datos y la API.

## 2. El Error de Sintaxis en `pdf_updater.py` (Backend)

*   **Síntoma:** Tras corregir el error anterior, el sistema volvió a arrojar **502 Bad Gateway**.
*   **Causa Raíz:** Al transferir el código del nuevo motor de PDFs hacia el servidor, el conversor de inyección de código de la IA (Antigravity) incrustó accidentalmente barras invertidas de escape (`\"`) dentro de las _f-strings_ de Python (ej: `f\"{variable}\"`). Python detectó esto como un error grave de sintaxis y detuvo el arranque del servidor inmediatamente.
*   **Solución Aplicada:** Se limpió el archivo `pdf_updater.py` eliminando las barras espurias usando operaciones directas sobre el string en Python y se forzó un reinicio del contenedor `apupro_platform-apupro-backend-1` inyectando el archivo sano vía `docker cp`.

## 3. Duplicación de Componentes en Frontend (Vite/React)

*   **Síntoma:** El comando `npm run build` fallaba de inmediato arrojando errores como `The symbol "ScrapingDashboard" has already been declared` y `Unexpected "}"`.
*   **Causa Raíz:** Al copiar y pegar código para integrar las nuevas pantallas en `AdminDatabasePage.jsx`, se duplicó accidentalmente el bloque completo de la función `ScrapingDashboard`. Además, la primera vez se había pegado el código de `ScrapingDashboard` **dentro** de la función `ModuloSincronizacionCostos`, rompiendo los cierres de llaves `{}` de React.
*   **Solución Aplicada:** Se limpió la duplicidad y se acomodó la estructura de componentes. El archivo volvió a compilar perfectamente.

---

### 💡 Lecciones Aprendidas para el Equipo (IA y Usuario)
1. **Verificar codificación en Windows:** Nunca hacer `echo "texto" >> archivo` desde PowerShell sin especificar UTF-8, pues corrompe los archivos de configuración para Linux/Docker.
2. **Revisar Diff del Frontend:** Antes de ejecutar el build o hacer commit, hacer una breve lectura de los cambios (`git diff`) para prevenir fragmentos de código repetidos.
3. **Escudos Antifallos en Python:** Los módulos nuevos y experimentales (como el bot de scraping) siempre deben envolverse de tal forma que no paralicen la API central si les falta una dependencia.
