# La Biblia de Arko 360 🏗️

Este documento registra la arquitectura, decisiones técnicas y el historial de iteraciones en la construcción del ecosistema **Arko 360** dentro de la infraestructura base de GynSys.

## 1. Concepto y Arquitectura 🏛️

**Objetivo:** Desarrollar una plataforma propia para la empresa de arquitectura e ingeniería (Arko 360) utilizando el mono-repositorio y el servidor VPS de GynSys, pero garantizando **aislamiento lógico total**.
- **Aislamiento de Datos:** Las tablas de la base de datos de Arko (`arko_posts`, `arko_projects`, `arko_admins`) no interactúan ni se relacionan mediante llaves foráneas con el entorno médico de GynSys (clínicas, doctores, pacientes).
- **Aislamiento de Autenticación:** GynSys utiliza su propia tabla de `doctors` y `users`. Arko 360 utiliza un JWT propio (`arko_token`) emitido y validado exclusivamente contra la tabla `arko_admins`.
- **Aislamiento de Frontend:** Las rutas están separadas bajo `/arko-admin/` y los servicios API apuntan a `/api/v1/arko/`.

### 1.1 Arquitectura de Despliegue y Red (El Proxy Global) 🌍
**¡ATENCIÓN!** Es crucial entender cómo se enrutan las peticiones en el VPS de producción para evitar confusiones al configurar headers (CORS, COOP/COEP) o certificados SSL.

El VPS (Digital Ocean) NO utiliza el `nginx` del sistema operativo (host) para escuchar en los puertos 80 y 443. En su lugar, utiliza un contenedor Docker llamado **`appgynsys-nginx-1`** que actúa como **Proxy Global Reverso** para todos los proyectos (GynSys, Arko360, etc.).

```
Internet (Puertos 80 / 443)
       │
       ▼
[appgynsys-nginx-1] (Contenedor Docker Global - Proxy Inverso)
       │  - Maneja los certificados SSL (Let's Encrypt).
       │  - Aquí se deben agregar configuraciones globales de headers HTTP 
       │    como `Cross-Origin-Opener-Policy` para WebAssembly/SharedArrayBuffer.
       │  - Archivo de config real: `/etc/nginx/conf.d/arko360.conf` (dentro del contenedor)
       │
       ├─────────────────────────────────┐
       ▼                                 ▼
[arko360_platform-nginx-1]        [appgynsys-backend-1]
(Contenedor Nginx de Arko)        (Contenedor de GynSys)
- Solo sirve los estáticos.       - Otras aplicaciones.
- Sus headers se pierden al
  pasar por el proxy global.
```

**Consecuencias de esta arquitectura:**
1. Editar archivos en `/etc/nginx/sites-available` del host Linux **no tiene ningún efecto**, ya que el host no escucha en los puertos web.
2. Si un feature requiere modificar headers HTTP (como FFmpeg WASM), los headers **deben** inyectarse copiando, editando y regresando el archivo de configuración dentro del contenedor `appgynsys-nginx-1`, seguido de un `docker exec appgynsys-nginx-1 nginx -s reload`.

---

## 2. Historial de Iteraciones y Desafíos Resueltos ⚙️

