# Bitácora de Implementación: Diseño Responsive y Mobile-First

**Fecha:** Septiembre 2026  
**Plataforma:** APUPro Platform (CostBase)  
**Entorno:** React 18 + Vite + Tailwind CSS  
**Objetivo de Pantalla:** Viewports móviles `≤ 768px` y ultra-estrechos `≤ 480px`, preservando la experiencia de escritorio.

---

## 1. Contexto y Diagnóstico Inicial

La plataforma APUPro fue concebida originalmente con una interfaz optimizada para escritorio, orientada a la manipulación densa de datos de ingeniería civil y presupuestaria (tablas de Análisis de Precios Unitarios con 7 a 9 columnas técnicas por insumo, selectores de bases de datos maestras y paneles de métricas). 

Al visualizar la aplicación en dispositivos móviles (smartphones y tablets compactas), se identificaron las siguientes deficiencias:
1. **Desborde Horizontal y Ruptura del Viewport:** Tablas con anchos fijos o colapsables que forzaban desplazamiento lateral en todo el documento o comprimían las columnas hasta hacer los números y descripciones ilegibles.
2. **Forzado de Zoom en iOS Safari:** Inputs y selects con `font-size` inferior a `16px` provocaban que Safari en iPhone aplicara un zoom automático al enfocar formularios, rompiendo la alineación de la interfaz.
3. **Muescas y Barras Dinámicas:** La barra de direcciones dinámica de los navegadores móviles y las áreas no seguras (Notch, Dynamic Island, Home Indicator) recortaban controles en la parte superior e inferior.
4. **Drawers y Navegación sin Contexto:** El menú lateral en móvil solo mostraba iconos colapsados sin texto descriptivo, impidiendo saber a qué módulo correspondía cada opción.
5. **Modales Desbordados:** Los diálogos y selectores de insumos sobrepasaban el alto de la pantalla o carecían de áreas de toque cómodas (`≥ 44px`).

---

## 2. Fase 0 & 1: Configuración Base Global (HTML, Tailwind y CSS)

### 2.1. Soporte de Áreas Seguras (Notch / Dynamic Island)
- **Archivo:** `frontend/index.html`
- **Modificación:** Se incorporó `viewport-fit=cover` a la etiqueta meta de viewport:
  ```html
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  ```
- **Propósito:** Habilitar en navegadores móviles el cálculo real de las funciones `env(safe-area-inset-top)`, `env(safe-area-inset-bottom)`, `env(safe-area-inset-left)` y `env(safe-area-inset-right)`.

### 2.2. Extensión del Tema en Tailwind CSS
- **Archivo:** `frontend/tailwind.config.js`
- **Modificación:** Se agregaron tokens de espaciado para áreas seguras y altura dinámica:
  ```javascript
  extend: {
    spacing: {
      'safe-top': 'env(safe-area-inset-top, 0px)',
      'safe-bottom': 'env(safe-area-inset-bottom, 0px)',
      'safe-left': 'env(safe-area-inset-left, 0px)',
      'safe-right': 'env(safe-area-inset-right, 0px)',
    },
    height: {
      'screen-dvh': '100dvh',
    },
    minHeight: {
      'screen-dvh': '100dvh',
    },
    maxHeight: {
      'screen-dvh': '100dvh',
    }
  }
  ```

### 2.3. Resets y Utilidades Globales
- **Archivo:** `frontend/src/index.css`
- **Modificaciones:**
  1. **Contenedor Root Full-Bleed:**
     ```css
     html, body, #root {
       width: 100%;
       max-width: none;
       min-height: 100dvh;
     }
     ```
  2. **Regla Global Anti-Zoom iOS (Crucial):**
     ```css
     @media screen and (max-width: 768px) {
       input, select, textarea {
         font-size: 16px !important;
       }
     }
     ```
     *Garantiza que ningún campo de formulario active el molesto zoom forzado de iOS.*
  3. **Utilidades de Toque y Áreas Seguras:**
     ```css
     @layer utilities {
       .pt-safe { padding-top: max(4px, env(safe-area-inset-top, 0px)); }
       .pb-safe { padding-bottom: max(4px, env(safe-area-inset-bottom, 0px)); }
       .pl-safe { padding-left: max(4px, env(safe-area-inset-left, 0px)); }
       .pr-safe { padding-right: max(4px, env(safe-area-inset-right, 0px)); }
       .touch-target { min-height: 44px; min-width: 44px; }
       .no-scrollbar::-webkit-scrollbar { display: none; }
       .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
     }
     ```

