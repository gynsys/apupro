import React from 'react';
import { ArrowLeft, ChevronDown, FileSpreadsheet, Search, SlidersHorizontal } from 'lucide-react';
import { motion } from 'framer-motion';
import { demoPartidas } from '../demoData';

export default function PartidasScreen({ activePartida, scrolled }) {
  return (
    <div className="flex h-full flex-col bg-[#f0f4fd]">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4">
        <div className="rounded-lg border border-slate-200 p-1 text-slate-500">
          <ArrowLeft size={15} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-[11px] font-extrabold text-slate-800">Rehabilitación de áreas internas</p>
          <p className="text-[9px] text-slate-400">Presupuesto · 88 partidas · USD</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5 text-[9px] font-semibold text-slate-500">
          <span className="rounded-md border border-slate-200 bg-white px-2 py-1">Presupuesto</span>
          <span className="rounded-md bg-blue-600 px-2 py-1 text-white">Partidas</span>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col p-3 sm:p-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-600">
            <SlidersHorizontal size={13} />
            Partidas del presupuesto
          </div>
          <div className="flex items-center gap-1.5">
            <span className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[9px] text-slate-500">Buscar</span>
            <span className="flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 text-[9px] font-bold text-white">
              <FileSpreadsheet size={11} />
              Exportar
            </span>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="grid grid-cols-[42px_1fr_52px_52px_68px] border-b border-slate-200 bg-slate-50 px-2 py-1.5 text-[8px] font-bold uppercase tracking-wide text-slate-500">
            <span>Cód.</span>
            <span>Descripción</span>
            <span className="text-right">Und.</span>
            <span className="text-right">Cant.</span>
            <span className="text-right">P.U.</span>
          </div>

          <div className="relative h-[228px] overflow-hidden sm:h-[252px]">
            <motion.div
              animate={{ y: scrolled ? -150 : 0 }}
              transition={{ duration: 0.8, ease: 'easeInOut' }}
            >
              {demoPartidas.map((item) => {
                const isActive = activePartida && item.code === '5';
                return (
                  <div
                    key={item.code}
                    className={`grid grid-cols-[42px_1fr_52px_52px_68px] items-center border-b border-slate-100 px-2 py-[7px] text-[9px] transition-colors ${
                      isActive ? 'bg-blue-50 ring-1 ring-inset ring-blue-300' : 'bg-white'
                    } ${item.isChapter ? 'font-bold text-slate-700' : 'text-slate-600'}`}
                  >
                    <span className="font-mono text-[8px] text-slate-400">{item.code}</span>
                    <span className="truncate pr-2">{item.description}</span>
                    <span className="text-right text-slate-400">{item.unit}</span>
                    <span className="text-right">{item.qty}</span>
                    <span className={`text-right font-semibold ${isActive ? 'text-blue-700' : 'text-slate-700'}`}>
                      {item.pu}
                    </span>
                  </div>
                );
              })}
            </motion.div>

            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-white to-transparent" />
          </div>
        </div>

        <div className="mt-2 flex items-center justify-between text-[9px] text-slate-400">
          <span>88 partidas · 6 capítulos</span>
          <span className="flex items-center gap-1 text-slate-500">
            Ver APU <ChevronDown size={11} className="-rotate-90" />
          </span>
        </div>
      </main>
    </div>
  );
}
