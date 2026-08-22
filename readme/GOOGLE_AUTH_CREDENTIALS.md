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
