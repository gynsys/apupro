# Demo animado de la landing

Este directorio contiene el recorrido animado que se muestra en la sección
**“Interfaz diseñada para la Productividad”** de la landing de CostBase.

La animación es una capa de interacción sobre la interfaz de la plataforma:
no hay llamadas al backend ni se crean datos reales.

## Secuencia

```text
Presupuestos
  → clic en "Presupuesto de Ejemplo costbase.net"
Partidas del presupuesto
  → scroll
  → clic en el engranaje de una partida
Editor de APU
  → scroll por materiales, equipos y mano de obra
  → clic en Exportar a Excel
Modal de exportación
  → clic en cerrar
Rebobinado
  → vuelve a Presupuestos
```

El ciclo se repite automáticamente y comienza cuando la sección entra en el
viewport.

## Fases

Las fases y sus duraciones están en `AnimatedPreview.jsx`:

| Fase | Propósito |
| --- | --- |
| `budgets` | Muestra el gestor de presupuestos. |
| `budget-click` | Resalta y abre el presupuesto demo. |
| `partidas` | Muestra la lista de partidas. |
| `partidas-scroll` | Desplaza la lista. |
| `partida-click` | Resalta el engranaje de la partida. |
| `apu` | Muestra la parte superior del editor de APU. |
| `apu-scroll` | Desplaza el editor hacia equipos y mano de obra. |
| `export-click` | Resalta el botón de Excel. |
| `modal` | Muestra el modal de exportación. |
| `close-click` | Cierra el modal. |
| `rewind` | Regresa visualmente a presupuestos. |

Para cambiar la velocidad, modifica `duration` en `PHASES`.

## Archivos

```text
preview/
├── AnimatedPreview.jsx  # Máquina de estados, cursor, transiciones y loop
├── AnimatedCursor.jsx   # Puntero y efecto de clic
├── DemoChrome.jsx       # Marco de navegador del mockup
├── ExportModal.jsx      # Modal de exportación con botones reales
├── demoData.js          # Presupuestos, partidas e insumos de ejemplo
├── README.md
└── screens/
    ├── BudgetsScreen.jsx
    ├── PartidasScreen.jsx
    └── ApuScreen.jsx
```

## Reutilización de la UI real

- `ApuScreen` renderiza el componente real `ApuEditorUI` con datos estáticos
  (`demoApuItem`) y configuración de ejemplo (`demoApuSettings`).
- La vista de presupuestos replica la estructura y las acciones del gestor
  real (`btn-accion`, menú lateral, buscador y tarjetas).
- La vista de partidas incluye las acciones de la plataforma: Base de Datos,
  Actualizar Precios, Configuración Global, Imprimir, Agregar Partida,
  Agregar Capítulo y Exportar Excel.
- Los botones de exportación y cierre del modal son `<button>` reales.

## Interacción

- El cursor es decorativo (`pointer-events-none`).
- El APU está envuelto en `pointer-events-none` para que el demo no se pueda
  editar; el botón de exportación vive fuera de ese contenedor.
- El modal se puede abrir manualmente con el botón de Excel y cerrar con la X
  o con Cancelar.
- El demo no se pausa al pasar el mouse.

## Accesibilidad

- Si el usuario tiene activado `prefers-reduced-motion`, se muestra la pantalla
  de presupuestos sin animación.
- El cursor y los efectos de clic son `aria-hidden`.
- En pantallas pequeñas se oculta el cursor y se mantiene la transición entre
  vistas.

## Datos de ejemplo

- Presupuesto animado: **Presupuesto de Ejemplo costbase.net**.
- Se conserva **Muro de gaviones L=35 m** como segunda tarjeta.
- El APU de ejemplo es **Pintura elastomérica para techos**.

Los datos están en `demoData.js` y no provienen de la base de datos.
