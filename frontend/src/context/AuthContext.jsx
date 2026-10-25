import React, { createContext, useState, useEffect, useCallback } from 'react';
import { loginArkoAdmin, loginLandingSite, loginGoogleArkoAdmin, API_URL } from '../services/api';

export const AuthContext = createContext(null);

const USER_SESSION_CACHE_KEY = 'arko_cached_user_v1';
let inflightMePromise = null;

function getCachedUser() {
  try {
    const raw = sessionStorage.getItem(USER_SESSION_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setCachedUser(userData) {
  try {
    if (userData) {
      sessionStorage.setItem(USER_SESSION_CACHE_KEY, JSON.stringify(userData));
    } else {
      sessionStorage.removeItem(USER_SESSION_CACHE_KEY);
    }
  } catch {
    // Ignorar errores de almacenamiento
  }
}

/**
 * Obtiene los datos reales del usuario autenticado desde /arko/me deduplicando llamadas concurrentes.
 * Retorna null si no está autenticado o hay error.
 */
export async function fetchCurrentUserShared(forceRefresh = false) {
  if (!forceRefresh && inflightMePromise) {
    return inflightMePromise;
  }
  inflightMePromise = (async () => {
    try {
      const token = localStorage.getItem('arko_admin_token') || localStorage.getItem('token') || localStorage.getItem('access_token');
      const headers = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const response = await fetch(`${API_URL}/arko/me`, {
        headers,
        credentials: 'include',
      });
      if (!response.ok) return null;
      return await response.json();
    } catch {
      return null;
    } finally {
      inflightMePromise = null;
    }
  })();
  return inflightMePromise;
}

export const AuthProvider = ({ children }) => {
  const initialUser = getCachedUser();
  const [isAuthenticated, setIsAuthenticated] = useState(() => Boolean(initialUser));
  const [user, setUser] = useState(() => initialUser);
  const [loading, setLoading] = useState(() => !initialUser);

  const checkAuth = useCallback(async () => {
    try {
      const userData = await fetchCurrentUserShared();
      if (userData) {
        setIsAuthenticated(true);
        setUser(userData);
        setCachedUser(userData);
      } else {
        setIsAuthenticated(false);
        setUser(null);
        setCachedUser(null);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setIsAuthenticated(false);
      setUser(null);
      setCachedUser(null);
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
        const userData = await fetchCurrentUserShared(true);
        const finalUser = userData || { email };
        setIsAuthenticated(true);
        setUser(finalUser);
        setCachedUser(finalUser);
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
      setCachedUser(null);
    }
  };

  const loginWithGoogle = async (token) => {
    try {
      const response = await loginGoogleArkoAdmin(token);
      if (response.success || response.token_type === 'bearer') {
        const userData = await fetchCurrentUserShared(true);
        const finalUser = userData || {};
        setIsAuthenticated(true);
        setUser(finalUser);
        setCachedUser(finalUser);
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
