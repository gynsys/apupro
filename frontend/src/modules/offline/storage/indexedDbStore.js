/**
 * Almacenamiento persistente en IndexedDB (con respaldo en memoria/localStorage)
 * exclusivo para el Modo Offline del Superadmin.
 */

import { isDeviceOfflineModeActive } from '../domain/offlinePolicy.js';

const DB_NAME = 'costbase_superadmin_offline_v1';
const DB_VERSION = 1;

const STORE_META = 'meta_store';
const STORE_BUDGETS_DETAIL = 'budgets_detail';
const STORE_COVENIN = 'covenin_catalog';
const STORE_OUTBOX = 'outbox_queue';

const memoryFallback = {
  [STORE_META]: new Map(),
  [STORE_BUDGETS_DETAIL]: new Map(),
  [STORE_COVENIN]: new Map(),
  [STORE_OUTBOX]: new Map(),
};

let dbInstancePromise = null;

function hasIndexedDB() {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
}

function openOfflineDb() {
  if (!hasIndexedDB()) return Promise.resolve(null);
  if (dbInstancePromise) return dbInstancePromise;

  dbInstancePromise = new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_META)) {
          db.createObjectStore(STORE_META, { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains(STORE_BUDGETS_DETAIL)) {
          db.createObjectStore(STORE_BUDGETS_DETAIL, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_COVENIN)) {
          db.createObjectStore(STORE_COVENIN, { keyPath: 'code' });
        }
        if (!db.objectStoreNames.contains(STORE_OUTBOX)) {
          db.createObjectStore(STORE_OUTBOX, { keyPath: 'opId' });
        }
      };

      request.onsuccess = (event) => {
        resolve(event.target.result);
      };

      request.onerror = () => {
        dbInstancePromise = null;
        resolve(null);
      };
    } catch (_e) {
      dbInstancePromise = null;
      resolve(null);
    }
  });

  return dbInstancePromise;
}

async function putRecord(storeName, record) {
  if (!isDeviceOfflineModeActive()) return false;
  const db = await openOfflineDb();
  if (!db) {
    const keyField =
      storeName === STORE_META
        ? 'key'
        : storeName === STORE_BUDGETS_DETAIL
        ? 'id'
        : storeName === STORE_COVENIN
        ? 'code'
        : 'opId';
    memoryFallback[storeName].set(String(record[keyField]), record);
    return true;
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      store.put(record);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch (_e) {
      resolve(false);
    }
  });
}

async function getRecord(storeName, key) {
  if (!isDeviceOfflineModeActive()) return null;
  const db = await openOfflineDb();
  if (!db) {
    return memoryFallback[storeName].get(String(key)) || null;
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    } catch (_e) {
      resolve(null);
    }
  });
}

async function getAllRecords(storeName) {
  if (!isDeviceOfflineModeActive()) return [];
  const db = await openOfflineDb();
  if (!db) {
    return Array.from(memoryFallback[storeName].values());
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
      req.onerror = () => resolve([]);
    } catch (_e) {
      resolve([]);
    }
  });
}

async function deleteRecord(storeName, key) {
  const db = await openOfflineDb();
  if (!db) {
    memoryFallback[storeName].delete(String(key));
    return true;
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      store.delete(key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch (_e) {
      resolve(false);
    }
  });
}

// ============================================================================
// 1. LISTA Y DETALLE DE PRESUPUESTOS
// ============================================================================

export async function saveOfflineBudgetsList(budgets) {
  if (!Array.isArray(budgets) || !isDeviceOfflineModeActive()) return false;
  return putRecord(STORE_META, {
    key: 'budgets_summary_list',
    updatedAt: new Date().toISOString(),
    items: budgets,
  });
}

export async function getOfflineBudgetsList() {
  if (!isDeviceOfflineModeActive()) return null;
  const record = await getRecord(STORE_META, 'budgets_summary_list');
  return record && Array.isArray(record.items) ? record.items : null;
}

export async function saveOfflineBudgetDetail(budget) {
  if (!budget || !budget.id || !isDeviceOfflineModeActive()) return false;
  return putRecord(STORE_BUDGETS_DETAIL, {
    ...budget,
    id: Number(budget.id) || String(budget.id),
    _cachedAt: new Date().toISOString(),
  });
}

