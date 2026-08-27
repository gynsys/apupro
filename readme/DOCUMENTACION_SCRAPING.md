# Documentación Técnica - Sistema de Scraping de Precios

## 📋 Descripción General

Sistema de sincronización y versionamiento histórico de precios mediante web scraping distribuido con mitigaciones anti-bloqueo para plataformas de e-commerce venezolanas (MercadoLibre y EPA).

## 🏗️ Arquitectura del Sistema

### Base de Datos
- **Tabla principal:** `cost360_materials` (materiales existentes)
- **Tabla histórica:** `historial_precios` (versionamiento de precios)

### Backend (FastAPI)
- **Framework:** FastAPI con Background Tasks
- **Bibliotecas:** requests, regex, sqlalchemy
- **Endpoint:** `/api/v1/scraping/versionar-precios-db`

### Frontend (React)
- **Componente:** `ModuloSincronizacionCostos`
- **Ubicación:** `AdminDatabasePage.jsx`
- **Integración:** Botón en interfaz administrativa

## 📁 Archivos del Sistema

### Backend
1. **`backend/app/api/v1/endpoints/scraping.py`**
   - Función principal: `scraping_seguro_gratuito_db()`
   - Endpoint: `POST /versionar-precios-db`
   - Mitigaciones: Batching, Jitter, User-Agent rotation

2. **`backend/app/api/v1/api.py`**
   - Router integration: `api_router.include_router(scraping.router, prefix="/scraping")`

3. **`backend/requirements.txt`**
   - Dependencias: requests (ya incluido)

### Frontend
1. **`frontend/src/modules/cost360/pages/AdminDatabasePage.jsx`**
   - Componente: `ModuloSincronizacionCostos`
   - Llamada API: `/api/v1/scraping/versionar-precios-db`
   - UI: Botón "🚀 Versionar Precios con Mercado Libre"

### Scripts de Prueba
1. **`readme/test_scraping.py`**
   - Script de prueba local
   - Conexión directa a base de datos
   - Comparación BD vs Scraping

2. **`readme/crear_tabla_historial.py`**
   - Script de migración inicial
   - Crea tabla `historial_precios`

## 🔧 Estructura de la Tabla `historial_precios`

```sql
CREATE TABLE historial_precios (
    id SERIAL PRIMARY KEY,
    material_id VARCHAR(50) NOT NULL,
    fecha DATE NOT NULL,
    precio DECIMAL(10,2) NOT NULL,
    fuente VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 🌐 Portales de Scraping

### MercadoLibre Venezuela
- **URL base:** `https://listado.mercadolibre.com.ve/{termino}`
- **Headers:** User-Agent rotation, Accept-Language, Referer
- **Patrones de precio:** Regex para formatos monetarios

### EPA Venezuela
- **URL base:** `https://ve.epaenlinea.com/catalogsearch/result/?q={termino}`
- **Headers:** User-Agent rotation, Accept-Language, Referer
- **Patrones de precio:** Regex para formatos monetarios

## 🛡️ Mitigaciones Anti-Bloqueo

### 1. Batching (Procesamiento por Lotes)
- **Límite:** 25 materiales por ejecución
- **SQL:** `LIMIT 25` en consulta de materiales
- **Propósito:** Evitar ráfagas masivas de peticiones

### 2. Jitter (Tiempos de Espera Variables)
- **Rango:** 15-40 segundos entre materiales
- **Implementación:** `random.uniform(15.0, 40.0)`
- **Propósito:** Simular comportamiento humano

### 3. User-Agent Spoofing (Rotación de Encabezados)
- **Navegadores:** Chrome, Safari, Firefox, iPhone
- **Rotación:** Random por cada petición
- **Propósito:** Evitar detección de bots

## 🔄 Flujo de Trabajo

### 1. Inicialización
- Usuario hace clic en botón de React
- Frontend llama al endpoint FastAPI
- Backend retorna `{"status": "processing"}` inmediatamente

