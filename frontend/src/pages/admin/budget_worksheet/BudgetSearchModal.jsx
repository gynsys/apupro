import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, Database, FileText, Sparkles, X, Plus, ChevronDown, Share2, Menu, Check } from 'lucide-react';
import { CostbaseSearchBar as Cost360SearchBar } from '../../../modules/costbase/components/CostbaseSearchBar';

export default function BudgetSearchModal({
  isOpen,
  onClose,
  activeDatabase,
  setActiveDatabase,
  databases = [],
  availableBudgets = [],
  currentBudgetId,
  onOpenAIApuModal,
  onOpenImportSharedPartida,
  showAiOption = true,
  showSharedOption = true,
  zIndexClass = 'z-50',
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (!isOpen) return null;

  return createPortal(
    <div className={`fixed inset-0 bg-slate-900/50 backdrop-blur-sm ${zIndexClass} flex flex-col sm:flex-row items-center justify-start sm:justify-center p-0 sm:p-4 sm:pt-20`}>
      <div className="w-full h-[100dvh] sm:h-[80vh] sm:max-w-4xl bg-amber-100 rounded-none sm:rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.08)] overflow-hidden font-sans flex flex-col animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header Fila 1: Título con Menú Hamburguesa y Botón Cerrar fijo a la derecha */}
        <div className="relative flex items-center justify-between px-3 sm:px-6 py-2.5 sm:py-3.5 bg-white/80 border-b border-amber-600/15 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {/* Botón Menú Hamburguesa */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(prev => !prev)}
              className="p-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 transition-colors cursor-pointer shrink-0 flex items-center justify-center active:scale-95"
              title="Seleccionar Base de Datos o Presupuesto"
            >
              <Menu size={18} />
            </button>

            <h2 className="m-0 text-sm sm:text-lg font-bold text-amber-900 flex items-center gap-1.5 truncate">
              <Search className="text-sky-600 shrink-0 hidden sm:inline" size={18} />
              <span className="truncate">Buscar Partida</span>
            </h2>

          </div>

          <div className="flex items-center shrink-0 ml-2">

            <button 
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSearchCovenin('');
                onClose();
              }}
              className="text-amber-800 hover:text-amber-950 bg-amber-200/50 hover:bg-amber-200 transition-colors p-1.5 rounded-xl cursor-pointer shrink-0"
              title="Cerrar modal"
            >
              <X size={18} />
            </button>
          </div>

          {/* Menú desplegable hamburguesa (Selectores de Base de Datos y Presupuestos) */}
          {mobileMenuOpen && (
            <>
              <div 
                className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150" 
                onClick={() => setMobileMenuOpen(false)} 
              />
              <div className="absolute top-full left-2 right-2 sm:left-4 sm:right-auto sm:w-80 z-50 bg-white border border-amber-300/90 rounded-2xl shadow-2xl p-3 animate-in fade-in slide-in-from-top-2 duration-200 mt-1">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Database size={14} className="text-amber-700" />
                    Seleccionar Origen
                  </span>
                  <button 
                    type="button"
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
                  >
                    <X size={15} />
                  </button>
                </div>

                {/* Sección 1: Bases de Datos */}
                <div className="mb-3">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Bases de Datos
                  </label>
                  <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                    {databases.map(db => (
                      <button
                        key={db.id}
                        type="button"
                        onClick={() => {
                          setActiveDatabase(db);
                          setSearchQuery('');
                          setSearchCovenin('');
                          setMobileMenuOpen(false);
                        }}
                        className={`w-full text-left px-2.5 py-1.5 rounded-xl text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
                          activeDatabase?.id === db.id 
                            ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200' 
                            : 'text-slate-700 hover:bg-slate-50 border border-transparent'
                        }`}
                      >
                        <span className="flex items-center gap-2 truncate">
                          <Database size={13} className={activeDatabase?.id === db.id ? 'text-blue-600' : 'text-slate-400'} />
                          <span className="truncate">{db.name}</span>
                        </span>
                        {activeDatabase?.id === db.id && (
                          <Check size={14} className="text-blue-600 shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sección 2: Presupuestos */}
                <div className="mb-2">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Copiar de Presupuesto
                  </label>
                  <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                    {availableBudgets.filter(b => b.id !== currentBudgetId).map(b => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => {
                          setActiveDatabase({ id: 'budget_' + b.id, name: b.name, is_budget: true });
                          setSearchQuery('');
                          setSearchCovenin('');
                          setMobileMenuOpen(false);
                        }}
                        className={`w-full text-left px-2.5 py-1.5 rounded-xl text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
                          activeDatabase?.id === 'budget_' + b.id
                            ? 'bg-amber-50 text-amber-900 font-bold border border-amber-300'
                            : 'text-slate-700 hover:bg-slate-50 border border-transparent'
                        }`}
                      >
                        <span className="flex items-center gap-2 truncate">
                          <FileText size={13} className={activeDatabase?.id === 'budget_' + b.id ? 'text-amber-700' : 'text-slate-400'} />
                          <span className="truncate">{b.name}</span>
                        </span>
                        {activeDatabase?.id === 'budget_' + b.id && (
                          <Check size={14} className="text-amber-700 shrink-0" />
                        )}
                      </button>
                    ))}
                    {availableBudgets.length <= 1 && (
                      <div className="text-center py-2 text-xs text-slate-400 italic">
                        No hay otros presupuestos disponibles
                      </div>
                    )}
                  </div>
                </div>

                {/* Opciones Adicionales */}
                <div className="pt-2 border-t border-slate-100 flex flex-col gap-1">
                  {showAiOption && (
                    <button
                      type="button"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        onClose();
                        onOpenAIApuModal?.();
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-xl text-xs font-medium text-purple-700 hover:bg-purple-50 flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <Sparkles size={13} className="text-purple-600" />
                      <span>Crear APU con Inteligencia Artificial</span>
                    </button>
                  )}
                  {showSharedOption && (
                    <button
                      type="button"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        onClose();
                        onOpenImportSharedPartida?.();
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-xl text-xs font-medium text-sky-700 hover:bg-sky-50 flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <Share2 size={13} className="text-sky-600" />
                      <span>Partidas Compartidas de Otro Usuario</span>
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Header Fila 2: Visible en pantallas medianas/grandes (desktop) para acceso directo rápido */}
        <div className="hidden sm:flex px-6 py-2 bg-amber-50/70 border-b border-amber-600/10 items-center gap-2 overflow-visible shrink-0">
          {/* Dropdown Base de Datos Desktop */}
          <div 
            className="relative shrink-0"
            onMouseEnter={() => setModalDbDropdownOpen(true)}
            onMouseLeave={() => setModalDbDropdownOpen(false)}
          >
            <button
              type="button"
              onClick={() => setModalDbDropdownOpen(prev => !prev)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors font-medium shadow-xs text-xs sm:text-sm cursor-pointer whitespace-nowrap"
            >
              <Database size={14} className="text-amber-700 shrink-0" />
              <span className="max-w-[120px] truncate">{activeDatabase?.name || 'Base de Datos'}</span>
              <ChevronDown size={14} className={`shrink-0 transition-transform duration-200 ${modalDbDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            {modalDbDropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setModalDbDropdownOpen(false)} />
                <div className="absolute top-full left-0 pt-1 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="bg-white border border-slate-200 rounded-xl shadow-xl min-w-[210px] overflow-hidden py-1">
                    {databases.map(db => (
                      <button
                        key={db.id}
                        type="button"
                        onClick={() => {
                          setActiveDatabase(db);
                          setSearchQuery('');
                          setSearchCovenin('');
                          setModalDbDropdownOpen(false);
                        }}
                        className={`w-full text-left px-4 py-2 text-xs sm:text-sm hover:bg-slate-50 transition-colors flex items-center gap-2 cursor-pointer ${
                          activeDatabase?.id === db.id ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-700'
                        }`}
                      >
                        <Database size={14} className="shrink-0" />
                        <span className="truncate">{db.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Dropdown Presupuestos Desktop */}
          <div 
            className="relative shrink-0"
            onMouseEnter={() => setModalBudgetDropdownOpen(true)}
            onMouseLeave={() => setModalBudgetDropdownOpen(false)}
          >
            <button
              type="button"
              onClick={() => setModalBudgetDropdownOpen(prev => !prev)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors font-medium shadow-xs text-xs sm:text-sm cursor-pointer whitespace-nowrap"
            >
              <FileText size={14} className="text-slate-500 shrink-0" />
              <span>Presupuestos</span>
              <ChevronDown size={14} className={`shrink-0 transition-transform duration-200 ${modalBudgetDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            {modalBudgetDropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setModalBudgetDropdownOpen(false)} />
                <div className="absolute top-full left-0 pt-1 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="bg-white border border-slate-200 rounded-xl shadow-xl min-w-[210px] overflow-hidden py-1 max-h-60 overflow-y-auto">
                    {availableBudgets.filter(b => b.id !== currentBudgetId).map(b => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => {
                          setActiveDatabase({ id: 'budget_' + b.id, name: b.name, is_budget: true });
                          setSearchQuery('');
                          setSearchCovenin('');
                          setModalBudgetDropdownOpen(false);
                        }}
                        className="w-full text-left px-4 py-2 text-xs sm:text-sm text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2 cursor-pointer"
                      >
                        <FileText size={14} className="text-slate-400 shrink-0" />
                        <span className="truncate">{b.name}</span>
                      </button>
                    ))}
                    {availableBudgets.length <= 1 && (
                      <div className="px-4 py-3 text-xs sm:text-sm text-slate-500 italic text-center">
                        No hay otros presupuestos
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Botón Crear APU con IA Desktop */}
          {showAiOption && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenAIApuModal?.();
              }}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 rounded-xl transition-colors font-semibold shadow-xs text-xs sm:text-sm cursor-pointer whitespace-nowrap"
              title="Crear APU con el generador de Inteligencia Artificial e insertar directamente al presupuesto"
            >
              <Sparkles size={14} className="text-purple-600 shrink-0" />
              <span>Crear con IA</span>
            </button>
          )}

          {/* Botón De Otro Usuario Desktop */}
          {showSharedOption && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenImportSharedPartida?.();
              }}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-700 rounded-xl transition-colors font-semibold shadow-xs text-xs sm:text-sm cursor-pointer whitespace-nowrap"
              title="Importar una partida compartida por otro usuario"
            >
              <Share2 size={14} className="text-sky-600 shrink-0" />
              <span>De Otro Usuario</span>
            </button>
          )}
        </div>
        
        {!activeDatabase?.is_budget && (
          <div className="px-3 sm:px-6 py-2 sm:py-3.5 border-b border-amber-600/15 bg-white/40 shrink-0">
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
              <p className="mt-1.5 text-xs text-slate-500 font-medium">
                <span className="font-bold text-slate-700">{new Intl.NumberFormat('es-VE').format(totalSearchResults)}</span>{' '}
                {(searchQuery || searchCovenin) ? (totalSearchResults === 1 ? 'coincidencia' : 'coincidencias') : (totalSearchResults === 1 ? 'Partida' : 'Partidas')}
              </p>
            )}
          </div>
        )}

        <div className="overflow-y-auto p-3 sm:p-4 flex-1 min-h-0 bg-white/20 overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
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