---

## 3. Fase 2: Shell de la Aplicación y Navegación Responsive

### 3.1. Layout Principal (`frontend/src/components/layout/AppLayout.jsx`)
- **Altura Dinámica:** Se reemplazó `h-screen` por `h-[100dvh] max-h-[100dvh]` para sincronizar el tamaño del shell con las barras dinámicas del navegador móvil.
- **Header:** Incorpora clase `pt-safe` y espaciado adaptativo `px-3 sm:px-6` y `h-14 sm:h-16`.
- **Menú Lateral Móvil (Drawer):**
  - Configurado a `w-[85vw] max-w-xs` con animación suave y fondo `backdrop-blur-sm`.
  - Se configuró con `isMobile={true}` para que los elementos del menú muestren **icono Y texto descriptivo** (en lugar de solo iconos colapsados), con altura mínima táctil `>= 44px` (`touch-target`).

### 3.2. Layout de Administración y Header Móvil
- **Archivos:** `frontend/src/components/layout/AdminLayout.jsx` y `frontend/src/components/layout/AdminHeader.jsx`
- **Modificaciones:**
  - El shell administrativo adopta `min-h-[100dvh]` y sidebar drawer con soporte para `pt-safe` y `pb-safe`.
  - El botón de apertura de menú (hamburguesa) en `AdminHeader.jsx` se rediseñó con dimensiones mínimas táctiles de 44x44px.

---

## 4. Fase 3: Componentes Core de Ingeniería

### 4.1. Dashboard y Explorador de Bases de Datos (`frontend/src/modules/costbase/pages/CostbaseDashboard.jsx`)
- **Pestañas Desplazables:** Pestañas superiores en contenedor `overflow-x-auto no-scrollbar` para navegación horizontal táctil fluida sin romper el ancho del teléfono.
- **Resumen Financiero:** Las métricas de costos se adaptaron a una cuadrícula responsive `grid grid-cols-4 sm:flex`.
- **Selector de Bases de Datos:** Ajustado a ancho completo en móviles (`w-full sm:w-auto`).

### 4.2. Editor Unificado de APU (`frontend/src/components/ApuEditorUI.jsx`)
El editor de APU es el componente técnico más crítico de la plataforma. Se reestructuró de la siguiente forma:
- **Ficha de Encabezado:** Se distribuyeron los datos de la partida (código Covenin, unidad, rendimiento, cantidad) en una cuadrícula responsiva `grid grid-cols-2 md:grid-cols-4`, evitando solapamiento de textos.
- **Tablas de Insumos (Materiales, Equipos y Mano de Obra):**
  - Cada una de las 3 tablas fue encapsulada en un contenedor con `overflow-x-auto` y `min-w-[620px]`.
  - **Solución técnica:** Impide que las 7 a 9 columnas técnicas (Código, Descripción, Unidad, Rendimiento, Cantidad, Desperdicio, Precio, Subtotal) se compriman hasta ser ilegibles, permitiendo scroll horizontal interno sin desplazar el resto de la página.
- **Resumen de Costos y Factores Indirectos:**
  - Los bloques de Subtotal A, B, Costo Directo, Porcentaje de Administración, Utilidad e IVA se reordenaron mediante `flex flex-col lg:flex-row`, apilándose limpiamente en pantallas móviles.

### 4.3. Generador de APU con IA (`frontend/src/modules/costbase/pages/AIApuGeneratorPage.jsx`)
- **Botones de Acción:** Los botones "Añadir Fila", "Guardar APU", "Importar Partida Base" y "Generar con IA" se apilaron a ancho completo en pantallas móviles (`w-full sm:w-auto min-h-[44px]`).
- **Modal del Asistente Guiado:** Ajustado a `max-h-[90dvh]` con scroll vertical independiente y botón de cerrar táctil.

---

## 5. Fase 4: Modales Globales y Selectores de Insumos

### 5.1. Selector Universal de Insumos (`frontend/src/components/ComponentSelectorModal.jsx`)
Este componente alimenta la selección de **Materiales, Equipos y Mano de Obra** en todo el sistema:
- **Estructura:** Contenedor modal adaptativo `h-[95dvh] sm:h-auto sm:max-h-[88vh]`.
- **Tabla de Insumos:** Envuelto en scroll horizontal con `min-w-[500px]`, garantizando que el usuario pueda ver el código, descripción completa, unidad y precio unitario desde su smartphone antes de seleccionar.
- **Botones de Acción y Cierre:** Accesibilidad táctil `>= 44px`.

