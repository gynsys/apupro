# Configuración de Google Sheets para Exportación de APU

## Pasos Completados
✅ 1. Documentación de problemas con Excel (EXPORT_EXCEL_PROBLEMAS.md)
✅ 2. Creación de nuevo endpoint: `backend/app/api/v1/endpoints/cost360_google.py`

## Pasos Pendientes para Completar la Prueba

### 1. Configurar Credenciales de Google Cloud
- Crear un proyecto en Google Cloud Console
- Habilitar Google Sheets API
- Crear cuenta de servicio
- Descargar archivo JSON con credenciales
- Guardar como `credentials.json` en el servidor

### 2. Agregar Router al API Principal
Modificar `backend/app/api/v1/api.py` para incluir el nuevo router:

```python
from app.api.v1.endpoints import cost360_google

api_router.include_router(cost360_google.router, prefix="/cost360", tags=["cost360"])
```

### 3. Instalar Dependencia
Agregar al `backend/requirements.txt`:
```
google-api-python-client==2.108.0
google-auth==2.23.4
```

### 4. Reconstruir Contenedor
```bash
docker compose build --no-cache apupro-backend
docker compose up -d apupro-backend
```

### 5. Modificar Frontend (Solo si funciona el backend)
En `frontend/src/modules/cost360/pages/APUViewer.jsx`:

```javascript
const handleExportToGoogleSheets = async () => {
  try {
    const API_URL = window.location.origin.includes('localhost') 
      ? 'http://localhost:8010' 
      : window.location.origin;
    
    const response = await fetch(`${API_URL}/api/v1/cost360/apu/${id}/export-googlesheet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    
    const data = await response.json();
    if (data.url) {
      window.open(data.url, '_blank');
    }
  } catch (error) {
    console.error('Error al exportar a Google Sheets:', error);
  }
};
```

### 6. Agregar Botón en Frontend (Solo si funciona el backend)
Agregar botón de Google Sheets al lado del botón de Excel en APUViewer.jsx

## Si la Prueba Funciona - Pasos de Limpieza

### Archivos a ELIMINAR:
1. `backend/app/api/v1/endpoints/cost360.py` → Eliminar función `export_apu_excel` (líneas 392-582)
2. `frontend/src/modules/cost360/pages/APUViewer.jsx` → Eliminar función `handleExportToExcel` actual
3. `backend/Dockerfile` → Eliminar `RUN pip install openpyxl==3.1.2` (solo si no se usa para presupuesto)

### Archivos a MANTENER:
✅ `backend/app/api/v1/endpoints/budgets.py` → Exportación de presupuesto a Excel (funciona bien)
✅ `backend/app/api/v1/endpoints/cost360_google.py` → Nueva implementación de Google Sheets
✅ Todas las demás funcionalidades

## Si la Prueba NO Funciona - Pasos de Limpieza

### Archivos a ELIMINAR:
1. `backend/app/api/v1/endpoints/cost360_google.py` → Archivo completo
2. Modificación en `backend/app/api/v1/api.py` → Eliminar import de cost360_google

### Archivos a MANTENER:
✅ `backend/app/api/v1/endpoints/cost360.py` → Mantener implementación actual de Excel
✅ Todas las demás funcionalidades

## Nota Importante
La exportación de PRESUPUESTO a Excel funciona correctamente y NO debe ser modificada.
Solo estamos probando una alternativa para la exportación de APU.
