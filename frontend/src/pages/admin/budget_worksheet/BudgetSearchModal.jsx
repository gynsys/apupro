import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, Database, FileText, Sparkles, X, Plus, ChevronDown } from 'lucide-react';
import { CostbaseSearchBar as Cost360SearchBar } from '../../../modules/costbase/components/CostbaseSearchBar';

export default function BudgetSearchModal({
  isOpen,
  onClose,
  activeDatabase,
  setActiveDatabase,
  databases,
  availableBudgets,
  currentBudgetId,
  onOpenAIApuModal,
  searchQuery,
  setSearchQuery,
  searchCovenin,
  setSearchCovenin,
  searchDesc,
  setSearchDesc,
  searchInsumos,
  setSearchInsumos,
  searching,
  searchDatabase,
  totalSearchResults,
  searchResults,
  hasMoreSearchResults,
  loadMoreSearchResults,
  onAddItem,
}) {
  const [modalDbDropdownOpen, setModalDbDropdownOpen] = useState(false);
  const [modalBudgetDropdownOpen, setModalBudgetDropdownOpen] = useState(false);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-start justify-center p-0 sm:p-4 sm:pt-20">
      <div className="w-full h-full sm:h-[80vh] sm:max-w-4xl bg-amber-100 rounded-none sm:rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.08)] overflow-hidden font-sans flex flex-col animate-in fade-in zoom-in-95 duration-200">
        <div className="flex flex-wrap sm:flex-nowrap justify-between items-center px-4 sm:px-6 py-3 sm:py-4 bg-white/40 border-b border-amber-600/15 gap-2">
          <div className="flex flex-wrap items-center gap-2 sm:gap-4">
            <h2 className="m-0 text-lg sm:text-xl font-bold text-amber-900 flex items-center gap-2">
              <Search className="text-sky-600" size={20} /> Buscar Partidas
            </h2>
            
            <div className="flex gap-2">
              {/* Dropdown Base de Datos */}
              <div 
                className="relative"
                onMouseEnter={() => setModalDbDropdownOpen(true)}
                onMouseLeave={() => setModalDbDropdownOpen(false)}
              >
                <button
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors font-medium shadow-sm text-xs sm:text-sm cursor-pointer"
                >
                  <Database size={14} />
                  <span className="max-w-[100px] truncate">{activeDatabase?.name || 'Base de Datos'}</span>
                  <ChevronDown size={14} className={modalDbDropdownOpen ? 'rotate-180 transition-transform duration-200' : 'transition-transform duration-200'} />
                </button>
                {modalDbDropdownOpen && (
                  <div className="absolute top-full left-0 pt-1 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="bg-white border border-slate-200 rounded-lg shadow-xl min-w-[200px] overflow-hidden py-1">
                      {databases.map(db => (
                        <button
                          key={db.id}
                          onClick={() => {
                            setActiveDatabase(db);
                            setSearchQuery('');
                            setSearchCovenin('');
                            setModalDbDropdownOpen(false);
                          }}
                          className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-50 transition-colors flex items-center gap-2 cursor-pointer ${
                            activeDatabase?.id === db.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700'
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

              {/* Dropdown Presupuestos */}
              <div 
                className="relative"
                onMouseEnter={() => setModalBudgetDropdownOpen(true)}
                onMouseLeave={() => setModalBudgetDropdownOpen(false)}
              >
                <button
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors font-medium shadow-sm text-xs sm:text-sm cursor-pointer"
                >
                  <FileText size={14} />
                  Presupuestos
                  <ChevronDown size={14} className={modalBudgetDropdownOpen ? 'rotate-180 transition-transform duration-200' : 'transition-transform duration-200'} />
                </button>
                {modalBudgetDropdownOpen && (
                  <div className="absolute top-full left-0 pt-1 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="bg-white border border-slate-200 rounded-lg shadow-xl min-w-[200px] overflow-hidden py-1 max-h-60 overflow-y-auto">
                      {availableBudgets.filter(b => b.id !== currentBudgetId).map(b => (
                        <button
                          key={b.id}
                          onClick={() => {
                            setActiveDatabase({ id: 'budget_' + b.id, name: b.name, is_budget: true });
                            setSearchQuery('');
                            setSearchCovenin('');
                            setModalBudgetDropdownOpen(false);
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2 cursor-pointer"
                        >
                          <FileText size={14} className="text-slate-400" />
                          <span className="truncate">{b.name}</span>
                        </button>
                      ))}
                      {availableBudgets.length <= 1 && (
                        <div className="px-4 py-3 text-sm text-slate-500 italic text-center">
                          No hay otros presupuestos
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Botón Desde IA */}
              <button
                onClick={() => {
                  onClose();
                  onOpenAIApuModal();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 rounded-xl transition-colors font-semibold shadow-sm text-xs sm:text-sm cursor-pointer"
                title="Crear APU con Inteligencia Artificial e insertar directamente al presupuesto"
              >
                <Sparkles size={14} className="text-purple-600" />
                <span>Desde IA</span>
              </button>
            </div>
          </div>
          <button 
            onClick={() => {
              setSearchQuery('');
              setSearchCovenin('');
              onClose();
            }}
            className="text-amber-700 hover:text-amber-900 bg-transparent transition-colors p-1.5 rounded-lg hover:bg-amber-200/50 cursor-pointer"
          >
            <X size={22} />
          </button>
        </div>
        
        {!activeDatabase?.is_budget && (
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-amber-600/15 bg-white/40">
            <Cost360SearchBar
              key={activeDatabase?.id}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              searchCovenin={searchCovenin}
              setSearchCovenin={setSearchCovenin}
              searchDesc={searchDesc}
              setSearchDesc={setSearchDesc}
              searchInsumos={searchInsumos}
              setSearchInsumos={setSearchInsumos}
              isSearching={searching}
              onSearch={searchDatabase}
            />

            {totalSearchResults > 0 && (
              <p className="mt-2 text-xs text-slate-500 font-medium">
                <span className="font-bold text-slate-700">{new Intl.NumberFormat('es-VE').format(totalSearchResults)}</span>{' '}
                {(searchQuery || searchCovenin) ? (totalSearchResults === 1 ? 'coincidencia' : 'coincidencias') : (totalSearchResults === 1 ? 'Partida' : 'Partidas')}
              </p>
            )}
          </div>
        )}

        <div className="overflow-y-auto p-3 sm:p-4 flex-1 bg-white/20">
          {searchResults.length === 0 && !searching ? (
            <div className="text-center py-12 text-amber-700/70 text-sm font-medium">
              No se encontraron partidas.
            </div>
          ) : (
            <div className="space-y-2.5 sm:space-y-3">
              {searchResults.map(item => (
                <div 
                  key={item.CodPar}
                  className="bg-white/80 border border-amber-600/10 rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row gap-2.5 sm:gap-4 hover:border-sky-300 hover:shadow-md transition-all items-start sm:items-center justify-between"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-[11px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                        {item.CovPar || item.CodPar}
                      </span>
                      <span className="text-[11px] font-semibold text-sky-700 bg-sky-100 px-2 py-0.5 rounded">
                        UND: {item.UniPar}
                      </span>
                    </div>
                    <p className="text-xs sm:text-[13px] text-amber-950 line-clamp-2 leading-relaxed m-0">
                      {item.Descri}
                    </p>
                  </div>
                  <button 
                    onClick={() => onAddItem(item)}
                    className="w-full sm:w-auto shrink-0 flex items-center justify-center gap-1.5 bg-transparent border border-sky-200 hover:border-sky-500 hover:bg-sky-50 text-sky-700 px-4 py-2 sm:py-1.5 rounded-lg font-semibold transition-colors text-xs active:scale-95 cursor-pointer"
                  >
                    <Plus size={14} /> Incluir
                  </button>
                </div>
              ))}
            </div>
          )}
          
          {hasMoreSearchResults && !searching && (
            <div className="text-center pt-4">
              <button
                onClick={() => loadMoreSearchResults()}
                className="bg-sky-600 hover:bg-sky-700 text-white px-6 py-2 rounded-xl text-sm font-semibold shadow-[0_4px_6px_rgba(2,132,199,0.2)] transition-all hover:-translate-y-[1px] cursor-pointer"
              >
                Cargar más...
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
