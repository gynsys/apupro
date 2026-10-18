/**
 * debugStorage.js
 * Utilidades para guardar archivos Debug JSON directamente en carpetas del sistema
 * (ej. Descargas/debug) usando la File System Access API e IndexedDB, con fallback
 * transparente a descarga estándar de navegador (<a download>).
 */

const DB_NAME = 'apupro_debug_storage';
const DB_VERSION = 1;
const STORE_NAME = 'handles';
const KEY_DEBUG_DIR = 'debug_directory_handle';
const LS_DEBUG_DIR_NAME = 'debug_directory_name';

/**
 * Abre o crea la base de datos IndexedDB para almacenar FileSystemHandles
 * @returns {Promise<IDBDatabase>}
 */
function openDebugDB() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB no está disponible en este entorno'));
      return;
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Comprueba si la File System Access API está soportada en el navegador actual
 * @returns {boolean}
 */
export function isFileSystemAccessSupported() {
  return (
    typeof window !== 'undefined' &&
    typeof window.showDirectoryPicker === 'function' &&
    typeof window.FileSystemDirectoryHandle !== 'undefined'
  );
}

/**
 * Verifica si el handle tiene permiso readwrite concedido.
 * Si requestIfPrompt es true (disparado por un evento de usuario), solicita el permiso.
 * @param {FileSystemDirectoryHandle} handle
 * @param {boolean} [requestIfPrompt=false]
 * @returns {Promise<boolean>}
 */
export async function verifyPermission(handle, requestIfPrompt = false) {
  if (!handle || typeof handle.queryPermission !== 'function') {
    return false;
  }
  const opts = { mode: 'readwrite' };
  try {
    const status = await handle.queryPermission(opts);
    if (status === 'granted') {
      return true;
    }
    if (status === 'prompt' && requestIfPrompt && typeof handle.requestPermission === 'function') {
      const reqStatus = await handle.requestPermission(opts);
      return reqStatus === 'granted';
    }
    return false;
  } catch (err) {
    console.warn('Error al verificar permisos del directorio de debug:', err);
    return false;
  }
}

/**
 * Guarda el FileSystemDirectoryHandle en IndexedDB y el nombre en localStorage
 * @param {FileSystemDirectoryHandle} handle
 * @returns {Promise<void>}
 */
export async function saveDebugDirectoryHandle(handle) {
  if (!handle) {
    throw new Error('El handle del directorio es requerido');
  }
  const db = await openDebugDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const putReq = store.put(handle, KEY_DEBUG_DIR);
    putReq.onsuccess = () => {
      if (handle.name) {
        try {
          localStorage.setItem(LS_DEBUG_DIR_NAME, handle.name);
        } catch (e) {
          console.warn('No se pudo guardar el nombre del directorio en localStorage', e);
        }
      }
      resolve();
    };
    putReq.onerror = () => reject(putReq.error);
  });
}

/**
 * Obtiene el FileSystemDirectoryHandle guardado en IndexedDB
 * @returns {Promise<FileSystemDirectoryHandle|null>}
 */
export async function getDebugDirectoryHandle() {
  try {
    const db = await openDebugDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const getReq = store.get(KEY_DEBUG_DIR);
      getReq.onsuccess = () => resolve(getReq.result || null);
      getReq.onerror = () => resolve(null);
    });
  } catch (err) {
    console.warn('No se pudo acceder a IndexedDB para el handle de debug:', err);
    return null;
  }
}

/**
 * Elimina el FileSystemDirectoryHandle guardado en IndexedDB y localStorage
 * @returns {Promise<void>}
 */
export async function clearDebugDirectoryHandle() {
  try {
    localStorage.removeItem(LS_DEBUG_DIR_NAME);
  } catch (e) {
    console.warn('Error al limpiar localStorage de debug:', e);
  }
  try {
    const db = await openDebugDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const delReq = store.delete(KEY_DEBUG_DIR);
      delReq.onsuccess = () => resolve();
      delReq.onerror = () => resolve();
    });
  } catch (err) {
    console.warn('Error al limpiar directorio de debug en IndexedDB:', err);
  }
}

/**
 * Retorna el nombre de la carpeta configurada (desde localStorage)
 * @returns {string|null}
 */
export function getSavedDebugDirectoryName() {
  try {
    return localStorage.getItem(LS_DEBUG_DIR_NAME) || null;
  } catch {
    return null;
  }
}

/**
 * Solicita al usuario elegir una carpeta en disco para almacenar los archivos de debug.
 * Debe ejecutarse dentro de un gesto de usuario (click de botón).
 * @returns {Promise<{success: boolean, name?: string, handle?: FileSystemDirectoryHandle, aborted?: boolean, error?: string}>}
 */
export async function pickDebugDirectory() {
  if (!isFileSystemAccessSupported()) {
    return {
      success: false,
      error: 'Tu navegador no soporta la selección de carpetas en disco (File System Access API). Se mantendrá la descarga en la carpeta de Descargas estándar.'
    };
  }

  try {
    const handle = await window.showDirectoryPicker({
      id: 'apupro_debug_dir',
      mode: 'readwrite',
      startIn: 'downloads'
    });

    if (!handle) {
      return { success: false, error: 'No se seleccionó ninguna carpeta' };
    }

    await saveDebugDirectoryHandle(handle);
    return {
      success: true,
      name: handle.name,
      handle
    };
  } catch (err) {
    if (err && err.name === 'AbortError') {
      return { success: false, aborted: true };
    }
    console.error('Error al seleccionar carpeta de debug:', err);
    return {
      success: false,
      error: (err && err.message) || 'Error al seleccionar la carpeta'
    };
  }
}

/**
 * Guarda los datos de depuración como archivo JSON.
 * Si hay una carpeta configurada y accesible con permiso en disco, escribe directamente en ella.
 * De lo contrario, ejecuta una descarga estándar en el navegador (<a download>).
 *
 * @param {object|string} data - Datos JSON o string a guardar
 * @param {string} [customFilename=null] - Nombre de archivo opcional
 * @returns {Promise<{success: boolean, method: 'filesystem'|'download', filename: string, dirName?: string}>}
 */
export async function saveDebugJsonFile(data, customFilename = null) {
  if (!data) {
    throw new Error('No hay datos para guardar en el archivo de depuración');
  }

  const filename = customFilename || `debug_apu_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  const content = typeof data === 'string' ? data : JSON.stringify(data, null, 2);

  // 1. Intentar escribir directamente en la carpeta seleccionada (ej. Descargas/debug)
  if (isFileSystemAccessSupported()) {
    try {
      const dirHandle = await getDebugDirectoryHandle();
      if (dirHandle) {
        const hasPermission = await verifyPermission(dirHandle, false);
        if (hasPermission) {
          const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
          const writable = await fileHandle.createWritable();
          await writable.write(content);
          await writable.close();
          return {
            success: true,
            method: 'filesystem',
            filename,
            dirName: dirHandle.name
          };
        }
      }
    } catch (fsErr) {
      console.warn('No se pudo guardar directamente en el directorio configurado, aplicando fallback a Descargas:', fsErr);
    }
  }

  // 2. Fallback estándar a Descargas mediante <a download>
  try {
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);
    return {
      success: true,
      method: 'download',
      filename
    };
  } catch (dlErr) {
    console.error('Error crítico al descargar archivo de depuración:', dlErr);
    throw dlErr;
  }
}
