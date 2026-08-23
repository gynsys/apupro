import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import AdminLayout from './components/layout/AdminLayout.jsx';
import ProfilePage from './pages/admin/ProfilePage.jsx';
import MaterialsPage from './pages/admin/MaterialsPage.jsx';
import BudgetHomePage from './pages/admin/BudgetHomePage.jsx';
import BudgetWorksheetPage from './pages/admin/BudgetWorksheetPage.jsx';
import BudgetAPUEditorPage from './pages/admin/BudgetAPUEditorPage.jsx';
import Cost360Dashboard from './modules/cost360/pages/Cost360Dashboard.jsx';
import APUViewer from './modules/cost360/pages/APUViewer.jsx';
import AIApuGeneratorPage from './modules/cost360/pages/AIApuGeneratorPage.jsx';
import DatabaseManagementPage from './modules/cost360/pages/DatabaseManagementPage.jsx';
import AdminDatabasePage from './modules/cost360/pages/AdminDatabasePage.jsx';
import MarketAdminPage from './modules/market/pages/MarketAdminPage.jsx';
import AppLayout from './components/layout/AppLayout.jsx';
import { API_URL } from './services/api';
import { Toaster } from 'react-hot-toast';
import { DatabaseProvider } from './contexts/DatabaseContext.jsx';

export const SiteConfigContext = React.createContext(null);

function App() {
  const [config, setConfig] = useState({
    branding: {
      primaryColor: '#0a4275'
    }
  });

  // Cargar configuración del sitio al montar
  useEffect(() => {
    fetchSiteConfig();
  }, []);

  const fetchSiteConfig = async () => {
    try {
      const response = await fetch(`${API_URL}/arko/config`);
      if (response.ok) {
        const siteConfig = await response.json();
        setConfig(siteConfig);
        window.ARKO_SITE_CONFIG = siteConfig; // Expose to non-React services
        // Aplicar el color primario a las variables CSS
        if (siteConfig.branding?.primaryColor) {
          applyThemeColor(siteConfig.branding.primaryColor);
        }
      }
    } catch (error) {
      console.error('Error fetching site config:', error);
    }
  };

  const applyThemeColor = (color) => {
    // Aplicar el color a las variables CSS globales
    document.documentElement.style.setProperty('--primary-color', color);
    // Calcular variantes del color
    document.documentElement.style.setProperty('--primary-color-light', adjustColorOpacity(color, 0.1));
    document.documentElement.style.setProperty('--primary-color-dark', adjustColorOpacity(color, 0.2));
  };

  const adjustColorOpacity = (hex, opacity) => {
    // Convertir hex a rgb y aplicar opacidad
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  };

  return (
    <AuthProvider>
      <Toaster position="top-center" containerStyle={{ zIndex: 999999 }} />
      <DatabaseProvider>
        <SiteConfigContext.Provider value={{ config, setConfig, fetchSiteConfig }}>
          <BrowserRouter basename={window.location.pathname.startsWith('/app') ? '/app' : ''}>
          <Routes>
                                                <Route path="/" element={<LandingPage />} />
            <Route 
              path="/admin/*" 
              element={
                <ProtectedRoute>
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/admin/profile" replace />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="materials" element={<MaterialsPage />} />
            </Route>
            
            {/* RUTAS DE BASE MAESTRA (Protegidas) */}
            <Route 
              path="/cost360" 
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Cost360Dashboard />} />
              <Route path="apu/:id" element={<APUViewer />} />
              <Route path="ai-generator" element={<AIApuGeneratorPage />} />
              <Route path="databases" element={<DatabaseManagementPage />} />
              <Route path="admin-db" element={<AdminDatabasePage />} />
              <Route path="market-admin" element={<MarketAdminPage />} />
            </Route>

            {/* RUTAS DE PRESUPUESTOS (APP - Protegidas) */}
            <Route 
              path="/budgets" 
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<BudgetHomePage />} />
              <Route path=":id" element={<BudgetWorksheetPage />} />
              <Route path=":id/item/:itemId" element={<BudgetAPUEditorPage />} />
            </Route>

            {/* Rutas para sitios clonados usando el slug (Obsoleto /login retirado) */}
            <Route path="/:slug" element={<Navigate to="admin" replace />} />
            <Route 
              path="/:slug/admin/*" 
              element={
                <ProtectedRoute>
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="profile" replace />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="materials" element={<MaterialsPage />} />
            </Route>

            <Route
              path="/:slug/cost360"
              element={
                <ProtectedRoute>
                  <Cost360Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/:slug/cost360/apu/:id"
              element={
                <ProtectedRoute>
                  <APUViewer />
                </ProtectedRoute>
              }
            />
            <Route
              path="/:slug/cost360/ai-generator"
              element={
                <ProtectedRoute>
                  <AIApuGeneratorPage />
                </ProtectedRoute>
              }
            />
          </Routes>
        </BrowserRouter>
      </SiteConfigContext.Provider>
      </DatabaseProvider>
    </AuthProvider>
  );
}

export default App;

