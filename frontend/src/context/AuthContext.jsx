import React, { createContext, useState, useEffect } from 'react';
import { loginArkoAdmin, loginLandingSite, loginGoogleArkoAdmin } from '../services/api';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Verificar autenticación al cargar (cookie ya está seteada por backend)
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/v1/arko/health');
      if (response.ok) {
        // If health check passes, try to get user info
        const tokenResponse = await fetch('/api/v1/arko/admin/posts', {
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include' // Important: include cookies
        });

        if (tokenResponse.ok) {
          setIsAuthenticated(true);
          // You might want to add an endpoint to get current user info
          setUser({ email: 'authenticated' }); // Placeholder
        } else {
          setIsAuthenticated(false);
          setUser(null);
        }
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setIsAuthenticated(false);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password, isLandingSite = false) => {
    try {
      const response = isLandingSite
        ? await loginLandingSite(email, password)
        : await loginArkoAdmin(email, password);

      if (response.success || response.token_type === 'bearer') {
        setIsAuthenticated(true);
        setUser({ email });
        return { success: true };
      }
      return { success: false, error: 'Login failed' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const logout = async () => {
    try {
      // Call backend logout endpoint to clear cookie
      await fetch('/api/v1/arko/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });
      setIsAuthenticated(false);
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
      // Even if backend call fails, clear local state
      setIsAuthenticated(false);
      setUser(null);
    }
  };

  const loginWithGoogle = async (token) => {
    try {
      const response = await loginGoogleArkoAdmin(token);
      if (response.success || response.token_type === 'bearer') {
        setIsAuthenticated(true);
        return { success: true };
      }
      return { success: false, error: 'Login failed' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, logout, loginWithGoogle, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
