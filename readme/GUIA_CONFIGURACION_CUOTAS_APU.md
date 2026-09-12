# Guía Técnica: Configuración y Modificación de Cuotas de APUs con IA

> **Módulo:** `cost360` / `users` / `planes`  
> **Última Actualización:** Septiembre 2026  
> **Cuotas Vigentes:**  
> - 🟢 **Plan Básico:** 20 APUs con IA / mes ($9.99 USD)  
> - 🔵 **Plan Profesional:** 50 APUs con IA / mes ($19.99 USD)  
> - 🟣 **Plan Experto:** 100 APUs con IA / mes ($34.99 USD)  
> - 👑 **Plan Enterprise / Superadmin:** Ilimitado (`max_ai_apus = 0`)

---

## 1. Arquitectura del Control de Cuotas

El control de consumo de IA opera bajo dos columnas numéricas en la tabla `arko_admins` de PostgreSQL:

1. `max_ai_apus` (INTEGER): Cuota máxima mensual permitida para la cuenta.
   * `0`: Representa acceso **Ilimitado** (cuentas Enterprise, administradores o configuraciones especiales).
   * `> 0`: Representa el límite numérico estricto mensual (20, 50, 100, etc.).
2. `ai_apus_generated` (INTEGER): Cantidad de APUs generados con éxito durante el ciclo mensual vigente.
   * Se incrementa automáticamente en `+1` únicamente cuando la IA genera un APU válido con código COVENIN en `cost360.py`.
   * Se reinicia a `0` cada vez que el usuario renueva su ciclo o se activa un plan nuevo.

---

## 2. Proceso Paso a Paso para Cambiar las Cuotas

Cuando se decida modificar la cantidad de APUs asignada a los planes, se deben actualizar los siguientes 4 puntos del sistema para mantener sincronizado el frontend, backend y la base de datos:

---

### Paso 1: Tarjetas Públicas de Precios (Landing Page)

**Archivo:** `frontend/src/components/landing/PricingSection.jsx`

Localiza la constante `plans` al inicio del componente y modifica el texto descriptivo de la cuota en cada plan:

```javascript
const plans = [
  {
    name: 'Básico',
    price: '9.99',
    features: [
      '20 APUs generados con IA por mes', // <-- Modificar aquí
      // ...
    ],
  },
  {
    name: 'Profesional',
    price: '19.99',
    features: [
      '50 APUs generados con IA por mes', // <-- Modificar aquí
      // ...
    ],
  },
  {
    name: 'Experto',
    price: '34.99',
    features: [
      '100 APUs generados con IA por mes', // <-- Modificar aquí
      // ...
    ],
  },
];
```

---

### Paso 2: Asignación por Defecto al Activar/Cambiar Plan (Backend)

**Archivo:** `backend/app/api/v1/endpoints/users.py`

En la función `update_user` (alrededor de la línea 106), actualiza las condiciones que asignan el valor numérico a `user.max_ai_apus`:

```python
plan_norm = (user_data.plan or "").strip().lower()
if plan_norm in ("básico", "basico", "basic"):
    user.max_ai_apus = 20   # <-- Nueva cuota Plan Básico
elif plan_norm in ("profesional", "pro"):
    user.max_ai_apus = 50   # <-- Nueva cuota Plan Profesional
elif plan_norm in ("experto", "expert"):
    user.max_ai_apus = 100  # <-- Nueva cuota Plan Experto
elif plan_norm in ("enterprise", "corporativo"):
    user.max_ai_apus = 0    # <-- 0 para Ilimitado
else:
    user.max_ai_apus = 0
```

---

### Paso 3: Sugerencias Automáticas en el Modal de Edición de Usuario (Frontend Admin)

**Archivo:** `frontend/src/modules/cost360/components/modals/EditUserModal.jsx`

En la función `handlePlanChange`, actualiza los valores que se auto-completan en el formulario cuando el administrador cambia el plan del usuario desde el panel:

