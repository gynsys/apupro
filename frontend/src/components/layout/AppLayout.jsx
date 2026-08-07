import React, { useState, useContext } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Layout, LogOut, Menu, X, Home, Settings,
  FileText, Database, Server, Cpu, ChevronRight
} from 'lucide-react';
import { AuthContext } from '../../context/AuthContext';

const NAV_ITEMS = [
  { name: 'Presupuestos', href: '/budgets',              Icon: FileText },
  { name: 'Visor Bases de Datos', href: '/cost360',              Icon: Database, exact: true  },
  { name: 'Gestion Bases de Datos', href: '/cost360/databases',    Icon: Server   },
  { 
    name: 'Crear APU', 
    href: '/cost360/ai-generator', 
    Icon: Cpu,
    subItems: [
      { name: 'Nuevo (Desde Cero)', href: '/cost360/ai-generator?mode=manual' },
      { name: 'Importar / Clonar', href: '/cost360/ai-generator?mode=import' },
      { name: 'Crear con IA', href: '/cost360/ai-generator?mode=ia' }
    ]
  },
];

export default function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, logout } = useContext(AuthContext);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => { logout(); navigate('/login'); };

  const isActive = (item) =>
    item.exact ? location.pathname === item.href : location.pathname.startsWith(item.href);

  /* ── Sidebar nav list ───────────────────────────────────────── */
  const SidebarContent = () => (
    <nav className="flex flex-col h-full py-5">
      {/* Mobile logo */}
      <div className="flex items-center gap-2.5 px-5 mb-6 lg:hidden">
        <div className="bg-blue-600 text-white p-1.5 rounded-xl shadow">
          <Layout size={18} />
        </div>
        <span className="text-lg font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-indigo-600">
          APUpro
        </span>
      </div>


      <div className="space-y-0.5 px-3 flex-1 pb-4 overflow-y-auto">
        {NAV_ITEMS.map(({ name, href, Icon, exact, subItems }) => {
          const active = exact ? location.pathname === href : location.pathname.startsWith(href);
          return (
            <div key={href} className="group relative">
              <Link
                to={href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  active
                    ? 'bg-blue-600/10 text-blue-700 shadow-sm border border-blue-200/60'
                    : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                <Icon
                  size={17}
                  className={active ? 'text-blue-600' : 'text-slate-400'}
                />
                <span className="flex-1 text-left">{name}</span>
                {subItems && (
                  <ChevronRight size={14} className={`transition-transform duration-200 ${active ? 'text-blue-600' : 'text-slate-400'} group-hover:rotate-90`} />
                )}
              </Link>
              
              {subItems && (
                <div className="overflow-hidden transition-all duration-300 max-h-0 group-hover:max-h-40 ml-4 mt-1 border-l-2 border-slate-100 flex flex-col gap-1 pl-2">
                  {subItems.map(sub => {
                    const isSubActive = location.search === sub.href.split('?')[1] || (!location.search && sub.href.includes('mode=ia') && location.pathname === href);
                    return (
                      <Link
                        key={sub.name}
                        to={sub.href}
                        onClick={() => setSidebarOpen(false)}
                        className={`text-xs py-1.5 px-2 rounded-lg transition-colors font-semibold btn-borde-azul-redondeado block ${
                          isSubActive ? 'text-blue-600 bg-blue-50/50' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                        }`}
                      >
                        {sub.name}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="px-5 pt-4 border-t border-white/40">
        <p className="text-[10px] text-slate-300 font-mono">APUpro v1.0</p>
      </div>
    </nav>
  );

  return (
    /* ── Root: gradient mesh background ──────────────────────── */
    <div
      className="h-screen overflow-hidden flex flex-col print:block"
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
            APUpro
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
      <div className="flex flex-1 overflow-hidden">

        {/* ── ZONE 1: SIDEBAR — glass panel (lg+) ────────────── */}
        <aside
          className="print:hidden hidden lg:flex lg:flex-col w-60 shrink-0 sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto"
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
        <main className="flex-1 overflow-y-auto min-w-0 relative">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
