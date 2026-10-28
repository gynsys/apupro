import React, { useRef, useEffect } from 'react';
import {
  X,
  FileSpreadsheet,
  FileText,
  ClipboardList,
  UploadCloud,
  ArrowRight,
} from 'lucide-react';

export default function BudgetImportChoiceModal({ isOpen, onClose, onSelectMode }) {
  const apuInputRef = useRef(null);
  const budgetInputRef = useRef(null);
  const computeInputRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleFilePicked = (event, mode) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file && onSelectMode) {
      onSelectMode(file, mode);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-xl bg-amber-100 rounded-2xl shadow-2xl border border-amber-600/20 overflow-hidden font-sans flex flex-col animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex justify-between items-center px-5 py-4 bg-white/50 border-b border-amber-600/15">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-sky-600/10 flex items-center justify-center text-sky-700 shrink-0">
              <UploadCloud size={20} />
            </div>
            <div className="min-w-0">
              <h2 className="m-0 text-base sm:text-lg font-bold text-amber-950 leading-tight truncate">
                Importar Presupuesto desde Archivo
              </h2>
              <p className="text-xs text-amber-800/80 m-0 truncate">
                Selecciona el tipo de archivo que deseas procesar:
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-amber-700 hover:text-amber-900 p-2 rounded-xl hover:bg-amber-200/50 transition-colors cursor-pointer shrink-0"
            aria-label="Cerrar modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Inputs ocultos específicos por tipo */}
        <input
          ref={apuInputRef}
          type="file"
          accept=".xlsx,.xls,.xlsm"
          onChange={(e) => handleFilePicked(e, 'apu_workbook')}
          className="hidden"
        />
        <input
          ref={budgetInputRef}
          type="file"
          accept=".xlsx,.xls,.csv,.pdf,.png,.jpg,.jpeg,.webp"
          onChange={(e) => handleFilePicked(e, 'budget')}
          className="hidden"
        />
        <input
          ref={computeInputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.webp"
          onChange={(e) => handleFilePicked(e, 'compute_notes')}
          className="hidden"
        />

        {/* Opciones / Tarjetas */}
        <div className="p-4 sm:p-6 flex flex-col gap-3.5">
          
          {/* Opción 1: Libro de APUs */}
          <div className="bg-white/85 hover:bg-white border border-emerald-600/25 rounded-xl p-4 shadow-sm transition-all duration-200 hover:shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-emerald-100/80 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                <FileSpreadsheet size={22} />
              </div>
              <div className="min-w-0">
                <h3 className="m-0 text-sm font-bold text-emerald-950 leading-tight">
                  Libro de APUs (Excel)
                </h3>
                <p className="text-xs text-slate-600 mt-1 mb-0 leading-relaxed">
                  Archivos de Excel con hojas de APU (Materiales, Equipos y Mano de Obra).
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => apuInputRef.current?.click()}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm hover:shadow transition-all shrink-0 cursor-pointer"
            >
              Seleccionar Libro de APUs
              <ArrowRight size={14} />
            </button>
          </div>

          {/* Opción 2: Presupuesto o Listado */}
          <div className="bg-white/85 hover:bg-white border border-sky-600/25 rounded-xl p-4 shadow-sm transition-all duration-200 hover:shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-sky-100/80 text-sky-700 flex items-center justify-center shrink-0 mt-0.5">
                <FileText size={22} />
              </div>
              <div className="min-w-0">
                <h3 className="m-0 text-sm font-bold text-sky-950 leading-tight">
                  Presupuesto o Listado de Partidas
                </h3>
                <p className="text-xs text-slate-600 mt-1 mb-0 leading-relaxed">
                  Listas de partidas para cruzar con la Base Maestra o generar con Inteligencia Artificial.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => budgetInputRef.current?.click()}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 shadow-sm hover:shadow transition-all shrink-0 cursor-pointer"
            >
              Seleccionar Presupuesto / Listado
              <ArrowRight size={14} />
            </button>
          </div>

          {/* Opción 3: Cómputos Métricos */}
          <div className="bg-white/85 hover:bg-white border border-amber-600/25 rounded-xl p-4 shadow-sm transition-all duration-200 hover:shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-amber-200/80 text-amber-800 flex items-center justify-center shrink-0 mt-0.5">
                <ClipboardList size={22} />
              </div>
              <div className="min-w-0">
                <h3 className="m-0 text-sm font-bold text-amber-950 leading-tight">
                  Apuntes de Cómputos Métricos
                </h3>
                <p className="text-xs text-slate-600 mt-1 mb-0 leading-relaxed">
                  Notas de obra, fotos o documentos con descripciones y mediciones.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => computeInputRef.current?.click()}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-amber-900 bg-amber-300 hover:bg-amber-400 border border-amber-400 shadow-sm hover:shadow transition-all shrink-0 cursor-pointer"
            >
              Seleccionar Cómputos
              <ArrowRight size={14} />
            </button>
          </div>

        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-white/40 border-t border-amber-600/15 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-semibold text-amber-800 hover:text-amber-950 px-4 py-2 rounded-xl hover:bg-amber-200/50 transition-colors cursor-pointer"
          >
            Cancelar
          </button>
        </div>

      </div>
    </div>
  );
}