### 5.2. Modales de Gestión de Proyectos
- **`CreateBudgetModal.jsx`:** Modal con `max-h-[92dvh]`, padding fluido `p-3 sm:p-6` y formulario optimizado.
- **`BudgetSettingsModal.jsx`:** Pestañas de configuración con scroll horizontal táctil y botón de cierre táctil.
- **`AccountSettingsModal.jsx`:** Formulario de perfil con scroll vertical interno limitado a `max-h-[92dvh]`.
- **`ShareBudgetModal.jsx`:** Caja de compartir presupuesto ajustada a `flex flex-col sm:flex-row gap-2` para evitar desbordes del botón "Copiar enlace".

---

## 6. Fase 5: Landing Page

### 6.1. Header (`frontend/src/components/landing/Header.jsx`)
- Integración de `pt-safe` para respetar la muesca superior.
- Botón de "Iniciar Sesión" con altura táctil mínima de 44px.

### 6.2. Hero Section (`frontend/src/components/landing/HeroSection.jsx`)
- **Tipografía Responsiva:** Titulares adaptados con `text-3xl sm:text-5xl md:text-7xl` para evitar desborde horizontal de palabras clave en pantallas de 320px a 480px.
- **Llamados a la Acción (CTA):** Botones apilados verticalmente en pantallas móviles (`flex flex-col sm:flex-row w-full sm:w-auto`).

---

## 7. Verificación y Despliegue en Producción Anterior

1. **Compilación de Producción:**
   - Verificado con `npm run build` en Vite sin advertencias críticas de empaquetado.
   - Generación de assets minificados (`index-97g1hP5R.css` y `index-CnpnK9rw.js`).
2. **Control de Versiones (Git):**
   - Commit `63c47a9`: Implementación de base global, layouts, editor de APU y selector de insumos.
   - Commit `54ffbf1`: Refactorización de modales secundarios, admin header y hero section.
3. **Despliegue en Droplet DigitalOcean (`167.172.115.154`):**
   - Paquete transferido y extraído en el contenedor Docker Nginx (`apupro_platform-apupro-frontend-1`).
   - Repositorio remoto actualizado con `git pull origin main`.
   - Verificación HTTP 200 y validación de cabeceras en `https://costbase.net/`.

---

## 8. Fase 6: Estandarización de Modales Full-Screen Nativo Móvil

Para ofrecer una experiencia indistinguible de una aplicación nativa en smartphones (`< sm`), se rediseñaron todos los modales principales y selectores del sistema:
- **Estructura Arquitectónica:**
  - Contenedor exterior: `fixed inset-0 ... p-0 sm:p-4`
  - Contenedor interior: `w-full h-full sm:h-auto sm:max-w-[size] rounded-none sm:rounded-2xl flex flex-col`
  - Cabecera fija: `pt-safe shrink-0` (protege contra notch y Dynamic Island de iPhone)
  - Cuerpo desplazable: `flex-1 overflow-y-auto` con scroll independiente
  - Pie de página / Botones fijos: `pb-safe shrink-0` (protege contra la barra de gestos de inicio de iOS y Android)
  - Altura de interacción táctil: Mínimo 44px (`min-h-[44px]`).

### Archivos Adaptados en Fase 6:
1. `frontend/src/components/modals/CreateBudgetModal.jsx`: Formulario de creación de presupuesto a pantalla completa móvil.
2. `frontend/src/components/modals/BudgetSettingsModal.jsx`: Configuración global de presupuesto (moneda, FCAS, admin, utilidad, IVA) con tabs táctiles sin scrollbars visibles.
3. `frontend/src/components/modals/ShareBudgetModal.jsx`: Modal de compartir presupuesto con campo URL adaptado y botón de copiado táctil.
4. `frontend/src/components/modals/ImportSharedBudgetModal.jsx`: Diálogo de importación con vista previa completa en móvil.
5. `frontend/src/components/modals/BudgetPrintModal.jsx`: Modal de opciones de impresión y exportación PDF/APU.
6. `frontend/src/components/SubscriptionRequestModal.jsx`: Modal de suscripción y planes con tarjetas legibles y pantalla de confirmación optimizada.
7. `frontend/src/components/ReportPaymentModal.jsx`: Reporte de pagos con formulario de pago táctil.
8. `frontend/src/components/modals/AccountSettingsModal.jsx`: Configuración de perfil y cuenta de usuario.
9. `frontend/src/components/ComponentSelectorModal.jsx`: Selector de insumos (materiales, equipos, mano de obra) a pantalla completa con búsqueda optimizada.

