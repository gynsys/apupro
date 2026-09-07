import React, { useState } from 'react';
import {
  Layout, Bell, Home, Settings, LogOut, FileText, Database, Server,
  Copy, Cpu, Calculator, Crown, Receipt, Plus, Upload, Link2,
  Search, Clock, Printer, FileSpreadsheet, CloudDownload, Share2, Edit3, Trash2
} from 'lucide-react';

export default function PreviewSection() {
  const [activeCard, setActiveCard] = useState(2);
  const [activeActionTooltip, setActiveActionTooltip] = useState('excel');
  const [searchTerm, setSearchTerm] = useState('');
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [hoveredNav, setHoveredNav] = useState(null);

  const sampleBudgets = [
    {
      id: 1,
      name: 'Presupuesto de Ejemplo costbase.net',
      items: 6,
      date: '7/9/2026',
      total: '$ 1.361,58'
    },
    {
      id: 2,
      name: 'Muro de Gaviones L=35 m h=3.00 m',
      items: 4,
      date: '7/9/2026',
      total: '$ 20.626,19'
    }
  ];

  const filteredBudgets = sampleBudgets.filter(b =>
    b.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sidebarIcons = [
    { id: 'budgets', name: 'Presupuestos', Icon: FileText, active: true },
    { id: 'db-viewer', name: 'Visor Bases de Datos', Icon: Database },
    { id: 'db-mgmt', name: 'Gestión Bases de Datos', Icon: Server },
    { id: 'new-apu', name: 'Nuevo (Desde Cero)', Icon: FileText },
    { id: 'clone', name: 'Importar / Clonar', Icon: Copy },
    { id: 'ai', name: 'Crear con IA', Icon: Cpu },
    { id: 'fcas', name: 'Calculadora FCAS', Icon: Calculator },
  ];

  return (
    <section className="py-24 bg-slate-950 relative overflow-hidden">
      {/* Decorative blurs */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[85%] h-[85%] bg-blue-900/20 blur-[150px] rounded-full pointer-events-none" />

      <div className="container mx-auto px-4 md:px-6 relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-5 tracking-tight">
            Interfaz diseñada para la Productividad
          </h2>
          <p className="text-slate-400 text-base md:text-lg">
            Todo lo que necesitas en una sola pantalla. Buscador rápido, edición inline y previsualización de costos en tiempo real.
          </p>
        </div>

        {/* Browser Mockup */}
        <div className="max-w-5xl mx-auto">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden shadow-blue-900/25 transition-all duration-500 hover:shadow-blue-500/10">
            {/* Browser Window Header */}
            <div className="h-11 bg-slate-950 border-b border-slate-800 flex items-center px-4 gap-2">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                <div className="w-3 h-3 rounded-full bg-green-500/80" />
              </div>
              <div className="mx-auto bg-slate-800/60 text-slate-300 text-xs py-1 px-4 rounded-md w-72 text-center font-mono border border-slate-700/60 select-none">
                app.costbase.net/budgets
              </div>
            </div>

            {/* Mockup Inside: Full CostBase Application Layout */}
            <div className="bg-[#f0f4fd] select-none text-slate-800 font-sans flex flex-col">
              {/* CostBase App Navbar */}
              <header className="h-14 bg-white/95 border-b border-slate-200/90 px-4 md:px-6 flex items-center justify-between gap-4 shadow-xs">
                {/* Brand Logo */}
                <div className="flex items-center gap-2.5">
                  <div className="bg-blue-600 text-white p-1.5 rounded-xl shadow-sm">
                    <Layout size={18} />
                  </div>
                  <span className="text-lg font-extrabold text-blue-700 tracking-tight">
                    CostBase
                  </span>
                </div>

                {/* Right controls */}
                <div className="flex items-center gap-1 relative">
                  {/* Notification Bell with Red Dot */}
                  <div className="relative">
                    <button
                      onClick={() => setNotificationOpen(!notificationOpen)}
                      className="relative p-2 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-blue-50/70 transition-colors cursor-pointer"
                      title="Notificaciones"
                    >
                      <Bell size={18} />
                      {/* Red indicator dot */}
                      <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white animate-pulse" />
                    </button>

                    {/* Interactive Notification Popover */}
                    {notificationOpen && (
                      <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-200 p-3.5 z-50 text-xs text-slate-700 animate-in fade-in slide-in-from-top-1 duration-200">
                        <div className="font-bold text-slate-900 border-b border-slate-100 pb-2 mb-2 flex items-center justify-between">
                          <span>Notificaciones</span>
                          <span className="text-[10px] bg-red-100 text-red-700 font-bold px-2 py-0.5 rounded-full">1 nueva</span>
                        </div>
                        <div className="p-2.5 bg-blue-50/80 rounded-xl border border-blue-100">
                          <p className="font-bold text-blue-950">Actualización de Índices</p>
                          <p className="text-[11px] text-slate-600 mt-0.5">Se han actualizado los costos de materiales y mano de obra para Septiembre 2026.</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <button className="p-2 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-blue-50/70 transition-colors cursor-pointer" title="Inicio">
                    <Home size={18} />
                  </button>
                  <button className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer" title="Configuración">
                    <Settings size={18} />
                  </button>
                  <button className="p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer" title="Cerrar Sesión">
                    <LogOut size={18} />
                  </button>
                </div>
              </header>

              {/* Main Area: Sidebar + Content */}
              <div className="flex min-h-[460px]">
                {/* Left Sidebar */}
                <aside className="w-14 bg-white border-r border-slate-200/80 py-4 hidden sm:flex flex-col items-center justify-between shrink-0">
                  <div className="flex flex-col items-center gap-2.5 w-full">
                    {sidebarIcons.map((item) => (
                      <div
                        key={item.id}
                        className="relative group w-full flex justify-center"
                        onMouseEnter={() => setHoveredNav(item.id)}
                        onMouseLeave={() => setHoveredNav(null)}
                      >
                        <div
                          className={`p-2 rounded-xl transition-colors cursor-pointer ${
                            item.active
                              ? 'text-blue-600 bg-blue-50/80 font-bold'
                              : 'text-slate-400 hover:text-slate-700 hover:bg-[#FEF3C7]'
                          }`}
                        >
                          <item.Icon size={20} />
                        </div>
                        {hoveredNav === item.id && (
                          <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 bg-slate-900 text-white text-[11px] font-medium px-2.5 py-1 rounded-md shadow-lg whitespace-nowrap z-50 pointer-events-none animate-in fade-in duration-150">
                            {item.name}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Sidebar Bottom */}
                  <div className="flex flex-col items-center gap-2 w-full pt-4 border-t border-slate-100">
                    <div className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl cursor-pointer transition-colors" title="Planes y Suscripción">
                      <Crown size={20} />
                    </div>
                    <div className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl cursor-pointer transition-colors" title="Reportar Pago">
                      <Receipt size={20} />
                    </div>
                  </div>
                </aside>

                {/* Content Area */}
                <main className="flex-1 p-5 md:p-8 overflow-hidden">
                  {/* Gestor de Presupuestos Header */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <div>
                      <h3 className="text-xl md:text-2xl font-extrabold text-blue-700 tracking-tight leading-tight">
                        Gestor de Presupuestos
                      </h3>
                      <p className="text-xs md:text-sm text-slate-500 font-medium mt-0.5">
                        Administra, crea y organiza todos tus proyectos
                      </p>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <button className="flex items-center gap-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-3.5 py-2 rounded-xl text-xs md:text-sm font-semibold shadow-sm hover:shadow hover:-translate-y-0.5 transition-all">
                        <Plus size={16} />
                        <span>Nuevo Presupuesto</span>
                      </button>
                      <button className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-3.5 py-2 rounded-xl text-xs md:text-sm font-semibold shadow-sm hover:shadow hover:-translate-y-0.5 transition-all">
                        <Upload size={16} />
                        <span>Importar Backup</span>
                      </button>
                      <button className="flex items-center gap-1.5 bg-[#B5DCB0] hover:bg-[#a1d39b] text-[#143d1a] border border-[#9ecc98] px-3.5 py-2 rounded-xl text-xs md:text-sm font-semibold shadow-sm hover:shadow hover:-translate-y-0.5 transition-all">
                        <Link2 size={16} />
                        <span>Importar con Enlace</span>
                      </button>
                    </div>
                  </div>

                  {/* Search Bar */}
                  <div className="bg-white rounded-2xl p-1.5 shadow-xs border-2 border-slate-300 mb-6 flex items-center px-4">
                    <Search size={18} className="text-slate-400 shrink-0 mr-3" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Buscar presupuestos por nombre..."
                      className="w-full bg-transparent outline-none py-1.5 text-xs md:text-sm text-slate-700 placeholder:text-slate-400"
                    />
                  </div>

                  {/* Budgets List */}
                  <div className="flex flex-col gap-3.5">
                    {filteredBudgets.map((budget) => {
                      const isAmberHovered = activeCard === budget.id;

                      return (
                        <div
                          key={budget.id}
                          onMouseEnter={() => {
                            setActiveCard(budget.id);
                            if (budget.id === 2) {
                              setActiveActionTooltip('excel');
                            } else {
                              setActiveActionTooltip(null);
                            }
                          }}
                          className={`cursor-pointer group rounded-2xl px-5 py-3.5 transition-all duration-300 border-2 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                            isAmberHovered
                              ? 'bg-[#fef3c7] border-[#f59e0b] shadow-md -translate-y-1'
                              : 'bg-white border-slate-200 hover:bg-[#fef3c7] hover:border-[#f59e0b] hover:-translate-y-1 shadow-sm'
                          }`}
                        >
                          {/* Left: Title & Metrics */}
                          <div className="flex flex-col gap-1.5 items-start justify-center flex-1 overflow-hidden">
                            <h4
                              className={`font-bold text-sm md:text-base tracking-tight truncate w-full transition-colors ${
                                isAmberHovered
                                  ? 'text-[#78350f]'
                                  : 'text-slate-800 group-hover:text-[#78350f]'
                              }`}
                            >
                              {budget.name}
                            </h4>
                            <div className="flex items-center gap-6 text-xs flex-wrap">
                              <p className="text-amber-700 font-semibold">
                                Partidas: {budget.items}
                              </p>
                              <div className="flex items-center gap-1.5 text-slate-500">
                                <Clock size={13} className="text-slate-400" />
                                <span>{budget.date}</span>
                              </div>
                              <span className="font-extrabold text-sm text-amber-900">
                                {budget.total}
                              </span>
                            </div>
                          </div>

                          {/* Right: Quick Actions */}
                          <div className="flex items-center gap-1 shrink-0 relative">
                            <button className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors" title="Duplicar">
                              <Copy size={17} />
                            </button>
                            <button className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors" title="Configuración Global">
                              <Settings size={17} />
                            </button>
                            <button className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors" title="Imprimir">
                              <Printer size={17} />
                            </button>

                            {/* Excel Export Button with Tooltip */}
                            <div
                              className="relative inline-flex items-center"
                              onMouseEnter={() => setActiveActionTooltip('excel')}
                              onMouseLeave={() => {
                                if (activeCard !== 2) setActiveActionTooltip(null);
                              }}
                            >
                              <button
                                className={`p-1.5 rounded-md transition-all ${
                                  isAmberHovered && activeActionTooltip === 'excel'
                                    ? 'bg-amber-200/90 text-amber-950 ring-1 ring-amber-400/60'
                                    : 'text-slate-400 hover:text-emerald-600'
                                }`}
                                title="Exportar a Excel"
                              >
                                <FileSpreadsheet size={17} />
                              </button>

                              {/* Tooltip visible on Card 2 hover (or mouseover) */}
                              {isAmberHovered && activeActionTooltip === 'excel' && (
                                <div className="absolute top-full right-0 mt-2 z-30 pointer-events-none">
                                  <div className="relative bg-white text-slate-800 text-[11px] font-semibold px-2.5 py-1 rounded shadow-md border border-slate-300 whitespace-nowrap animate-in fade-in zoom-in-95 duration-150">
                                    <div className="absolute -top-1 right-2.5 w-2 h-2 bg-white border-t border-l border-slate-300 rotate-45" />
                                    Exportar a Excel
                                  </div>
                                </div>
                              )}
                            </div>

                            <button className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors" title="Exportar Backup">
                              <CloudDownload size={17} />
                            </button>
                            <button className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors" title="Compartir enlace">
                              <Share2 size={17} />
                            </button>
                            <button className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors" title="Renombrar">
                              <Edit3 size={17} />
                            </button>
                            <button className="p-1.5 text-slate-400 hover:text-red-500 transition-colors" title="Eliminar">
                              <Trash2 size={17} />
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {filteredBudgets.length === 0 && (
                      <div className="p-8 text-center text-sm text-slate-400 bg-white/60 rounded-2xl border border-dashed border-slate-300">
                        No se encontraron presupuestos que coincidan con "{searchTerm}".
                      </div>
                    )}
                  </div>
                </main>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
