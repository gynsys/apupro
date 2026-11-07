import { API_URL } from '../../../services/api';

const BASE = `${API_URL}/budget-review`;

function buildAuthHeaders(extra = {}) {
  const token =
    typeof localStorage !== 'undefined'
      ? localStorage.getItem('arko_admin_token') ||
        localStorage.getItem('token') ||
        localStorage.getItem('access_token')
      : null;
  const headers = { ...extra };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

export const budgetReviewService = {
  async listSnapshots() {
    const res = await fetch(`${BASE}/snapshots`, {
      credentials: 'include',
      headers: buildAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Error al obtener historial de auditorías');
    }
    return res.json();
  },

  async getSnapshotDetail(snapshotId) {
    const res = await fetch(`${BASE}/snapshots/${encodeURIComponent(snapshotId)}`, {
      credentials: 'include',
      headers: buildAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Error al cargar el informe de auditoría');
    }
    return res.json();
  },

  async auditExistingBudget(budgetId, databaseId = 'master', options = {}) {
    const res = await fetch(`${BASE}/audit-budget`, {
      method: 'POST',
      headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
      credentials: 'include',
      body: JSON.stringify({
        budget_id: budgetId,
        database_id: databaseId || 'master',
        parent_snapshot_id: options.parentSnapshotId || null,
        name: options.name || null,
        project_name: options.projectName || null,
        client_name: options.clientName || null,
        auditor_notes: options.auditorNotes || null,
        report_code: options.reportCode || null,
        reviewer_name: options.reviewerName || null,
        reviewer_civ: options.reviewerCiv || null,
        document_reference: options.documentReference || null,
        institution_name: options.institutionName || null,
        conclusion_text: options.conclusionText || null,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Error al auditar el presupuesto seleccionado');
    }
    return res.json();
  },

  async auditUploadedFile(file, databaseId = 'master', options = {}) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('database_id', databaseId || 'master');
    if (options.mode) {
      formData.append('mode', options.mode);
    }
    if (options.parentSnapshotId) {
      formData.append('parent_snapshot_id', options.parentSnapshotId);
    }
    if (options.name) {
      formData.append('name', options.name);
    }
    if (options.projectName) {
      formData.append('project_name', options.projectName);
    }
    if (options.clientName) {
      formData.append('client_name', options.clientName);
    }
    if (options.auditorNotes) {
      formData.append('auditor_notes', options.auditorNotes);
    }
    if (options.reportCode) {
      formData.append('report_code', options.reportCode);
    }
    if (options.reviewerName) {
      formData.append('reviewer_name', options.reviewerName);
    }
    if (options.reviewerCiv) {
      formData.append('reviewer_civ', options.reviewerCiv);
    }
    if (options.documentReference) {
      formData.append('document_reference', options.documentReference);
    }
    if (options.institutionName) {
      formData.append('institution_name', options.institutionName);
    }
    if (options.conclusionText) {
      formData.append('conclusion_text', options.conclusionText);
    }

    const res = await fetch(`${BASE}/audit-file`, {
      method: 'POST',
      headers: buildAuthHeaders(),
      credentials: 'include',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Error al importar y auditar el archivo');
    }
    return res.json();
  },

  async saveSnapshot(snapshotId, payload) {
    const res = await fetch(`${BASE}/snapshots/${encodeURIComponent(snapshotId)}`, {
      method: 'PATCH',
      headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Error al guardar la auditoría');
    }
    return res.json();
  },

  async saveSnapshotAs(snapshotId, payload) {
    const res = await fetch(`${BASE}/snapshots/${encodeURIComponent(snapshotId)}/clone`, {
      method: 'POST',
      headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Error al guardar copia de la auditoría');
    }
    return res.json();
  },

  async updateFinding(snapshotId, findingId, payload) {
    const res = await fetch(
      `${BASE}/snapshots/${encodeURIComponent(snapshotId)}/findings/${encodeURIComponent(findingId)}`,
      {
        method: 'PATCH',
        headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify(payload),
      }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Error al actualizar el hallazgo');
    }
    return res.json();
  },

  async deleteSnapshot(snapshotId) {
    const res = await fetch(`${BASE}/snapshots/${encodeURIComponent(snapshotId)}`, {
      method: 'DELETE',
      headers: buildAuthHeaders(),
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Error al eliminar la auditoría');
    }
    return res.json();
  },

  async downloadExcelReport(snapshotId, fallbackName = 'Informe_Auditoria.xlsx') {
    const res = await fetch(`${BASE}/snapshots/${encodeURIComponent(snapshotId)}/export-excel`, {
      method: 'GET',
      headers: buildAuthHeaders(),
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Error generando el archivo Excel de auditoría');
    }
    const blob = await res.blob();
    const contentDisposition = res.headers.get('Content-Disposition') || '';
    const match = contentDisposition.match(/filename="?([^"]+)"?/i);
    const filename = match && match[1] ? match[1] : fallbackName;

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  },
};
