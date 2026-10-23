import React from 'react';
import {
  Bell,
  Calculator,
  Copy,
  Cpu,
  Database,
  FileText,
  Home,
  Layout,
  Search,
  Server,
  Settings,
  Users,
} from 'lucide-react';
import { demoBudgets } from '../demoData';

const sidebarItems = [
  { Icon: FileText, active: true },
  { Icon: Database },
  { Icon: Server },
  { Icon: Copy },
  { Icon: Cpu },
  { Icon: Calculator },
  { Icon: Users },
];

export default function BudgetsScreen({ activeBudget }) {
  return (
    <div className="flex h-full flex-col bg-[#f0f4fd]">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-blue-600 p-1.5 text-white">
            <Layout size={15} />
          </div>
          <span className="text-sm font-extrabold tracking-tight text-blue-700">CostBase</span>
        </div>
        <div className="flex items-center gap-1 text-slate-400">
          <Bell size={15} />
          <Home size={15} />
          <Settings size={15} />
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-12 shrink-0 flex-col items-center gap-2 border-r border-slate-200 bg-white py-3 sm:flex">
          {sidebarItems.map(({ Icon, active }, index) => (
            <div
              key={index}
              className={`rounded-lg p-1.5 ${active ? 'bg-blue-50 text-blue-600' : 'text-slate-400'}`}
            >
              <Icon size={17} />
            </div>
          ))}
        </aside>

        <main className="min-w-0 flex-1 p-4 sm:p-5">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <h3 className="text-lg font-extrabold leading-tight text-blue-700">Gestor de Presupuestos</h3>
              <p className="text-[10px] font-medium text-slate-500">Administra, crea y organiza tus proyectos</p>
            </div>
            <span className="rounded-lg bg-blue-600 px-2.5 py-1.5 text-[10px] font-bold text-white shadow-sm">
              Nuevo Presupuesto
            </span>
          </div>

          <div className="mb-3 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-400 shadow-sm">
            <Search size={14} />
            <span>Buscar presupuestos por nombre...</span>
          </div>

          <div className="space-y-2">
            {demoBudgets.map((budget) => {
              const isActive = activeBudget === budget.id;
              return (
                <div
                  key={budget.id}
                  className={`flex items-center justify-between rounded-xl border bg-white px-3 py-2.5 shadow-sm transition-all duration-300 ${
                    isActive
                      ? 'border-blue-400 ring-2 ring-blue-200'
                      : 'border-slate-200'
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div className={`rounded-lg p-1.5 ${isActive ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>
                      <FileText size={15} />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[11px] font-bold text-slate-800">{budget.name}</p>
                      <p className="text-[9px] text-slate-400">
                        {budget.client} · {budget.items} partidas
                      </p>
                    </div>
                  </div>
                  <div className="ml-3 flex shrink-0 items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-700">{budget.total}</span>
                    <span className={`text-[10px] font-semibold ${isActive ? 'text-blue-600' : 'text-slate-400'}`}>
                      Abrir →
                    </span>
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
