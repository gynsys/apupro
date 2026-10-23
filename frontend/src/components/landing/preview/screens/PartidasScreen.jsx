import React from 'react';
import {
  ArrowLeft,
  ChevronDown,
  Database,
  FileSpreadsheet,
  FolderPlus,
  Plus,
  Printer,
  RefreshCw,
  Settings,
  Settings2,
  SlidersHorizontal,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { demoPartidas } from '../demoData';

export default function PartidasScreen({ activePartida, scrolled, gearActive }) {
  return (
    <div className="flex h-full flex-col bg-[#f0f4fd]">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4">
        <div className="rounded-lg border border-slate-200 p-1.5 text-slate-500">
          <ArrowLeft size={17} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-extrabold text-slate-800">Presupuesto de Ejemplo costbase.net</p>
          <p className="text-[10px] text-slate-400">Presupuesto · 6 partidas · USD</p>
        </div>
        <div className="ml-auto flex items-center gap-1 text-[9px] font-medium text-slate-600">
          <span className="flex items-center gap-1 rounded-lg border border-slate-400 bg-white px-2 py-1.5 shadow-xs">
            <Database size={12} /> Base de Datos
          </span>
          <span className="hidden items-center gap-1 rounded-lg border border-slate-400 bg-white px-2 py-1.5 shadow-xs lg:flex">
            <RefreshCw size={12} /> Actualizar Precios
          </span>
          <span className="flex items-center gap-1 rounded-lg border border-slate-400 bg-white px-2 py-1.5 shadow-xs">
            <Settings size={12} /> Configuración Global
          </span>
          <span className="flex items-center gap-1 rounded-lg border border-slate-400 bg-white px-2 py-1.5 shadow-xs">
            <Printer size={12} /> Imprimir
          </span>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
            <SlidersHorizontal size={14} />
            Partidas del presupuesto
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button type="button" className="flex items-center gap-1 rounded-xl bg-blue-600 px-2.5 py-1.5 text-[10px] font-medium text-white shadow-xs">
              <Plus size={13} /> Agregar Partida
            </button>
            <button type="button" className="flex items-center gap-1 rounded-xl border border-slate-400 bg-white px-2.5 py-1.5 text-[10px] font-medium text-slate-700 shadow-xs">
              <FolderPlus size={13} /> Agregar Capítulo
            </button>
            <button type="button" className="flex items-center gap-1 rounded-xl border border-slate-400 bg-white px-2.5 py-1.5 text-[10px] font-medium text-slate-700 shadow-xs">
              <FileSpreadsheet size={13} className="text-emerald-600" /> Exportar Excel
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="grid grid-cols-[48px_1fr_58px_58px_78px_40px] border-b border-slate-200 bg-slate-50 px-3 py-2 text-[9px] font-bold uppercase tracking-wide text-slate-500">
            <span>Cód.</span>
            <span>Descripción</span>
            <span className="text-right">Und.</span>
            <span className="text-right">Cant.</span>
            <span className="text-right">P.U.</span>
            <span />
          </div>

          <div className="relative h-[292px] overflow-hidden sm:h-[326px]">
            <motion.div
              animate={{ y: scrolled ? -150 : 0 }}
              transition={{ duration: 0.8, ease: 'easeInOut' }}
            >
              {demoPartidas.map((item) => {
                const isActive = activePartida && item.code === '5';
                return (
                  <div
                    key={item.code}
                    className={`grid grid-cols-[48px_1fr_58px_58px_78px_40px] items-center border-b border-slate-100 px-3 py-[9px] text-[11px] transition-colors ${
                      isActive ? 'bg-blue-50 ring-1 ring-inset ring-blue-300' : 'bg-white'
                    } ${item.isChapter ? 'font-bold text-slate-700' : 'text-slate-600'}`}
                  >
                    <span className="font-mono text-[10px] text-slate-400">{item.code}</span>
                    <span className="truncate pr-2">{item.description}</span>
                    <span className="text-right text-slate-400">{item.unit}</span>
                    <span className="text-right">{item.qty}</span>
                    <span className={`text-right font-semibold ${isActive ? 'text-blue-700' : 'text-slate-700'}`}>
                      {item.pu}
                    </span>
                    <button
                      type="button"
                      className={`ml-auto rounded-md p-1 transition-all ${
                        isActive && gearActive
                          ? 'bg-blue-600 text-white ring-2 ring-blue-200'
                          : 'text-slate-400'
                      }`}
                      title="Abrir APU"
                    >
                      <Settings2 size={14} />
                    </button>
                  </div>
                );
              })}
            </motion.div>

            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-white to-transparent" />
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between text-[10px] text-slate-400">
          <span>Clic en el engranaje para abrir el APU</span>
          <span className="flex items-center gap-1 text-slate-500">
            Ver APU <ChevronDown size={11} className="-rotate-90" />
          </span>
        </div>
      </main>
    </div>
  );
}
