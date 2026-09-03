import React, { useState, useContext } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Layout, LogOut, Menu, X, Home, Settings,
  FileText, Database, Server, Cpu, ChevronRight, Copy, Calculator
} from 'lucide-react';
import { FaTools } from 'react-icons/fa';
import { AuthContext } from '../../context/AuthContext';
import { UserCostosProvider, useUserCostos } from '../../context/UserCostosContext';
import toast from 'react-hot-toast';
import SubscriptionRequestModal from '../SubscriptionRequestModal';
import ReportPaymentModal from '../ReportPaymentModal';
import { Crown, Receipt } from 'lucide-react';

const NAV_ITEMS = [
  { name: 'Presupuestos', href: '/budgets',           Icon: FileText },
  { name: 'Visor Bases de Datos', href: '/cost360',   Icon: Database, exact: true  },
  { name: 'Gestion Bases de Datos', href: '/cost360/databases', Icon: Server   },
  { name: 'Nuevo (Desde Cero)', href: '/cost360/ai-generator?mode=manual', Icon: FileText },
  { name: 'Importar / Clonar', href: '/cost360/ai-generator?mode=import', Icon: Copy },
  { name: 'Crear con IA', href: '/cost360/ai-generator?mode=ia', Icon: Cpu }
];

export default function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, user, logout } = useContext(AuthContext);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const handleLogout = () => { logout(); navigate('/'); };

  const isActive = (item) =>
    item.exact ? location.pathname === item.href : location.pathname.startsWith(item.href);

  // Extend NAV_ITEMS conditionally based on admin status
  const getNavItems = () => {
    let items = [...NAV_ITEMS];
    if (user?.email === 'admin@arko360.net') {
      items.push({ name: 'Mantenimiento BD', href: '/cost360/admin-db', Icon: FaTools });
    }
    return items;
  };

  /* ── Sidebar nav list ───────────────────────────────────────── */
  const SidebarContent = () => (
    <nav className="flex flex-col h-full py-5 items-center w-full">
      {/* Mobile logo */}
      <div className="flex items-center gap-2.5 px-5 mb-6 lg:hidden w-full justify-center">
        <div className="bg-blue-600 text-white p-1.5 rounded-xl shadow">
          <Layout size={18} />
        </div>
      </div>

      <div className="space-y-3 px-2 flex-1 pb-4 w-full flex flex-col items-center">
        {getNavItems().map(({ name, href, Icon, exact }) => {
          const active = exact ? location.pathname === href : location.pathname.startsWith(href);
          return (
            <div key={href} className="group relative w-full flex justify-center">
              <Link
                to={href}
                onClick={() => setSidebarOpen(false)}
                className="flex items-center justify-center p-3 rounded-xl transition-all duration-200 text-slate-500 hover:bg-[#FEF3C7] hover:text-slate-800"
              >
                {typeof Icon === 'function' ? (
                  <Icon
                    size={24}
                    className={active ? 'text-blue-600' : 'text-slate-400'}
                  />
                ) : (
                  <Icon
                    className={`${active ? 'text-blue-600' : 'text-slate-400'} w-6 h-6`}
                  />
                )}
              </Link>
              
              {/* Tooltip */}
              <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-2 bg-white text-slate-500 border border-slate-200 text-xs font-bold rounded-lg shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-[9999]">
                {name}
                <div className="absolute top-1/2 -translate-y-1/2 right-full border-4 border-transparent border-r-white"></div>
              </div>
            </div>
          );
        })}

        {/* Botón Calculadora FCAS movido justo debajo de los iconos de navegación */}
        <div className="group relative w-full flex justify-center">
          <Link
            to="/fcas"
            onClick={() => setSidebarOpen(false)}
            className="flex items-center justify-center p-3 rounded-xl transition-all duration-200 text-slate-500 hover:bg-[#FEF3C7] hover:text-slate-800"
          >
            <Calculator size={24} className={location.pathname.startsWith('/fcas') ? 'text-blue-600' : 'text-slate-400'} />
          </Link>
          {/* Tooltip */}
          <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-2 bg-white text-slate-500 border border-slate-200 text-xs font-bold rounded-lg shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-[9999]">
            Calculo FCAS
            <div className="absolute top-1/2 -translate-y-1/2 right-full border-4 border-transparent border-r-white"></div>
          </div>
        </div>

        {/* Separator to push the next item to bottom */}
        <div className="flex-1"></div>

        {/* Botón Mi Plan / Premium */}
        <div className="group relative w-full flex justify-center mt-auto pb-2">
          <button
            onClick={() => {
              setSidebarOpen(false);
              setShowSubscriptionModal(true);
            }}
            className="flex items-center justify-center p-3 rounded-xl transition-all duration-200 text-slate-500 hover:bg-[#FEF3C7] hover:text-amber-600"
          >
            <Crown size={24} />
          </button>
          {/* Tooltip */}
          <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-2 bg-white text-slate-500 border border-slate-200 text-xs font-bold rounded-lg shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-[9999]">
            Planes y Beneficios
            <div className="absolute top-1/2 -translate-y-1/2 right-full border-4 border-transparent border-r-white"></div>
          </div>
        </div>

        {/* Botón Reportar Pago */}
        <div className="group relative w-full flex justify-center pb-4">
          <button
            onClick={() => {
              setSidebarOpen(false);
              setShowPaymentModal(true);
            }}
            className="flex items-center justify-center p-3 rounded-xl transition-all duration-200 text-slate-500 hover:bg-green-50 hover:text-green-600"
          >
            <Receipt size={24} />
          </button>
          {/* Tooltip */}
          <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-2 bg-white text-slate-500 border border-slate-200 text-xs font-bold rounded-lg shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-[9999]">
            Reportar Pago
            <div className="absolute top-1/2 -translate-y-1/2 right-full border-4 border-transparent border-r-white"></div>
          </div>
        </div>
      </div>
    </nav>
  );

  return (
    /* ── Root: gradient mesh background ──────────────────────── */
    <div
      className="h-screen overflow-hidden flex flex-col print:block print:overflow-visible print:h-auto animate-fade-in"
      style={{
        background: 'linear-gradient(135deg, #f0f4ff 0%, #e8f0fe 40%, #f5f3ff 100%)',
      }}
    >
      {/* ── ZONE 2: TOP HEADER — glass bar ────────────────────── */}
      <header
        className="print:hidden h-14 sticky top-0 z-50 flex items-center px-4 gap-3"
        style={{
          background: 'rgba(255,255,255,0.75)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(255,255,255,0.6)',
          boxShadow: '0 1px 24px 0 rgba(80,100,200,0.07)',
        }}
      >
        {/* Hamburger */}
        <button
          className="lg:hidden p-1.5 rounded-xl text-slate-400 hover:bg-white/80 transition-colors"
          onClick={() => setSidebarOpen(true)}
        >
          <Menu size={22} />
        </button>

        {/* Logo */}
        <button
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => navigate('/budgets')}
        >
          <div className="bg-blue-600 text-white p-1.5 rounded-xl shadow-sm">
            <Layout size={18} />
          </div>
          <span className="text-lg font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-indigo-600 hidden sm:block">
            CostBase
          </span>
        </button>

        <div className="flex-1" />
        <div id="header-actions-portal" className="flex items-center" />

        {/* Right controls */}
        {isAuthenticated ? (
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => navigate('/budgets')}
              className="p-2 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-blue-50/70 transition-colors"
              title="Inicio"
            >
              <Home size={19} />
            </button>
            <button
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-white/80 transition-colors"
              title="Configuración"
            >
              <Settings size={19} />
            </button>
            <span className="text-sm font-semibold text-slate-600 hidden sm:block mx-2">Mi Cuenta</span>
            <button
              onClick={handleLogout}
              className="p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50/70 transition-colors"
              title="Cerrar Sesión"
            >
              <LogOut size={19} />
            </button>
          </div>
        ) : (
          <Link to="/login" className="text-sm font-medium text-blue-600 hover:text-blue-700">
            Iniciar Sesión
          </Link>
        )}
      </header>

      {/* ── BODY ──────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden print:h-auto print:block print:overflow-visible">

        {/* ── ZONE 1: SIDEBAR — glass panel (lg+) ────────────── */}
        <aside
          className="print:hidden hidden lg:flex lg:flex-col w-[80px] shrink-0 sticky top-14 h-[calc(100vh-3.5rem)] z-40"
          style={{
            background: 'rgba(255,255,255,0.65)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderRight: '1px solid rgba(255,255,255,0.7)',
            boxShadow: '1px 0 20px 0 rgba(80,100,200,0.06)',
          }}
        >
          <SidebarContent />
        </aside>

        {/* ── SIDEBAR Mobile Overlay ─────────────────────────── */}
        {sidebarOpen && (
          <>
            <div
              className="print:hidden fixed inset-0 z-40 lg:hidden"
              style={{ background: 'rgba(30,40,80,0.35)', backdropFilter: 'blur(4px)' }}
              onClick={() => setSidebarOpen(false)}
            />
            <div
              className="print:hidden fixed top-0 left-0 h-full w-64 z-50 flex flex-col lg:hidden shadow-2xl"
              style={{
                background: 'rgba(255,255,255,0.88)',
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
                borderRight: '1px solid rgba(255,255,255,0.7)',
              }}
            >
              <div className="flex items-center justify-between h-14 px-4 border-b border-white/40">
                <span className="text-sm font-semibold text-slate-600">Menú</span>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <SidebarContent />
              </div>
            </div>
          </>
        )}

        {/* ── MAIN CONTENT ──────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto print:h-auto print:block print:overflow-visible min-w-0 relative">
          <UserCostosProvider>
            <Outlet />
          </UserCostosProvider>
        </main>

      </div>
      
      {/* Modals Globales */}
      <SubscriptionRequestModal 
        isOpen={showSubscriptionModal} 
        onClose={() => setShowSubscriptionModal(false)}
        limitType="manual"
      />

      <ReportPaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
      />
    </div>
  );
}
