import React from 'react';
import {
  Bell,
  CloudDownload,
  Copy,
  Crown,
  Database,
  Edit3,
  FileSpreadsheet,
  FileText,
  Home,
  Layout,
  Link2,
  Plus,
  Printer,
  Receipt,
  Search,
  Settings,
  Share2,
  Trash2,
  Upload,
} from 'lucide-react';
import { demoBudgets } from '../demoData';

const sidebarItems = [FileText, Database, Database, Copy, FileText, FileText];

export default function BudgetsScreen({ activeBudget }) {
  return (
    <div className="flex h-full flex-col bg-[#f0f4fd]">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200/90 bg-white/95 px-4 shadow-xs md:px-6">
        <div className="flex items-center gap-2.5">
          <div className="rounded-xl bg-blue-600 p-1.5 text-white shadow-sm">
            <Layout size={18} />
          </div>
          <span className="text-lg font-extrabold tracking-tight text-blue-700">CostBase</span>
        </div>
        <div className="flex items-center gap-1 text-slate-400">
          <Bell size={18} />
          <Home size={18} />
          <Settings size={18} />
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-14 shrink-0 flex-col items-center justify-between border-r border-slate-200/80 bg-white py-4 sm:flex">
          <div className="flex w-full flex-col items-center gap-2.5">
            {sidebarItems.map((Icon, index) => (
              <div
                key={index}
                className={`rounded-xl p-2 ${index === 0 ? 'bg-blue-50/80 font-bold text-blue-600' : 'text-slate-400'}`}
              >
                <Icon size={20} />
              </div>
            ))}
          </div>
          <div className="flex w-full flex-col items-center gap-2 border-t border-slate-100 pt-4">
            <Crown size={20} className="text-slate-400" />
            <Receipt size={20} className="text-slate-400" />
          </div>
        </aside>

        <main className="min-w-0 flex-1 overflow-hidden p-5 md:p-8">
          <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <h3 className="text-xl font-extrabold leading-tight tracking-tight text-blue-700 md:text-2xl">
                Gestor de Presupuestos
              </h3>
              <p className="mt-0.5 text-xs font-medium text-slate-500 md:text-sm">
                Administra, crea y organiza todos tus proyectos
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm">
                <Plus size={16} />
                Nuevo Presupuesto
              </span>
              <span className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm">
                <Upload size={16} />
                Importar Backup
              </span>
              <span className="flex items-center gap-1.5 rounded-xl border border-[#9ecc98] bg-[#B5DCB0] px-3.5 py-2 text-xs font-semibold text-[#143d1a] shadow-sm">
                <Link2 size={16} />
                Importar con Enlace
              </span>
            </div>
          </div>

          <div className="mb-6 flex items-center rounded-2xl border-2 border-slate-300 bg-white p-1.5 px-4 shadow-xs">
            <Search size={18} className="mr-3 shrink-0 text-slate-400" />
            <span className="w-full py-1.5 text-xs text-slate-400 md:text-sm">
              Buscar presupuestos por nombre...
            </span>
          </div>

          <div className="flex flex-col gap-3.5">
            {demoBudgets.map((budget) => {
              const isActive = activeBudget === budget.id;
              return (
                <div
                  key={budget.id}
                  className={`flex cursor-pointer flex-col items-start justify-between gap-4 rounded-2xl border-2 px-5 py-3.5 transition-all duration-300 md:flex-row md:items-center ${
                    isActive
                      ? '-translate-y-1 border-[#f59e0b] bg-[#fef3c7] shadow-md'
                      : 'border-slate-200 bg-white shadow-sm'
                  }`}
                >
                  <div className="flex flex-1 flex-col items-start justify-center gap-1.5 overflow-hidden">
                    <h4 className={`w-full truncate text-sm font-bold tracking-tight md:text-base ${isActive ? 'text-[#78350f]' : 'text-slate-800'}`}>
                      {budget.name}
                    </h4>
                    <div className="flex flex-wrap items-center gap-6 text-xs">
                      <p className={`font-semibold ${isActive ? 'text-amber-700' : 'text-slate-500'}`}>
                        Partidas: {budget.items}
                      </p>
                      <span className="text-slate-500">{budget.client}</span>
                      <span className="text-sm font-extrabold text-amber-900">{budget.total}</span>
                    </div>
                  </div>

                  <div className="relative flex shrink-0 items-center gap-1">
                    <button type="button" className="p-1.5 text-slate-400" title="Duplicar"><Copy size={17} /></button>
                    <button type="button" className="p-1.5 text-slate-400" title="Configuración Global"><Settings size={17} /></button>
                    <button type="button" className="p-1.5 text-slate-400" title="Imprimir"><Printer size={17} /></button>
                    <button type="button" className="rounded-md p-1.5 text-slate-400" title="Exportar a Excel"><FileSpreadsheet size={17} /></button>
                    <button type="button" className="p-1.5 text-slate-400" title="Exportar Backup"><CloudDownload size={17} /></button>
                    <button type="button" className="p-1.5 text-slate-400" title="Compartir enlace"><Share2 size={17} /></button>
                    <button type="button" className="p-1.5 text-slate-400" title="Renombrar"><Edit3 size={17} /></button>
                    <button type="button" className="p-1.5 text-slate-400" title="Eliminar"><Trash2 size={17} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        </main>
      </div>
    </div>
  );
}
