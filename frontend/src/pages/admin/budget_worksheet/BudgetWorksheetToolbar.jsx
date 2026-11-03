import React from 'react';
import { Plus, FolderPlus, Settings, Printer, Loader, Gauge } from 'lucide-react';
import ExcelIcon from './ExcelIcon';

export default function BudgetWorksheetToolbar({
  onOpenSearchModal,
  onOpenChapterModal,
  onExportExcel,
  exportingExcel,
  onRecalibratePerformances,
  recalibratingPerformances,
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

      {/* Fila de Acciones: en móvil chips con scroll horizontal suave; en desktop fila flex */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 pt-0.5 w-full sm:w-auto -mx-1 px-1 sm:mx-0 sm:px-0">
        <button  
          onClick={onOpenChapterModal}
          className="flex items-center justify-center gap-1.5 bg-white border border-slate-300 hover:border-blue-500 hover:bg-blue-50 hover:text-blue-700 text-slate-700 px-3 py-1.5 rounded-xl font-medium transition-all duration-200 text-xs sm:text-sm cursor-pointer shadow-xs whitespace-nowrap shrink-0 touch-target"
        >
          <FolderPlus size={16} className="shrink-0 text-amber-600" /> <span>+ Capítulo</span>
        </button>

        <button
          onClick={onExportExcel}
          disabled={exportingExcel}
          className="flex items-center justify-center gap-1.5 bg-white border border-slate-300 hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 px-3 py-1.5 rounded-xl font-medium transition-all duration-200 disabled:opacity-50 text-xs sm:text-sm cursor-pointer shadow-xs whitespace-nowrap shrink-0 touch-target"
          title="Exportar presupuesto a Excel"
        >
          {exportingExcel ? (
            <Loader size={16} className="animate-spin text-emerald-600 shrink-0" />
          ) : (
            <ExcelIcon size={16} className="text-emerald-600 shrink-0" />
          )}
          <span>Excel</span>
        </button>

        {onRecalibratePerformances && (
          <button
            onClick={onRecalibratePerformances}
            disabled={recalibratingPerformances}
            className="flex items-center justify-center gap-1.5 bg-white border border-slate-300 hover:border-amber-500 hover:bg-amber-50 hover:text-amber-800 text-slate-700 px-3 py-1.5 rounded-xl font-medium transition-all duration-200 disabled:opacity-50 text-xs sm:text-sm cursor-pointer shadow-xs whitespace-nowrap shrink-0 touch-target"
            title="Recalibrar rendimientos según normas técnicas COVENIN y cuadrillas reales"
          >
            {recalibratingPerformances ? (
              <Loader size={16} className="animate-spin text-amber-600 shrink-0" />
            ) : (
              <Gauge size={16} className="text-amber-600 shrink-0" />
            )}
            <span>Recalibrar</span>
          </button>
        )}

        {/* VISIBLES EN MÓVIL (< md) */}
        <button 
          onClick={() => setShowSettings(!showSettings)}
          className="md:hidden flex items-center justify-center gap-1.5 bg-white border border-slate-300 hover:border-blue-500 hover:bg-blue-50 hover:text-blue-700 text-slate-700 px-3 py-1.5 rounded-xl font-medium transition-all duration-200 text-xs cursor-pointer shadow-xs whitespace-nowrap shrink-0 touch-target"
        >
          <Settings size={15} className="shrink-0 text-slate-600" /> <span>Ajustes</span>
        </button>

        <button 
          onClick={() => setShowPrintModal(true)}
          className="md:hidden flex items-center justify-center gap-1.5 bg-white border border-slate-300 hover:border-blue-500 hover:bg-blue-50 hover:text-blue-700 text-slate-700 px-3 py-1.5 rounded-xl font-medium transition-all duration-200 text-xs cursor-pointer shadow-xs whitespace-nowrap shrink-0 touch-target"
        >
          <Printer size={15} className="shrink-0 text-slate-600" /> <span>Imprimir</span>
        </button>
      </div>
    </div>
  );
}
