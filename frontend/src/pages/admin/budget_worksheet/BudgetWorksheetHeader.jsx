import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Settings, Printer, RefreshCw, Database, ChevronDown, Activity } from 'lucide-react';
import { useDatabaseContext } from '../../../contexts/DatabaseContext';

export default function BudgetWorksheetHeader({
  budget,
  syncing,
  onSyncPrices,
  showSettings,
  setShowSettings,
  setShowPrintModal,
  onOpenControlObra,
}) {
  const navigate = useNavigate();
  const [headerDbDropdownOpen, setHeaderDbDropdownOpen] = useState(false);
  const { activeDatabase, setActiveDatabase, databases } = useDatabaseContext();

  const headerPortalTarget = document.getElementById('header-actions-portal');
  const itemsCount = (budget.items || []).filter(item => !item.is_chapter).length;

  return (
    <>
      {/* Project Name + Back Button */}
      <div className="flex items-center justify-between w-full md:w-auto md:flex-1 min-w-0 gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <button 
            onClick={() => navigate('/budgets')}
            className="p-2 bg-white border border-slate-400 hover:border-slate-500 rounded hover:bg-slate-50 transition-colors shrink-0 cursor-pointer"
            title="Volver a presupuestos"
          >
            <ArrowLeft size={20} className="text-slate-600" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 
              className="text-[17px] font-bold text-slate-800 leading-tight truncate block max-w-full"
              title={budget.project_name || budget.name}
            >
              {budget.project_name || budget.name}
            </h1>
            <span className="text-[10px] text-slate-500 font-medium leading-tight block mt-0.5">
              Total Partidas: {itemsCount}
            </span>
          </div>
        </div>
        <div className="flex md:hidden items-center shrink-0 gap-1.5">
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className="p-1.5 bg-white border border-slate-400 hover:border-blue-500 hover:bg-blue-50 hover:text-blue-700 rounded text-slate-600 transition-all duration-200 cursor-pointer shadow-xs"
            title="Configuración Global"
          >
            <Settings size={17} />
          </button>
          <button 
            onClick={() => setShowPrintModal(true)}
            className="p-1.5 bg-white border border-slate-400 hover:border-blue-500 hover:bg-blue-50 hover:text-blue-700 rounded text-slate-700 transition-all duration-200 cursor-pointer shadow-xs"
            title="Imprimir Presupuesto"
          >
            <Printer size={17} />
          </button>
          {onOpenControlObra && (
            <button
              onClick={onOpenControlObra}
              className="p-1.5 bg-white border border-blue-400 hover:border-blue-600 hover:bg-blue-50 text-blue-700 rounded transition-all duration-200 cursor-pointer shadow-xs"
              title="Control de Obra"
            >
              <Activity size={17} />
            </button>
          )}
        </div>
      </div>

      {/* Topbar Actions Portal */}
      {headerPortalTarget && createPortal(
        <div className="flex gap-2 mx-2">
          {/* Database Selector Dropdown */}
          <div 
            className="relative"
            onMouseEnter={() => setHeaderDbDropdownOpen(true)}
            onMouseLeave={() => setHeaderDbDropdownOpen(false)}
          >
            <button
              type="button"
              onClick={() => setHeaderDbDropdownOpen(prev => !prev)}
              className="w-[34px] h-[34px] sm:w-auto sm:h-auto p-0 sm:px-3 sm:py-1.5 bg-white border border-slate-400 hover:border-blue-500 hover:bg-blue-50 hover:text-blue-700 text-slate-700 rounded-xl transition-all duration-200 flex items-center justify-center sm:gap-2 cursor-pointer shadow-xs shrink-0 text-xs sm:text-sm font-medium"
              title={`Base de Datos: ${activeDatabase?.name || 'Base Maestra'}`}
            >
              <Database className="w-[18px] h-[18px] sm:w-4 sm:h-4 shrink-0 text-slate-700 hover:text-blue-700" />
              <span className="hidden sm:inline">Base de Datos</span>
              <ChevronDown size={14} className={`hidden sm:inline transition-transform duration-200 ${headerDbDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            {headerDbDropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setHeaderDbDropdownOpen(false)} />
                <div className="absolute top-full left-0 pt-1 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="bg-white border border-slate-300 rounded-xl shadow-lg min-w-[200px] overflow-hidden py-1">
                    {databases.map(db => (
                      <button
                        key={db.id}
                        onClick={() => {
                          setActiveDatabase(db);
                          setHeaderDbDropdownOpen(false);
                        }}
                        className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-50 transition-colors flex items-center gap-2 ${
                          activeDatabase.id === db.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700'
                        }`}
                      >
                        <Database size={14} />
                        {db.name}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          <button 
            type="button"
            onClick={onSyncPrices}
            disabled={syncing}
            className="w-[34px] h-[34px] sm:w-auto sm:h-auto p-0 sm:px-3 sm:py-1.5 bg-white border border-slate-400 hover:border-blue-500 hover:bg-blue-50 hover:text-blue-700 text-slate-700 rounded-xl transition-all duration-200 flex items-center justify-center sm:gap-2 cursor-pointer shadow-xs shrink-0 text-xs sm:text-sm font-medium"
            title="Actualizar Precios"
          >
            <RefreshCw size={17} className={`shrink-0 ${syncing ? 'animate-spin text-blue-600' : ''}`} />
            <span className="hidden sm:inline">{syncing ? 'Actualizando...' : 'Actualizar Precios'}</span>
          </button>

          {onOpenControlObra && (
            <button
              type="button"
              onClick={onOpenControlObra}
              className="w-[34px] h-[34px] sm:w-auto sm:h-auto p-0 sm:px-3 sm:py-1.5 bg-white border border-blue-400 hover:border-blue-600 hover:bg-blue-50 text-blue-700 rounded-xl transition-all duration-200 flex items-center justify-center sm:gap-2 cursor-pointer shadow-xs shrink-0 text-xs sm:text-sm font-medium"
              title="Control de Obra"
            >
              <Activity size={17} className="shrink-0" />
              <span className="hidden sm:inline">Control de Obra</span>
            </button>
          )}

          <button 
            onClick={() => setShowSettings(!showSettings)}
            className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-400 hover:border-blue-500 hover:bg-blue-50 hover:text-blue-700 text-slate-700 rounded-xl transition-all duration-200 font-medium text-sm cursor-pointer shadow-xs"
          >
            <Settings size={16} /> Configuración Global
          </button>

          <button 
            onClick={() => setShowPrintModal(true)}
            className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-400 hover:border-blue-500 hover:bg-blue-50 hover:text-blue-700 text-slate-700 rounded-xl transition-all duration-200 font-medium text-sm cursor-pointer shadow-xs"
          >
            <Printer size={16} /> Imprimir
          </button>
        </div>,
        headerPortalTarget
      )}
    </>
  );
}
