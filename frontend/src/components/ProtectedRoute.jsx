import React, { useContext } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated } = useContext(AuthContext);
  const location = useLocation();

  if (!isAuthenticated) {
    const pathParts = location.pathname.split('/');
    // Check if the route is /:slug/admin/...
    // pathParts[0] is empty, pathParts[1] is the slug, pathParts[2] is 'admin'
    if (pathParts.length > 2 && pathParts[2] === 'admin' && pathParts[1] !== 'admin') {
      const slug = pathParts[1];
      return <Navigate to={`/${slug}/login`} replace />;
    }
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default ProtectedRoute;
