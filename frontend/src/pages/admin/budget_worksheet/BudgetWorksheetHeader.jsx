import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Settings, Printer, RefreshCw, Database, ChevronDown } from 'lucide-react';
import { useDatabaseContext } from '../../../contexts/DatabaseContext';

export default function BudgetWorksheetHeader({
  budget,
  syncing,
  onSyncPrices,
  showSettings,
  setShowSettings,
  setShowPrintModal,
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
              className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-400 hover:border-blue-500 hover:bg-blue-50 hover:text-blue-700 text-slate-700 rounded-xl transition-all duration-200 font-medium text-sm cursor-pointer shadow-xs"
            >
              <Database size={16} />
              Base de Datos
              <ChevronDown size={14} className={headerDbDropdownOpen ? 'rotate-180 transition-transform duration-200' : 'transition-transform duration-200'} />
            </button>
            {headerDbDropdownOpen && (
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
            )}
          </div>

          <button 
            onClick={onSyncPrices}
            disabled={syncing}
            className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-400 hover:border-blue-500 hover:bg-blue-50 hover:text-blue-700 text-slate-700 rounded-xl transition-all duration-200 font-medium text-sm cursor-pointer shadow-xs"
          >
            <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Actualizando...' : 'Actualizar Precios'}
          </button>

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
