import { API_URL } from '../../../services/api';

const getAuthHeaders = () => {
  const token =
    localStorage.getItem('arko_admin_token') ||
    localStorage.getItem('token') ||
    localStorage.getItem('access_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

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
