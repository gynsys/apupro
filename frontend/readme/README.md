# Ingeniería Arko 360 - Landing Page

Esta es la documentación oficial (Biblia de Desarrollo) para la Landing Page de **Ingeniería Arko 360**. El objetivo de este documento es proporcionar todo el contexto técnico, decisiones de arquitectura y guías de estilo para que cualquier desarrollador pueda continuar escalando o modificando el proyecto en el futuro sin romper el diseño ni el sistema de despliegue.

---

## 🏗️ 1. Arquitectura y Stack Tecnológico

El proyecto está construido bajo una arquitectura moderna pero deliberadamente simple, enfocada en rendimiento y alto impacto visual:

- **Framework Core:** React 18
- **Build Tool:** Vite (rápido, HMR instantáneo)
- **Estilos:** Vanilla CSS (Puro). **NO SE USA TAILWIND**. Todo el diseño está centralizado en un Design System personalizado en `index.css`.
- **Animaciones:** Framer Motion (para entradas suaves al hacer scroll y modales)
- **Iconografía:** Lucide React (ligeros, consistentes y vectoriales)
- **Formularios:** React Hook Form (para validación eficiente del formulario de contacto sin re-renders innecesarios)
- **Enrutamiento Base:** `/arko360/` (Configurado en `vite.config.js` para que los assets carguen correctamente desde el subdirectorio).

---

## 📂 2. Estructura de Directorios

La carpeta principal del proyecto se ubica dentro del repositorio de GynSys (`appgynsys/arko360`), pero opera de manera totalmente aislada a nivel de código fuente.

```text
arko360/
├── dist/                  # (Generado) Código compilado de producción
├── public/                # Assets estáticos (Logo, imágenes en el futuro)
├── src/
│   ├── components/        # Componentes UI (Navbar, Hero, About, Portfolio, etc.)
│   ├── hooks/             # Custom Hooks (ej. useContactForm.js para lógica de negocio)
│   ├── services/          # Conexiones externas (ej. api.js para envíos de correo)
│   ├── App.jsx            # Contenedor principal que ensambla la Landing
│   ├── main.jsx           # Punto de entrada de React
│   └── index.css          # DESIGN SYSTEM: Core de estilos y utilidades
├── .env.example           # Variables de entorno de ejemplo
├── package.json           # Dependencias exclusivas de Arko 360
├── vite.config.js         # Configuración de compilación de Vite
└── README.md              # Este archivo
```

---

## 🎨 3. Design System (`index.css`)

Todo el aspecto visual se controla desde `src/index.css`. Antes de crear CSS inline o clases nuevas, se deben aprovechar las variables y utilidades ya existentes.

### Paleta de Colores (Variables CSS)
Basados en el logo oficial:
- **Azul Principal:** `--primary: #1A6BB5;` (Se usa en botones primarios, acentos y overlays).
- **Gris/Negro:** `--secondary: #3D3D3D;` (Se usa en títulos principales `h1`, `h2`).
- **Fondos:** `--bg: #F8FAFC;` (Gris súper claro para secciones alternas) y `--white: #FFFFFF;`.
- **Textos:** `--text: #1F2937;` (Párrafos) y `--text-muted: #6B7280;` (Subtítulos).

### Utilidades Globales
Existen clases predefinidas para agilizar el desarrollo:
- `.container`: Centra el contenido a un máximo de `1200px` con padding lateral.
- `.section`: Aplica un padding vertical generoso (`96px`) estándar para cada bloque de la página.
- `.section-tag`: Genera la etiqueta pequeña redondeada con fondo azul translúcido (ej. "Sobre Nosotros").
- `.section-title`: Formato para los títulos de sección (fuente condensada, negrita, tamaño fluido responsivo).
- Botones: `.btn`, `.btn-primary`, `.btn-outline`, `.btn-white`.

---

## 📱 4. Reglas del Responsive Web Design (RWD)

