import React, { createContext, useState, useEffect } from 'react';
import { loginArkoAdmin, loginLandingSite, loginGoogleArkoAdmin } from '../services/api';

export const AuthContext = createContext(null);

function parseJwt(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem('arko_admin_token') || null);
  const [isAuthenticated, setIsAuthenticated] = useState(!!token);
  const [user, setUser] = useState(null);

  useEffect(() => {
    if (token) {
      localStorage.setItem('arko_admin_token', token);
      setIsAuthenticated(true);
      const decoded = parseJwt(token);
      if (decoded) {
        setUser({ email: decoded.sub });
      } else {
        setUser(null);
      }
    } else {
      localStorage.removeItem('arko_admin_token');
      setIsAuthenticated(false);
      setUser(null);
    }
  }, [token]);

  const login = async (email, password, isLandingSite = false) => {
    try {
      const response = isLandingSite 
        ? await loginLandingSite(email, password)
        : await loginArkoAdmin(email, password);
      if (response.access_token) {
        setToken(response.access_token);
        return { success: true };
      }
      return { success: false, error: 'Token no recibido' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const logout = () => {
    setToken(null);
  };

  const loginWithGoogle = async (token) => {
    try {
      const response = await loginGoogleArkoAdmin(token);
      if (response.access_token) {
        setToken(response.access_token);
        return { success: true };
      }
      return { success: false, error: 'Token no recibido' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  return (
    <AuthContext.Provider value={{ token, isAuthenticated, user, login, logout, loginWithGoogle }}>
      {children}
    </AuthContext.Provider>
  );
};
