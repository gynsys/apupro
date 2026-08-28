# Plan de Implementación - Dashboard de Bot Scraping

## 📋 Estado General del Proyecto
**Fecha Inicio:** 2026-08-28  
**Estado:** En Progreso  
**Enfoque:** Implementación Completa con Arquitectura Profesional

---

## ✅ FASE 1: BACKEND (COMPLETADA)

### 1.1 Modificar scraping.py para configuración dinámica ✅
- [x] Implementar clase `ScrapingConfig` con Pydantic
- [x] Crear clase `BotState` para estado global
- [x] Sistema de logs estructurado
- [x] Orquestador con flags de control (stop/pause)
- [x] Integración con configuración dinámica
- [x] Mantener funcionalidad original (pending/approve/reject)

**Archivos modificados:**
- `backend/app/api/v1/endpoints/scraping.py` (428 líneas)

### 1.2 Crear tabla scraping_config en base de datos ✅
- [x] Script de migración creado
- [x] Tabla `scraping_config` creada con configuración por defecto
- [x] Campos: max_concurrency, headless, bypass_cloudflare, request_delay_ms, active_portals, batch_size

**Archivos creados:**
- `readme/crear_tabla_scraping_config.py`

### 1.3 Crear endpoints de configuración ✅
- [x] `POST /api/v1/scraping/start` - Iniciar bot
- [x] `POST /api/v1/scraping/pause` - Pausar bot
- [x] `POST /api/v1/scraping/resume` - Reanudar bot
- [x] `POST /api/v1/scraping/kill` - Detener bot
- [x] `GET /api/v1/scraping/config` - Obtener configuración
- [x] `PUT /api/v1/scraping/config` - Actualizar configuración
- [x] `GET /api/v1/scraping/status` - Obtener estado
- [x] `GET /api/v1/scraping/logs` - Obtener logs
- [x] `DELETE /api/v1/scraping/logs` - Limpiar logs

**Integrado en:** `backend/app/api/v1/endpoints/scraping.py`

### 1.4 Implementar WebSocket para logs ✅
- [x] Crear endpoint `/api/v1/scraping/ws/logs`
- [x] ConnectionManager para manejo de conexiones
- [x] Broadcast de logs en tiempo real
- [x] Envío de estado periódico
- [x] Integración con router principal

**Archivos creados:**
- `backend/app/api/v1/endpoints/scraping_ws.py`

**Archivos modificados:**
- `backend/app/api/v1/api.py` (WebSocket router integration)

---

## 🔄 FASE 2: FRONTEND BASE (EN PROGRESO)

### 2.1 Extraer componentes UI primitivos ✅
- [x] Crear estructura de carpetas: `components/ui/`
- [x] Extraer `Button` de ControlBar.tsx
- [x] Extraer `Badge` de ControlBar.tsx
- [x] Extraer `Card`, `CardHeader`, `CardTitle`, `CardContent` de ConfigPanel.tsx
- [x] Extraer `Label` de ConfigPanel.tsx
- [x] Extraer `Switch` de ConfigPanel.tsx
- [x] Extraer `Input` de ConfigPanel.tsx
- [x] Extraer `BadgeToggle` de LogConsole.tsx

**Ubicación objetivo:**
- `frontend/src/modules/cost360/components/ui/`

### 2.2 Crear hooks personalizados ✅
- [x] `useScrapingWebSocket.ts` - Manejo de WebSocket
  - Conexión automática
  - Manejo de reconexión
  - Parseo de mensajes
  - Estados de conexión
- [x] `useScrapingApi.ts` - Llamadas HTTP
  - Control del bot (start/pause/kill/resume)
  - Gestión de configuración
  - Manejo de errores
  - Caching de respuestas

**Ubicación objetivo:**
- `frontend/src/modules/cost360/hooks/`

### 2.3 Crear contexto global ⏳
- [ ] `ScrapingDashboardContext.tsx`
  - Estado unificado del dashboard
  - Compartición de datos entre componentes
  - Sistema de eventos
  - Manejo de errores globales

**Ubicación objetivo:**
- `frontend/src/modules/cost360/context/`

---

## 🎨 FASE 3: FRONTEND INTEGRACIÓN (PENDIENTE)

### 3.1 Adaptar componentes existentes ⏸️
- [ ] Adaptar `ControlBar.tsx`
  - Importar componentes UI de `ui/`
  - Integrar con `useScrapingApi`
  - Conectar con contexto global
  - Manejo de estados dinámicos
- [ ] Adaptar `LogConsole.tsx`
  - Importar componentes UI de `ui/`
  - Integrar con `useScrapingWebSocket`
  - Sistema de filtros mejorado
  - Auto-scroll optimizado
