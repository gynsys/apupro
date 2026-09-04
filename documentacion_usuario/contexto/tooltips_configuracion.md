# Contexto de Ayuda: Configuración de Tooltips

Este archivo define los tooltips y ayudas contextuales para integración en-app.

## 📍 Ubicaciones de Tooltips

### 1. Botón de Backup (CloudDownload)
**Ubicación:** BudgetHomePage.jsx - línea de botón backup
**Tooltip:** "Crear backup (.cb) - Archivo encriptado con todo el presupuesto"
**Componente:** TooltipCard
**Trigger:** hover

### 2. Botón de Compartir (Share2)
**Ubicación:** BudgetHomePage.jsx - línea de botón compartir
**Tooltip:** "Generar enlace para compartir - Los destinatarios solo ven vista previa"
**Componente:** TooltipCard
**Trigger:** hover

### 3. Botón Importar Backup
**Ubicación:** BudgetHomePage.jsx - botón principal
**Tooltip:** "Importar archivo .cb - Restaurar presupuesto completo"
**Componente:** TooltipCard
**Trigger:** hover

### 4. Configuración de Costos
**Ubicación:** TabNavigation.jsx - sección de costos
**Tooltip:** "Configura tus valores por defecto para nuevos presupuestos"
**Componente:** InfoIcon con popover
**Trigger:** click

### 5. Calculadora FCAS
**Ubicación:** TabNavigation.jsx - campo FCAS
**Tooltip:** "Calcular FCAS automáticamente - Factor de costo social venezolano"
**Componente:** CalculatorIcon con modal
**Trigger:** click

### 6. Botón Crear Base de Datos
**Ubicación:** DatabaseManagementPage.jsx - botón crear
**Tooltip:** "Crear base personalizada - Aplica inflación a precios maestros"
**Componente:** TooltipCard
**Trigger:** hover

---

## 🎨 Componentes React para Integración

### TooltipCard Component
```jsx
import React from 'react';

const TooltipCard = ({ children, content, position = 'top' }) => {
  return (
    <div className="tooltip-container">
      {children}
      <div className={`tooltip-content tooltip-${position}`}>
        {content}
      </div>
    </div>
  );
};

export default TooltipCard;
```

### CSS para Tooltips
```css
.tooltip-container {
  position: relative;
  display: inline-block;
}

.tooltip-content {
  position: absolute;
  background: #333;
  color: white;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 12px;
  white-space: nowrap;
  z-index: 1000;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s;
}

.tooltip-container:hover .tooltip-content {
  opacity: 1;
}

.tooltip-top {
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-bottom: 8px;
}

.tooltip-right {
  left: 100%;
  top: 50%;
  transform: translateY(-50%);
  margin-left: 8px;
}

.tooltip-bottom {
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-top: 8px;
}

.tooltip-left {
  right: 100%;
  top: 50%;
  transform: translateY(-50%);
  margin-right: 8px;
}
```

---

## 🔗 Integración con Centro de Ayuda

### Link "Más información"
Cada tooltip puede incluir un link al centro de ayuda:
```jsx
<TooltipCard content="Backup - <a href='/help/backup' class='tooltip-link'>Más info</a>">
  <CloudDownload />
</TooltipCard>
```

### Modal de Ayuda Extendida
Para funcionalidades complejas, usar modal en lugar de tooltip:
```jsx
const [showHelp, setShowHelp] = useState(false);

<button onClick={() => setShowHelp(true)}>
  <HelpIcon />
</button>

{showHelp && (
  <HelpModal
    onClose={() => setShowHelp(false)}
    guide="backup"
  />
)}
```

---

## 📋 Categorías de Ayuda Contextual

### Prioridad Alta (Tooltips inmediatos):
- Backup/Restauración
- Compartición
- Configuración de costos

### Prioridad Media (Modales informativos):
- Bases de datos Cost360
- Generador APU con IA
- Límites de planes

### Prioridad Baja (Links a centro de ayuda):
- Funciones básicas
- Exportación/impresión
- Solución de problemas

---

## 🎯 Estrategia de Implementación

### Fase 1: Tooltips Simples
- Iconos de ayuda (?) en campos complejos
- Tooltips en botones principales
- Ayuda contextual directa

### Fase 2: Modales Informativos
- Modales para funcionalidades complejas
- Integración con centro de ayuda
- Videos embebidos

### Fase 3: Tour Guiado
- Tour interactivo para nuevos usuarios
- Destacar funcionalidades clave
- Guía paso a paso integrada

---

## 📊 Métricas de Uso

### Seguimiento:
- Clics en tooltips
- Apertura de modales de ayuda
- Tiempo en centro de ayuda
- Búsquedas más frecuentes

### Optimización:
- Ajustar contenido según uso
- Simplificar tooltips poco usados
- Expandir secciones populares

---

## ⚠️ Notas de Integración

- No modificar lógica existente, solo agregar UI de ayuda
- Mantener consistencia visual con diseño actual
- Probar en diferentes dispositivos y navegadores
- Asegurar accesibilidad (screen readers, teclado)
