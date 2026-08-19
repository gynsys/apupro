# Tareas: Módulo de Saneamiento e Indicadores de Mercado (Automatización)

## 1. Backend (Estructura Modular)
- [ ] Crear Modelos en `backend/app/db/models/market.py` (`CostMarketIndicator`, `CostMaterialFamily`).
- [ ] Actualizar Modelo `CostMaterial` en `cost360.py` con `market_indicator_id`, `family_id` y `market_factor`.
- [ ] Ejecutar script de base de datos para añadir las nuevas columnas (`ALTER TABLE`).
- [ ] Crear CRUD separado en `backend/app/crud/crud_market.py`.
- [ ] Crear Servicio de IA en `backend/app/services/ai_sanitization_service.py` (Lógica para limpiar nombres).
- [ ] Crear Router API en `backend/app/api/v1/endpoints/market.py` y registrarlo en `api.py`.

## 2. Frontend (Arquitectura Desacoplada)
- [ ] Crear servicio `frontend/src/modules/market/services/marketService.js`.
- [ ] Crear Página `frontend/src/modules/market/pages/MarketAdminPage.jsx`.
- [ ] Crear Componente `SanitizationPanel.jsx` (Interfaz para limpiar materiales en lote usando IA).
- [ ] Crear Componente `MarketIndicatorsPanel.jsx` (Interfaz para ver/editar los insumos líderes).
- [ ] Añadir la nueva página al enrutador principal y al menú de navegación del administrador.
