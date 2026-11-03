# Aislamiento de usuarios

Auditoría de aislamiento entre usuarios de Costbase/APUPro.

> Fecha: 02/11/2026
>
> Alcance: presupuestos, partidas, componentes APU, APUs personalizados,
> comparticiones, notificaciones, usuarios y bases Cost360.

---

## 1. Regla

Cada usuario solo puede leer, modificar o eliminar sus propios datos.

El superadmin puede administrar cuentas y la base maestra, pero **no puede
borrar APUs personalizados ni presupuestos de otro usuario**.

Las comparticiones son copias independientes: el receptor puede eliminar su
copia sin afectar al emisor.

---

## 2. Matriz de endpoints

| Área | Endpoint | Aislamiento | Estado |
|---|---|---|---|
| Presupuestos | `GET/POST /budgets` | filtra `user_id` | OK |
| Presupuestos | `GET/PUT/DELETE /budgets/{id}` | filtra `user_id` | OK |
| Presupuestos | `POST /budgets/{id}/duplicate` | filtra `user_id` | OK |
| Presupuestos | `POST /budgets/{id}/share-to-user` | crea copia para destinatario | OK |
| Presupuestos | `GET /budgets/shared/*` | token público intencional | PÚBLICO |
| Partidas | `POST/PUT/DELETE /budgets/{id}/items` | valida dueño del presupuesto | OK |
| Componentes APU | `/budgets/{id}/items/{item}/materials` | valida presupuesto y partida | CORREGIDO |
| Componentes APU | `/budgets/{id}/items/{item}/equipments` | valida presupuesto y partida | CORREGIDO |
| Componentes APU | `/budgets/{id}/items/{item}/labors` | valida presupuesto y partida | CORREGIDO |
| APUs personalizados | `GET /costbase/items?database_id=personalizada` | filtra `user_id` | CORREGIDO |
| APUs personalizados | `DELETE /costbase/custom-apus/{id}` | UUID exacto + dueño | CORREGIDO |
| APUs compartidos | `POST /costbase/custom-apus/share` | copia propia del receptor | CORREGIDO |
| Base maestra | `DELETE /costbase/items/{code}` | solo superadmin | CORREGIDO |
| Base maestra | `PUT /costbase/items/{code}/apu` | solo superadmin | CORREGIDO |
| Usuarios | `GET /users/` | solo superadmin | CORREGIDO |
| Usuarios | `PUT/DELETE /users/{id}` | solo superadmin | CORREGIDO |
| Usuarios | `POST /users/system/process-expirations` | solo superadmin | CORREGIDO |
| Usuarios | `GET /users/search` | necesario para compartir | REVISAR |
| Notificaciones | `GET/PUT /notifications` | filtra `user_id` | OK |
| Bases Cost360 | `GET /costbase/databases` | propias o publicadas | OK |
| Bases Cost360 | `PUT/DELETE /costbase/databases/{id}` | valida `owner_id` | OK |
| Recursos Cost360 | `/costbase/resources` | catálogo global | GLOBAL |
| Market | `/market/*` | catálogo global | GLOBAL |

---

## 3. Correcciones aplicadas

### APUs personalizados

- Borrado solo por UUID exacto.
- Sin búsqueda por prefijo, código o contenido de `apu_data`.
- Solo el dueño puede borrar.
- Superadmin sin excepción sobre APUs personales.

### APUs compartidos

Antes la copia compartida quedaba con `user_id` del emisor. Ahora:

```text
user_id = destinatario
shared_with_user_id = destinatario
shared_by_user_id = emisor
```

Se migraron las copias compartidas existentes.

### Componentes APU

Los endpoints de materiales, equipos y mano de obra solo validaban la partida,
no el dueño del presupuesto. Ahora validan:

```text
Budget.id == budget_id
Budget.user_id == current_user.id
BudgetItem.id == item_id
BudgetItem.budget_id == budget_id
```

### Usuarios

Listar, actualizar, eliminar usuarios y procesar expiraciones ahora requiere
superadmin.

### Base maestra

Borrar o modificar partidas de la base maestra requiere superadmin.

---

## 4. Pruebas

```text
6 passed
```

Pruebas específicas:

- [`test_custom_apu_isolation.py`](../backend/tests/test_custom_apu_isolation.py)
- [`test_user_component_isolation.py`](../backend/tests/test_user_component_isolation.py)

Además:

```text
11 passed
```

para Control de Obra.

### Verificación en producción

```text
roomelt intenta borrar APU del admin             → 403
admin intenta borrar APU del usuario 10          → 403
roomelt intenta borrar partida maestra           → 403
roomelt intenta agregar componente a presupuesto ajeno → 404
roomelt intenta actualizar usuario                → 403
roomelt intenta abrir presupuesto ajeno           → 404
```

---

## 5. Riesgos pendientes

1. **Búsqueda de usuarios** devuelve usuarios a cualquier autenticado. Es
   necesaria para compartir, pero conviene limitar campos o permitir búsqueda
   por correo exacto.
2. **Recursos y market** son catálogos globales; no son datos personales, pero
   sus endpoints de escritura deben revisarse.
3. **Enlaces públicos** de presupuestos y partidas son intencionales; cualquiera
   con el token puede verlos.
4. **Sin pruebas A/B de todos los endpoints**: la matriz cubre los flujos
   principales, no cada ruta.
5. **Sin borrado lógico** para presupuestos y APUs.
6. **Sin auditoría** de eliminaciones de presupuestos.

---

## 6. Recomendaciones

- Agregar `deleted_at` y papelera por usuario.
- Auditar `DELETE` de presupuestos y APUs.
- Añadir pruebas A/B para cada router.
- Revisar endpoints de recursos y market.
- No usar el rol `admin` como sinónimo de superadmin.
- Migrar a un identificador de tenant explícito si se agregan más bases.
