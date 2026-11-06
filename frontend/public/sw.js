/**
 * Service Worker de CostBase (Exclusivo para Superadmin).
 * Sólo es registrado por `swManager.js` cuando `isSuperAdminOfflineAllowed(user) === true`.
 * Si un usuario no-superadmin inicia sesión o cierra sesión, el SW es desregistrado y su caché eliminada.
 */

const CACHE_NAME = 'costbase-superadmin-shell-v1';
const APP_SHELL_URLS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/logo-cb-new.png',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL_URLS).catch(() => {
        // Ignorar errores individuales de precarga
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith('costbase-superadmin-') && k !== CACHE_NAME)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'ENABLE_SUPERADMIN_OFFLINE') {
    caches.open(CACHE_NAME).then((cache) => {
      cache.addAll(APP_SHELL_URLS).catch(() => {});
    });
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Solo interceptar peticiones GET del mismo origen
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // No interceptar llamadas a la API (/api/...) — de eso se encarga IndexedDB en budgetService.js
  if (url.pathname.startsWith('/api/')) return;

  // 1. Peticiones de navegación SPA (/budgets, /budgets/123, /costbase, /fcas, etc.):
  // Estrategia Network-First con fallback a /index.html en caché cuando no hay internet
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', copy));
          }
          return networkResponse;
        })
        .catch(async () => {
          const cachedIndex =
            (await caches.match('/index.html')) ||
            (await caches.match('/')) ||
            (await caches.match('/admin-assets/index.html'));
          if (cachedIndex) return cachedIndex;
          return new Response('CostBase Offline: Abra la app con conexión una vez para guardar el App Shell.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          });
        })
    );
    return;
  }

  // 2. Recursos estáticos de Vite (/admin-assets/*, imágenes, fuentes, CSS, JS):
  // Estrategia Cache-First con actualización en red
  if (
    url.pathname.startsWith('/admin-assets/') ||
    url.pathname.startsWith('/images/') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.endsWith('.webmanifest')
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const networkFetch = fetch(request)
          .then((response) => {
            if (response && response.ok) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
            return response;
          })
          .catch(() => cached);

        return cached || networkFetch;
      })
    );
  }
});
