/**
 * Gestor del Service Worker PWA exclusivo para el Superadmin.
 * - Si el usuario es Superadmin: registra `/sw.js` con scope `/` y activa el caché de App Shell.
 * - Si el usuario NO es Superadmin (o cierra sesión): desregistra cualquier Service Worker activo
 *   y purga todos los cachés e IndexedDB offline del dispositivo.
 */

import { isSuperAdminOfflineAllowed, persistSuperAdminUser } from '../domain/offlinePolicy.js';
import { clearAllOfflineData } from '../storage/indexedDbStore.js';

const SW_URL = '/sw.js';

/**
 * Sincroniza el estado del Service Worker y almacenamiento offline según el usuario autenticado.
 * @param {object|null} user
 * @returns {Promise<boolean>} true si el SW quedó activo para Superadmin
 */
export async function syncServiceWorkerForUser(user) {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return false;
  }

  if (isSuperAdminOfflineAllowed(user)) {
    persistSuperAdminUser(user);
    try {
      const registration = await navigator.serviceWorker.register(SW_URL, { scope: '/' });
      const discoveredAssets = [];
      if (typeof document !== 'undefined') {
        document.querySelectorAll('script[src], link[rel="stylesheet"][href], link[rel="modulepreload"][href]').forEach((el) => {
          const rawUrl = el.getAttribute('src') || el.getAttribute('href');
          if (rawUrl && rawUrl.startsWith('/')) {
            discoveredAssets.push(rawUrl);
          }
        });
      }
      const targetWorker = registration.active || registration.waiting || registration.installing;
      if (targetWorker) {
        targetWorker.postMessage({
          type: 'ENABLE_SUPERADMIN_OFFLINE',
          assets: discoveredAssets,
        });
      }
      return true;
    } catch (_err) {
      return false;
    }
  }

  // Si no es Superadmin, limpiar persistencia, desregistrar SW y borrar cachés
  await disableAndPurgeOfflineMode();
  return false;
}

/**
 * Desactiva completamente el Modo Offline, desregistra Service Workers y limpia IndexedDB/CacheStorage.
 * @returns {Promise<void>}
 */
export async function disableAndPurgeOfflineMode() {
  persistSuperAdminUser(null);
  await clearAllOfflineData();

  if (typeof window === 'undefined') return;

  if ('serviceWorker' in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((reg) => reg.unregister()));
    } catch (_e) {
      // ignore
    }
  }

  if ('caches' in window) {
    try {
      const keys = await window.caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith('costbase-superadmin-'))
          .map((k) => window.caches.delete(k))
      );
    } catch (_e) {
      // ignore
    }
  }
}
