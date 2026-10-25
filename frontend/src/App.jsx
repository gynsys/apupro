import React, { useState, useEffect, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import BudgetHomePage from './pages/admin/BudgetHomePage.jsx';
import BudgetWorksheetPage from './pages/admin/BudgetWorksheetPage.jsx';
import AppLayout from './components/layout/AppLayout.jsx';
import { API_URL } from './services/api';
import { Toaster } from 'react-hot-toast';
import { DatabaseProvider } from './contexts/DatabaseContext.jsx';
import { UserCostosProvider } from './context/UserCostosContext.jsx';

const LandingPage = lazy(() => import('./pages/LandingPage.jsx'));
const BudgetAPUEditorPage = lazy(() => import('./pages/admin/BudgetAPUEditorPage.jsx'));
const SharedBudgetPage = lazy(() => import('./pages/admin/SharedBudgetPage.jsx'));
const SharedPartidaPage = lazy(() => import('./pages/admin/SharedPartidaPage.jsx'));
const CalculadoraFCASPage = lazy(() => import('./pages/tools/CalculadoraFCASPage.jsx'));
const CostbaseDashboard = lazy(() => import('./modules/costbase/pages/CostbaseDashboard.jsx'));
const APUViewer = lazy(() => import('./modules/costbase/pages/APUViewer.jsx'));
const AIApuGeneratorPage = lazy(() => import('./modules/costbase/pages/AIApuGeneratorPage.jsx'));
const DatabaseManagementPage = lazy(() => import('./modules/costbase/pages/DatabaseManagementPage.jsx'));
const AdminDatabasePage = lazy(() => import('./modules/costbase/pages/AdminDatabasePage.jsx'));
const MarketAdminPage = lazy(() => import('./modules/market/pages/MarketAdminPage.jsx'));

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
        <UserCostosProvider>
          <SiteConfigContext.Provider value={{ config, setConfig, fetchSiteConfig }}>
            <BrowserRouter basename={window.location.pathname.startsWith('/app') ? '/app' : ''}>
              <Suspense
                fallback={
                  <div className="min-h-screen flex items-center justify-center bg-slate-50">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
                  </div>
                }
              >
                <Routes>
                  <Route path="/" element={<LandingPage />} />
                  {/* Redirección retrocompatible de rutas admin obsoletas */}
                  <Route path="/admin/*" element={<Navigate to="/budgets" replace />} />

                  {/* FCAS Calculator Route */}
                  <Route
                    path="/fcas"
                    element={
                      <ProtectedRoute>
                        <AppLayout />
                      </ProtectedRoute>
                    }
                  >
                    <Route index element={<CalculadoraFCASPage />} />
                  </Route>

                  {/* RUTAS DE BASE MAESTRA - COSTBASE (Protegidas) */}
                  <Route
                    path="/costbase"
                    element={
                      <ProtectedRoute>
                        <AppLayout />
                      </ProtectedRoute>
                    }
                  >
                    <Route index element={<CostbaseDashboard />} />
                    <Route path="apu/:id" element={<APUViewer />} />
                    <Route path="ai-generator" element={<AIApuGeneratorPage />} />
                    <Route path="databases" element={<DatabaseManagementPage />} />
                    <Route path="admin-db" element={<AdminDatabasePage />} />
                    <Route path="market-admin" element={<MarketAdminPage />} />
                  </Route>

                  {/* ALIAS RETROCOMPATIBLES /cost360 */}
                  <Route
                    path="/cost360"
                    element={
                      <ProtectedRoute>
                        <AppLayout />
                      </ProtectedRoute>
                    }
                  >
                    <Route index element={<CostbaseDashboard />} />
                    <Route path="apu/:id" element={<APUViewer />} />
                    <Route path="ai-generator" element={<AIApuGeneratorPage />} />
                    <Route path="databases" element={<DatabaseManagementPage />} />
                    <Route path="admin-db" element={<AdminDatabasePage />} />
                    <Route path="market-admin" element={<MarketAdminPage />} />
                  </Route>

                  {/* RUTA DE VISTA PREVIA COMPARTIDA (Accesible con y sin sesión) */}
                  <Route path="/budgets/shared/partida/:token" element={<SharedPartidaPage />} />
                  <Route path="/budgets/shared/:token" element={<SharedBudgetPage />} />

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

                  {/* Rutas retrocompatibles usando el slug */}
                  <Route path="/:slug" element={<Navigate to="/budgets" replace />} />
                  <Route path="/:slug/admin/*" element={<Navigate to="/budgets" replace />} />

                  <Route
                    path="/:slug/costbase"
                    element={
                      <ProtectedRoute>
                        <CostbaseDashboard />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/:slug/costbase/apu/:id"
                    element={
                      <ProtectedRoute>
                        <APUViewer />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/:slug/costbase/ai-generator"
                    element={
                      <ProtectedRoute>
                        <AIApuGeneratorPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/:slug/cost360"
                    element={
                      <ProtectedRoute>
                        <CostbaseDashboard />
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
              </Suspense>
            </BrowserRouter>
          </SiteConfigContext.Provider>
        </UserCostosProvider>
      </DatabaseProvider>
    </AuthProvider>
  );
}

export default App;
