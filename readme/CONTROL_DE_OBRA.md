# Control de Obra

Documentación técnica y funcional del módulo de control de avance de obra.

> **Estado:** implementación inicial funcional en producción.
>
> **Módulo backend:** `backend/app/modules/control_obra/`
>
> **Módulo frontend:** `frontend/src/modules/control_obra/`
>
> **Último commit del módulo:** `6f28440`

---

## 1. Alcance

El módulo permite controlar la ejecución de un presupuesto sin modificar el
presupuesto original.

Incluye:

- avance físico ponderado,
- avance financiero,
- registro de cantidades ejecutadas por fecha,
- períodos de ejecución,
- cierre y reapertura de períodos con auditoría,
- aumentos,
- disminuciones,
- obras extras,
- presupuesto modificado,
- adendum al contrato,
- planificación por partida,
- curva S planificada vs real,
- reporte Excel.

No incluye todavía:

- certificaciones,
- valuaciones,
- pagos,
- retenciones,
- anticipos,
- reporte PDF,
- aprobación por roles,
- migraciones Alembic.

---

## 2. Terminología venezolana

```text
PO  = Presupuesto original aprobado
A   = Aumentos aprobados
D   = Disminuciones aprobadas
OE  = Obras extras aprobadas
PM  = Presupuesto modificado
AD  = Adendum aprobado
```

Regla:

```text
PM = PO + A - D + OE
```

Sin adendum:

```text
PM <= PO
```

Con adendum:

```text
PM <= PO + AD
```

El **adendum** no es una modificación de cantidad. Es el instrumento
contractual que amplía los recursos disponibles.

---

## 3. Arquitectura

### Backend

```text
backend/app/modules/control_obra/
├── __init__.py          # Exporta el dominio
├── domain.py            # Reglas de negocio puras
├── models.py            # Modelos SQLAlchemy
├── service.py           # Integración BD ↔ dominio
├── router.py            # Endpoints FastAPI
├── simulate_example.py  # Simulación con presupuesto real
├── simulation_result.json
├── fixtures/
│   └── example_budget.json
├── tests/
│   ├── test_control_obra.py
│   └── test_control_obra_api.py
└── README.md
```

Integraciones:

```text
backend/app/api/v1/api.py              # Incluye el router
backend/app/db/models/__init__.py      # Registra las tablas
```

### Frontend

```text
frontend/src/modules/control_obra/
├── ControlObraModal.jsx
└── controlObraService.js
```

Integraciones:

```text
frontend/src/pages/admin/budget_worksheet/BudgetWorksheetHeader.jsx
frontend/src/pages/admin/budget_worksheet/BudgetWorksheetView.jsx
```

El botón se muestra en la cabecera del presupuesto:

```text
[ Control de Obra ]
```

---

## 4. Base de datos

Las tablas se crean automáticamente al iniciar el backend mediante
`Base.metadata.create_all`.

| Tabla | Uso |
|---|---|
| `control_obra_modifications` | Cabecera de aumentos, disminuciones y obras extras |
| `control_obra_modification_items` | Líneas de cada modificación |
| `control_obra_addenda` | Adendum contractual |
| `control_obra_progress_entries` | Cantidades ejecutadas por fecha |
| `control_obra_periods` | Períodos de ejecución |
| `control_obra_plans` | Fechas planificadas por partida |
| `control_obra_audit` | Auditoría de cierres y reaperturas |

### Importante sobre migraciones

`create_all` crea tablas nuevas, pero **no modifica tablas existentes**.

Si se agrega una columna a una tabla que ya existe en producción, hay que
ejecutar un `ALTER TABLE` manual o crear una migración. No asumir que
`create_all` actualizará el esquema.

---

## 5. Reglas de cálculo

Todas las cantidades, montos y porcentajes se redondean a dos decimales con
`ROUND_HALF_UP`.

### Peso de una partida

```text
Peso_i = Monto vigente de la partida / Monto modificado total
```

### Avance físico

