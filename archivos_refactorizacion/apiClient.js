/**
 * Cliente API centralizado con interceptor de autenticación.
 * AJUSTAR: Verifica que la ruta de import de API_URL sea correcta para tu proyecto.
 */
import { API_URL } from '../../../services/api'; // AJUSTAR RUTA

const getToken = () => localStorage.getItem('arko_admin_token');

/**
 * Realiza un fetch autenticado con manejo base de errores.
 */
export const apiFetch = async (endpoint, options = {}) => {
  const token = getToken();
  const url = `${API_URL}${endpoint}`;

  const defaultHeaders = {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
  };

  const config = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...(options.headers || {}),
    },
  };

  // Si el body es FormData, eliminar Content-Type para que el browser ponga el boundary
  if (options.body instanceof FormData) {
    delete config.headers['Content-Type'];
  }

  const response = await fetch(url, config);
  return response;
};

/**
 * Wrapper para POST con JSON body.
 */
export const apiPost = async (endpoint, body, options = {}) => {
  return apiFetch(endpoint, {
    method: 'POST',
    body: JSON.stringify(body),
    ...options,
  });
};

/**
 * Wrapper para PUT con JSON body.
 */
export const apiPut = async (endpoint, body, options = {}) => {
  return apiFetch(endpoint, {
    method: 'PUT',
    body: JSON.stringify(body),
    ...options,
  });
};

/**
 * Wrapper para DELETE.
 */
export const apiDelete = async (endpoint, options = {}) => {
  return apiFetch(endpoint, {
    method: 'DELETE',
    ...options,
  });
};

/**
 * Wrapper para POST con FormData (uploads).
 */
export const apiPostFormData = async (endpoint, formData, options = {}) => {
  return apiFetch(endpoint, {
    method: 'POST',
    body: formData,
    ...options,
  });
};