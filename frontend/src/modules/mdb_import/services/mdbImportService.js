import { API_URL } from '../../../services/api';

const getAuthHeaders = () => {
  const token =
    localStorage.getItem('arko_admin_token') ||
    localStorage.getItem('token') ||
    localStorage.getItem('access_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export async function checkLocalBridge() {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1500);
    const response = await fetch('http://127.0.0.1:8765/health', {
      method: 'GET',
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timer);
    if (!response.ok) return false;
    const data = await response.json();
    return data?.status === 'ok';
  } catch (_error) {
    return false;
  }
}

export async function convertWithLocalBridge(file) {
  const response = await fetch('http://127.0.0.1:8765/convert', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'X-Filename': encodeURIComponent(file.name),
    },
    body: file,
  });

  if (!response.ok) {
    let detail = '';
    try {
      const data = await response.json();
      detail = data?.detail || '';
    } catch (_error) {
      detail = '';
    }
    throw new Error(detail || 'El puente local no pudo convertir el archivo.');
  }

  return await response.blob();
}

export async function importMdbBudget(file) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_URL}/budgets/import-mdb`, {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: formData,
  });

  let data = null;
  try {
    data = await response.json();
  } catch (_error) {
    data = null;
  }

  if (!response.ok) {
    const detail = data?.detail;
    throw new Error(
      typeof detail === 'string'
        ? detail
        : 'No se pudo importar el archivo MDB.'
    );
  }

  return data;
}
