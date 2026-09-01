import React, { createContext, useContext, useState, useCallback } from 'react';
import { API_URL } from '../services/api';

const COSTOS_DEFAULTS = {
  porcentajeUtilidad: 10,
  porcentajeAdministracion: 15,
  iva: 16,
  fcas: 0,
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
 * Se monta en AppLayout para que esté disponible en toda la app autenticada.
 */
export function UserCostosProvider({ children }) {
  const [costosConfig, setCostosConfigState] = useState(COSTOS_DEFAULTS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Carga los costos desde GET /arko/me.
   * Se llama tras el login o al montar AppLayout.
   */
  const loadCostos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/arko/me`, {
        credentials: 'include',
      });
      if (!response.ok) {
        // Si no está autenticado, queda con defaults — no es error crítico
        return;
      }
      const data = await response.json();
      if (data.costos_config) {
        setCostosConfigState({ ...COSTOS_DEFAULTS, ...data.costos_config });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Actualiza uno o varios campos de costos via PUT /arko/me/costos.
   * @param {Partial<typeof COSTOS_DEFAULTS>} patch - Solo los campos a actualizar.
   */
  const updateCostosConfig = useCallback(async (patch) => {
    // Optimistic update local
    setCostosConfigState(prev => ({ ...prev, ...patch }));
    try {
      const response = await fetch(`${API_URL}/arko/me/costos`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(patch),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || 'Error al guardar costos');
      }
      const saved = await response.json();
      // Sincronizar con el valor real devuelto por el backend
      setCostosConfigState({ ...COSTOS_DEFAULTS, ...saved });
      return saved;
    } catch (err) {
      // Revertir optimistic update en caso de error
      setError(err.message);
      throw err;
    }
  }, []);

  return (
    <UserCostosContext.Provider value={{ costosConfig, loadCostos, updateCostosConfig, loading, error }}>
      {children}
    </UserCostosContext.Provider>
  );
}
