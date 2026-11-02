import { API_URL } from '../../services/api';

function token() {
  return localStorage.getItem('token') || localStorage.getItem('access_token') || '';
}

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || 'No se pudo completar la operación de control de obra');
  }
  return data;
}

export const controlObraService = {
  getSummary: (budgetId) => request(`/budgets/${budgetId}/control-obra`),
  addProgress: (budgetId, payload) => request(`/budgets/${budgetId}/control-obra/progress`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  updateProgress: (budgetId, entryId, payload) => request(`/budgets/${budgetId}/control-obra/progress/${entryId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  }),
  syncProgress: (budgetId, payload) => request(`/budgets/${budgetId}/control-obra/progress/sync`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  createModification: (budgetId, payload) => request(`/budgets/${budgetId}/control-obra/modifications`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  approveModification: (budgetId, id) => request(`/budgets/${budgetId}/control-obra/modifications/${id}/approve`, {
    method: 'POST',
  }),
  createAddendum: (budgetId, payload) => request(`/budgets/${budgetId}/control-obra/addenda`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  approveAddendum: (budgetId, id) => request(`/budgets/${budgetId}/control-obra/addenda/${id}/approve`, {
    method: 'POST',
  }),
  getPeriods: (budgetId) => request(`/budgets/${budgetId}/control-obra/periods`),
  createPeriod: (budgetId, payload) => request(`/budgets/${budgetId}/control-obra/periods`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  closePeriod: (budgetId, id) => request(`/budgets/${budgetId}/control-obra/periods/${id}/close`, {
    method: 'POST',
  }),
  reopenPeriod: (budgetId, id, reason) => request(`/budgets/${budgetId}/control-obra/periods/${id}/reopen`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  }),
  getCurve: (budgetId) => request(`/budgets/${budgetId}/control-obra/curve`),
  planItem: (budgetId, payload) => request(`/budgets/${budgetId}/control-obra/plan`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  downloadReport: async (budgetId) => {
    const response = await fetch(`${API_URL}/budgets/${budgetId}/control-obra/report.xlsx`, {
      headers: token() ? { Authorization: `Bearer ${token()}` } : {},
    });
    if (!response.ok) throw new Error('No se pudo generar el reporte');
    return response.blob();
  },
};