---

## 9. Fase 7: Gestor de Presupuestos (`BudgetHomePage.jsx`)

En la pantalla principal del gestor de presupuestos se resolvieron los problemas de botones desbordados y tarjetas ilegibles:

### 9.1. Cabecera y Botones de Acción Superior
- Se reorganizó a `flex flex-col sm:flex-row gap-2.5 sm:gap-3`.
- **En móvil:**
  - Botón principal `+ Nuevo Presupuesto`: Toma el 100% del ancho (`w-full`) como acción destacada superior.
  - Botones secundarios `Importar Backup` e `Importar Enlace`: Distribuidos en una cuadrícula de 2 columnas (`grid grid-cols-2`) directamente debajo, eliminando cualquier recorte.
- **En escritorio:** Mantiene la alineación horizontal fluida original.

### 9.2. Tarjetas de Presupuesto (`.tarjeta-presupuesto-ambar`)
- **Layout Adaptativo:** Cambia de `flex-direction: column` en móvil a `flex-direction: row` en escritorio (`≥ 768px`).
- **Bloque de Información:** En móvil ocupa el ancho total mostrando el nombre del proyecto (`line-clamp-2 break-words` con fallback preventivo), badge de monto total (`$ / Bs.`), conteo de partidas y fecha de creación sin solapamientos.
- **Barra de Acciones Rápidas:** Los 8 botones de acción rápida se organizan en una barra inferior táctil con separador `border-t border-amber-200/60`, dimensiones mínimas de 36x36px y feedback táctil (`active:scale-95`).
- **Modales Inline:** Los modales de "Renombrar", "Duplicar" y "Eliminar Presupuesto" se adaptaron con soporte full-screen nativo.

---

## 10. Fase 8: Hoja de Trabajo y Edición de Presupuestos (`BudgetWorksheetPage.jsx`)

La hoja de trabajo del presupuesto presentaba el mayor desafío por la densidad de información (tabla de 8 columnas técnicas con cálculo en tiempo real, capítulos de obra y múltiples acciones por fila).

### 10.1. Desacoplamiento de la Cabecera del Worksheet
- La cabecera fue extraída de la etiqueta `<tr><th colSpan="8">` de la tabla hacia un contenedor superior independiente:
  - **En móvil:**
    - Botón primario `+ Agregar Partida` a ancho completo (`w-full`).
    - Cuadrícula de 2x2 para las acciones secundarias: `📁 Agregar Capítulo`, `📊 Exportar Excel`, `⚙️ Configuración Global` y `🖨️ Imprimir`.
    - Accesos rápidos en la barra superior al lado del título y conteo de partidas: botones de 1 toque ⚙️ y 🖨️.
  - **En escritorio:** Mantiene la alineación horizontal limpia con el selector de base de datos, actualización de precios, configuración e impresión mediante portal a la barra de navegación superior (`header-actions-portal`).

### 10.2. Tarjetas Nativas de Partida para Móvil (`md:hidden`)
Para evitar el desplazamiento lateral horizontal de la tabla de 8 columnas en smartphones, se sustituyó por una lista de tarjetas de partida apiladas verticalmente con 4 niveles:
1. **Fila 1 (Identificación y Movimiento):**
   - Número de partida `#` con botones táctiles `▲` y `▼` para reordenar partidas arriba/abajo sin pelear con el scroll táctil del teléfono (`handleMoveItem`).
   - Badge con Código COVENIN o interno (`cov_par` / `cod_par`).
   - Badge con Unidad de medida (`UND: {item.unit}`).
2. **Fila 2 (Descripción):**
   - Texto completo de la descripción de la partida con tipografía clara y espaciado cómodo.
3. **Fila 3 (Panel de Cálculos en 3 Columnas):**
   - **Cantidad:** Campo interactivo editable con calculadora matemática integrada (`MathQuantityInput`). Actualiza en tiempo real los subtotales e importes generales.
   - **P.U.:** Precio unitario formateado.
   - **Total:** Monto total de la partida destacado en color azul.
4. **Fila 4 (Botones de Acción - ESTRICTAMENTE SOLO ICONOS):**
   - 4 botones táctiles sin texto visible (`≥ 40px` de altura):
     - ⚙️ `Settings` (Editar APU de la partida)
     - 🖨️ `Printer` (Imprimir ficha técnica APU)
     - 📊 `ExportApuExcelButton` (Exportar APU a Excel)
     - 🗑️ `Trash2` (Eliminar partida)

