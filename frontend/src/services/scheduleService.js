import { API_URL } from './api';

export const scheduleService = {
  // Obtener o crear cronograma del presupuesto
  getOrCreateByBudget: async (budgetId) => {
    const response = await fetch(`${API_URL}/schedules/budget/${budgetId}`, {
      credentials: 'include'
    });
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.detail || 'Error al cargar el cronograma del presupuesto');
    }
    return response.json();
  },

  // Importar / sincronizar partidas del presupuesto
  importBudgetItems: async (scheduleId, options = { round_up: true, default_cuadrillas: 1.0 }) => {
    const response = await fetch(`${API_URL}/schedules/${scheduleId}/import-budget`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(options)
    });
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.detail || 'Error al importar partidas del presupuesto');
    }
    return response.json();
  },

  // Actualizar metadatos del cronograma (fecha inicio, días por semana)
  updateSchedule: async (scheduleId, data) => {
    const response = await fetch(`${API_URL}/schedules/${scheduleId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.detail || 'Error al actualizar el cronograma');
    }
    return response.json();
  },

  // Actividades
  createActivity: async (scheduleId, data) => {
    const response = await fetch(`${API_URL}/schedules/${scheduleId}/activities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.detail || 'Error al crear la actividad');
    }
    return response.json();
  },

  updateActivity: async (scheduleId, activityId, data) => {
    const response = await fetch(`${API_URL}/schedules/${scheduleId}/activities/${activityId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.detail || 'Error al actualizar la actividad');
    }
    return response.json();
  },

  deleteActivity: async (scheduleId, activityId) => {
    const response = await fetch(`${API_URL}/schedules/${scheduleId}/activities/${activityId}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.detail || 'Error al eliminar la actividad');
    }
    return true;
  },

  // Dependencias
  createDependency: async (scheduleId, data) => {
    const response = await fetch(`${API_URL}/schedules/${scheduleId}/dependencies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.detail || 'Error al crear la dependencia');
    }
    return response.json();
  },

  deleteDependency: async (scheduleId, dependencyId) => {
    const response = await fetch(`${API_URL}/schedules/${scheduleId}/dependencies/${dependencyId}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.detail || 'Error al eliminar la dependencia');
    }
    return true;
  },

  // Calcular CPM
  calculate: async (scheduleId) => {
    const response = await fetch(`${API_URL}/schedules/${scheduleId}/calculate`, {
      method: 'POST',
      credentials: 'include'
    });
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.detail || 'Error al calcular la ruta crítica CPM');
    }
    return response.json();
  }
};
