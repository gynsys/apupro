import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { API_URL } from '../services/api';

const COSTOS_DEFAULTS = {
  porcentajeUtilidad: 10,
  porcentajeAdministracion: 15,
  iva: 16,
  fcas: 417.0,
  fcasSalarioBase: 240,
  fcasBonoCestaticket: 40,
  fcasMetodo: 'estandar',
  fcasSavedProfiles: {}, // Almacena calculos con nombre
};

const getInitialCostos = () => {
  try {
    const cached = localStorage.getItem('costos_config');
    if (cached) {
      const parsed = JSON.parse(cached);
      return { ...COSTOS_DEFAULTS, ...parsed };
    }
  } catch (_) {}
  return COSTOS_DEFAULTS;
};

const getAuthHeaders = (extraHeaders = {}) => {
  const token = localStorage.getItem('arko_admin_token') || localStorage.getItem('token') || localStorage.getItem('access_token');
  const headers = { ...extraHeaders };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

const UserCostosContext = createContext(null);

/**
 * Hook para acceder a la configuración de costos del usuario autenticado.
 * Debe usarse dentro de <UserCostosProvider>.
 */
export function useUserCostos() {
  const ctx = useContext(UserCostosContext);
  if (!ctx) {
    throw new Error('useUserCostos must be used inside <UserCostosProvider>');
  }
  return ctx;
}

/**
 * Provider que carga los costos del usuario desde el backend y permite actualizarlos.
 * Se monta a nivel raíz para que esté disponible en toda la app autenticada.
 */
export function UserCostosProvider({ children }) {
  const [costosConfig, setCostosConfigState] = useState(getInitialCostos);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Carga los costos desde GET /arko/me.
   * Se ejecuta automáticamente al montar el provider.
   */
  const loadCostos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/arko/me`, {
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      if (!response.ok) {
        // Si no está autenticado, queda con defaults/caché — no es error crítico
        return;
      }
      const data = await response.json();
      if (data.costos_config) {
        const merged = { ...COSTOS_DEFAULTS, ...data.costos_config };
        setCostosConfigState(merged);
        try {
          localStorage.setItem('costos_config', JSON.stringify(merged));
        } catch (_) {}
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Cargar costos reales del backend al montar
  useEffect(() => {
    loadCostos();
  }, [loadCostos]);

  /**
   * Actualiza uno o varios campos de costos via PUT /arko/me/costos.
   * @param {Partial<typeof COSTOS_DEFAULTS>} patch - Solo los campos a actualizar.
   */
  const updateCostosConfig = useCallback(async (patch) => {
    // Optimistic update local y en caché
    const optimistic = { ...costosConfig, ...patch };
    setCostosConfigState(optimistic);
    try {
      localStorage.setItem('costos_config', JSON.stringify(optimistic));
    } catch (_) {}

    try {
      const response = await fetch(`${API_URL}/arko/me/costos`, {
        method: 'PUT',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify(patch),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || 'Error al guardar costos');
      }
      const saved = await response.json();
      // Sincronizar con el valor real devuelto por el backend
      const confirmed = { ...COSTOS_DEFAULTS, ...saved };
      setCostosConfigState(confirmed);
      try {
        localStorage.setItem('costos_config', JSON.stringify(confirmed));
      } catch (_) {}
      return confirmed;
    } catch (err) {
      // Revertir optimistic update en caso de error
      setError(err.message);
      throw err;
    }
  }, [costosConfig]);

  return (
    <UserCostosContext.Provider value={{ costosConfig, loadCostos, updateCostosConfig, loading, error }}>
      {children}
    </UserCostosContext.Provider>
  );
}
