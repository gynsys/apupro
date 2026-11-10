import { API_URL } from './api';
import {
  isDeviceOfflineModeActive,
  isNetworkOfflineError,
  saveOfflineBudgetsList,
  getOfflineBudgetsList,
  saveOfflineBudgetDetail,
  getOfflineBudgetDetail,
  saveOfflineCoveninCatalog,
  searchOfflineCoveninCatalog,
  enqueueOfflineOperation,
} from '../modules/offline';

function notifyOfflineChanged() {
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent('costbase:offline-updated'));
  }
}

const getAuthHeaders = () => {
  const token = typeof localStorage !== 'undefined'
    ? (localStorage.getItem('arko_admin_token') || localStorage.getItem('token') || localStorage.getItem('access_token'))
    : null;
  const headers = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

export const budgetService = {
  // BUDGETS
  getAll: async () => {
    if (isDeviceOfflineModeActive() && typeof navigator !== 'undefined' && navigator.onLine === false) {
      const cached = await getOfflineBudgetsList();
      if (cached) return cached;
    }
    try {
      const response = await fetch(`${API_URL}/budgets/`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Error al cargar presupuestos');
      const data = await response.json();
      if (isDeviceOfflineModeActive() && Array.isArray(data)) {
        saveOfflineBudgetsList(data);
        // Pre-cachear en segundo plano el detalle de los presupuestos para que al desconectar internet abran al instante
        if (typeof navigator !== 'undefined' && navigator.onLine !== false) {
          Promise.allSettled(
            data.slice(0, 25).map(async (b) => {
              if (!b || !b.id) return;
              const existing = await getOfflineBudgetDetail(b.id);
              if (existing && !existing._offlineSummaryFallback && Array.isArray(existing.items)) {
                return;
              }
              const detailRes = await fetch(`${API_URL}/budgets/${b.id}`, {
                credentials: 'include',
              });
              if (detailRes.ok) {
                const detail = await detailRes.json();
                await saveOfflineBudgetDetail(detail);
              }
            })
          ).then(() => notifyOfflineChanged());
        }
      }
      return data;
    } catch (err) {
      if (isDeviceOfflineModeActive()) {
        const cached = await getOfflineBudgetsList();
        if (cached) return cached;
      }
      throw err;
    }
  },

  generateAPUReport: async (id) => {
    const response = await fetch(`${API_URL}/budgets/${id}/report`, {
      credentials: 'include'
    });
    if (!response.ok) throw new Error('Error al generar reporte');
    return response.blob();
  },

  searchComponents: async (type, query, databaseId = 'master', limit = 50, signal = null) => {
    // type is 'materials', 'equipments', or 'labors' (or 'partidas')
    const endpoint = type === 'partidas' ? 'items' : type;
    if (isDeviceOfflineModeActive() && typeof navigator !== 'undefined' && navigator.onLine === false) {
      if (type === 'partidas' || type === 'items') {
        const localMatches = await searchOfflineCoveninCatalog(query, limit);
        return { items: localMatches, total: localMatches.length, offline: true };
      }
      return [];
    }
    try {
      const response = await fetch(
        `${API_URL}/cost360/${endpoint}?search=${encodeURIComponent(query)}&database_id=${databaseId}&limit=${limit}`,
        {
          credentials: 'include',
          signal,
        }
      );
      if (!response.ok) throw new Error(`Error al buscar ${type}`);
      const data = await response.json();
      if (isDeviceOfflineModeActive() && (type === 'partidas' || type === 'items')) {
        const items = Array.isArray(data) ? data : data?.items || [];
        if (items.length > 0) saveOfflineCoveninCatalog(items);
      }
      return data;
    } catch (err) {
      if (isDeviceOfflineModeActive() && isNetworkOfflineError(err)) {
        if (type === 'partidas' || type === 'items') {
          const localMatches = await searchOfflineCoveninCatalog(query, limit);
          return { items: localMatches, total: localMatches.length, offline: true };
        }
        return [];
      }
      throw err;
    }
  },

  addComponent: async (budgetId, itemId, type, data) => {
    // type is 'materials', 'equipments', or 'labors'
    try {
      const response = await fetch(`${API_URL}/budgets/${budgetId}/items/${itemId}/${type}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error(`Error al agregar componente`);
      const added = await response.json();
      if (isDeviceOfflineModeActive()) {
        const cached = await getOfflineBudgetDetail(budgetId);
        if (cached && Array.isArray(cached.items)) {
          const updatedItems = cached.items.map((it) =>
            String(it.id) === String(itemId)
              ? { ...it, [type]: [...(it[type] || []), added] }
              : it
          );
          await saveOfflineBudgetDetail({ ...cached, items: updatedItems });
        }
      }
      return added;
    } catch (err) {
      if (isDeviceOfflineModeActive() && isNetworkOfflineError(err)) {
        const tempComp = {
          id: `offline-${type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          ...data,
          _offlineCreated: true,
        };
        await enqueueOfflineOperation({
          type: 'ADD_APU_COMPONENT',
          budgetId,
          itemId,
          compType: type,
          payload: data,
        });
        const cached = await getOfflineBudgetDetail(budgetId);
        if (cached && Array.isArray(cached.items)) {
          const updatedItems = cached.items.map((it) =>
            String(it.id) === String(itemId)
              ? { ...it, [type]: [...(it[type] || []), tempComp] }
              : it
          );
          await saveOfflineBudgetDetail({ ...cached, items: updatedItems });
        }
        notifyOfflineChanged();
        return tempComp;
      }
      throw err;
    }
  },

  updateComponent: async (budgetId, itemId, type, componentId, data) => {
    // type is 'materials', 'equipments', or 'labors'
    try {
      const response = await fetch(`${API_URL}/budgets/${budgetId}/items/${itemId}/${type}/${componentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error(`Error al actualizar componente`);
      const updated = await response.json();
      if (isDeviceOfflineModeActive()) {
        const cached = await getOfflineBudgetDetail(budgetId);
        if (cached && Array.isArray(cached.items)) {
          const updatedItems = cached.items.map((it) =>
            String(it.id) === String(itemId)
              ? {
                  ...it,
                  [type]: (it[type] || []).map((c) =>
                    String(c.id) === String(componentId) ? { ...c, ...updated } : c
                  ),
                }
              : it
          );
          await saveOfflineBudgetDetail({ ...cached, items: updatedItems });
        }
      }
      return updated;
    } catch (err) {
      if (isDeviceOfflineModeActive() && isNetworkOfflineError(err)) {
        await enqueueOfflineOperation({
          type: 'UPDATE_APU_COMPONENT',
          budgetId,
          itemId,
          compType: type,
          componentId,
          payload: data,
        });
        const cached = await getOfflineBudgetDetail(budgetId);
        if (cached && Array.isArray(cached.items)) {
          const updatedItems = cached.items.map((it) =>
            String(it.id) === String(itemId)
              ? {
                  ...it,
                  [type]: (it[type] || []).map((c) =>
                    String(c.id) === String(componentId) ? { ...c, ...data } : c
                  ),
                }
              : it
          );
          await saveOfflineBudgetDetail({ ...cached, items: updatedItems });
        }
        notifyOfflineChanged();
        return { id: componentId, ...data, _offlineQueued: true };
      }
      throw err;
    }
  },

  syncPrices: async (budgetId) => {
    const response = await fetch(`${API_URL}/budgets/${budgetId}/sync_prices`, {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include'
    });
    if (!response.ok) throw new Error('Error al sincronizar precios');
    return response.json();
  },

  syncAdvanced: async (budgetId, payload) => {
    const response = await fetch(`${API_URL}/budgets/${budgetId}/sync_advanced`, {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || 'Error al actualizar el presupuesto');
    }
    return response.json();
  },

  getById: async (id) => {
    if (isDeviceOfflineModeActive() && typeof navigator !== 'undefined' && navigator.onLine === false) {
      const cached = await getOfflineBudgetDetail(id);
      if (cached) return cached;
    }
    try {
      const response = await fetch(`${API_URL}/budgets/${id}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Error al cargar el presupuesto');
      const data = await response.json();
      if (isDeviceOfflineModeActive() && data) {
        saveOfflineBudgetDetail(data);
      }
      return data;
    } catch (err) {
      if (isDeviceOfflineModeActive()) {
        const cached = await getOfflineBudgetDetail(id);
        if (cached) return cached;
      }
      throw err;
    }
  },

  create: async (data) => {
    const response = await fetch(`${API_URL}/budgets/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (response.status === 403) {
        throw { detail: errorData.detail || 'Límite alcanzado', isLimitError: true };
      }
      throw new Error(errorData.detail || 'Error al crear el presupuesto');
    }
    return response.json();
  },

  updateItem: async (budgetId, itemId, data) => {
    try {
      const response = await fetch(`${API_URL}/budgets/${budgetId}/items/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Error al actualizar item');
      return response.json();
    } catch (err) {
      if (isDeviceOfflineModeActive() && isNetworkOfflineError(err)) {
        await enqueueOfflineOperation({
          type: 'UPDATE_BUDGET_ITEM',
          budgetId,
          itemId,
          payload: data,
        });
        const cached = await getOfflineBudgetDetail(budgetId);
        if (cached && Array.isArray(cached.items)) {
          const updatedItems = cached.items.map((it) =>
            String(it.id) === String(itemId) ? { ...it, ...data } : it
          );
          await saveOfflineBudgetDetail({ ...cached, items: updatedItems });
        }
        notifyOfflineChanged();
        return { id: itemId, ...data, _offlineQueued: true };
      }
      throw err;
    }
  },

  deleteItem: async (budgetId, itemId) => {
    try {
      const response = await fetch(`${API_URL}/budgets/${budgetId}/items/${itemId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Error al eliminar partida');
      const resData = await response.json();
      if (isDeviceOfflineModeActive()) {
        const cached = await getOfflineBudgetDetail(budgetId);
        if (cached && Array.isArray(cached.items)) {
          await saveOfflineBudgetDetail({
            ...cached,
            items: cached.items.filter((it) => String(it.id) !== String(itemId)),
          });
        }
      }
      return resData;
    } catch (err) {
      if (isDeviceOfflineModeActive() && isNetworkOfflineError(err)) {
        await enqueueOfflineOperation({
          type: 'DELETE_BUDGET_ITEM',
          budgetId,
          itemId,
        });
        const cached = await getOfflineBudgetDetail(budgetId);
        if (cached && Array.isArray(cached.items)) {
          await saveOfflineBudgetDetail({
            ...cached,
            items: cached.items.filter((it) => String(it.id) !== String(itemId)),
          });
        }
        notifyOfflineChanged();
        return { deleted: true, id: itemId, _offlineQueued: true };
      }
      throw err;
    }
  },

  reorderItems: async (budgetId, itemIds) => {
    try {
      const response = await fetch(`${API_URL}/budgets/${budgetId}/items/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(itemIds)
      });
      if (!response.ok) throw new Error('Error al reordenar partidas');
      return response.json();
    } catch (err) {
      if (isDeviceOfflineModeActive() && isNetworkOfflineError(err)) {
        await enqueueOfflineOperation({
          type: 'REORDER_BUDGET_ITEMS',
          budgetId,
          payload: itemIds,
        });
        notifyOfflineChanged();
        return { reordered: true, _offlineQueued: true };
      }
      throw err;
    }
  },

  update: async (id, data) => {
    try {
      const response = await fetch(`${API_URL}/budgets/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify(data)
      });
      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.detail || 'Error al actualizar el presupuesto');
      }
      const updated = await response.json();
      if (isDeviceOfflineModeActive()) {
        try {
          const cached = await getOfflineBudgetDetail(id);
          if (cached) {
            await saveOfflineBudgetDetail({ ...cached, ...updated });
          }
        } catch (offlineErr) {
          console.warn('[budgetService] Error updating offline budget cache:', offlineErr);
        }
      }
      return updated;
    } catch (err) {
      if (isDeviceOfflineModeActive() && isNetworkOfflineError(err)) {
        await enqueueOfflineOperation({
          type: 'UPDATE_BUDGET',
          budgetId: id,
          payload: data,
        });
        const cached = await getOfflineBudgetDetail(id);
        if (cached) {
          await saveOfflineBudgetDetail({ ...cached, ...data });
        }
        notifyOfflineChanged();
        return { id, ...data, _offlineQueued: true };
      }
      throw err;
    }
  },

  delete: async (id) => {
    const response = await fetch(`${API_URL}/budgets/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
      credentials: 'include'
    });
    if (!response.ok) throw new Error('Error al eliminar el presupuesto');
    // 204 No Content — no body to parse
    return response.status === 204 ? null : response.json();
  },

  duplicateBudget: async (id, newName) => {
    const response = await fetch(`${API_URL}/budgets/${id}/duplicate?new_name=${encodeURIComponent(newName)}`, {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include'
    });
    if (!response.ok) throw new Error('Error al duplicar el presupuesto');
    return response.json();
  },

  // ITEMS (Partidas del Presupuesto)
  addItem: async (budgetId, data) => {
    try {
      const response = await fetch(`${API_URL}/budgets/${budgetId}/items`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify(data)
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        if (response.status === 403) {
          throw { detail: errData.detail || 'Límite alcanzado', isLimitError: true };
        }
        throw new Error(errData.detail || 'Error al agregar partida al presupuesto');
      }
      const created = await response.json();
      if (isDeviceOfflineModeActive()) {
        const cached = await getOfflineBudgetDetail(budgetId);
        if (cached && Array.isArray(cached.items)) {
          await saveOfflineBudgetDetail({
            ...cached,
            items: [...cached.items, created],
          });
        }
      }
      return created;
    } catch (err) {
      if (isDeviceOfflineModeActive() && isNetworkOfflineError(err)) {
        const tempItem = {
          id: `offline-item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          ...data,
          materials: data.materials || [],
          equipments: data.equipments || [],
          labors: data.labors || [],
          _offlineCreated: true,
        };
        await enqueueOfflineOperation({
          type: 'ADD_BUDGET_ITEM',
          budgetId,
          payload: data,
        });
        const cached = await getOfflineBudgetDetail(budgetId);
        if (cached && Array.isArray(cached.items)) {
          await saveOfflineBudgetDetail({
            ...cached,
            items: [...cached.items, tempItem],
          });
        }
        notifyOfflineChanged();
        return tempItem;
      }
      throw err;
    }
  },

  importSharedPartida: async (budgetId, token) => {
    const response = await fetch(`${API_URL}/budgets/${budgetId}/import-shared-partida`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ token })
    });
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      if (response.status === 403) {
        throw { detail: errData.detail || 'Límite alcanzado', isLimitError: true };
      }
      throw new Error(errData.detail || 'Error al importar la partida compartida');
    }
    return response.json();
  },

  // DELETE a single APU component (material, equipment or labor)
  deleteComponent: async (budgetId, itemId, type, componentId) => {
    try {
      const response = await fetch(`${API_URL}/budgets/${budgetId}/items/${itemId}/${type}/${componentId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!response.ok) throw new Error(`Error al eliminar componente de tipo ${type}`);
      const resData = await response.json();
      if (isDeviceOfflineModeActive()) {
        const cached = await getOfflineBudgetDetail(budgetId);
        if (cached && Array.isArray(cached.items)) {
          const updatedItems = cached.items.map((it) =>
            String(it.id) === String(itemId)
              ? { ...it, [type]: (it[type] || []).filter((c) => String(c.id) !== String(componentId)) }
              : it
          );
          await saveOfflineBudgetDetail({ ...cached, items: updatedItems });
        }
      }
      return resData;
    } catch (err) {
      if (isDeviceOfflineModeActive() && isNetworkOfflineError(err)) {
        await enqueueOfflineOperation({
          type: 'DELETE_APU_COMPONENT',
          budgetId,
          itemId,
          compType: type,
          componentId,
        });
        const cached = await getOfflineBudgetDetail(budgetId);
        if (cached && Array.isArray(cached.items)) {
          const updatedItems = cached.items.map((it) =>
            String(it.id) === String(itemId)
              ? { ...it, [type]: (it[type] || []).filter((c) => String(c.id) !== String(componentId)) }
              : it
          );
          await saveOfflineBudgetDetail({ ...cached, items: updatedItems });
        }
        notifyOfflineChanged();
        return { deleted: true, id: componentId, _offlineQueued: true };
      }
      throw err;
    }
  },

  // Backup functionality
  exportBackup: async (budgetId) => {
    const response = await fetch(`${API_URL}/budgets/${budgetId}/backup`, {
      method: 'POST',
      credentials: 'include'
    });
    if (!response.ok) throw new Error('Error al exportar backup');
    return response.json();
  },

  importBackup: async (file) => {
    const formData = new FormData();
    formData.append('backup_file', file);

    const response = await fetch(`${API_URL}/budgets/import-backup`, {
      method: 'POST',
      credentials: 'include',
      body: formData
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Error al importar backup');
    }
    return response.json();
  },

  // Importar presupuesto desde archivo (Excel, CSV, PDF o imagen)
  previewImport: async (file, mode = 'budget') => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('mode', mode);

    const response = await fetch(`${API_URL}/budgets/import/preview`, {
      method: 'POST',
      credentials: 'include',
      body: formData
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const error = new Error(errorData.detail || 'No se pudo analizar el archivo');
      error.status = response.status;
      throw error;
    }
    return response.json();
  },

  commitImport: async (payload) => {
    try {
      const response = await fetch(`${API_URL}/budgets/import/commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const error = new Error(errorData.detail || 'No se pudo crear el presupuesto');
        error.status = response.status;
        throw error;
      }
      const result = await response.json();
      if (isDeviceOfflineModeActive() && result?.budget_id) {
        try {
          const detailRes = await fetch(`${API_URL}/budgets/${result.budget_id}`, {
            credentials: 'include',
          });
          if (detailRes.ok) {
            const detail = await detailRes.json();
            await saveOfflineBudgetDetail(detail);
          }
        } catch (_e) {
          // ignore
        }
      }
      return result;
    } catch (err) {
      if (isDeviceOfflineModeActive() && isNetworkOfflineError(err)) {
        const targetId = payload?.budget_id || `offline-budget-${Date.now()}`;
        await enqueueOfflineOperation({
          type: 'COMMIT_COMPUTOS_IMPORT',
          payload,
        });
        const existingDetail = payload?.budget_id ? await getOfflineBudgetDetail(payload.budget_id) : null;
        const offlineItems = Array.isArray(payload?.items)
          ? payload.items.map((it, idx) => ({
              id: it.id || `offline-item-${idx}-${Date.now()}`,
              cod_par: it.code || it.cod_par || `P-${idx + 1}`,
              cov_par: it.code || it.cov_par || '',
              description: it.description || '',
              unit: it.unit || 'UND',
              quantity: Number(it.quantity) || 0,
              performance: Number(it.performance) || 1,
              unit_price: Number(it.unit_price) || 0,
              is_chapter: Boolean(it.is_chapter),
              materials: it.materials || [],
              equipments: it.equipments || [],
              labors: it.labors || [],
            }))
          : existingDetail?.items || [];

        const updatedBudget = {
          ...(existingDetail || {}),
          id: targetId,
          name: payload?.project_name || existingDetail?.name || 'Presupuesto Offline',
          project_name: payload?.project_name || existingDetail?.project_name || 'Presupuesto Offline',
          currency: payload?.currency || existingDetail?.currency || 'USD',
          items: offlineItems,
        };
        await saveOfflineBudgetDetail(updatedBudget);
        const list = (await getOfflineBudgetsList()) || [];
        const existsInList = list.some((b) => String(b.id) === String(targetId));
        if (!existsInList) {
          await saveOfflineBudgetsList([
            {
              id: targetId,
              name: updatedBudget.name,
              project_name: updatedBudget.project_name,
              currency: updatedBudget.currency,
              created_at: new Date().toISOString(),
              items_count: offlineItems.filter((i) => !i.is_chapter).length,
              total_amount: 0,
            },
            ...list,
          ]);
        }
        notifyOfflineChanged();
        return { budget_id: targetId, _offlineQueued: true };
      }
      throw err;
    }
  },

  generateImportApu: async (payload) => {
    const response = await fetch(`${API_URL}/budgets/import/generate-apu`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const error = new Error(errorData.detail || 'No se pudo generar el APU');
      error.status = response.status;
      throw error;
    }
    return response.json();
  },

  resolveComputo: async (payload) => {
    if (isDeviceOfflineModeActive() && typeof navigator !== 'undefined' && navigator.onLine === false) {
      const localMatches = await searchOfflineCoveninCatalog(payload?.description || '', 1);
      const best = localMatches[0];
      return {
        code: best?.code || payload?.code || 'S/C',
        description: best?.description || String(payload?.description || '').toUpperCase(),
        unit: payload?.unit || best?.unit || 'UND',
        unit_price: Number(best?.unit_price || 0),
        materials: [],
        equipments: [],
        labors: [],
        offline: true,
      };
    }
    try {
      const response = await fetch(`${API_URL}/budgets/import/resolve-computo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const error = new Error(errorData.detail || 'No se pudo procesar la partida de cómputo');
        error.status = response.status;
        throw error;
      }
      return response.json();
    } catch (err) {
      if (isDeviceOfflineModeActive() && isNetworkOfflineError(err)) {
        const localMatches = await searchOfflineCoveninCatalog(payload?.description || '', 1);
        const best = localMatches[0];
        return {
          code: best?.code || payload?.code || 'S/C',
          description: best?.description || String(payload?.description || '').toUpperCase(),
          unit: payload?.unit || best?.unit || 'UND',
          unit_price: Number(best?.unit_price || 0),
          materials: [],
          equipments: [],
          labors: [],
          offline: true,
        };
      }
      throw err;
    }
  },

  enrichDescription: async (payload) => {
    if (isDeviceOfflineModeActive() && typeof navigator !== 'undefined' && navigator.onLine === false) {
      const localMatches = await searchOfflineCoveninCatalog(payload?.description || '', 8);
      return {
        status: localMatches.length > 0 ? 'complete' : 'incomplete',
        covenin_matches: localMatches.map((m) => ({
          code: m.code,
          description: m.description,
          unit: m.unit,
          chapter: m.chapter || 'CATÁLOGO LOCAL OFFLINE',
        })),
        questions: [],
        enriched_description: String(payload?.description || '').toUpperCase(),
        recommended_unit: localMatches[0]?.unit || payload?.current_unit || 'UND',
        recommended_code: localMatches[0]?.code || '',
        offline: true,
      };
    }
    try {
      const response = await fetch(`${API_URL}/budgets/import/enrich-description`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const error = new Error(errorData.detail || 'No se pudo analizar la descripción de la partida');
        error.status = response.status;
        throw error;
      }
      return response.json();
    } catch (err) {
      if (isDeviceOfflineModeActive() && isNetworkOfflineError(err)) {
        const localMatches = await searchOfflineCoveninCatalog(payload?.description || '', 8);
        return {
          status: localMatches.length > 0 ? 'complete' : 'incomplete',
          covenin_matches: localMatches.map((m) => ({
            code: m.code,
            description: m.description,
            unit: m.unit,
            chapter: m.chapter || 'CATÁLOGO LOCAL OFFLINE',
          })),
          questions: [],
          enriched_description: String(payload?.description || '').toUpperCase(),
          recommended_unit: localMatches[0]?.unit || payload?.current_unit || 'UND',
          recommended_code: localMatches[0]?.code || '',
          offline: true,
        };
      }
      throw err;
    }
  },

  exportExcel: async (budgetId, payload = null) => {
    const response = await fetch(`${API_URL}/budgets/${budgetId}/export-excel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload || {})
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Error al exportar presupuesto a Excel');
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    let filename = `Presupuesto_${budgetId}.xlsx`;
    const contentDisposition = response.headers.get('content-disposition');
    if (contentDisposition && contentDisposition.includes('filename=')) {
      filename = contentDisposition.split('filename=')[1].replace(/["']/g, '').trim();
    }
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return true;
  },

  exportAllApusExcel: async (budgetId, payload = null) => {
    const response = await fetch(`${API_URL}/budgets/${budgetId}/export-apus-excel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload || {})
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Error al exportar APUs a Excel');
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    let filename = `APUs_${budgetId}.xlsx`;
    const contentDisposition = response.headers.get('content-disposition');
    if (contentDisposition && contentDisposition.includes('filename=')) {
      filename = contentDisposition.split('filename=')[1].replace(/["']/g, '').trim();
    }
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return true;
  },

  recalibratePerformances: async (budgetId) => {
    const response = await fetch(`${API_URL}/budgets/${budgetId}/recalibrate-performances`, {
      method: 'POST',
      credentials: 'include'
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Error al recalibrar rendimientos');
    }
    return response.json();
  },

  getComputosDrafts: async () => {
    if (isDeviceOfflineModeActive() && typeof navigator !== 'undefined' && navigator.onLine === false) {
      try {
        const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('costbase_computos_saved_sheets_v1') : null;
        return raw ? JSON.parse(raw) : [];
      } catch (_e) {
        return [];
      }
    }
    try {
      const headers = getAuthHeaders();
      delete headers['Content-Type'];
      const response = await fetch(`${API_URL}/budgets/computos/drafts`, {
        headers,
        credentials: 'include'
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Error al obtener borradores de cómputos');
      }
      return response.json();
    } catch (err) {
      if (isDeviceOfflineModeActive() && isNetworkOfflineError(err)) {
        try {
          const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('costbase_computos_saved_sheets_v1') : null;
          return raw ? JSON.parse(raw) : [];
        } catch (_e) {
          return [];
        }
      }
      throw err;
    }
  },

  saveComputosDraft: async (payload) => {
    try {
      const response = await fetch(`${API_URL}/budgets/computos/drafts`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Error al guardar borrador de cómputos en la nube');
      }
      return response.json();
    } catch (err) {
      if (isDeviceOfflineModeActive() && isNetworkOfflineError(err)) {
        await enqueueOfflineOperation({
          type: 'SAVE_COMPUTOS_DRAFT',
          payload,
        });
        notifyOfflineChanged();
        return { ...payload, _offlineQueued: true };
      }
      throw err;
    }
  },

  deleteComputosDraft: async (draftId) => {
    const headers = getAuthHeaders();
    delete headers['Content-Type'];
    const response = await fetch(`${API_URL}/budgets/computos/drafts/${encodeURIComponent(draftId)}`, {
      method: 'DELETE',
      headers,
      credentials: 'include'
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Error al eliminar borrador de cómputos en la nube');
    }
    return response.json();
  },

  exportComputosExcel: async (payload) => {
    const response = await fetch(`${API_URL}/budgets/computos/export-excel`, {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Error al exportar cómputos a Excel');
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;

    let filename = `Planilla_de_Computos.xlsx`;
    const contentDisposition = response.headers.get('content-disposition');
    if (contentDisposition && contentDisposition.includes('filename=')) {
      filename = contentDisposition.split('filename=')[1].replace(/["']/g, '').trim();
    }
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return true;
  }
};
