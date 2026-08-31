/**
 * API Helper - Centralized fetch wrapper with httpOnly cookie support
 *
 * This helper replaces the need for localStorage token management.
 * All API calls now use httpOnly cookies for authentication.
 */

const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

/**
 * Generic fetch wrapper with credentials (httpOnly cookies)
 * @param {string} endpoint - API endpoint path (e.g., '/users')
 * @param {Object} options - Fetch options
 * @returns {Promise<Response>}
 */
export const apiFetch = async (endpoint, options = {}) => {
  const url = `${API_URL}${endpoint}`;

  return fetch(url, {
    ...options,
    credentials: 'include', // Include httpOnly cookies
    headers: {
      'Content-Type': options.headers?.['Content-Type'] || 'application/json',
      ...options.headers,
    }
  });
};

/**
 * GET request
 * @param {string} endpoint - API endpoint path
 * @returns {Promise<Response>}
 */
export const apiGet = (endpoint) => {
  return apiFetch(endpoint, { method: 'GET' });
};

/**
 * POST request with JSON body
 * @param {string} endpoint - API endpoint path
 * @param {Object} body - Request body
 * @returns {Promise<Response>}
 */
export const apiPost = (endpoint, body) => {
  return apiFetch(endpoint, {
    method: 'POST',
    body: JSON.stringify(body),
  });
};

/**
 * POST request with FormData (for file uploads)
 * @param {string} endpoint - API endpoint path
 * @param {FormData} formData - FormData object
 * @returns {Promise<Response>}
 */
export const apiPostFormData = (endpoint, formData) => {
  return apiFetch(endpoint, {
    method: 'POST',
    headers: {
      // Don't set Content-Type for FormData - browser sets it with boundary
    },
    body: formData,
  });
};

/**
 * PUT request with JSON body
 * @param {string} endpoint - API endpoint path
 * @param {Object} body - Request body
 * @returns {Promise<Response>}
 */
export const apiPut = (endpoint, body) => {
  return apiFetch(endpoint, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
};

/**
 * DELETE request
 * @param {string} endpoint - API endpoint path
 * @returns {Promise<Response>}
 */
export const apiDelete = (endpoint) => {
  return apiFetch(endpoint, { method: 'DELETE' });
};

/**
 * PATCH request with JSON body
 * @param {string} endpoint - API endpoint path
 * @param {Object} body - Request body
 * @returns {Promise<Response>}
 */
export const apiPatch = (endpoint, body) => {
  return apiFetch(endpoint, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
};
