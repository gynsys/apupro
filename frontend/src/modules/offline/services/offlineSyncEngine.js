/**
 * Motor de preparación para Modo Obra (pre-descarga de presupuestos, APUs y catálogo COVENIN)
 * y sincronización en segundo plano (Outbox Queue) cuando regresa el internet.
 * Exclusivo para el Superadmin.
 */

import { API_URL } from '../../../services/api.js';
import { isDeviceOfflineModeActive, isSuperAdminOfflineAllowed } from '../domain/offlinePolicy.js';
import {
  saveOfflineBudgetsList,
  saveOfflineBudgetDetail,
  saveOfflineCoveninCatalog,
  getOfflineOutbox,
  removeOfflineOperation,
  getOfflineCachedBudgetsCount,
  getOfflineCoveninCatalog,
} from '../storage/indexedDbStore.js';

const COVENIN_SEED_QUERIES = [
  'E',
  'C',
  'I',
  'S',
  'U',
  'CONCRETO',
  'ACERO',
  'EXCAVACION',
  'DEMOLICION',
  'REMOCION',
  'PARED',
  'FRISO',
  'PINTURA',
  'TUBERIA',
  'CABLE',
  'TRANSPORTE',
];

function buildAuthHeaders() {
  const token =
    typeof localStorage !== 'undefined'
      ? localStorage.getItem('arko_admin_token') ||
        localStorage.getItem('token') ||
        localStorage.getItem('access_token')
      : null;
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Descarga todos los presupuestos del Superadmin (con sus APUs completos),
 * borradores de cómputos en la nube y un snapshot amplio del catálogo COVENIN
 * para trabajar 100% sin conexión en obra.
 *
 * @param {object} options
 * @param {object} options.user Usuario actual
 * @param {(status: { step: string, progress: number }) => void} [options.onProgress]
 * @returns {Promise<{ budgetsCached: number, coveninCached: number }>}
 */
export async function prepareDeviceForOfflineWork({ user, onProgress } = {}) {
  if (!isSuperAdminOfflineAllowed(user) && !isDeviceOfflineModeActive()) {
    throw new Error('Modo Offline exclusivo para Superadmin');
  }

  const report = (step, progress) => {
    if (typeof onProgress === 'function') {
      onProgress({ step, progress });
    }
  };

  report('Descargando lista de presupuestos...', 10);
  const headers = buildAuthHeaders();
  const listRes = await fetch(`${API_URL}/budgets/`, {
    headers,
    credentials: 'include',
  });
  if (!listRes.ok) {
    throw new Error('No se pudo descargar la lista de presupuestos');
  }
  const budgets = await listRes.json();
  await saveOfflineBudgetsList(budgets);

  // Descargar detalle completo de cada presupuesto (partidas + APUs)
  let budgetsCached = 0;
  const totalBudgets = Array.isArray(budgets) ? budgets.length : 0;
  for (let i = 0; i < totalBudgets; i++) {
    const b = budgets[i];
    const pct = 15 + Math.round(((i + 1) / Math.max(totalBudgets, 1)) * 45);
    report(`Guardando presupuesto (${i + 1}/${totalBudgets}): ${b.project_name || b.id}`, pct);
    try {
      const detailRes = await fetch(`${API_URL}/budgets/${b.id}`, {
        headers,
        credentials: 'include',
      });
      if (detailRes.ok) {
        const detail = await detailRes.json();
        await saveOfflineBudgetDetail(detail);
        budgetsCached += 1;
      }
    } catch (_e) {
      // Continuar con el siguiente presupuesto
    }
  }

  // Sincronizar borradores de cómputos en localStorage para que estén al día
  report('Sincronizando planillas de cómputos...', 68);
  try {
    const draftsRes = await fetch(`${API_URL}/budgets/computos/drafts`, {
      headers,
      credentials: 'include',
    });
    if (draftsRes.ok) {
      const cloudDrafts = await draftsRes.json();
      if (Array.isArray(cloudDrafts) && typeof localStorage !== 'undefined') {
        const rawLocal = localStorage.getItem('costbase_computos_saved_sheets_v1');
        const localList = rawLocal ? JSON.parse(rawLocal) : [];
        const byId = new Map();
        localList.forEach((d) => d?.id && byId.set(d.id, d));
        cloudDrafts.forEach((d) => d?.id && byId.set(d.id, d));
        localStorage.setItem(
          'costbase_computos_saved_sheets_v1',
          JSON.stringify(Array.from(byId.values()))
        );
      }
    }
  } catch (_e) {
    // Ignorar si falla
  }

  // Descargar catálogo compacto COVENIN para buscador y enriquecedor offline
  report('Descargando catálogo COVENIN para uso en obra...', 78);
  const collectedMap = new Map();
  for (let idx = 0; idx < COVENIN_SEED_QUERIES.length; idx++) {
    const q = COVENIN_SEED_QUERIES[idx];
    try {
      const res = await fetch(
        `${API_URL}/cost360/items?search=${encodeURIComponent(q)}&database_id=master&limit=100`,
        {
          headers,
          credentials: 'include',
        }
      );
      if (res.ok) {
        const data = await res.json();
        const items = Array.isArray(data) ? data : data?.items || [];
        items.forEach((it) => {
          const code = String(it.CovPar || it.CodPar || it.code || it.cod_par || it.id || '').trim();
          if (code && !collectedMap.has(code)) {
            collectedMap.set(code, it);
          }
        });
      }
    } catch (_e) {
      // Continuar
    }
  }

  const catalogItems = Array.from(collectedMap.values());
  if (catalogItems.length > 0) {
    await saveOfflineCoveninCatalog(catalogItems);
  }

  const totalCatalog = (await getOfflineCoveninCatalog()).length;
  const totalBudgetsStored = await getOfflineCachedBudgetsCount();

  report('¡Dispositivo listo para trabajar sin conexión!', 100);
  return {
    budgetsCached: totalBudgetsStored || budgetsCached,
    coveninCached: totalCatalog,
  };
}

/**
 * Procesa las operaciones pendientes en la cola `outbox_queue` cuando regresa la conexión.
 * @returns {Promise<{ synced: number, remaining: number }>}
 */
export async function flushOfflineOutbox() {
  if (!isDeviceOfflineModeActive()) return { synced: 0, remaining: 0 };
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    const current = await getOfflineOutbox();
    return { synced: 0, remaining: current.length };
  }

  const queue = await getOfflineOutbox();
  if (queue.length === 0) return { synced: 0, remaining: 0 };

  const headers = buildAuthHeaders();
  let synced = 0;

  for (const op of queue) {
    try {
      let ok = false;
      if (op.type === 'SAVE_COMPUTOS_DRAFT' && op.payload) {
        const res = await fetch(`${API_URL}/budgets/computos/drafts`, {
          method: 'POST',
          headers,
          credentials: 'include',
          body: JSON.stringify(op.payload),
        });
        ok = res.ok;
      } else if (op.type === 'COMMIT_COMPUTOS_IMPORT' && op.payload) {
        const res = await fetch(`${API_URL}/budgets/import/commit`, {
          method: 'POST',
          headers,
          credentials: 'include',
          body: JSON.stringify(op.payload),
        });
        ok = res.ok;
      } else if (op.type === 'ADD_BUDGET_ITEM' && op.budgetId && op.payload) {
        const res = await fetch(`${API_URL}/budgets/${op.budgetId}/items`, {
          method: 'POST',
          headers,
          credentials: 'include',
          body: JSON.stringify(op.payload),
        });
        ok = res.ok;
      } else if (op.type === 'UPDATE_BUDGET_ITEM' && op.budgetId && op.itemId && op.payload) {
        if (String(op.itemId).startsWith('offline-item-')) {
          ok = true;
        } else {
          const res = await fetch(`${API_URL}/budgets/${op.budgetId}/items/${op.itemId}`, {
            method: 'PUT',
            headers,
            credentials: 'include',
            body: JSON.stringify(op.payload),
          });
          ok = res.ok;
        }
      } else if (op.type === 'DELETE_BUDGET_ITEM' && op.budgetId && op.itemId) {
        if (String(op.itemId).startsWith('offline-item-')) {
          ok = true;
        } else {
          const res = await fetch(`${API_URL}/budgets/${op.budgetId}/items/${op.itemId}`, {
            method: 'DELETE',
            headers,
            credentials: 'include',
          });
          ok = res.ok || res.status === 404;
        }
      } else if (op.type === 'REORDER_BUDGET_ITEMS' && op.budgetId && op.payload) {
        const res = await fetch(`${API_URL}/budgets/${op.budgetId}/items/reorder`, {
          method: 'POST',
          headers,
          credentials: 'include',
          body: JSON.stringify(op.payload),
        });
        ok = res.ok;
      } else if (op.type === 'UPDATE_BUDGET' && op.budgetId && op.payload) {
        const res = await fetch(`${API_URL}/budgets/${op.budgetId}`, {
          method: 'PUT',
          headers,
          credentials: 'include',
          body: JSON.stringify(op.payload),
        });
        ok = res.ok;
      } else if (op.type === 'ADD_APU_COMPONENT' && op.budgetId && op.itemId && op.compType && op.payload) {
        const res = await fetch(`${API_URL}/budgets/${op.budgetId}/items/${op.itemId}/${op.compType}`, {
          method: 'POST',
          headers,
          credentials: 'include',
          body: JSON.stringify(op.payload),
        });
        ok = res.ok;
      } else if (op.type === 'UPDATE_APU_COMPONENT' && op.budgetId && op.itemId && op.compType && op.componentId && op.payload) {
        if (String(op.componentId).startsWith('offline-')) {
          ok = true;
        } else {
          const res = await fetch(`${API_URL}/budgets/${op.budgetId}/items/${op.itemId}/${op.compType}/${op.componentId}`, {
            method: 'PUT',
            headers,
            credentials: 'include',
            body: JSON.stringify(op.payload),
          });
          ok = res.ok;
        }
      } else if (op.type === 'DELETE_APU_COMPONENT' && op.budgetId && op.itemId && op.compType && op.componentId) {
        if (String(op.componentId).startsWith('offline-')) {
          ok = true;
        } else {
          const res = await fetch(`${API_URL}/budgets/${op.budgetId}/items/${op.itemId}/${op.compType}/${op.componentId}`, {
            method: 'DELETE',
            headers,
            credentials: 'include',
          });
          ok = res.ok || res.status === 404;
        }
      } else {
        // Operación desconocida: descartar para no bloquear cola
        ok = true;
      }

      if (ok) {
        await removeOfflineOperation(op.opId);
        synced += 1;
      }
    } catch (_e) {
      // Si vuelve a fallar la red, detener el ciclo hasta el próximo evento online
      break;
    }
  }

  const remaining = (await getOfflineOutbox()).length;
  return { synced, remaining };
}
