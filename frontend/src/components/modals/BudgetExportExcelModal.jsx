import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, CheckSquare, Square, Download, Layers, FileSpreadsheet, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function BudgetExportExcelModal({
  isOpen,
  onClose,
  onExport,
  isExporting = false,
  totalItemsCount = 0,
}) {
  const [exportBudget, setExportBudget] = useState(true);
  const [exportApus, setExportApus] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!exportBudget && !exportApus) {
      toast.error('Selecciona al menos una opción para exportar');
      return;
    }
    onExport({ exportBudget, exportApus });
  };

  return createPortal(
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4">
      <div 
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden font-sans flex flex-col animate-in fade-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-excel-modal-title"
      >
        {/* Encabezado */}
        <div className="flex justify-between items-center px-5 py-4 bg-emerald-50/70 border-b border-emerald-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <FileSpreadsheet size={20} />
            </div>
            <div>
              <h2 id="export-excel-modal-title" className="m-0 text-base sm:text-lg font-bold text-slate-900 leading-tight">
                Exportar a Excel
              </h2>
              <p className="m-0 text-xs text-slate-500">
                Genera archivos compatibles con Microsoft Excel (.xlsx)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isExporting}
            className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            aria-label="Cerrar modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Contenido */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <p className="text-xs sm:text-sm text-slate-600 mb-1">
            Selecciona qué documentos deseas incluir en la exportación:
          </p>

          <div className="space-y-3">
            {/* Opción 1: Presupuesto General */}
            <div
              onClick={() => !isExporting && setExportBudget(prev => !prev)}
              className={`p-3.5 rounded-xl border-2 transition-all cursor-pointer select-none flex items-start gap-3 ${
                exportBudget
                  ? 'border-emerald-500 bg-emerald-50/40 text-slate-900'
                  : 'border-slate-200 hover:border-slate-300 bg-white text-slate-600'
              }`}
            >
              <button
                type="button"
                className="mt-0.5 text-emerald-600 shrink-0 focus:outline-hidden"
                tabIndex={-1}
              >
                {exportBudget ? <CheckSquare size={20} /> : <Square size={20} className="text-slate-300" />}
              </button>
              <div className="flex-1">
                <div className="flex items-center gap-2 font-semibold text-sm text-slate-900">
                  <FileSpreadsheet size={16} className="text-emerald-600" />
                  Presupuesto General
                </div>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Exporta la planilla con capítulos, cómputos, partidas, totales, IVA y fórmulas automáticas.
                </p>
              </div>
            </div>

            {/* Opción 2: Todos los APUs */}
            <div
              onClick={() => !isExporting && setExportApus(prev => !prev)}
              className={`p-3.5 rounded-xl border-2 transition-all cursor-pointer select-none flex items-start gap-3 ${
                exportApus
                  ? 'border-emerald-500 bg-emerald-50/40 text-slate-900'
                  : 'border-slate-200 hover:border-slate-300 bg-white text-slate-600'
              }`}
            >
              <button
                type="button"
                className="mt-0.5 text-emerald-600 shrink-0 focus:outline-hidden"
                tabIndex={-1}
              >
                {exportApus ? <CheckSquare size={20} /> : <Square size={20} className="text-slate-300" />}
              </button>
              <div className="flex-1">
                <div className="flex items-center gap-2 font-semibold text-sm text-slate-900">
                  <Layers size={16} className="text-emerald-600" />
                  Todos los APUs del Presupuesto
                </div>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Genera un <strong>único libro de Excel</strong> con <strong>una hoja por cada APU</strong>{' '}
                  {totalItemsCount > 0 ? `(${totalItemsCount} partidas)` : ''}, con su desglose de materiales, equipos, mano de obra y costos indirectos.
                </p>
              </div>
            </div>
          </div>

          {/* Botones de acción */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isExporting}
              className="px-4 py-2 text-xs sm:text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isExporting || (!exportBudget && !exportApus)}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-xs transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isExporting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Exportando...</span>
                </>
              ) : (
                <>
                  <Download size={16} />
                  <span>Descargar Excel</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
