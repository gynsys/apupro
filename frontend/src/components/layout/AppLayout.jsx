import React, { useState, useContext } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Layout, LogOut, Menu, X, Home, Settings,
  FileText, Database, Server, Cpu, ChevronRight, Copy, Calculator
} from 'lucide-react';
import { FaTools } from 'react-icons/fa';
import { AuthContext } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import SubscriptionRequestModal from '../SubscriptionRequestModal';
import ReportPaymentModal from '../ReportPaymentModal';
import AccountSettingsModal from '../modals/AccountSettingsModal';
import { Crown, Receipt, HelpCircle } from 'lucide-react';
import NotificationBell from './NotificationBell';
import HelpDrawer from '../help/HelpDrawer';

const NAV_ITEMS = [
  { name: 'Presupuestos', href: '/budgets',           Icon: FileText },
  { name: 'Visor Bases de Datos', href: '/costbase',   altHrefs: ['/cost360'], Icon: Database, exact: true  },
  { name: 'Gestion Bases de Datos', href: '/costbase/databases', altHrefs: ['/cost360/databases'], Icon: Server   },
  { name: 'Nuevo (Desde Cero)', href: '/costbase/ai-generator?mode=manual', altHrefs: ['/cost360/ai-generator?mode=manual', '/cost360/ai-generator'], Icon: FileText },
  { name: 'Importar / Clonar', href: '/costbase/ai-generator?mode=import', altHrefs: ['/cost360/ai-generator?mode=import'], Icon: Copy },
  { name: 'Crear con IA', href: '/costbase/ai-generator?mode=ia', altHrefs: ['/cost360/ai-generator?mode=ia'], Icon: Cpu }
];

