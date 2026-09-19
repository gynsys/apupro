# Módulo de Planificación y Cronograma de Obra (CPM / Gantt)

> **Estado del Módulo:** En Pausa / Arquitectura base completada y preservada.  
> **Fecha de Pausa:** Septiembre 2026.  
> **Decisión:** Se preservó toda la base matemática, modelos, endpoints y prototipo frontend, pero se retiró la renderización del botón en la interfaz de usuario para retomarlo en una fase dedicada con mayor prioridad y mejor definición de UX/secuenciación constructiva.

---

## 1. Resumen Ejecutivo

El módulo de **Cronograma de Obra** calcula de forma determinista y sin uso de LLM las fechas tempranas, tardías, holguras y la **Ruta Crítica** de un proyecto de construcción a partir de las partidas de un presupuesto y sus rendimientos de APU, usando el método **CPM (Critical Path Method / PDM)**.

---

## 2. Componentes Implementados y Disponibles en el Código

### A. Motor Matemático Determinista (`backend/app/services/cpm_engine.py`)
- **Forward Pass:** Cálculo de Inicio Temprano ($ES$) y Fin Temprano ($EF$).
- **Backward Pass:** Cálculo de Inicio Tardío ($LS$) y Fin Tardío ($LF$).
- **Holguras:** Holgura Total ($TF = LS - ES$) y Holgura Libre ($FF$).
- **Ruta Crítica:** Actividades donde $TF \le 0$.
- **Duración por APU:** 
  $$\text{Duración (días)} = \max\left(1, \left\lceil \frac{\text{Cantidad}}{\text{Rendimiento} \times \text{Cuadrillas}} \right\rceil\right)$$
  *(Redondeo al entero superior).*
- **Relaciones PDM:** Fin a Comienzo ($FS$), Comienzo a Comienzo ($SS$), Fin a Fin ($FF$) y Comienzo a Fin ($SF$) con soporte para desfase (*lag* positivo y negativo).
- **Detección de Ciclos:** Algoritmo en grafo dirigido para detectar dependencias circulares y arrojar `CPMCycleError`.
- **Calendario Laboral:** Función `add_working_days` para semanas de 5 días (Lunes a Viernes) o 6 días (Lunes a Sábado).

### B. Pruebas Unitarias (`backend/tests/test_cpm.py`)
- Suite de pruebas con `pytest` que valida:
  - Red lineal secuencial básica ($FS$).
  - Red con caminos convergentes y divergentes.
  - Relaciones con desfase (*lag*).
  - Relaciones $SS$ y $FF$.
  - Detección de ciclos circulares ($A \to B \to C \to A$).
  - Cálculo de duraciones con cuadrillas y rendimiento de APU.

### C. Modelos de Base de Datos PostgreSQL (`backend/app/db/models/schedule.py`)
Las tablas están creadas y migradas en producción (`apupro_db`):
- `schedules`: Datos globales del cronograma vinculados a un presupuesto (`budget_id`), fecha de inicio del proyecto, días laborables por semana (5 o 6), duración total del proyecto.
- `schedule_activities`: Actividades importadas del presupuesto (`apu_item_id`), código/EDT, nombre, cantidad, rendimiento, cuadrillas, duración, $ES, EF, LS, LF$, $TF, FF$, fecha de inicio, fecha de fin y flag de `is_critical`.
- `schedule_dependencies`: Predecesora (`predecessor_id`), sucesora (`successor_id`), tipo (`FS`, `SS`, `FF`, `SF`) y desfase (`lag_days`).

### D. Endpoints REST (`backend/app/api/v1/endpoints/schedule.py`)
Registrados bajo el prefijo `/api/v1/schedules`:
- `GET /schedules/budget/{budget_id}`: Obtiene o inicializa el cronograma e importa automáticamente las partidas con cantidad $> 0$.
- `POST /schedules/{schedule_id}/import-budget`: Sincroniza partidas nuevas agregadas al presupuesto.
- `POST /schedules/{schedule_id}/calculate`: Recalcula el CPM, determina la ruta crítica y persiste los resultados en BD.
- `PUT /schedules/activities/{activity_id}`: Actualiza duración manual o número de cuadrillas de una actividad.
- `POST /schedules/dependencies`: Agrega una dependencia validando previamente que no cree un ciclo circular.
- `DELETE /schedules/dependencies/{dep_id}`: Elimina una dependencia.

### E. Frontend y Servicios (`frontend/src/pages/admin/SchedulePage.jsx`)
- `frontend/src/services/scheduleService.js`: Cliente API para comunicación con el backend.
- `frontend/src/pages/admin/SchedulePage.jsx`: Vista con métricas globales (Duración total, Actividades Críticas en rojo, Fecha Inicio, Selector 5/6 días), Diagrama de Gantt interactivo (`gantt-task-react`) y Tabla detallada CPM con modal para gestionar dependencias.
- Ruta activa en `frontend/src/App.jsx`: `/budgets/:id/schedule`.

---

## 3. Motivo de la Pausa y Aspectos a Resolver en la Reactivación

1. **Problema de Inicio en Día 1 (Red sin Precedencias Iniciales):**
   - Al importar un presupuesto por primera vez, las partidas se crean sin dependencias lógicas asignadas ($P(j) = \emptyset$).
   - Por definición matemática del método CPM, cualquier actividad sin predecesoras inicia en la fecha cero ($ES = 0$), haciendo que todas las partidas del presupuesto se dibujen en paralelo el mismo día.
2. **Requerimiento Constructivo:**
   - En una obra real, las partidas deben tener una secuencia cronológica (ej. Excavación $\to$ Fundaciones $\to$ Estructura $\to$ Acabados).
   - Para no obligar al usuario a enlazar manualmente decenas o cientos de partidas una por una, se requiere implementar un mecanismo de auto-secuenciación:
     - **Opción 1:** Auto-encadenamiento en cascada ($FS$) siguiendo el orden de la EDT/Capítulos del presupuesto.
     - **Opción 2:** Asistente con IA que analice las descripciones de las partidas y genere la malla lógica de precedencias constructivas con paralelismos y desfases típicos de obra.
3. **Optimización de UX/UI:**
   - Rediseñar y simplificar la interfaz de planificación para que se adapte con mayor fluidez al flujo de trabajo del usuario antes de exponerla públicamente.

---

## 4. Guía para Reactivar el Módulo en el Futuro

Cuando se decida retomar este desarrollo:

1. **Restaurar el botón en la interfaz:**
   - En `frontend/src/pages/admin/BudgetWorksheetPage.jsx`, volver a colocar el botón de acceso:
     ```jsx
     <button
       onClick={() => navigate(`/budgets/${id}/schedule`)}
       className="flex items-center justify-center gap-2 bg-white border border-red-200 text-red-700 hover:bg-red-50 px-3 py-2 rounded-xl font-medium shadow-xs text-xs sm:text-sm"
     >
       <Calendar size={16} className="text-red-600 shrink-0" />
       <span>Cronograma CPM</span>
     </button>
     ```
2. **Implementar auto-encadenamiento al importar:**
   - En `backend/app/api/v1/endpoints/schedule.py` (función `_import_budget_items_to_schedule`), al crear las actividades, generar automáticamente dependencias $FS$ entre ítems consecutivos de cada capítulo o según la secuencia deseada.
3. **Opcional - Asistente de Red con IA:**
   - Crear un endpoint `POST /schedules/{schedule_id}/suggest-dependencies-ai` que use el proveedor LLM existente en la plataforma para inferir dependencias entre actividades basándose en su descripción técnica.
