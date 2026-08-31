import { useCallback } from 'react';
import { apiFetch, apiPost, apiPut, apiDelete, apiPostFormData } from '../lib/apiClient';

/**
 * Hook centralizado para llamadas API autenticadas.
 * Expone wrappers con manejo de errores opcional.
 */
export const useApi = () => {
  const fetchAuth = useCallback((endpoint, options) => apiFetch(endpoint, options), []);
  const post = useCallback((endpoint, body, options) => apiPost(endpoint, body, options), []);
  const put = useCallback((endpoint, body, options) => apiPut(endpoint, body, options), []);
  const del = useCallback((endpoint, options) => apiDelete(endpoint, options), []);
  const postForm = useCallback((endpoint, formData, options) => apiPostFormData(endpoint, formData, options), []);

  return { fetchAuth, post, put, del, postForm };
};