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
    try {
      const response = await fetch(
        `${API_URL}/cost360/${type}?search=${encodeURIComponent(query)}&database_id=${databaseId}&limit=${limit}`,
        {
          credentials: 'include',
          signal,
        }
      );
      if (!response.ok) throw new Error(`Error al buscar ${type}`);
      const data = await response.json();
      if (isDeviceOfflineModeActive() && type === 'partidas') {
        const items = Array.isArray(data) ? data : data?.items || [];
        if (items.length > 0) saveOfflineCoveninCatalog(items);
      }
      return data;
    } catch (err) {
      if (isDeviceOfflineModeActive() && isNetworkOfflineError(err) && type === 'partidas') {
        const localMatches = await searchOfflineCoveninCatalog(query, limit);
        return { items: localMatches, total: localMatches.length, offline: true };
      }
      throw err;
    }
  },

  addComponent: async (budgetId, itemId, type, data) => {
    // type is 'materials', 'equipments', or 'labors'
    const response = await fetch(`${API_URL}/budgets/${budgetId}/items/${itemId}/${type}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error(`Error al agregar componente`);
    return response.json();
  },

  updateComponent: async (budgetId, itemId, type, componentId, data) => {
    // type is 'materials', 'equipments', or 'labors'
    const response = await fetch(`${API_URL}/budgets/${budgetId}/items/${itemId}/${type}/${componentId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error(`Error al actualizar componente`);
    return response.json();
  },

  syncPrices: async (budgetId) => {
    const response = await fetch(`${API_URL}/budgets/${budgetId}/sync_prices`, {
      method: 'POST',
      credentials: 'include'
    });
    if (!response.ok) throw new Error('Error al sincronizar precios');
    return response.json();
  },

  getById: async (id) => {
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
    const response = await fetch(`${API_URL}/budgets/${budgetId}/items/${itemId}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    if (!response.ok) throw new Error('Error al eliminar partida');
    return response.json();
  },

  reorderItems: async (budgetId, itemIds) => {
    const response = await fetch(`${API_URL}/budgets/${budgetId}/items/reorder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(itemIds)
    });
    if (!response.ok) throw new Error('Error al reordenar partidas');
    return response.json();
  },

  update: async (id, data) => {
    const response = await fetch(`${API_URL}/budgets/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Error al actualizar el presupuesto');
    return response.json();
  },

  delete: async (id) => {
    const response = await fetch(`${API_URL}/budgets/${id}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    if (!response.ok) throw new Error('Error al eliminar el presupuesto');
    // 204 No Content — no body to parse
    return response.status === 204 ? null : response.json();
  },

  duplicateBudget: async (id, newName) => {
    const response = await fetch(`${API_URL}/budgets/${id}/duplicate?new_name=${encodeURIComponent(newName)}`, {
      method: 'POST',
      credentials: 'include'
    });
    if (!response.ok) throw new Error('Error al duplicar el presupuesto');
    return response.json();
  },

  // ITEMS (Partidas del Presupuesto)
  addItem: async (budgetId, data) => {
    const response = await fetch(`${API_URL}/budgets/${budgetId}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
    return response.json();
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
    const response = await fetch(`${API_URL}/budgets/${budgetId}/items/${itemId}/${type}/${componentId}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    if (!response.ok) throw new Error(`Error al eliminar componente de tipo ${type}`);
    return response.json();
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
    return response.json();
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
  },

  enrichDescription: async (payload) => {
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
