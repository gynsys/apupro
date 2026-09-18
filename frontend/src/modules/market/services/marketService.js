import { apiFetch, apiPost, apiPut } from '../../../lib/apiHelper';

export const marketService = {
  getUnsanitizedMaterials: async (limit = 50) => {
    const response = await apiFetch(`/market/unsanitized?limit=${limit}`);
    if (!response.ok) throw new Error('Error al obtener materiales no saneados');
    return response.json();
  },

  sanitizeBatch: async (materials) => {
    const response = await apiPost('/market/sanitize/batch', materials);
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.detail || 'Error de la IA al sanear lote');
    }
    return response.json();
  },

  applySanitization: async (approvedItems) => {
    const response = await apiPost('/market/sanitize/apply', approvedItems);
    if (!response.ok) throw new Error('Error al aplicar saneamiento');
    return response.json();
  },

  getIndicators: async (databaseId = 'master') => {
    const dbParam = databaseId ? `?database_id=${encodeURIComponent(databaseId)}` : '';
    const response = await apiFetch(`/market/indicators${dbParam}`);
    if (!response.ok) throw new Error('Error al obtener indicadores');
    return response.json();
  },

  updateLeaderPrice: async (indicatorId, newPrice, databaseId = 'master') => {
    const response = await apiPut(`/market/indicators/${indicatorId}/apply`, {
      new_price: newPrice,
      leader_id: indicatorId,
      database_id: databaseId || 'master'
    });
    if (!response.ok) throw new Error('Error al actualizar precio líder');
    return response.json();
  },

  getFamilyMaterials: async (familyId, databaseId = 'master') => {
    const dbParam = databaseId ? `?database_id=${encodeURIComponent(databaseId)}` : '';
    const response = await apiFetch(`/market/families/${familyId}/materials${dbParam}`);
    if (!response.ok) throw new Error('Error al obtener materiales de la familia');
    return response.json();
  },

  changeFamilyLeader: async (familyId, newLeaderId, databaseId = 'master') => {
    const response = await apiPost(`/market/families/${familyId}/change-leader`, {
      new_leader_id: newLeaderId,
      database_id: databaseId || 'master'
    });
    if (!response.ok) throw new Error('Error al cambiar el líder de la familia');
    return response.json();
  }
};
