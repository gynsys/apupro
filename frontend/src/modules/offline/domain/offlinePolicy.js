/**
 * Política de acceso al Modo Offline.
 * Restringe todas las capacidades offline (PWA Service Worker, sesión persistente,
 * caché IndexedDB de presupuestos/COVENIN y cola de sincronización) exclusivamente al Superadmin.
 */

export const SUPERADMIN_OFFLINE_EMAIL = 'admin@arko360.net';
export const SUPERADMIN_USER_STORAGE_KEY = 'arko_superadmin_offline_user_v1';
export const SUPERADMIN_OFFLINE_FLAG_KEY = 'arko_superadmin_offline_enabled_v1';

/**
 * Verifica si un objeto de usuario corresponde al Superadmin autorizado para Modo Offline.
 * @param {object|null} user
 * @returns {boolean}
 */
export function isSuperAdminOfflineAllowed(user) {
  if (!user || typeof user !== 'object') return false;
  if (user.is_superadmin === true) return true;
  const email = String(user.email || '').trim().toLowerCase();
  return email === SUPERADMIN_OFFLINE_EMAIL;
}

/**
 * Verifica si el dispositivo tiene habilitado actualmente el Modo Offline de Superadmin
 * en almacenamiento local.
 * @returns {boolean}
 */
export function isDeviceOfflineModeActive() {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  try {
    return window.localStorage.getItem(SUPERADMIN_OFFLINE_FLAG_KEY) === '1';
  } catch (_e) {
    return false;
  }
}

/**
 * Lee el perfil del Superadmin persistido localmente para mantener sesión en obra sin señal.
 * @returns {object|null}
 */
export function getPersistedSuperAdminUser() {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(SUPERADMIN_USER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isSuperAdminOfflineAllowed(parsed) ? parsed : null;
  } catch (_e) {
    return null;
  }
}

/**
 * Guarda o limpia el perfil persistente del Superadmin en localStorage.
 * Si el usuario no es Superadmin, asegura que no quede ningún dato offline persistido.
 * @param {object|null} user
 * @returns {void}
 */
export function persistSuperAdminUser(user) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    if (isSuperAdminOfflineAllowed(user)) {
      window.localStorage.setItem(SUPERADMIN_USER_STORAGE_KEY, JSON.stringify(user));
      window.localStorage.setItem(SUPERADMIN_OFFLINE_FLAG_KEY, '1');
    } else {
      window.localStorage.removeItem(SUPERADMIN_USER_STORAGE_KEY);
      window.localStorage.removeItem(SUPERADMIN_OFFLINE_FLAG_KEY);
    }
  } catch (_e) {
    // Ignorar errores de cuota
  }
}

/**
 * Determina si un error de fetch corresponde a falta de red / modo sin conexión
 * (y NO a un rechazo HTTP 401/403 del servidor).
 * @param {unknown} error
 * @returns {boolean}
 */
export function isNetworkOfflineError(error) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return true;
  }
  if (!error) return false;
  const msg = String(error.message || error || '').toLowerCase();
  return (
    error.name === 'TypeError' ||
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network request failed') ||
    msg.includes('load failed') ||
    msg.includes('offline')
  );
}
