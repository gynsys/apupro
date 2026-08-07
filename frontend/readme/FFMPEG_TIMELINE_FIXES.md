# Correcciones: FFmpeg WASM + Timeline Track History
**Fecha:** Julio 2026
**Modulo:** admin -> Social Generator -> Editor de Video

---

## 1. Problema Original: "Error al cargar el motor de video (FFmpeg)"

### Diagnostico
FFmpeg WebAssembly requiere SharedArrayBuffer del navegador. Para que funcione, el servidor
DEBE enviar estos dos headers HTTP en todas las respuestas:

    Cross-Origin-Opener-Policy: same-origin
    Cross-Origin-Embedder-Policy: require-corp

Sin ellos, el navegador bloquea silenciosamente la carga del WASM y la promesa
ffmpegInstance.load() nunca resuelve ni rechaza -- se queda colgada indefinidamente.

### Causa adicional: CDN externo bloqueado
Inicialmente el codigo cargaba FFmpeg desde unpkg.com (CDN externo). Algunos navegadores
y redes bloquean imports de Workers desde origenes cruzados, causando el error:
"failed to import ffmpeg-core.js"

---

## 2. Correcciones Aplicadas

### 2.1 Servir FFmpeg localmente (sin CDN)

Los archivos de nucleo se copiaron desde node_modules a la carpeta public/:

    admin/public/ffmpeg/ffmpeg-core.js   (~112 KB)
    admin/public/ffmpeg/ffmpeg-core.wasm (~30 MB)

En VideoEditorModal.jsx se cambio la URL de carga:

    // ANTES (CDN externo - fallaba por CORS)
    coreURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js'

    // DESPUES (local - sin dependencia de red externa)
    const baseURL = `${window.location.origin}/ffmpeg`;
    coreURL: `${baseURL}/ffmpeg-core.js`
    wasmURL: `${baseURL}/ffmpeg-core.wasm`

### 2.2 Headers COOP/COEP -- ARQUITECTURA DE DOS NGINX

IMPORTANTE: La arquitectura tiene DOS capas de nginx en Docker:
  - Nginx Global Proxy (`appgynsys-nginx-1`) -- Escucha en los puertos 80/443 del servidor y enruta el trafico a todos los contenedores.
  - Nginx del Admin (`arko360_platform-nginx-1`) -- Interno al contenedor del admin, sus headers se pierden al pasar por el proxy global.

Los headers DEBEN agregarse al nginx del Global Proxy.

Archivo a modificar: `/etc/nginx/conf.d/arko360.conf` (dentro del contenedor `appgynsys-nginx-1`)

    server {
        listen 443 ssl;
        server_name admin.arko360.net;

        # REQUERIDO para FFmpeg WASM (SharedArrayBuffer)
        add_header Cross-Origin-Opener-Policy "same-origin" always;
        add_header Cross-Origin-Embedder-Policy "require-corp" always;

        ...
    }

Para aplicar el parche (proceso realizado):
    1. Extraer config: `docker cp appgynsys-nginx-1:/etc/nginx/conf.d/arko360.conf /root/arko360.conf`
    2. Modificar archivo agregando los `add_header` en el bloque de `admin.arko360.net`.
    3. Retornar config: `docker cp /root/arko360.conf appgynsys-nginx-1:/etc/nginx/conf.d/arko360.conf`
    4. Aplicar cambios: `docker exec appgynsys-nginx-1 nginx -s reload`

### 2.3 Vite Dev Server (desarrollo local)

En vite.config.js se agregaron los headers para desarrollo local:

    server: {
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
      },
    },

---

## 3. Feature: Timeline / Track History de Textos

### Descripcion
Sistema de linea de tiempo para controlar aparicion/desaparicion de textos en video.

### Archivos modificados
- components/TimelinePanel.jsx    -- nuevo componente con tracks arrastrables
- components/SlideCanvas.jsx      -- textos y elementos respetan startTime/endTime
- hooks/useVideoExport.js         -- exportacion multipaso con captura por intervalos
- index.jsx                       -- integracion del panel, estado videoTime

### Propiedades anadidas a la estructura de slide
    slide.titleStartTime     // segundos en que aparece el titulo
    slide.titleEndTime       // segundos en que desaparece el titulo
    slide.contentStartTime   // segundos en que aparece el contenido
    slide.contentEndTime     // segundos en que desaparece el contenido
    el.startTime             // para elementos extra
    el.endTime

---

## 4. Arquitectura del Servidor

    Internet
       |
    Nginx Global Proxy (appgynsys-nginx-1)   <-- aqui van los headers COOP/COEP
    (Puertos 80/443 reales del servidor)
       | proxy_pass http://172.18.0.1:3001
    Nginx Docker Admin (arko360_platform-nginx-1) <-- este nginx NO aplica headers al exterior
       | serve static files
    dist/
       +-- ffmpeg/
           +-- ffmpeg-core.js
           +-- ffmpeg-core.wasm         <-- 30MB, se cachea en el navegador
