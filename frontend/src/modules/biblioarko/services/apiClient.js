import { API_URL } from '../../../services/api';

const getToken = () => localStorage.getItem('arko_admin_token');

const request = async (method, endpoint, data = null, options = {}) => {
  const url = `${API_URL}${endpoint}`;
  const headers = {
    'Authorization': `Bearer ${getToken()}`,
    ...options.headers,
  };

  if (!(data instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  } else {
    // Let browser set content type for FormData (boundary)
    delete headers['Content-Type'];
  }

  const config = {
    method,
    headers,
  };

  if (data) {
    config.body = data instanceof FormData ? data : JSON.stringify(data);
  }

  const response = await fetch(url, config);
  const responseData = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(responseData?.detail || 'Error en la petición');
  }

  return { data: responseData };
};

export const api = {
  get: (endpoint, options) => request('GET', endpoint, null, options),
  post: (endpoint, data, options) => request('POST', endpoint, data, options),
  put: (endpoint, data, options) => request('PUT', endpoint, data, options),
  delete: (endpoint, options) => request('DELETE', endpoint, null, options),
};

