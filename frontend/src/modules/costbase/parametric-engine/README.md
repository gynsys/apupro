# Parametric Engine (Frontend)

Módulo autónomo y desacoplado para alimentar los contratos paramétricos y chips del Asistente Guiado (Chatbot) con los datos empíricos de las 17.343 partidas de CostBase.

## Desconexión Rápida
En `index.js`, cambiar:
```javascript
export const USE_PARAMETRIC_ENGINE = false;
```
Esto desactiva inmediatamente el motor y hace que el asistente use las definiciones por defecto.
Para eliminarlo por completo, basta con borrar esta carpeta y quitar la línea de importación en `guidedBuilderConstants.js`.
