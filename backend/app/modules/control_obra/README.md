# Control de Obra

Módulo aislado para el control de avance físico y financiero de una obra.

No modifica el presupuesto original. El presupuesto, las modificaciones, el
adendum y los avances son entidades separadas.

## Estructura

```text
backend/app/modules/control_obra/
├── __init__.py
├── domain.py                  # Reglas de negocio y cálculos
├── simulate_example.py        # Simulación con el presupuesto de ejemplo
├── simulation_result.json     # Resultado generado por la simulación
├── fixtures/
│   └── example_budget.json    # Presupuesto de Ejemplo costbase.net
├── tests/
│   └── test_control_obra.py
└── README.md
```

## Conceptos

```text
PO  = Presupuesto original aprobado
A   = Aumentos aprobados
D   = Disminuciones aprobadas
OE  = Obras extras aprobadas
PM  = Presupuesto modificado

PM = PO + A - D + OE
```

Sin adendum:

```text
PM <= PO
```

Con adendum aprobado:

```text
PM <= PO + Adendum
```

El adendum no es una modificación de cantidad: es un instrumento contractual
que amplía los recursos disponibles.

## Avance

```text
Avance físico = Ejecutado / Presupuesto modificado
Avance financiero = Ejecutado / Monto contractual vigente
```

El avance financiero usa el monto contractual:

```text
Monto contractual = PO + Adendum aprobado
```

Todas las cantidades, montos y porcentajes se redondean a dos decimales con
`ROUND_HALF_UP`.

## Pruebas

Desde la raíz del repositorio:

```bash
PYTHONPATH=backend python -m pytest backend/app/modules/control_obra/tests/test_control_obra.py -q
```

En PowerShell:

```powershell
$env:PYTHONPATH = (Resolve-Path backend).Path
python -m pytest backend\app\modules\control_obra\tests\test_control_obra.py -q
```

Cubren:

- cálculo del presupuesto original,
- avance físico y financiero,
- disminución y aumento dentro del monto original,
- rechazo de un aumento sin adendum,
- aprobación de un adendum,
- obra extra,
- redondeo a dos decimales,
- rechazo de avance negativo.

## Simulación

```bash
python backend/app/modules/control_obra/simulate_example.py
```

La simulación usa:

```text
Presupuesto de Ejemplo costbase.net
ID: 436619ef-c7ca-4373-9651-971dd8bc4dea
```

Y ejecuta:

1. Avance inicial de tres partidas.
2. Una disminución.
3. Un aumento dentro del monto original.
4. Una obra extra rechazada por no tener adendum.
5. Aprobación de un adendum.
6. Aprobación de la obra extra.
7. Cálculo final de avance físico y financiero.

El resultado se guarda en `simulation_result.json`.

## Integración

El módulo ya incluye:

- modelos SQLAlchemy en `models.py`,
- servicio de integración en `service.py`,
- endpoints en `router.py`,
- botón y modal en `frontend/src/modules/control_obra/`.

Endpoints:

```text
GET  /api/v1/budgets/{budget_id}/control-obra
POST /api/v1/budgets/{budget_id}/control-obra/progress
POST /api/v1/budgets/{budget_id}/control-obra/modifications
POST /api/v1/budgets/{budget_id}/control-obra/modifications/{id}/approve
POST /api/v1/budgets/{budget_id}/control-obra/addenda
POST /api/v1/budgets/{budget_id}/control-obra/addenda/{id}/approve
```

La interfaz se abre desde el botón `Control de Obra` del presupuesto.