### 2. Background Task
- Consulta 25 materiales de base de datos
- Alterna entre MercadoLibre y EPA (50/50)
- Aplica mitigaciones anti-bloqueo
- Detecta precios mediante regex

### 3. Almacenamiento
- Guarda en tabla `historial_precios`
- Registra material_id, fecha, precio, fuente
- Mantiene versionamiento temporal

### 4. Finalización
- Registro de procesamiento en logs
- Notificación de completion
- Disponibilidad de datos históricos

## 📊 Patrones de Regex para Precios

```python
precio_patterns = [
    r'(\d{1,3}(?:[\.,]\d{3})*(?:[\.,]\d{2}))',  # Formato: 1.000,00 o 1,000.00
    r'(\d+[\.,]\d+)\s*(?:Bs|USD|US\$)',
    r'US\s*\$\s*(\d+[\.,]\d+)',
    r'\$\s*(\d+[\.,]\d+)',
    r'price["\']\s*:\s*["\'](\d+[\.,]\d+)',
    r'(\d+\.?\d*)'
]
```

## 🎯 Configuración de Pruebas

### Script de Prueba Local
- **Archivo:** `readme/test_scraping.py`
- **Materiales:** 10 reales de base de datos
- **Portales:** MercadoLibre y EPA
- **Salida:** Comparativo BD vs Scraping

### Comando de Ejecución
```bash
python readme/test_scraping.py
```

## 🔍 Depuración y Logs

### Niveles de Logging
- **INFO:** Inicio de proceso, materiales procesados
- **ERROR:** Fallos en scraping, errores de conexión
- **SUCCESS:** Precios detectados y guardados

### Formato de Logs
```
[COMPARATIVO] MAT1234 | BD: $100.00 | Scraping: $120.00 | Fuente: mercadolibre
Diferencia: $20.00 (20.0%)
```

## 🚀 Despliegue en Producción

### Consideraciones
- **Cron Jobs:** Ejecución programada (ej. semanal)
- **Monitoreo:** Logs de errores y timeouts
- **Backups:** Tabla `historial_precios` antes de limpieza
- **Validación:** Comparación manual de precios

### Seguridad
- **Tokens:** Admin token para acceso al endpoint
- **Rate Limiting:** Limitar peticiones por IP
- **CORS:** Restringir orígenes permitidos

## 📈 Métricas de Éxito

### KPIs a Monitorear
- **Precios detectados:** % de materiales con scraping exitoso
- **Diferencia de precios:** Comparación BD vs Scraping
- **Tiempo de ejecución:** 25 materiales × (15-40s) = 6-16 horas
- **Errores de bloqueo:** HTTP 403, 429, timeouts

## 🔄 Mantenimiento

### Actualizaciones Necesarias
- **Selectores CSS:** Cambios en estructura de portales
- **Patrones de regex:** Ajustes por nuevos formatos de precio
- **URLs de búsqueda:** Cambios en estructura de endpoints
- **Headers:** Actualización de User-Agents

### Escalabilidad
- **Aumentar lote:** Modificar `LIMIT 25` → `LIMIT 50`
- **Agregar portales:** Incluir nuevos e-commerce
- **Mejorar regex:** Patrones más específicos por portal
- **Caching:** Reducir peticiones duplicadas

## 📞 Soporte y Continuidad

### Archivos Clave para Mantenimiento
1. `backend/app/api/v1/endpoints/scraping.py` - Lógica principal
2. `readme/test_scraping.py` - Pruebas y validación
3. `frontend/src/modules/cost360/pages/AdminDatabasePage.jsx` - UI

### Pasos para Modificaciones
1. Actualizar patrones de regex en `scraping.py`
2. Probar localmente con `test_scraping.py`
3. Desplegar cambios en backend
4. Validar en producción con lote pequeño
5. Monitorear logs y errores

---

**Fecha de implementación:** 2026-08-27
**Versión:** 1.0
**Estado:** Funcional en pruebas