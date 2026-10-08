import React from 'react';
import { Plus, FolderPlus, Settings, Printer, Loader } from 'lucide-react';
import ExcelIcon from './ExcelIcon';

export default function BudgetWorksheetToolbar({
  onOpenSearchModal,
  onOpenChapterModal,
  onExportExcel,
  exportingExcel,
  showSettings,
  setShowSettings,
  setShowPrintModal,
}) {
  return (
    <div className="w-full md:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
      <button  
        onClick={onOpenSearchModal}
        className="w-full sm:w-auto flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-1.5 rounded-xl font-medium border border-blue-600 transition-all active:scale-95 text-sm"
      >
        <Plus size={18} /> Agregar Partida
      </button>

      <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
        <button  
          onClick={onOpenChapterModal}
          className="flex items-center justify-center gap-2 bg-white border border-slate-400 hover:border-blue-500 hover:bg-blue-50 hover:text-blue-700 text-slate-700 px-3 py-1.5 rounded-xl font-medium transition-all duration-200 text-xs sm:text-sm cursor-pointer shadow-xs"
        >
          <FolderPlus size={16} className="shrink-0" /> <span className="truncate">Agregar Capítulo</span>
        </button>

        <button
          onClick={onExportExcel}
          disabled={exportingExcel}
          className="flex items-center justify-center gap-2 bg-white border border-slate-400 hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 px-3 py-1.5 rounded-xl font-medium transition-all duration-200 disabled:opacity-50 text-xs sm:text-sm cursor-pointer shadow-xs"
          title="Exportar presupuesto a Excel"
        >
          {exportingExcel ? (
            <Loader size={16} className="animate-spin text-emerald-600 shrink-0" />
          ) : (
            <ExcelIcon size={16} className="text-emerald-600 shrink-0" />
          )}
          <span className="truncate">Exportar Excel</span>
        </button>

        {/* VISIBLES EN MÓVIL (< md) */}
        <button 
          onClick={() => setShowSettings(!showSettings)}
          className="md:hidden flex items-center justify-center gap-2 bg-white border border-slate-400 hover:border-blue-500 hover:bg-blue-50 hover:text-blue-700 text-slate-700 px-3 py-1.5 rounded font-medium transition-all duration-200 text-xs cursor-pointer shadow-xs"
        >
          <Settings size={16} className="shrink-0 text-slate-600" /> <span className="truncate">Configuración</span>
        </button>

        <button 
          onClick={() => setShowPrintModal(true)}
          className="md:hidden flex items-center justify-center gap-2 bg-white border border-slate-400 hover:border-blue-500 hover:bg-blue-50 hover:text-blue-700 text-slate-700 px-3 py-1.5 rounded font-medium transition-all duration-200 text-xs cursor-pointer shadow-xs"
        >
          <Printer size={16} className="shrink-0 text-amber-600" /> <span className="truncate">Imprimir</span>
        </button>
      </div>
    </div>
  );
}