### 10.3. Tarjeta de Capítulos de Obra Rediseñada
- **Mitad de altura:** Reducida a `min-h-[34px]` y padding `px-3 py-1.5`.
- **Botones de movimiento horizontales:** Botones `▲` y `▼` alineados lado a lado (`flex items-center gap-0.5`), eliminando la altura forzada anterior.
- **Paleta de Color Ámbar (Hover de Presupuestos):**
  - Fondo: `#fef3c7` (`bg-[#fef3c7]`)
  - Borde: `#f59e0b` (`border-[#f59e0b]`)
  - Texto: `#78350f` (`text-[#78350f]` en negrita mayúscula)
  - Edición rápida de nombre de capítulo al tocar el texto y botón de papelera integrado.

### 10.4. Barra de Totales Ultra-Compacta en Móvil
- **En móvil (`md:hidden`):**
  - Se sustituyó la tarjeta vertical de más de 120px por una barra horizontal de 3 columnas de tan solo **~36px de alto**: `SUBTOTAL` | `I.V.A. (16%)` | `TOTAL (USD/Bs.)`.
  - Área de notas compacta de 1 sola fila (`rows={1}`) que no obstruye la pantalla.
- **En escritorio (`hidden md:flex`):**
  - Se conserva la vista espaciosa con notas de 2 líneas y la tabla vertical de totales con tipografía ajustada a 14px (`text-[14px]`).

### 10.5. Experiencia de Escritorio Preservada (`hidden md:block`)
- En pantallas medianas y grandes se conserva intacta la tabla estilo hoja de cálculo de 8 columnas con arrastrar y soltar (Drag and Drop mediante `@hello-pangea/dnd`).

### 10.6. Modales Internos de la Hoja de Trabajo
- **Buscar e Incluir Partidas (`showSearchModal`):** Pantalla completa nativa en teléfonos (`w-full h-full sm:h-[80vh]`), cabecera flexible con selector de bases de datos/presupuestos y botón "Incluir" táctil.
- **Agregar Capítulo (`showChapterModal`):** Formato bottom-sheet táctil.
- **Confirmación de Eliminación (`itemToDelete`):** Diálogo centrado o bottom-sheet con botones táctiles de 44px.

---

## 11. Estado Actual y Próximos Pasos para Retomar

### 11.1. Estado del Repositorio
- **Compilación de Producción (`npm run build`):** Verificada y pasando con éxito con **código de salida 0** en Vite.
- **Archivos Modificados en la Sesión:**
  - `frontend/src/components/modals/CreateBudgetModal.jsx`
  - `frontend/src/components/modals/BudgetSettingsModal.jsx`
  - `frontend/src/components/modals/ShareBudgetModal.jsx`
  - `frontend/src/components/modals/ImportSharedBudgetModal.jsx`
  - `frontend/src/components/modals/BudgetPrintModal.jsx`
  - `frontend/src/components/SubscriptionRequestModal.jsx`
  - `frontend/src/components/ReportPaymentModal.jsx`
  - `frontend/src/components/modals/AccountSettingsModal.jsx`
  - `frontend/src/components/ComponentSelectorModal.jsx`
  - `frontend/src/pages/admin/BudgetHomePage.jsx`
  - `frontend/src/pages/admin/BudgetWorksheetPage.jsx`
  - `frontend/src/index.css`

### 11.2. Próximas Pantallas Pendientes por Revisar/Optimizar al Retomar:
1. **Página de Edición Individual de APU (`BudgetAPUEditorPage.jsx` / `ApuEditorUI.jsx`):**
   - Revisar la experiencia móvil al agregar y editar insumos individuales de materiales, equipos y mano de obra dentro de una partida específica de presupuesto.
2. **Páginas de Catálogos Maestros:**
   - `MaterialsPage.jsx` (Materiales)
   - `EquipmentsPage.jsx` (Equipos)
   - `LaborsPage.jsx` (Mano de Obra)
3. **Calculadora FCAS (`FCASCalculatorPage.jsx`):**
   - Optimizar formularios de factores de costos asociados al salario para teléfonos móviles.
4. **Página de Presupuestos Compartidos (`SharedBudgetPage.jsx`):**
   - Verificar la vista pública móvil para clientes que reciben un presupuesto compartido mediante enlace.