export async function getOfflineBudgetDetail(budgetId) {
  if (!budgetId || !isDeviceOfflineModeActive()) return null;
  const numId = Number(budgetId);
  const byNum = !Number.isNaN(numId) ? await getRecord(STORE_BUDGETS_DETAIL, numId) : null;
  if (byNum) return byNum;
  return getRecord(STORE_BUDGETS_DETAIL, String(budgetId));
}

export async function getOfflineCachedBudgetsCount() {
  if (!isDeviceOfflineModeActive()) return 0;
  const list = await getAllRecords(STORE_BUDGETS_DETAIL);
  return list.length;
}

// ============================================================================
// 2. CATÁLOGO COVENIN LOCAL (PARA BÚSQUEDA Y ENRIQUECEDOR OFFLINE)
// ============================================================================

export async function saveOfflineCoveninCatalog(items) {
  if (!Array.isArray(items) || items.length === 0 || !isDeviceOfflineModeActive()) return false;
  const db = await openOfflineDb();
  if (!db) {
    items.forEach((it) => {
      const code = String(it.code || it.cod_par || it.id || '').trim();
      if (code) memoryFallback[STORE_COVENIN].set(code, { ...it, code });
    });
    return true;
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_COVENIN, 'readwrite');
      const store = tx.objectStore(STORE_COVENIN);
      items.forEach((it) => {
        const code = String(it.code || it.cod_par || it.id || '').trim();
        if (code) {
          store.put({
            code,
            description: String(it.description || it.des_par || '').toUpperCase(),
            unit: String(it.unit || it.uni_par || 'UND').toUpperCase(),
            chapter: String(it.chapter || '').toUpperCase(),
            unit_price: Number(it.unit_price || it.pre_par || 0),
          });
        }
      });
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch (_e) {
      resolve(false);
    }
  });
}

export async function getOfflineCoveninCatalog() {
  if (!isDeviceOfflineModeActive()) return [];
  return getAllRecords(STORE_COVENIN);
}

function normalizeSearchText(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export async function searchOfflineCoveninCatalog(query, limit = 25) {
  if (!isDeviceOfflineModeActive()) return [];
  const all = await getOfflineCoveninCatalog();
  if (!all || all.length === 0) return [];

  const cleanQ = normalizeSearchText(query).trim();
  if (!cleanQ) return all.slice(0, limit);

  const tokens = cleanQ.split(/\s+/).filter((t) => t.length >= 2);
  const scored = [];

  for (const item of all) {
    const codeNorm = normalizeSearchText(item.code);
    const descNorm = normalizeSearchText(item.description);
    let score = 0;

    if (codeNorm.includes(cleanQ)) {
      score += 100;
    }
    if (descNorm.includes(cleanQ)) {
      score += 50;
    }
    for (const tok of tokens) {
      if (descNorm.includes(tok) || codeNorm.includes(tok)) {
        score += 15;
      }
    }
    if (score > 0) {
      scored.push({ item, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.item);
}

// ============================================================================
// 3. COLA DE SINCRONIZACIÓN (OUTBOX QUEUE)
// ============================================================================

export async function enqueueOfflineOperation(operation) {
  if (!operation || !isDeviceOfflineModeActive()) return null;
  const opId = operation.opId || `op-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const record = {
    ...operation,
    opId,
    createdAt: operation.createdAt || new Date().toISOString(),
  };
  await putRecord(STORE_OUTBOX, record);
  return record;
}

export async function getOfflineOutbox() {
  if (!isDeviceOfflineModeActive()) return [];
  const items = await getAllRecords(STORE_OUTBOX);
  return items.sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
}

export async function removeOfflineOperation(opId) {
  if (!opId) return false;
  return deleteRecord(STORE_OUTBOX, opId);
}

export async function clearAllOfflineData() {
  Object.values(memoryFallback).forEach((m) => m.clear());
  if (!hasIndexedDB()) return;
  try {
    const db = await openOfflineDb();
    if (db) {
      db.close();
      dbInstancePromise = null;
    }
    window.indexedDB.deleteDatabase(DB_NAME);
  } catch (_e) {
    // ignore
  }
}