export default function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, user, logout, checkAuth } = useContext(AuthContext);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showHelpDrawer, setShowHelpDrawer] = useState(false);

  const handleLogout = () => { logout(); navigate('/'); };

  const isActive = (item) => {
    if (item.exact) {
      return location.pathname === item.href || item.altHrefs?.includes(location.pathname);
    }
    return location.pathname.startsWith(item.href) || item.altHrefs?.some(alt => location.pathname.startsWith(alt.split('?')[0]));
  };

  // Extend NAV_ITEMS conditionally based on admin status
  const getNavItems = () => {
    let items = [...NAV_ITEMS];
    if (user?.email === 'admin@arko360.net') {
      items.push({ name: 'Mantenimiento BD', href: '/costbase/admin-db', altHrefs: ['/cost360/admin-db'], Icon: FaTools });
    }
    return items;
  };

  /* ── Sidebar nav list ───────────────────────────────────────── */
  const SidebarContent = ({ isMobile = false }) => (
    <nav className={`flex flex-col h-full py-4 ${isMobile ? 'items-start px-3' : 'items-center'} w-full`}>
      {/* Mobile logo header inside drawer */}
      {isMobile && (
        <div className="flex items-center gap-2.5 px-3 mb-5 w-full">
          <div className="bg-blue-600 text-white p-1.5 rounded-xl shadow">
            <Layout size={18} />
          </div>
          <span className="font-extrabold text-lg text-slate-800 tracking-tight">CostBase</span>
        </div>
      )}

      <div className={`space-y-2 flex-1 pb-4 w-full flex flex-col ${isMobile ? 'items-stretch' : 'items-center'}`}>
        {getNavItems().map(({ name, href, Icon, exact }) => {
          const active = exact ? location.pathname === href : location.pathname.startsWith(href);
          return (
            <div key={href} className="group relative w-full">
              <Link
                to={href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center ${
                  isMobile ? 'justify-start px-3.5 py-2.5 gap-3' : 'justify-center p-3'
                } rounded-xl transition-all duration-200 ${
                  active ? 'bg-blue-50 text-blue-700 font-semibold shadow-xs' : 'text-slate-600 hover:bg-[#FEF3C7] hover:text-slate-900'
                } min-h-[44px] touch-target`}
              >
                {typeof Icon === 'function' ? (
                  <Icon
                    size={22}
                    className={active ? 'text-blue-600 shrink-0' : 'text-slate-400 shrink-0'}
                  />
                ) : (
                  <Icon
                    className={`${active ? 'text-blue-600' : 'text-slate-400'} w-5 h-5 shrink-0`}
                  />
                )}
                {isMobile && (
                  <span className="text-sm font-medium tracking-tight truncate">{name}</span>
                )}
              </Link>
              
              {!isMobile && (
                <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-2 bg-white text-slate-500 border border-slate-200 text-xs font-bold rounded-lg shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-[9999]">
                  {name}
                  <div className="absolute top-1/2 -translate-y-1/2 right-full border-4 border-transparent border-r-white"></div>
                </div>
              )}
            </div>
          );
        })}

        {/* Botón Calculadora FCAS */}
        <div className="group relative w-full">
          <Link
            to="/fcas"
            onClick={() => setSidebarOpen(false)}
            className={`flex items-center ${
              isMobile ? 'justify-start px-3.5 py-2.5 gap-3' : 'justify-center p-3'
            } rounded-xl transition-all duration-200 ${
              location.pathname.startsWith('/fcas') ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-600 hover:bg-[#FEF3C7] hover:text-slate-900'
            } min-h-[44px] touch-target`}
          >
            <Calculator size={22} className={location.pathname.startsWith('/fcas') ? 'text-blue-600 shrink-0' : 'text-slate-400 shrink-0'} />
            {isMobile && (
              <span className="text-sm font-medium tracking-tight truncate">Cálculo FCAS</span>
            )}
          </Link>
          {!isMobile && (
            <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-2 bg-white text-slate-500 border border-slate-200 text-xs font-bold rounded-lg shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-[9999]">
              Cálculo FCAS
              <div className="absolute top-1/2 -translate-y-1/2 right-full border-4 border-transparent border-r-white"></div>
            </div>
          )}
        </div>

        {/* Separator to push the next item to bottom */}
        <div className="flex-1 min-h-[12px]"></div>

        {/* Botón Mi Plan / Premium */}
        <div className="group relative w-full mt-auto pb-1">
          <button
            onClick={() => {
              setSidebarOpen(false);
              setShowSubscriptionModal(true);
            }}
            className={`flex items-center ${
              isMobile ? 'justify-start px-3.5 py-2.5 gap-3' : 'justify-center p-3'
            } rounded-xl transition-all duration-200 text-slate-600 hover:bg-[#FEF3C7] hover:text-amber-600 w-full min-h-[44px] touch-target cursor-pointer`}
          >
            <Crown size={22} className="text-amber-500 shrink-0" />
            {isMobile && (
              <span className="text-sm font-medium tracking-tight truncate">Planes y Beneficios</span>
            )}
          </button>
          {!isMobile && (
            <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-2 bg-white text-slate-500 border border-slate-200 text-xs font-bold rounded-lg shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-[9999]">
              Planes y Beneficios
              <div className="absolute top-1/2 -translate-y-1/2 right-full border-4 border-transparent border-r-white"></div>
            </div>
          )}
        </div>

        {/* Botón Reportar Pago */}
        <div className="group relative w-full pb-1">
          <button
            onClick={() => {
              setSidebarOpen(false);
              setShowPaymentModal(true);
            }}
            className={`flex items-center ${
              isMobile ? 'justify-start px-3.5 py-2.5 gap-3' : 'justify-center p-3'
            } rounded-xl transition-all duration-200 text-slate-600 hover:bg-green-50 hover:text-green-600 w-full min-h-[44px] touch-target cursor-pointer`}
          >
            <Receipt size={22} className="text-emerald-500 shrink-0" />
            {isMobile && (
              <span className="text-sm font-medium tracking-tight truncate">Reportar Pago</span>
            )}
          </button>
          {!isMobile && (
            <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-2 bg-white text-slate-500 border border-slate-200 text-xs font-bold rounded-lg shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-[9999]">
              Reportar Pago
              <div className="absolute top-1/2 -translate-y-1/2 right-full border-4 border-transparent border-r-white"></div>
            </div>
          )}
        </div>

        {/* Botón Centro de Ayuda */}
        <div className="group relative w-full pb-2">
          <button
            onClick={() => {
              setSidebarOpen(false);
              setShowHelpDrawer(true);
            }}
            className={`flex items-center ${
              isMobile ? 'justify-start px-3.5 py-2.5 gap-3' : 'justify-center p-3'
            } rounded-xl transition-all duration-200 text-slate-600 hover:bg-blue-50 hover:text-blue-600 w-full min-h-[44px] touch-target cursor-pointer`}
            title="Centro de Ayuda"
          >
            <HelpCircle size={22} className="text-blue-500 shrink-0" />
            {isMobile && (
              <span className="text-sm font-medium tracking-tight truncate">Centro de Ayuda</span>
            )}
          </button>
          {!isMobile && (
            <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-2 bg-white text-slate-500 border border-slate-200 text-xs font-bold rounded-lg shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-[9999]">
              Centro de Ayuda
              <div className="absolute top-1/2 -translate-y-1/2 right-full border-4 border-transparent border-r-white"></div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );

  return (
    /* ── Root: gradient mesh background ──────────────────────── */
    <div
      className="h-[100dvh] max-h-[100dvh] overflow-hidden flex flex-col print:block print:overflow-visible print:h-auto animate-fade-in"
      style={{
        background: 'linear-gradient(135deg, #f0f4ff 0%, #e8f0fe 40%, #f5f3ff 100%)',
      }}
    >
      {/* ── ZONE 2: TOP HEADER — glass bar ────────────────────── */}
      <header
        className="print:hidden min-h-[3.5rem] pt-safe sticky top-0 z-50 flex items-center px-3 sm:px-4 gap-2 sm:gap-3"
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
          className="lg:hidden p-2 rounded-xl text-slate-500 hover:bg-white/80 transition-colors touch-target flex items-center justify-center cursor-pointer"
          onClick={() => setSidebarOpen(true)}
          aria-label="Abrir menú"
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
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowHelpDrawer(true)}
              className="p-2 rounded-xl text-slate-500 hover:text-blue-600 hover:bg-blue-50/70 transition-colors cursor-pointer min-w-[38px] min-h-[38px] flex items-center justify-center"
              title="Centro de Ayuda"
            >
              <HelpCircle size={19} />
            </button>
            <NotificationBell />
            <button
              onClick={() => navigate('/budgets')}
              className="p-2 rounded-xl text-slate-500 hover:text-blue-600 hover:bg-blue-50/70 transition-colors min-w-[38px] min-h-[38px] flex items-center justify-center cursor-pointer"
              title="Inicio"
            >
              <Home size={19} />
            </button>
            <button
              onClick={() => setShowAccountModal(true)}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-white/80 transition-colors cursor-pointer min-w-[38px] min-h-[38px] flex items-center justify-center"
              title="Configuración de la Cuenta"
            >
              <Settings size={19} />
            </button>
            <button
              onClick={handleLogout}
              className="p-2 rounded-xl text-slate-500 hover:text-red-500 hover:bg-red-50/70 transition-colors cursor-pointer min-w-[38px] min-h-[38px] flex items-center justify-center"
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
          className="print:hidden hidden lg:flex lg:flex-col w-[80px] shrink-0 sticky top-14 h-[calc(100dvh-3.5rem)] z-40"
          style={{
            background: 'rgba(255,255,255,0.65)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderRight: '1px solid rgba(255,255,255,0.7)',
            boxShadow: '1px 0 20px 0 rgba(80,100,200,0.06)',
          }}
        >
          <SidebarContent isMobile={false} />
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
              className="print:hidden fixed top-0 left-0 h-full max-h-[100dvh] w-[85vw] max-w-xs z-50 flex flex-col lg:hidden shadow-2xl pt-safe pb-safe"
              style={{
                background: 'rgba(255,255,255,0.92)',
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
                borderRight: '1px solid rgba(255,255,255,0.7)',
              }}
            >
              <div className="flex items-center justify-between h-14 px-4 border-b border-slate-200/60">
                <span className="text-sm font-bold text-slate-700">Navegación</span>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 touch-target flex items-center justify-center cursor-pointer"
                  aria-label="Cerrar menú"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <SidebarContent isMobile={true} />
              </div>
            </div>
          </>
        )}

        {/* ── MAIN CONTENT ──────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto print:h-auto print:block print:overflow-visible min-w-0 relative">
          <Outlet />
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

      <AccountSettingsModal
        isOpen={showAccountModal}
        onClose={() => setShowAccountModal(false)}
        user={user}
        onRefreshUser={checkAuth}
        onOpenReportPayment={() => setShowPaymentModal(true)}
      />

      {/* Panel Deslizante de Ayuda */}
      <HelpDrawer
        isOpen={showHelpDrawer}
        onClose={() => setShowHelpDrawer(false)}
      />
    </div>
  );
}
