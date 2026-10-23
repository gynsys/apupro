import React from 'react';
import {
  ArrowLeft,
  Calculator,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  Printer,
} from 'lucide-react';
import { motion } from 'framer-motion';
import ApuEditorUI from '../../../ApuEditorUI';
import { demoApuItem, demoApuSettings } from '../demoData';

const noop = () => {};

export default function ApuScreen({ scrolled, exportActive, onExportClick }) {
  return (
    <div className="flex h-full flex-col bg-[#f0f4fd]">
      <header className="flex h-[52px] shrink-0 items-center justify-between gap-3 border-b border-gray-200 bg-gray-50/95 px-3 shadow-sm">
        <div className="flex items-center gap-2">
          <button type="button" className="rounded-lg border border-slate-300 bg-white p-1.5 text-slate-600 shadow-sm" title="Volver">
            <ArrowLeft size={16} />
          </button>
          <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 shadow-sm">
            <Calculator size={13} className="text-blue-600" />
            <span className="font-mono text-[11px] font-black text-slate-800">5/16</span>
          </div>
          <div className="flex items-center rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm">
            <button type="button" className="rounded p-1 text-slate-700"><ChevronLeft size={15} /></button>
            <span className="mx-0.5 h-3 w-px bg-slate-200" />
            <button type="button" className="rounded p-1 text-slate-700"><ChevronRight size={15} /></button>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="hidden items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1 shadow-sm lg:flex">
            <span className="text-[8px] font-semibold uppercase tracking-wider text-slate-500">Cant:</span>
            <span className="text-[11px] font-bold text-slate-800">180,00</span>
            <span className="rounded border border-slate-200 bg-slate-100 px-1 text-[8px] font-bold text-slate-600">m2</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-2 py-1 shadow-sm">
            <span className="text-[8px] font-semibold uppercase tracking-wider text-emerald-600">P.U:</span>
            <span className="text-[11px] font-bold text-emerald-700">$ 9,35</span>
          </div>
          <div className="hidden items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-2 py-1 shadow-sm xl:flex">
            <span className="text-[8px] font-semibold uppercase tracking-wider text-blue-600">Total Partida:</span>
            <span className="text-[11px] font-bold text-blue-700">$ 1.683,00</span>
          </div>
          <button type="button" className="rounded-lg border border-slate-300 bg-white p-1.5 text-slate-500 shadow-sm" title="Imprimir">
            <Printer size={15} />
          </button>
          <button
            type="button"
            onClick={onExportClick}
            data-demo-target="export"
            className={`flex items-center gap-1 rounded-lg border px-2 py-1.5 text-[9px] font-bold shadow-sm transition-all duration-300 ${
              exportActive
                ? 'border-emerald-500 bg-emerald-500 text-white ring-2 ring-emerald-200'
                : 'border-emerald-600 bg-emerald-600 text-white'
            }`}
            title="Exportar a Excel"
          >
            <FileSpreadsheet size={14} />
            Excel
          </button>
        </div>
      </header>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <motion.div
          animate={{ y: scrolled ? -250 : 0 }}
          transition={{ duration: 0.85, ease: 'easeInOut' }}
          className="pointer-events-none p-3"
        >
          <ApuEditorUI
            item={demoApuItem}
            settings={demoApuSettings}
            onHeaderChange={noop}
            onHeaderBlur={noop}
            onComponentChange={noop}
            onComponentBlur={noop}
            onRemoveRow={noop}
            onAddBlankRow={noop}
            onAddSearchRow={noop}
            onSelectComponent={noop}
            deletingId={null}
          />
        </motion.div>
      </div>
    </div>
  );
}
