import React, { createContext, useState, useEffect, useCallback } from 'react';
import { loginArkoAdmin, loginLandingSite, loginGoogleArkoAdmin, API_URL } from '../services/api';

export const AuthContext = createContext(null);

/**
 * Obtiene los datos reales del usuario autenticado desde /arko/me.
 * Retorna null si no está autenticado o hay error.
 */
async function fetchCurrentUser() {
  try {
    const response = await fetch(`${API_URL}/arko/me`, {
      credentials: 'include',
    });
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const userData = await fetchCurrentUser();
      if (userData) {
        setIsAuthenticated(true);
        setUser(userData);
      } else {
        setIsAuthenticated(false);
        setUser(null);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setIsAuthenticated(false);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async (email, password, isLandingSite = false) => {
    try {
      const response = isLandingSite
        ? await loginLandingSite(email, password)
        : await loginArkoAdmin(email, password);

      if (response.success || response.token_type === 'bearer') {
        // Cargar datos reales del usuario tras login exitoso
        const userData = await fetchCurrentUser();
        setIsAuthenticated(true);
        setUser(userData || { email });
        return { success: true };
      }
      return { success: false, error: 'Login failed' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const logout = async () => {
    try {
      await fetch(`${API_URL}/arko/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setIsAuthenticated(false);
      setUser(null);
    }
  };

  const loginWithGoogle = async (token) => {
    try {
      const response = await loginGoogleArkoAdmin(token);
      if (response.success || response.token_type === 'bearer') {
        const userData = await fetchCurrentUser();
        setIsAuthenticated(true);
        setUser(userData || {});
        return { success: true };
      }
      return { success: false, error: 'Login failed' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, logout, loginWithGoogle, loading, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
};