### Iteración 1: Calculadora de Diseño de Mezclas (Tesis de Ingeniería)
- **Desafío:** Extraer y portar la lógica matemática de un archivo Excel validado en la tesis de ingeniería civil del usuario (`app diseño de mezclas.xlsx`).
- **Solución:**
  - Se analizó el Excel utilizando scripts de Python locales (OpenPyXL) para extraer el motor de cálculo basado en regresiones lineales e interpolaciones logarítmicas, en lugar de utilizar simples tablas estáticas.
  - Se construyó el componente `MixDesignCalculator.jsx` en React que procesa Volumen, Resistencia ($f'_c$), Asentamiento, y Propiedades Físicas de Agregados para entregar resultados precisos en milisegundos.
  - **Estado:** ✅ Completado, testeado y subido a producción (`30249cdb`).

### Iteración 2: El Modelo de Datos y el Laberinto de Alembic
- **Desafío:** Modelar el backend de Arko (Posts y Proyectos) e inyectarlo en la base de datos PostgreSQL de producción.
- **Incidencias (Troubleshooting Alembic):**
  - **Bloqueo Local:** El servidor local de Docker PostgreSQL estaba apagado (`Connection refused` en el puerto 5433), imposibilitando la generación local de migraciones.
  - **Generación Remota:** Decidimos utilizar `ssh_runner.py` para generar la migración `alembic revision --autogenerate` directamente dentro del contenedor del VPS.
  - **Problema de Ramas Múltiples:** Descubrimos que el árbol de migraciones de producción (Alembic) estaba roto (`Multiple head revisions are present`) debido a que archivos antiguos generados (`c6aa46e17027` y `3787361c3e45`) habían sido purgados por un comando `git clean -fd`.
  - **Solución Definitiva:**
    1. Se recrearon localmente las migraciones perdidas (archivos *dummy*) y se pushearon a Git para reparar el grafo de dependencias de Alembic.
    2. Se creó un script manual en Python (`fix_alembic.py` y `fix2.py`) usando SQLAlchemy para apuntar la tabla de control `alembic_version` al *head* correcto.
    3. Ante la rebeldía del autogenerate, aplicamos inyección directa de SQL (DDL) mediante `fix_arko.py` para construir la tabla `arko_admins` e insertar el campo `seo_config`.
  - **Estado:** ✅ Completado. Las tablas están sanas en producción.

### Iteración 4: Error de Despliegue Estático ("Ni calculadora ni icono")
- **Desafío:** El usuario no podía ver las nuevas rutas de Arko 360 (Calculadora) ni el ícono de acceso al Dashboard en la Landing Page de GynSys, a pesar de que el código fuente local fue actualizado y pusheado a Git.
- **Análisis del Error Raíz (Post-Mortem):**
  - **Error:** Se realizó un despliegue manual mediante `scp -r frontend/dist/*` hacia el servidor VPS (`/var/www/html/`).
  - **Causa:** ¡Nunca se ejecutó `npm run build` en la carpeta `frontend` antes del `scp`! Como la carpeta `dist` está en el `.gitignore`, GitHub no la versiona. El servidor de producción estaba recibiendo una carpeta `dist` antigua que **no contenía** el componente `MixDesignCalculator.jsx` ni el nuevo Header compilado.
  - **Lección Aprendida:** Jamás confiar en hacer `scp` directo de un directorio ignorado (`dist`) sin compilar explícitamente (`npm run build`) justo antes de subir los archivos estáticos.
- **Solución:**
  1. Se compiló el frontend de GynSys correctamente.
  2. Se movió el ícono React Icon (`LayoutDashboard`) al **Header** de `LandingPage.jsx` para acceso directo al admin.
  3. Se resubió la carpeta `dist` actualizada.
- **Estado:** ✅ Completado y documentado en la Biblia.

### Iteración 3: Sistema de Autenticación Propio
- **Desafío:** Garantizar que GynSys y Arko no crucen credenciales de seguridad.
- **Solución:**
  - Backend: Se creó `get_current_arko_admin` y `/api/v1/arko/auth/login`. Este endpoint valida exclusivamente contra `arko_admins` e inyecta el `token_type: arko_admin`.
  - Frontend: Se creó el archivo `ArkoLogin.jsx` que almacena el token de sesión en `localStorage.getItem('arko_token')` (totalmente al margen de la sesión médica de `access_token` de GynSys).
  - Se configuró la cuenta semilla de producción: `admin@arko360.com` / `Arko360.admin`.
  - **Estado:** ✅ Completado y desplegado.

---

## 3. Estado Actual (Dónde Estamos) 📍

1. **Calculadora:** Funcionando y conectada a la Landing Page.
2. **Backend:** Operativo con endpoints protegidos para Arko.
3. **Login:** Rutas (`/arko-admin/login` y `/arko-admin/dashboard`) en el router global.

## 4. Próximos Pasos (Roadmap) 🚀

- [ ] **Limpieza de ArkoDashboardPage y ArkoPostEditor:** Los componentes actuales del editor de blog fueron clonados del sistema médico de GynSys. Contienen configuraciones muy pesadas relativas a Clínicas (Tenants) y URLs médicas.
- [ ] **Ajuste del Generador de IA:** Adaptar el *prompt* maestro (que originalmente generaba "Casos Clínicos Médicos") para que redacte "Proyectos de Arquitectura", "Diseño Estructural" y "Consejos de Construcción".
- [ ] **Despliegue del Frontend:** Una vez limpio el Dashboard, realizar el `npm run build` y subir el CMS de Arko 360 al servidor.