- [ ] Adaptar `ConfigPanel.tsx`
  - Importar componentes UI de `ui/`
  - Integrar con `useScrapingApi`
  - Validación de valores
  - Sincronización con backend

**Ubicación objetivo:**
- `frontend/src/modules/cost360/components/scraping/`

### 3.2 Integrar en AdminDatabasePage ⏸️
- [ ] Crear nueva pestaña "Bot Scraping"
- [ ] Layout con 3 componentes
  - ControlBar (superior)
  - LogConsole (izquierda/centro)
  - ConfigPanel (derecha/lateral)
- [ ] Conexión con backend
- [ ] Manejo de estados de carga
- [ ] Sistema de notificaciones

**Archivos a modificar:**
- `frontend/src/modules/cost360/pages/AdminDatabasePage.jsx`

---

## 🧪 FASE 4: TESTING (PENDIENTE)

### 4.1 Pruebas unitarias de componentes ⏸️
- [ ] ControlBar functionality
- [ ] LogConsole filtering
- [ ] ConfigPanel validation
- [ ] Hooks functionality

### 4.2 Pruebas de integración ⏸️
- [ ] Backend-frontend communication
- [ ] WebSocket connectivity
- [ ] State management
- [ ] Error handling

### 4.3 Pruebas de usuario ⏸️
- [ ] Start/pause/kill workflow
- [ ] Configuration changes
- [ ] Log monitoring
- [ ] End-to-end scraping

---

## 📁 ESTRUCTURA FINAL DE ARCHIVOS

### Backend:
```
backend/app/
├── api/v1/endpoints/
│   ├── scraping.py ✅ (modificado)
│   └── scraping_ws.py ✅ (nuevo)
├── api/v1/api.py ✅ (modificado)
└── db/
    └── scraping_config ✅ (tabla creada)
```

### Frontend:
```
frontend/src/modules/cost360/
├── components/
│   ├── ui/ ⏳ (nueva carpeta)
│   │   ├── Button.tsx ⏸️
│   │   ├── Badge.tsx ⏸️
│   │   ├── Card.tsx ⏸️
│   │   ├── Input.tsx ⏸️
│   │   ├── Switch.tsx ⏸️
│   │   └── BadgeToggle.tsx ⏸️
│   └── scraping/ ⏳ (nueva carpeta)
│       ├── ControlBar.tsx ⏸️
│       ├── LogConsole.tsx ⏸️
│       └── ConfigPanel.tsx ⏸️
├── hooks/ ⏳ (nueva carpeta)
│   ├── useScrapingWebSocket.ts ⏸️
│   └── useScrapingApi.ts ⏸️
├── context/ ⏳ (nueva carpeta)
│   └── ScrapingDashboardContext.tsx ⏸️
└── pages/
    └── AdminDatabasePage.jsx ⏸️ (modificar)
```

---

## 🎯 CRITERIOS DE ÉXITO

### Backend:
- [x] Configuración dinámica funcional
- [x] Control completo del bot (start/pause/kill/resume)
- [x] WebSocket para logs en tiempo real
- [x] Persistencia de configuración en BD
- [x] Compatibilidad con funcionalidad existente

### Frontend:
- [ ] Componentes Shadcn UI consistentes
- [ ] WebSocket en tiempo real funcional
- [ ] Control de bot desde UI
- [ ] Configuración modificable desde UI
- [ ] Logs filtrables y monitoreables
- [ ] Error handling robusto

### Integración:
- [ ] Comunicación fluida frontend-backend
- [ ] Estados sincronizados
- [ ] UX intuitiva para ingenieros
- [ ] Performance aceptable

---

## 📝 NOTAS DE IMPLEMENTACIÓN

### Decisiones Técnicas:
1. **Cloudscraper:** Ya estaba en uso, mantenido para bypass Cloudflare
2. **Threading:** Usado para background tasks (no asyncio por compatibilidad)
3. **Estado Global:** Singleton pattern para simplicidad
4. **WebSocket:** Simple broadcast para logs (no rooms por ahora)
5. **UI Primitives:** Extraídos para reutilización futura

### Próximos Pasos Inmediatos:
1. ~~Crear carpetas frontend~~ (en progreso)
2. Extraer componentes UI primitivos
3. Crear hooks personalizados
4. Adaptar componentes existentes
5. Integrar en AdminDatabasePage

---

**Última actualización:** 2026-08-28 13:20  
**Estado Backend:** ✅ COMPLETADO  
**Estado Frontend:** ⏳ EN PROGRESO  
**Estado General:** 🔄 40% COMPLETADO