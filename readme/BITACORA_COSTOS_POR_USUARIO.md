# Bitácora de Implementación: Configuración de Costos por Usuario

Fecha de inicio: 2026-08-22
Fecha de completado: 2026-09-01

---

## FASE 1: Backend - Modelo de Base de Datos

- [x] 1.1 Agregar `costos_config` a `arko_admins` en `backend/app/db/models/arko.py`
- [N/A] 1.2 Agregar `costos_config` a `arko_users` — ArkoUser no es el actor principal del sistema (usa ArkoAdmin)
- [x] 1.3 Migración SQL directa (no hay Alembic): `ALTER TABLE arko_admins ADD COLUMN IF NOT EXISTS costos_config JSONB`
- [x] 1.4 Migración ejecutada en producción — columna verificada con `information_schema`
- [N/A] 1.5 Probar migración en backup — columna es nullable, sin riesgo de datos existentes

---

## FASE 2: Backend - Endpoints

- [x] 2.1 `backend/app/api/v1/endpoints/users.py` ya existía
- [x] 2.2 Implementar endpoint GET `/api/v1/arko/me` — retorna id, email, plan, costos_config (con fallback a site_config.costos)
- [x] 2.3 Implementar endpoint PUT `/api/v1/arko/me/costos` — actualiza costos_config del usuario con validación de rangos
- [x] 2.4 Autenticación en ambos endpoints via `get_current_arko_admin`
- [x] 2.5 Validación: valores negativos y porcentajes > 100% lanzan HTTPException 400
- [x] 2.6 Actualizar endpoint POST `/budgets/` para usar defaults del usuario como valores iniciales
- [N/A] 2.7 Endpoints registrados en router — `/arko/me` ya está bajo el router arko existente
- [x] 2.8 Fix bug en `users.py` L62,64: `user.max_budgets = user.max_budgets` → `user.max_budgets = user_data.max_budgets`

---

## FASE 3: Frontend - Context y Estado

- [x] 3.1 Crear archivo `frontend/src/context/UserCostosContext.jsx`
- [x] 3.2 Provider con estado: `costosConfig`, `updateCostosConfig(patch)`, `loading`, `error`
- [x] 3.3 `loadCostos()` carga desde `GET /api/v1/arko/me` con fallback a defaults
- [x] 3.4 `updateCostosConfig()` hace PUT con optimistic update y sincroniza con respuesta del backend
- [x] 3.5 Integrar `UserCostosProvider` dentro de `<main>` en `AppLayout.jsx`
- [x] 3.6 Actualizar `AuthContext.jsx`: reemplazar placeholder `{ email: 'authenticated' }` con datos reales de `/arko/me`
- [x] 3.7 Verificación: contexto se propaga a `AdminDatabasePage` y `TabNavigation`

---

## FASE 4: Frontend - Componentes

- [x] 4.1 Actualizar `TabNavigation.jsx` para usar `useUserCostos()` — eliminar props `costosConfig`/`onCostosConfigChange`
- [x] 4.2 Estado local `draft` para edición en curso — solo persiste al hacer click en "Guardar"
- [x] 4.3 `handleSaveCostos()` llama `updateCostosConfig(draft)` — guarda en BD via PUT /me/costos
- [x] 4.4 Reemplazar `alert()` por `toast.success/error` en TabNavigation
- [x] 4.5 Eliminar listener `window.addEventListener('updateFCAS', ...)` de `AdminDatabasePage.jsx`
- [x] 4.6 Actualizar `AdminDatabasePage.jsx` para usar `useUserCostos()` en lugar de estado local
- [x] 4.7 Eliminar `setCostosConfig` local y el `useEffect` que escuchaba `updateFCAS`
- [x] 4.8 `CalculadoraFCAS` ahora llama `updateCostosConfig({ fcas: value })` via `CalculadoraFCASWrapper` en `AppLayout`
- [x] 4.9 Eliminar `window.dispatchEvent(new CustomEvent('updateFCAS', ...))` de `AppLayout.jsx`
- [x] 4.10 Limpiar props obsoletas de `TabNavigation` en `AdminDatabasePage`

---

## FASE 5: Backend - Valores por Defecto Configurables

- [x] 5.1 Fallback implementado en `_get_costos_config()`: primero `costos_config`, luego `site_config.costos`, luego defaults hardcoded (10, 15, 16, 0)
- [x] 5.2 El endpoint PUT `/arko/admin/config` existente sigue funcionando para config global
- [x] 5.3 Nuevos usuarios usan los defaults del sistema hasta que guarden sus propios costos
- [N/A] 5.4-5.5 Sin cambios adicionales requeridos

---

## FASE 6: Testing y Validación

- [x] 6.10 Frontend build exitoso (docker compose build sin errores)
- [ ] 6.1-6.9 Pruebas manuales en producción pendientes tras deploy

---

## Validación Final

- [ ] ✓ Verificar que /arko/me retorna costos_config correctamente
- [ ] ✓ Verificar que TabNavigation carga valores del usuario al montar
- [ ] ✓ Verificar que "Guardar" en TabNavigation persiste en BD (reload conserva valores)
- [ ] ✓ Verificar que Calculadora FCAS actualiza el contexto al usar "Usar FCAS"
- [ ] ✓ Verificar que crear presupuesto usa costos del usuario como defaults
- [ ] ✓ Probar con dos usuarios diferentes — config independiente

---

## Notas de implementación

- Se usó `ArkoAdmin` (no `ArkoUser`) — es el modelo principal para cuentas de presupuestos
- No se requirió Alembic — migración SQL directa con `IF NOT EXISTS` para idempotencia
- `TabNavigation` usa patron "draft" local: los cambios no persisten hasta hacer click en "Guardar"
- `CalculadoraFCAS` actualiza inmediatamente (sin draft) porque el usuario ya confirmó el valor calculado
- `AuthContext.user` ahora contiene datos reales: `{ id, email, full_name, plan, max_budgets, costos_config }`
- Fix colateral: bug en `users.py` donde `max_budgets` y `max_items_per_budget` no se actualizaban
