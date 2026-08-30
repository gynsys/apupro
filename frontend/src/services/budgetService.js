import { API_URL } from './api';

const getAuthHeaders = () => {
  const token = localStorage.getItem('arko_admin_token');
  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : ''
  };
};

export const budgetService = {
  // BUDGETS
  getAll: async () => {
    const response = await fetch(`${API_URL}/budgets/`, {
      headers: getAuthHeaders()
    });
    if (!response.ok) throw new Error('Error al cargar presupuestos');
    return response.json();
  },

  generateAPUReport: async (id) => {
    const response = await fetch(`${API_URL}/budgets/${id}/report`, {
      headers: getAuthHeaders()
    });
    if (!response.ok) throw new Error('Error al generar reporte');
    return response.blob();
  },

  searchComponents: async (type, query, databaseId = 'master') => {
    // type is 'materials', 'equipments', or 'labors'
    // databaseId is the ID of the selected database (e.g., 'master', 'personalizada', 'junio')
    const response = await fetch(`${API_URL}/cost360/${type}?search=${encodeURIComponent(query)}&database_id=${databaseId}`);
    if (!response.ok) throw new Error(`Error al buscar ${type}`);
    return response.json();
  },

  addComponent: async (budgetId, itemId, type, data) => {
    // type is 'materials', 'equipments', or 'labors'
    const response = await fetch(`${API_URL}/budgets/${budgetId}/items/${itemId}/${type}`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error(`Error al agregar componente`);
    return response.json();
  },

  updateComponent: async (budgetId, itemId, type, componentId, data) => {
    // type is 'materials', 'equipments', or 'labors'
    const response = await fetch(`${API_URL}/budgets/${budgetId}/items/${itemId}/${type}/${componentId}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error(`Error al actualizar componente`);
    return response.json();
  },

  syncPrices: async (budgetId) => {
    const response = await fetch(`${API_URL}/budgets/${budgetId}/sync_prices`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    if (!response.ok) throw new Error('Error al sincronizar precios');
    return response.json();
  },

  getById: async (id) => {
    const response = await fetch(`${API_URL}/budgets/${id}`, {
      headers: getAuthHeaders()
    });
    if (!response.ok) throw new Error('Error al cargar el presupuesto');
    return response.json();
  },

  create: async (data) => {
    const response = await fetch(`${API_URL}/budgets/`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Error al crear el presupuesto');
    return response.json();
  },

  updateItem: async (budgetId, itemId, data) => {
    const response = await fetch(`${API_URL}/budgets/${budgetId}/items/${itemId}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Error al actualizar item');
    return response.json();
  },

  deleteItem: async (budgetId, itemId) => {
    const response = await fetch(`${API_URL}/budgets/${budgetId}/items/${itemId}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    if (!response.ok) throw new Error('Error al eliminar partida');
    return response.json();
  },

  reorderItems: async (budgetId, itemIds) => {
    const response = await fetch(`${API_URL}/budgets/${budgetId}/items/reorder`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(itemIds)
    });
    if (!response.ok) throw new Error('Error al reordenar partidas');
    return response.json();
  },

  update: async (id, data) => {
    const response = await fetch(`${API_URL}/budgets/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Error al actualizar el presupuesto');
    return response.json();
  },

  delete: async (id) => {
    const response = await fetch(`${API_URL}/budgets/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    if (!response.ok) throw new Error('Error al eliminar el presupuesto');
    return response.json();
  },

  duplicateBudget: async (id, newName) => {
    const response = await fetch(`${API_URL}/budgets/${id}/duplicate?new_name=${encodeURIComponent(newName)}`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    if (!response.ok) throw new Error('Error al duplicar el presupuesto');
    return response.json();
  },

  // ITEMS (Partidas del Presupuesto)
  addItem: async (budgetId, data) => {
    const response = await fetch(`${API_URL}/budgets/${budgetId}/items`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.detail || 'Error al agregar partida al presupuesto');
    }
    return response.json();
  },

  // DELETE a single APU component (material, equipment or labor)
  deleteComponent: async (budgetId, itemId, type, componentId) => {
    const response = await fetch(`${API_URL}/budgets/${budgetId}/items/${itemId}/${type}/${componentId}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    if (!response.ok) throw new Error(`Error al eliminar componente de tipo ${type}`);
    return response.json();
  }
};