El proyecto es "Mobile-First" mentalmente, pero adaptado usando Media Queries tradicionales (`@media (max-width: 768px)`).
Si vas a modificar componentes, ten en cuenta:

1. **Flexbox/Grid:** Los contenedores principales usan `display: grid` o `display: flex; flex-wrap: wrap`.
2. **Fuentes Fluidas:** Los tamaños de letra principales usan `clamp()` (ej. `font-size: clamp(32px, 5vw, 52px)`), por lo que se achican automáticamente sin necesidad de media queries.
3. **Navbar:** Tiene un script que detecta si el usuario está arriba (menú transparente con logo blanco) o si ha hecho scroll (menú blanco con logo original). En móviles (`< 768px`), el logo se reduce a `70px` para no deformar la barra superior.

---

## 🚀 5. Flujo de Desarrollo Local

Si necesitas agregar una nueva sección (ej. "Preguntas Frecuentes"):

1. Entra a la carpeta: `cd C:\Users\pablo\Documents\appgynsys\arko360`
2. Inicia el servidor de Vite: `npm run dev`
3. Abre tu navegador en `http://localhost:5174/arko360/` (Nota: Vite respetará el path base `/arko360/`).
4. Crea tu nuevo componente en `src/components/FAQ.jsx`.
5. Impórtalo en `src/App.jsx`.
6. Añade los estilos al final de `src/index.css` (o respeta las reglas de componentes existentes).

---

## 🌐 6. Proceso de Despliegue a Producción (MUY IMPORTANTE)

Debido a que este proyecto reside dentro de un repositorio de React más grande (GynSys) que utiliza Netlify como hosting de *Single Page Application*, **Netlify puede entrar en conflicto** si intenta compilar ambos proyectos simultáneamente usando diferentes gestores de paquetes (NPM vs PNPM).

Por ello, el despliegue de Arko 360 se realiza con una técnica de **"Build Estático Embebido"**. 

Para actualizar el sitio en vivo, debes seguir estos pasos exactos desde la terminal de tu PC:

```powershell
# 1. Ve a la carpeta de Arko 360
cd C:\Users\pablo\Documents\appgynsys\arko360

# 2. Compila el código (Minifica React y CSS)
npm run build

# 3. Elimina los assets viejos que están en la carpeta pública de GynSys
Remove-Item -Path "..\frontend\public\arko360\assets" -Recurse -Force

# 4. Copia el nuevo resultado de la compilación hacia la carpeta pública de GynSys
Copy-Item -Path "dist\*" -Destination "..\frontend\public\arko360" -Recurse -Force

# 5. Ve a la raíz del repositorio, commitea y sube los cambios a GitHub
cd ..
git add frontend/public/arko360 arko360/src
git commit -m "feat(arko360): descripción de lo que cambiaste"
git push
```

**¿Por qué funciona esto?**
Cuando subes los archivos a GitHub, Netlify compila GynSys normalmente. Como los archivos compilados de Arko 360 ahora viven en `frontend/public/arko360`, Netlify simplemente los toma y los sube tal cual, ignorando que son una aplicación de React aparte. 

Además, existe una regla en `frontend/public/_redirects` que evita que el React Router de GynSys intercepte la URL `/arko360`:
```text
/arko360/*  /arko360/index.html  200
/arko360    /arko360/index.html  200
```

---

## 📧 7. Configuración de Formularios

El formulario de contacto (`src/components/Contact.jsx`) usa `src/hooks/useContactForm.js` para enviar datos. 
Actualmente, las llamadas apuntan a un mock o una ruta API configurada en `api.js`. Si vas a conectarlo a un backend real (ej. SendGrid o un webhook), debes:

1. Abrir `src/services/api.js`.
2. Modificar la función `submitContactForm` para que haga un `fetch()` o `axios.post()` a tu servidor real.
3. Asegurarte de que la API retorne una respuesta 200 OK para que el formulario muestre la pantalla verde de "¡Mensaje Enviado!".

---
*Documento creado el 31 de Mayo de 2026.*
