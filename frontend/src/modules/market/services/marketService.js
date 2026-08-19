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
    if (!response.ok) throw new Error('Error al aplicar saneamiento');
    return response.json();
  },
  
  getIndicators: async () => {
    const response = await fetch(`${API_URL}/market/indicators`, {
      headers: getAuthHeaders()
    });
    if (!response.ok) throw new Error('Error al obtener indicadores');
    return response.json();
  },

  updateLeaderPrice: async (indicatorId, newPrice) => {
    const response = await fetch(`${API_URL}/market/indicators/${indicatorId}/apply`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ new_price: newPrice, leader_id: indicatorId })
    });
    if (!response.ok) throw new Error('Error al actualizar precio líder');
    return response.json();
  },

  getFamilyMaterials: async (familyId) => {
    const response = await fetch(`${API_URL}/market/families/${familyId}/materials`, {
      headers: getAuthHeaders()
    });
    if (!response.ok) throw new Error('Error al obtener materiales de la familia');
    return response.json();
  },

  changeFamilyLeader: async (familyId, newLeaderId) => {
    const response = await fetch(`${API_URL}/market/families/${familyId}/change-leader`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ new_leader_id: newLeaderId })
    });
    if (!response.ok) throw new Error('Error al cambiar el líder de la familia');
    return response.json();
  }
};
