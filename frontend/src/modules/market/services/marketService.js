import { API_URL } from '../../../services/api';

const getAuthHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${localStorage.getItem('arko_admin_token')}`
});

export const marketService = {
  getUnsanitizedMaterials: async (limit = 50) => {
    const response = await fetch(`${API_URL}/market/unsanitized?limit=${limit}`, {
      headers: getAuthHeaders()
    });
    if (!response.ok) throw new Error('Error al obtener materiales no saneados');
    return response.json();
  },

  sanitizeBatch: async (materials) => {
    const response = await fetch(`${API_URL}/market/sanitize/batch`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(materials)
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.detail || 'Error de la IA al sanear lote');
    }
    return response.json();
  },

  applySanitization: async (approvedItems) => {
    const response = await fetch(`${API_URL}/market/sanitize/apply`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(approvedItems)
    });
    if (!response.ok) throw new Error('Error al guardar datos saneados');
    return response.json();
  }
};
