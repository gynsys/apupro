import { API_URL } from '../../../services/api';

const BASE = `${API_URL}/budget-review`;

export const budgetReviewService = {
  async listSnapshots() {
    const res = await fetch(`${BASE}/snapshots`, {
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Error al obtener historial de auditorías');
    }
    return res.json();
  },

  async getSnapshotDetail(snapshotId) {
    const res = await fetch(`${BASE}/snapshots/${snapshotId}`, {
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Error al cargar el informe de auditoría');
    }
    return res.json();
  },

  async auditExistingBudget(budgetId, databaseId = 'master') {
    const res = await fetch(`${BASE}/audit-budget`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        budget_id: budgetId,
        database_id: databaseId || 'master',
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Error al auditar el presupuesto seleccionado');
    }
    return res.json();
  },

  async auditUploadedFile(file, databaseId = 'master') {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('database_id', databaseId || 'master');

    const res = await fetch(`${BASE}/audit-file`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Error al importar y auditar el archivo');
    }
    return res.json();
  },

  async deleteSnapshot(snapshotId) {
    const res = await fetch(`${BASE}/snapshots/${snapshotId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Error al eliminar la auditoría');
    }
    return res.json();
  },

  getExportExcelUrl(snapshotId) {
    return `${BASE}/snapshots/${snapshotId}/export-excel`;
  },
};