```text
Avance_i = min(Cantidad ejecutada_i / Cantidad vigente_i, 1)

Avance físico = Σ (Peso_i × Avance_i)
```

El límite a 100% evita que una partida excedida infle el avance contractual.
Los excesos se muestran por partida en `item_progress`.

### Avance financiero

Implementación actual:

```text
Avance financiero = Monto ejecutado / Monto contractual
```

Donde:

```text
Monto contractual = PO + Adendum aprobado
```

### Limitación conocida

Hoy el avance financiero usa **ejecutado**, no **certificado**. Por eso puede
coincidir con el físico cuando no hay adendum, cambios de precio ni
certificaciones.

La fórmula objetivo es:

```text
Avance financiero = Monto certificado / Monto contractual
```

Para implementarla falta agregar el registro y aprobación de certificaciones.

### Equivalencia

Con precios constantes y sin excesos:

```text
Σ (Ejecutado_i × P.U._i)
────────────────────────
Σ (Cantidad vigente_i × P.U._i)
```

es equivalente al promedio ponderado por montos.

---

## 6. Flujo funcional

### Registrar avance

```text
Control de Obra
→ Partidas
→ Cantidad ejecutada
→ Fecha
→ Registrar
```

### Modificación

```text
Control de Obra
→ Modificaciones
→ Tipo: aumento, disminución u obra extra
→ Partida, cantidad y precio
→ Crear
→ Aprobar
```

Validación al aprobar:

```text
Presupuesto modificado <= Monto contractual disponible
```

Si supera el monto original y no hay adendum, la aprobación se rechaza.

### Adendum

```text
Control de Obra
→ Adendum
→ Monto adicional
→ Crear
→ Aprobar
```

Al aprobarlo, el monto contractual se amplía y las modificaciones pendientes
pueden aprobarse si caben en el nuevo monto.

### Períodos

```text
Control de Obra
→ Períodos
→ Crear
→ Cerrar
→ Reabrir con motivo
```

Un período cerrado rechaza nuevos avances. La reapertura queda auditada.

### Curva S

```text
Control de Obra
→ Curva S
```

Requiere que las partidas tengan fechas planificadas. Actualmente la
planificación se carga por API:

```http
POST /api/v1/budgets/{budget_id}/control-obra/plan
```

Falta el formulario de planificación en la interfaz.

### Reporte

Botón de descarga en la cabecera del modal:

```text
[↓]
```

Genera un Excel con:

- Resumen.
- Partidas.
- Modificaciones.
- Adendum.

---

## 7. API

Base:

```text
/api/v1/budgets/{budget_id}/control-obra
```

| Método | Ruta | Uso |
|---|---|---|
| GET | `/` | Resumen completo |
| POST | `/progress` | Registrar avance |
| POST | `/modifications` | Crear modificación |
| POST | `/modifications/{id}/approve` | Aprobar modificación |
| POST | `/addenda` | Crear adendum |
| POST | `/addenda/{id}/approve` | Aprobar adendum |
| GET | `/periods` | Listar períodos |
| POST | `/periods` | Crear período |
| POST | `/periods/{id}/close` | Cerrar período |
| POST | `/periods/{id}/reopen` | Reabrir período |
| POST | `/plan` | Planificar una partida |
| GET | `/curve` | Curva S |
| GET | `/report.xlsx` | Reporte Excel |

### Ejemplo de avance

```json
{
  "item_id": "uuid-de-la-partida",
  "quantity": 2.5,
  "entry_date": "2026-11-01",
  "notes": "Frente 1"
}
```

### Ejemplo de modificación

```json
{
  "kind": "increase",
  "code": "AUM-001",
  "description": "Aumento por ajuste de proyecto",
  "lines": [
    {
      "item_id": "uuid-de-la-partida",
      "quantity_delta": 5,
      "unit_price": 100
    }
  ]
}
```

### Ejemplo de obra extra

