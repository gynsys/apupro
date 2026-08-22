# Credenciales de Google Auth (CostBase & GynSys)

## Proyecto en Google Cloud
El inicio de sesión y registro mediante Google en **CostBase** (y en GynSys) comparte las mismas credenciales (Client ID) generadas en Google Cloud.

- **Nombre del proyecto en Google Cloud:** `gynsys-d01eb` (o `GynSys`)
- **Cuenta administradora:** Las credenciales fueron creadas/administradas utilizando la cuenta de correo principal del desarrollador (usualmente `dramarielh@gmail.com`).

## ID de Cliente (Client ID)
- El `GOOGLE_CLIENT_ID` utilizado en las variables de entorno (`.env` tanto en frontend como backend) termina en `...mt7vg83.apps.googleusercontent.com`.

## Mantenimiento y Nuevos Dominios
Si en el futuro se despliega la plataforma en un nuevo dominio (o subdominio), es estrictamente necesario autorizar ese origen en Google Cloud para evitar el error `400: origin_mismatch`.

**Pasos para autorizar un nuevo dominio:**
1. Iniciar sesión en [Google Cloud Console](https://console.cloud.google.com/) con la cuenta dueña del proyecto.
2. Seleccionar el proyecto `gynsys-d01eb` en el menú superior.
3. Ir a **API y Servicios** > **Credenciales**.
4. Editar la credencial en la sección **IDs de clientes de OAuth 2.0**.
5. Agregar el nuevo dominio (sin barra `/` al final) tanto en **Orígenes autorizados de JavaScript** como en **URIs de redireccionamiento autorizados**.
6. Guardar y esperar ~5 minutos a que se propague el cambio.

## Solución de Problemas (Troubleshooting Avanzado)

Durante la implementación inicial nos encontramos con varios problemas silenciosos importantes. Si el login de Google deja de funcionar, revisa los siguientes puntos:

### 1. Variables de Entorno en Producción (Docker)
Para que el cliente web (Vite) tenga acceso a `VITE_GOOGLE_CLIENT_ID` durante la compilación en **GitHub Actions**:
- **En `deploy.yml`**: La variable debe ser pasada en `build-args`.
- **En `Dockerfile` (frontend)**: La variable **DEBE** ser declarada usando `ARG VITE_GOOGLE_CLIENT_ID` y `ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID`. Si esto se omite, Docker ignora la variable que le manda Github Actions y el botón queda inerte (no se abre la ventana de Google).

### 2. Bloqueo Silencioso por Encabezados de Seguridad (COOP)
Si la ventana de Google **sí se abre** y te permite elegir la cuenta, pero al cerrarse la pantalla **se queda cargando y no ocurre nada** (y no muestra ningún error en consola):
- Verifica que el archivo `nginx.conf` del frontend tenga configurado el encabezado de seguridad a:
  `add_header Cross-Origin-Opener-Policy "same-origin-allow-popups";`
- Si la política está configurada de forma estricta (`same-origin`), el navegador por seguridad bloqueará la comunicación (vía `postMessage`) entre la ventana emergente de Google y la página principal de CostBase, resultando en un fallo silencioso donde el token jamás llega a la aplicación.
