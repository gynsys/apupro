import { useState, useCallback } from 'react';
import { apiFetch, apiPost, apiPut, apiDelete } from '../../../lib/apiHelper';

export interface ScrapingConfig {
  max_concurrency: number;
  headless: boolean;
  bypass_cloudflare: boolean;
  request_delay_ms: number;
  active_portals: string[];
  batch_size: number;
  portal_urls: Record<string, string>;
}

export const useScrapingApi = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiCall = useCallback(async (endpoint: string, method: string = 'GET', body?: any) => {
    setLoading(true);
    setError(null);

    try {
      const url = `/scraping${endpoint}`;
      let response;

      switch (method) {
        case 'POST':
          response = await apiPost(url, body || {});
          break;
        case 'PUT':
          response = await apiPut(url, body || {});
          break;
        case 'DELETE':
          response = await apiDelete(url);
          break;
        default:
          response = await apiFetch(url);
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const startScraping = useCallback(async () => {
    return apiCall('/start', 'POST');
  }, [apiCall]);

  const pauseScraping = useCallback(async () => {
    return apiCall('/pause', 'POST');
  }, [apiCall]);

  const resumeScraping = useCallback(async () => {
    return apiCall('/resume', 'POST');
  }, [apiCall]);

  const killScraping = useCallback(async () => {
    return apiCall('/kill', 'POST');
  }, [apiCall]);

  const getConfig = useCallback(async (): Promise<ScrapingConfig> => {
    return apiCall('/config', 'GET');
  }, [apiCall]);

  const updateConfig = useCallback(async (config: ScrapingConfig) => {
    return apiCall('/config', 'PUT', config);
  }, [apiCall]);

  const getStatus = useCallback(async () => {
    return apiCall('/status', 'GET');
  }, [apiCall]);

  const getLogs = useCallback(async (limit: number = 100) => {
    return apiCall(`/logs?limit=${limit}`, 'GET');
  }, [apiCall]);

  const clearLogs = useCallback(async () => {
    return apiCall('/logs', 'DELETE');
  }, [apiCall]);

  return {
    loading,
    error,
    startScraping,
    pauseScraping,
    resumeScraping,
    killScraping,
    getConfig,
    updateConfig,
    getStatus,
    getLogs,
    clearLogs
  };
};