```javascript
const handlePlanChange = (e) => {
  const newPlan = e.target.value;
  const newForm = { ...form, plan: newPlan };
  
  if (newPlan === 'free' || newPlan === 'demo') {
    newForm.max_ai_apus = 0;
    newForm.has_ai_access = false;
  } else if (newPlan === 'Básico') {
    newForm.max_ai_apus = 20;  // <-- Nueva cuota Básico
    newForm.has_ai_access = true;
  } else if (newPlan === 'Profesional') {
    newForm.max_ai_apus = 50;  // <-- Nueva cuota Profesional
    newForm.has_ai_access = true;
  } else if (newPlan === 'Experto') {
    newForm.max_ai_apus = 100; // <-- Nueva cuota Experto
    newForm.has_ai_access = true;
  } else if (newPlan === 'enterprise') {
    newForm.max_ai_apus = 0;   // <-- 0 = Ilimitado
    newForm.has_ai_access = true;
  }
  
  setForm(newForm);
};
```

---

### Paso 4: Actualización en Base de Datos para Usuarios Existentes

Para que los usuarios que ya están registrados y tienen asignada la cuota anterior reciban el aumento inmediatamente:

#### A) En Producción (vía Terminal Docker / psql)
Ejecutar el siguiente comando SQL:

```sql
UPDATE arko_admins 
SET max_ai_apus = 20 
WHERE plan IN ('Básico', 'basico', 'basic') AND (max_ai_apus = 10 OR max_ai_apus IS NULL);

UPDATE arko_admins 
SET max_ai_apus = 50 
WHERE plan IN ('Profesional', 'profesional', 'pro') AND (max_ai_apus = 25 OR max_ai_apus IS NULL);

UPDATE arko_admins 
SET max_ai_apus = 100 
WHERE plan IN ('Experto', 'experto', 'expert') AND (max_ai_apus = 50 OR max_ai_apus IS NULL);

UPDATE arko_admins 
SET max_ai_apus = 0 
WHERE plan IN ('enterprise', 'corporativo', 'admin');
```

#### B) En el Arranque Automático del Servidor
Las sentencias anteriores ya están incorporadas en la lista `schema_statements` de `backend/app/main.py`. Cada vez que el backend inicia o se despliega una nueva versión del contenedor, el servidor verifica y aplica estas actualizaciones de manera segura y transparente.

---

## 3. Asignación Manual / Personalizada por Usuario

Si deseas asignarle una cantidad de APUs especial a un usuario específico (por ejemplo, darle 150 APUs o permitirle acceso ilimitado sin cambiarle el nombre del plan):

1. Ingresa a la plataforma con una cuenta de Administrador.
2. Ve a `/cost360/admin-db` y haz clic en la pestaña **"Usuarios"**.
3. En la fila del usuario deseado, pulsa el botón **"Editar"**.
4. En el campo **"Límite APUs con IA"**, escribe el número deseado (o coloca `0` si deseas que sea ilimitado).
5. Haz clic en **"Guardar"**.
6. La tabla actualizará inmediatamente el indicador mostrando el nuevo cupo.

---

## 4. Visualización en la Interfaz

* **Tabla de Usuarios (`UsuariosTab.jsx`):**
  * `0`: Se muestra como badge verde esmeralda con el texto `{usados} / Ilimitado`.
  * `> 0`: Se muestra como badge índigo `{usados} / {límite}` (cambia a rojo únicamente si `usados >= límite`).
  * `free` sin IA: Se muestra como `-`.
* **Modal de Consumo del Usuario (`AccountSettingsModal.jsx`):**
  * Si el plan es Enterprise o tiene `max_ai_apus = 0`, la barra de progreso se llena en gradiente verde con la leyenda `Acceso Ilimitado`.
  * Si tiene un límite finito, la barra muestra el porcentaje consumido exacto con alertas de color a partir del 80% y 100%.

---

## 5. Verificación Rápida de Cambios

Para verificar que la compilación y los cambios estén en orden tras cualquier edición:

```bash
# En el directorio frontend/
npm run build
```
*(Debe compilar con código 0 y sin advertencias de sintaxis).*
