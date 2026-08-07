# Documentación Técnica: Separación de APUpro de Arko360

Este documento detalla los pasos técnicos, comandos, configuraciones y rutas utilizadas para separar exitosamente el módulo "Cost360/Presupuestos" (ahora APUpro) del monolito original de Arko360, convirtiéndolo en una plataforma 100% independiente alojada en `apupro.arko360.net`.

---

## 1. Configuración de Repositorios y Entorno Local

Se creó un nuevo directorio y repositorio Git para aislar el código:

- **Ruta original:** `C:\Users\pablo\Documents\arko360_platform`
- **Nueva ruta:** `C:\Users\pablo\Documents\apupro_platform`
- **Repositorio remoto:** `https://github.com/gynsys/apupro.git`

Se inicializó el nuevo repositorio en local y se enlazó con GitHub.

---

## 2. Aislamiento de la Base de Datos

Para independizar los datos, se extrajo la base de datos de Arko360 y se montó un contenedor exclusivo para APUpro en el servidor de producción.

- **Contenedor:** `apupro_platform-apupro-db-1`
- **Puerto expuesto (Host):** `5440` (Interno de Docker: `5432`)
- **Variables de entorno:**
  - `POSTGRES_USER`: apupro_user
  - `POSTGRES_PASSWORD`: apupro_password
  - `POSTGRES_DB`: apupro_db

### Comandos de migración utilizados:
Se ejecutaron directamente por SSH en el servidor:
1. Exportar DB original: 
   `docker exec -t arko360_platform-db-1 pg_dump -U arko360_user -F c arko360_db > /root/arko360_backup.dump`
2. Copiar archivo de respaldo al nuevo contenedor: 
   `docker cp /root/arko360_backup.dump apupro_platform-apupro-db-1:/tmp/arko360_backup.dump`
3. Restaurar en nueva DB: 
   `docker exec -t apupro_platform-apupro-db-1 pg_restore -U apupro_user -d apupro_db -1 /tmp/arko360_backup.dump`

---

## 3. Limpieza y Configuración del Backend

Se procedió a eliminar todo el código innecesario heredado de Arko360.

- **Rutas y modelos eliminados:** `calculadora`, `leads`, `blog`, `arko_landing_sites`, `arko_app`.
- **Rutas mantenidas:** `cost360`, `budgets`, `materials`, `uploads`, `search_v6`.
- **Autenticación:** Se restauró deliberadamente el módulo `arko.py` (modelos de `ArkoAdmin` y endpoints de `/arko/auth/login`) para conservar el acceso de los administradores existentes en la base de datos migrada sin tener que refactorizar todo el flujo JWT en el frontend de forma inmediata.
- **Ruta principal del router:** `backend/app/api/v1/api.py`

**Variable de conexión a BD (`docker-compose.yml`):**
`DATABASE_URL=postgresql://apupro_user:apupro_password@apupro-db:5432/apupro_db`

---

## 4. Limpieza y Configuración del Frontend

Se adaptó el frontend SPA (React + Vite) para comportarse como una aplicación independiente.

- **Archivos modificados:**
  - `frontend/src/App.jsx`: Se eliminaron las rutas de Landing Sites. Se ajustaron los `<Navigate>` base para redirigir a `/budgets` de forma relativa.
  - `frontend/src/pages/Login.jsx`: Se eliminó la redirección estática obligatoria (`window.location.href = 'https://arko360.net/app/budgets'`) y se reemplazó por la redirección interna del router de React (`navigate('/budgets')`).
  - `frontend/src/components/layout/AppLayout.jsx`: Limpieza visual de la barra de navegación lateral (eliminación de textos "Mis", "NAVEGACION", etc.).

### Modificación del Build de Vite (Variables de entorno)
Dado que Vite compila las variables en tiempo de construcción, el `.env` no es inyectado dinámicamente. Para solucionar esto:
1. Se modificó el `frontend/Dockerfile` agregando:
   ```dockerfile
   ARG VITE_API_URL
   ENV VITE_API_URL=$VITE_API_URL
   ```
2. Se pasó como argumento en el `docker-compose.yml`:
   ```yaml
   args:
     - VITE_API_URL=https://apupro.arko360.net/api/v1
   ```

---

## 5. Infraestructura, Nginx y Certificados SSL

Se configuró un bloque de servidor (Server Block) de Nginx en Ubuntu de forma nativa para enrutar el subdominio y asegurar la conexión.

- **Ruta del archivo Nginx:** `/etc/nginx/sites-available/apupro.arko360.net` (simbolizado en `sites-enabled`)
- **Contenido del Proxy Nginx (`apupro.conf`):**
  - Tráfico raíz (`/`) mapeado al contenedor del Frontend en el puerto `3010`.
  - Tráfico API (`/api/`) mapeado al contenedor Backend en el puerto `8010`.
- **Dominio:** `apupro.arko360.net` (Resolviendo a IP: `167.172.115.154`)

### Comandos SSL de Certbot:
Se instaló el certificado Let's Encrypt para forzar HTTPS:
```bash
certbot install --cert-name apupro.arko360.net --nginx -n
systemctl reload nginx
```

---

## 6. Estado Actual de Contenedores en Producción

La plataforma APUpro corre enteramente bajo el stack `apupro_platform`:

1. `apupro_platform-apupro-frontend-1` (Puerto: `3010`)
2. `apupro_platform-apupro-backend-1` (Puerto: `8010`)
3. `apupro_platform-apupro-db-1` (Puerto: `5440`)

---

## 7. Próximos Pasos (Deuda Técnica)

1. **Limpieza del monolito original:** El código de `cost360` y `budgets` sigue presente en el repositorio original de `arko360_platform`. Es seguro proceder a eliminarlo ahora que APUpro es autosuficiente.
2. **Refactorización de Autenticación:** Se debería cambiar el nombre interno del modelo de usuarios de `ArkoAdmin` a algo como `User` o `ApuUser` en la base de datos de APUpro y en el backend, adaptando la URL de login (`/api/v1/auth/login`).