```json
{
  "kind": "extra_work",
  "code": "OE-001",
  "description": "Alcantarilla adicional",
  "lines": [
    {
      "item_id": null,
      "code": "EXTRA-001",
      "description": "Alcantarilla adicional",
      "unit": "und",
      "quantity_delta": 1,
      "unit_price": 500,
      "is_new_item": true
    }
  ]
}
```

### Ejemplo de adendum

```json
{
  "amount": 500,
  "code": "AD-001",
  "description": "Recursos adicionales aprobados"
}
```

---

## 8. Autenticación y permisos

Todos los endpoints usan:

```text
get_current_arko_admin
```

Y validan que el presupuesto pertenezca al usuario autenticado.

Actualmente **cualquier usuario propietario del presupuesto** puede:

- registrar avance,
- crear modificaciones,
- aprobar modificaciones,
- crear adendum,
- aprobar adendum,
- cerrar y reabrir períodos.

No existe todavía una separación de roles residente/supervisor/administrador.

---

## 9. Pruebas

### Ejecutar

PowerShell:

```powershell
$env:PYTHONPATH = (Resolve-Path backend).Path
python -m pytest backend\app\modules\control_obra\tests -q
```

Linux/macOS:

```bash
PYTHONPATH=backend python -m pytest backend/app/modules/control_obra/tests -q
```

### Cobertura actual

```text
11 passed
```

- 7 pruebas de dominio.
- 4 pruebas de integración con SQLite en memoria.

Cubren:

- presupuesto original,
- avance físico y financiero,
- aumentos y disminuciones,
- adendum,
- obra extra,
- rechazo sin adendum,
- períodos cerrados y reapertura,
- curva,
- reporte Excel,
- redondeo a dos decimales,
- cantidades negativas.

### Limitaciones de las pruebas

- No hay prueba visual del modal.
- No hay prueba de concurrencia.
- No hay prueba de rendimiento con presupuestos grandes.
- No hay prueba de migración de esquema.

---

## 10. Despliegue

Servidor:

```text
/root/apupro_platform
```

Comandos:

```bash
docker compose build apupro-backend apupro-frontend
docker compose up -d apupro-backend apupro-frontend
```

Verificar:

```bash
docker ps
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8010/health
```

Tablas:

```sql
SELECT tablename
FROM pg_tables
WHERE tablename LIKE 'control_obra%'
ORDER BY tablename;
```

### Historial de commits del módulo

```text
600a384  feat(control-obra): modulo de avance, modificaciones, adendum y periodos
5bf5e73  fix(control-obra): avance fisico ponderado, redondeo y tab activo
a88d55d  fix(control-obra): indicador de pestana por fondo activo
6f28440  fix(control-obra): evitar solapamiento del encabezado y pestanas
```

---

## 11. Datos de prueba en producción

El presupuesto:

```text
Presupuesto de Ejemplo costbase.net
ID: 436619ef-c7ca-4373-9651-971dd8bc4dea
```

Contiene datos creados durante la validación:

```text
Período:      Noviembre 2026
Disminución:  DIS-001
Aumento:      AUM-001
Obra extra:   OE-001
Adendum:      AD-001
Avances:      registros de prueba
Plan:         partida EOP072
```

Si se quiere dejar limpio para una demostración nueva, hay que eliminar esos
registros de las tablas `control_obra_*` asociadas a ese presupuesto.

---

## 12. Problemas conocidos y deuda técnica

1. **Avance financiero usa ejecutado**, no certificado.
2. **Obras extras** se suman al monto modificado, pero no se convierten en
   `BudgetItem`, por lo que no tienen fila propia para registrar avance.
3. **La planificación no tiene formulario** en la interfaz; solo API.
4. **No hay roles de aprobación**.
5. **No hay auditoría de modificaciones y adendum**, solo de períodos.
6. **No hay migraciones Alembic**.
7. **No hay bloqueo optimista**: dos usuarios podrían aprobar a la vez.
8. **No se valida cantidad negativa en modificaciones** que puedan dejar una
   cantidad vigente menor que cero.
