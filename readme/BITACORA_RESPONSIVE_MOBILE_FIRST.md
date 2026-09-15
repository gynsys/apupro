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

## 7. Verificación y Despliegue en Producción

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
