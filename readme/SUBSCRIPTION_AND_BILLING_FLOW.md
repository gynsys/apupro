# Flujo de Registro, Límites y Suscripción (CostBase)

Este documento detalla la lógica completa del ciclo de vida de un usuario en CostBase, desde el momento en que se registra y verifica su correo, hasta que choca con los límites de su plan Demo, solicita un plan Premium, reporta su pago y es administrado por el Superadmin.

---

## 1. Flujo de Registro y Verificación de Correo

La plataforma utiliza un sistema de verificación OTP (One Time Password) enviado por correo electrónico para garantizar que todos los usuarios sean reales.

### Lógica Paso a Paso:
1. **Inicio de Registro:** El usuario introduce sus datos en RegisterModal.jsx. El frontend envía una petición a POST /auth/register-init.
2. **Almacenamiento Temporal:** El backend (en rko.py) NO crea el usuario en la base de datos todavía. Genera un código de 6 dígitos, guarda los datos temporalmente en **Redis** (pending_registrations) y envía el código usando send_verification_email de email.py (vía Resend).
3. **Verificación:** El usuario ingresa el código en el frontend. Se llama a POST /auth/verify-email. 
4. **Creación del Usuario:** El backend compara el código con el guardado en Redis. Si coincide, extrae los datos de Redis, crea el registro en la tabla rko_users (ArkoAdmin model) con is_active=True y is_email_verified=True, y borra la caché de Redis.

---

## 2. Control de Límites (El "Paywall")

Por defecto, los usuarios recién registrados entran con el plan **"free" (Cuenta Demo)**, el cual tiene límites rígidos (ej. 1 presupuesto, 2 partidas, sin acceso a IA).

### Lógica Paso a Paso:
1. **Validación en Backend:** Cuando el usuario intenta crear un presupuesto (POST /budgets/) o una partida, el backend revisa las propiedades del usuario (current_user.max_budgets, current_user.max_items_per_budget).
2. **Excepción HTTP:** Si el conteo en la base de datos supera el límite, el backend lanza un HTTPException 403 / 400 con un mensaje específico.
3. **Captura en Frontend:** Los servicios del frontend (ej. udgetService.js o cost360DatabaseService.js) atrapan el error. Si detectan que es por límite, lanzan un error especial (error.isLimitError = true).
4. **Disparador del Modal:** Componentes como BudgetHomePage.jsx interceptan ese error y cambian un estado (setShowLimitModal(true)) para abrir la ventana de ventas.

---

## 3. Flujo de Solicitud de Suscripción (Upsell)

Cuando el usuario choca con el límite (o si hace clic proactivamente en la corona ?? de la barra lateral), se activa el proceso de ventas.

### Lógica Paso a Paso:
1. **Modal de Planes:** Se muestra el componente SubscriptionRequestModal.jsx. Dependiendo de cómo se abrió (límite de BD, límite de APU, o clic manual), el título cambia.
2. **Selección de Plan:** El usuario elige entre Básico, Profesional o Experto.
3. **Petición API:** El frontend envía un POST /users/subscription-request indicando el plan seleccionado (plan_name).
4. **Disparo de 2 Correos Automáticos (email.py):**
   - **Correo Admin (send_subscription_request_email):** Llega a costbaseia@gmail.com alertando silenciosamente al equipo de ventas que el usuario "X" quiere el plan "Y".
   - **Correo Usuario (send_payment_instructions_email):** Llega a la bandeja del usuario. Es un correo HTML detallado felicitándolo por su elección y dándole las cuentas bancarias (Pago Móvil BDV, Transferencia BDV, Binance TRC20) junto con los logos.

---

## 4. Reporte de Pago (Billing Frontend)

Una vez que el usuario realiza la transferencia, necesita informarlo a la plataforma.

1. **Acceso:** En la barra lateral (AppLayout.jsx), hay un ícono de recibo (??). Al hacer clic, se abre ReportPaymentModal.jsx.
2. **Formulario:** El usuario selecciona el plan que pagó, el método usado (Transferencia, Pago Móvil, Binance), ingresa el número de referencia y sube la foto/PDF del comprobante.
3. **Estado Actual:** El modal valida que los campos existan y muestra una simulación de éxito. *(Pendiente: Conectar a un endpoint backend para guardar el comprobante en AWS/Local y notificar al Superadmin).*

---

## 5. Gestión de Usuarios (Superadmin)

Cuando el pago es verificado (ya sea revisando la cuenta de banco o leyendo el correo), el Superadmin debe activar el plan del usuario.

### Lógica Paso a Paso:
1. **Panel Admin:** El Superadmin ingresa a Mantenimiento BD -> Pestaña Usuarios (UsuariosTab.jsx).
2. **Edición (EditUserModal.jsx):** Al hacer clic en "Editar" sobre el usuario que pagó, se abre un modal.
3. **Auto-completado de Límites:** El Superadmin selecciona el plan (ej. "Profesional") en el menú desplegable. El frontend **automáticamente rellena** los inputs numéricos recomendados para ese plan (ej. 2000 presupuestos, 2000 partidas, y marca el check de acceso a IA).
4. **Guardado:** Se hace un PUT /users/{user_id}. El endpoint en users.py actualiza los campos plan, max_budgets, max_items_per_budget y has_ai_access en la base de datos.
5. **Activación Inmediata:** El usuario ya puede continuar usando la herramienta sin bloqueos.

---

## 6. Archivos Involucrados (Quick Reference)

### Frontend (React)
| Archivo | Rol en el Flujo |
|---------|-----------------|
| RegisterModal.jsx | Captura los datos del usuario e inicia el proceso OTP. |
| AppLayout.jsx | Contiene la barra lateral, íconos de Mi Plan (??) y Reportar Pago (??) e importa los Modales globales. |
| SubscriptionRequestModal.jsx | Modal de Ventas. Muestra los planes, atrapa los límites y llama al backend para enviar los correos de cobro. |
| ReportPaymentModal.jsx | Formulario para que el usuario reporte la referencia bancaria y suba el comprobante de pago. |
| UsuariosTab.jsx | Tabla del Superadmin para ver a todos los usuarios, sus planes y límites. |
| EditUserModal.jsx | Formulario del Superadmin para cambiar de plan a un usuario (rellena límites automáticamente). |
| udgetService.js / cost360DatabaseService.js | Capturan el código HTTP 403 del backend y lo transforman en isLimitError para detonar el modal. |

### Backend (Python/FastAPI)
| Archivo | Rol en el Flujo |
|---------|-----------------|
| models/arko.py | Contiene ArkoAdmin, define los campos plan, max_budgets, max_items_per_budget, has_ai_access, is_email_verified. |
| endpoints/arko.py | (O uth.py) Maneja la lógica de validación OTP con Redis (/register-init, /verify-email). |
| endpoints/users.py | Endpoint POST /subscription-request (llama a los 2 correos) y PUT /{user_id} (actualiza límites del Superadmin). |
| services/email.py | Funciones send_subscription_request_email y send_payment_instructions_email (Usa Resend API para despachar HTMLs). |