9. **No hay reporte PDF**.
10. **No hay certificaciones, pagos, retenciones ni anticipos**.
11. Se usan `datetime.utcnow()` y aparecen advertencias de deprecación.
12. El modal usa `window.prompt` para el motivo de reapertura.

---

## 13. Roadmap recomendado

### Fase 1: cierre financiero

- Certificaciones por período.
- Monto certificado.
- Avance financiero = certificado / contractual.
- Avance pagado = pagos / contractual.
- Retenciones y anticipos.

### Fase 2: obras extras completas

- Convertir una obra extra aprobada en `BudgetItem`.
- Permitir registrar avance sobre esa nueva partida.
- Recalcular pesos y avance físico.

### Fase 3: planificación y curva

- Formulario de fechas planificadas por partida.
- Distribución semanal/mensual.
- Curva S con gráfico.
- Comparación planificado vs real.
- Alertas de atraso.

### Fase 4: gobierno y auditoría

- Roles residente, supervisor, administrador.
- Aprobación en dos pasos.
- Auditoría de modificaciones y adendum.
- Bloqueo optimista.
- Reapertura con flujo formal, no `window.prompt`.

### Fase 5: reportes

- PDF de control de obra.
- Reporte por período.
- Reporte de modificaciones.
- Reporte de certificaciones.

### Fase 6: migraciones

- Introducir Alembic.
- Versionar las tablas `control_obra_*`.
- Evitar cambios manuales en producción.

---

## 14. Mantenimiento

### Agregar un campo

1. Modificar el modelo en `models.py`.
2. Si la tabla ya existe en producción, ejecutar `ALTER TABLE`.
3. Actualizar `service.py`.
4. Actualizar el schema del router si aplica.
5. Agregar prueba.
6. Reconstruir backend.

### Agregar un endpoint

1. Agregar schema Pydantic en `router.py`.
2. Agregar función en `service.py`.
3. Validar reglas en `domain.py` si es lógica de negocio.
4. Agregar prueba de API.
5. Reconstruir backend.

### Cambiar una fórmula

1. Modificar `domain.py`.
2. Ejecutar pruebas de dominio.
3. Verificar que `summary()` siga devolviendo los campos esperados.
4. Actualizar esta documentación.
5. Reconstruir backend y probar con un presupuesto de ejemplo.

### Cambiar la interfaz

1. Modificar `ControlObraModal.jsx`.
2. Actualizar `controlObraService.js` si hay un endpoint nuevo.
3. Ejecutar `npm --prefix frontend run build`.
4. Verificar que el modal no pierda el scroll ni el encabezado.
5. Reconstruir frontend.

---

## 15. Comandos útiles

### Pruebas

```powershell
$env:PYTHONPATH = (Resolve-Path backend).Path
python -m pytest backend\app\modules\control_obra\tests -q
```

### Simulación

```bash
python backend/app/modules/control_obra/simulate_example.py
```

Genera:

```text
backend/app/modules/control_obra/simulation_result.json
```

### Build frontend

```bash
npm --prefix frontend run build
```

### Consultar tablas

```sql
SELECT tablename
FROM pg_tables
WHERE tablename LIKE 'control_obra%';
```

### Consultar avance de un presupuesto

```sql
SELECT *
FROM control_obra_progress_entries
WHERE budget_id = '436619ef-c7ca-4373-9651-971dd8bc4dea'
ORDER BY entry_date;
```

---

## 16. Referencias

- [README del módulo](../backend/app/modules/control_obra/README.md)
- [Dominio](../backend/app/modules/control_obra/domain.py)
- [Modelos](../backend/app/modules/control_obra/models.py)
- [Servicio](../backend/app/modules/control_obra/service.py)
- [Router](../backend/app/modules/control_obra/router.py)
- [Pruebas](../backend/app/modules/control_obra/tests)
- [Simulación](../backend/app/modules/control_obra/simulate_example.py)
