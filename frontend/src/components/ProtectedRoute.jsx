import React, { useContext } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated } = useContext(AuthContext);
  const location = useLocation();

  if (!isAuthenticated) {
    // Prevent infinite redirect loops for cloned templates (/:slug) by always redirecting to the main landing page
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedRoute;
