import React from 'react';
import { FileSpreadsheet, X } from 'lucide-react';
import { motion } from 'framer-motion';

export default function ExportModal({ closeActive, onClose }) {
  return (
    <motion.div
      className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-[2px]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <motion.div
        className="w-full max-w-[380px] rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
        initial={{ opacity: 0, scale: 0.94, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.28, ease: 'easeOut' }}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="rounded-xl bg-emerald-50 p-2 text-emerald-600">
              <FileSpreadsheet size={18} />
            </div>
            <div>
              <h4 className="text-[12px] font-extrabold text-slate-800">Exportar a Excel</h4>
              <p className="text-[9px] text-slate-400">Selecciona el contenido del archivo</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            data-demo-target="close"
            className={`rounded-md p-1 text-slate-400 transition-all duration-300 ${
              closeActive ? 'bg-rose-50 text-rose-500 ring-2 ring-rose-200' : ''
            }`}
          >
            <X size={15} />
          </button>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50/60 px-3 py-2">
            <span className="h-2.5 w-2.5 rounded-full border-[3px] border-emerald-600 bg-white" />
            <div>
              <p className="text-[10px] font-bold text-slate-700">APU completo</p>
              <p className="text-[8px] text-slate-400">Materiales, equipos y mano de obra</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 opacity-70">
            <span className="h-2.5 w-2.5 rounded-full border border-slate-300 bg-white" />
            <div>
              <p className="text-[10px] font-bold text-slate-600">Presupuesto completo</p>
              <p className="text-[8px] text-slate-400">Todas las partidas del presupuesto</p>
            </div>
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-1.5 text-[9px] font-semibold text-slate-500">
            Cancelar
          </button>
          <button type="button" className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[9px] font-bold text-white shadow-sm">
            Exportar
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
