# Refactorización del Flujo de Autenticación y Verificación por Correo
**Fecha:** 23 de Agosto de 2026

## Resumen de Cambios

Se ha refactorizado por completo el flujo de autenticación, verificación de correos y recuperación de contraseñas para la plataforma `costbase_platform` (anteriormente apupro_platform). El objetivo principal ha sido mejorar la experiencia de usuario (UX) manteniendo a la persona en la misma ventana modal sin redirigirla a URLs externas, y reemplazar los "Enlaces Mágicos" (JWT) por códigos de verificación de 6 dígitos que son mucho más amigables.

## Modificaciones en Base de Datos

Se agregó una nueva columna de forma nativa en la base de datos de producción para almacenar el código de verificación temporal.
- **Tablas modificadas:** `arko_admins` y `arko_users`
- **Columna añadida:** `verification_code VARCHAR(10) DEFAULT NULL`

## Backend (`arko.py` y `email.py`)

1. **Generación de Códigos:** En lugar de crear un JWT con la librería `jose`, ahora el backend genera un código numérico aleatorio de 6 dígitos mediante `random.choices(string.digits, k=6)`.
2. **Envío de Correos:** Se actualizó `email.py` (usando `Resend SMTP`) para renderizar un código gigante en el correo en lugar de un enlace clicable.
3. **Nuevos Endpoints / Endpoints Refactorizados:**
   - `POST /auth/register`: Crea el usuario con `is_email_verified=False` y guarda un `verification_code`. Envía el correo.
   - `POST /auth/resend-verification`: Regenera el código y vuelve a enviar el correo de verificación.
   - `POST /auth/verify-email`: Recibe `email` y `code`. Si coinciden, cambia `is_email_verified=True` y limpia el código.
   - `POST /auth/forgot-password`: Busca el correo, genera un código, lo guarda y lo envía por correo.
   - `POST /auth/reset-password`: Recibe `email`, `code` y `new_password`. Verifica el código y sobreescribe la contraseña.

## Frontend (React)

1. **Eliminación de Páginas Sueltas:** Se eliminaron las rutas y archivos de `Login.jsx`, `Register.jsx`, `VerifyEmail.jsx` y `ResetPassword.jsx`. Todo el flujo ocurre en Modales en la Landing.
2. **`RegisterModal.jsx`:** Ahora cuenta con un estado `view` (`register` o `verify`). Después de registrarse exitosamente, el modal cambia automáticamente a la pantalla de verificación donde el usuario ingresa el código de 6 dígitos. Si el código es correcto, el sistema inicia sesión automáticamente.
3. **`LoginModal.jsx`:** Maneja múltiples estados (`login`, `verify`, `forgotPassword`, `resetPassword`). 
   - Si un usuario intenta entrar y no ha verificado su correo, el modal lo cambia automáticamente a la vista de verificación y le envía un código.
   - Si presiona "¿Olvidaste tu contraseña?", cambia a la vista para pedir el correo, y luego a la vista para ingresar el código y la nueva contraseña.
4. **Mensajes Toast:** Se eliminaron todos los `alert()` nativos del navegador, reemplazándolos con la librería `react-hot-toast` (`toast.success` y `toast.error`), logrando un acabado profesional.

## Corrección de Variables de Entorno y Configuración

Durante la implementación se detectó que el backend no estaba enviando los correos porque faltaba la variable `RESEND_API_KEY` en el archivo `.env` del contenedor en producción de `costbase_platform` (anteriormente apupro_platform).
- Se extrajo la clave de la API leyendo las variables de entorno del contenedor hermano de Arko360 (`arko360_platform-backend-1`).
- Se insertó la clave en el archivo `.env` local y remoto de Costbase.
- Se reinició el contenedor `costbase_platform-costbase-backend-1` en producción para que tome la configuración y comience a enviar correos reales (dejando de "simularlos" en los logs).

## Corrección de Codificación de Caracteres (UTF-8)

Se resolvió un problema de doble codificación en el que se mostraban caracteres extraños (ej: `estÃ¡`) en los mensajes JSON retornados por el backend. Se limpió el archivo binario reemplazando directamente los bytes corruptos para que `FastAPI` envíe las cadenas de texto en formato UTF-8 nativo y puro.
