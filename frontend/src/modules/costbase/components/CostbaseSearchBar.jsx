import React, { useState, useEffect, useMemo, useContext } from 'react';
import { FiSearch } from 'react-icons/fi';
import { Loader, X, Layers, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import coveninTreeData from '../data/covenin_tree.json';
import { SiteConfigContext } from '../../../App';

const Cost360SearchBar = ({
  searchQuery,
  setSearchQuery,
  searchCovenin,
  setSearchCovenin,
  searchDesc,
  setSearchDesc,
  searchInsumos,
  setSearchInsumos,
  isSearching,
  onSearch,
  hideSearchButton = false
}) => {
  const [coveninTree] = useState(coveninTreeData);
  const [selectedTipoObra, setSelectedTipoObra] = useState('');
  const [selectedCapitulo, setSelectedCapitulo] = useState('');
  const [selectedSubcapitulo, setSelectedSubcapitulo] = useState('');
  const [selectedPartida, setSelectedPartida] = useState('');
  const [categoriesOpen, setCategoriesOpen] = useState(false);

  const configContext = useContext(SiteConfigContext);
  const hiddenCategories = configContext?.config?.hiddenCategories || [];
  
  // Filtrar el árbol principal para ocultar las categorías desactivadas
  const visibleTree = useMemo(() => {
    return coveninTree.filter(c => !hiddenCategories.includes(c.code));
  }, [coveninTree, hiddenCategories]);

  // Sincronizar el prefijo hacia el padre
  useEffect(() => {
    const currentPrefix = selectedPartida || selectedSubcapitulo || selectedCapitulo || selectedTipoObra || '';
    if (setSearchCovenin) {
       setSearchCovenin(currentPrefix);
    }
  }, [selectedTipoObra, selectedCapitulo, selectedSubcapitulo, selectedPartida, setSearchCovenin]);

  const currentSub = coveninTree.find(c => c.code === selectedTipoObra)?.children?.find(c => c.code === selectedCapitulo)?.children?.find(c => c.code === selectedSubcapitulo);
  const hasFourthLevel = currentSub?.children?.length > 0;

  const hasCategoryFilter = Boolean(selectedTipoObra || selectedCapitulo || selectedSubcapitulo || selectedPartida);

  const handleClearCategories = () => {
    setSelectedTipoObra('');
    setSelectedCapitulo('');
    setSelectedSubcapitulo('');
    setSelectedPartida('');
    if (setSearchCovenin) {
      setSearchCovenin('');
    }
  };

  const categorySummary = useMemo(() => {
    if (selectedPartida) {
      const par = currentSub?.children?.find(p => p.code === selectedPartida);
      return par ? `${selectedPartida} - ${par.name}` : selectedPartida;
    }
    if (selectedSubcapitulo) {
      const sub = coveninTree.find(c => c.code === selectedTipoObra)?.children?.find(c => c.code === selectedCapitulo)?.children?.find(s => s.code === selectedSubcapitulo);
      return sub ? `${selectedSubcapitulo} - ${sub.name}` : selectedSubcapitulo;
    }
    if (selectedCapitulo) {
      const cap = coveninTree.find(c => c.code === selectedTipoObra)?.children?.find(c => c.code === selectedCapitulo);
      return cap ? `${selectedCapitulo} - ${cap.name}` : selectedCapitulo;
    }
    if (selectedTipoObra) {
      const tipo = visibleTree.find(c => c.code === selectedTipoObra);
      return tipo ? `${selectedTipoObra} - ${tipo.name}` : selectedTipoObra;
    }
    return '';
  }, [selectedTipoObra, selectedCapitulo, selectedSubcapitulo, selectedPartida, currentSub, coveninTree, visibleTree]);

  return (
    <div className="flex flex-col gap-2.5">
      {/* Acordeón para Filtros COVENIN (Tipo de Obra, Capítulo, etc.) */}
      <div className="border border-slate-300/80 rounded-xl bg-white/70 overflow-hidden shadow-2xs transition-all">
        <button
          type="button"
          onClick={() => setCategoriesOpen(prev => !prev)}
          className="w-full flex items-center justify-between px-3 sm:px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100/60 transition-colors cursor-pointer select-none"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Layers size={15} className={hasCategoryFilter ? 'text-blue-600 shrink-0' : 'text-amber-700 shrink-0'} />
            <span className="font-bold text-slate-800 text-xs sm:text-sm shrink-0">
              Clasificación COVENIN
            </span>
            {hasCategoryFilter ? (
              <span className="bg-blue-100 text-blue-800 text-[10px] sm:text-xs px-2 py-0.5 rounded-full font-semibold truncate max-w-[130px] sm:max-w-[280px]" title={categorySummary}>
                {categorySummary}
              </span>
            ) : (
              <span className="text-[11px] text-slate-400 font-normal hidden sm:inline">
                (Opcional: filtrar por capítulos)
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0 ml-2">
            {hasCategoryFilter && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  handleClearCategories();
                }}
                className="text-[11px] text-rose-600 hover:text-rose-800 font-bold hover:underline px-1.5 py-0.5 rounded hover:bg-rose-50 flex items-center gap-1 cursor-pointer"
                title="Limpiar filtros de categoría"
              >
                <RotateCcw size={11} />
                <span>Limpiar</span>
              </span>
            )}
            
            {/* Indicador claro y visible de Recoger / Explorar */}
            {categoriesOpen ? (
              <span className="text-[11px] font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 px-2 py-0.5 rounded-lg flex items-center gap-1 transition-colors">
                <ChevronUp size={14} className="text-amber-800" />
                <span>Recoger</span>
              </span>
            ) : (
              <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded-lg flex items-center gap-1 transition-colors">
                <ChevronDown size={14} className="text-slate-500" />
                <span>Explorar</span>
              </span>
            )}
          </div>
        </button>

        {categoriesOpen && (
          <div className="p-3 border-t border-slate-200 bg-slate-50/90 flex flex-col gap-2.5 max-h-[48vh] sm:max-h-none overflow-y-auto overscroll-contain animate-in fade-in duration-150">
            {/* Barra superior de acción rápida para ver partidas inmediatamente en mobile */}
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200">
              <span className="text-[11px] font-bold text-amber-950 truncate">
                {hasCategoryFilter ? categorySummary : 'Selecciona una categoría COVENIN'}
              </span>
              <button
                type="button"
                onClick={() => setCategoriesOpen(false)}
                className="px-3 py-1.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-bold text-xs rounded-xl shadow-xs active:scale-95 transition-all flex items-center gap-1 cursor-pointer shrink-0"
                title="Recoger filtros y explorar listado de partidas"
              >
                <ChevronUp size={14} />
                <span>Ver partidas</span>
              </button>
            </div>

            {/* Los 4 Selectores */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Tipo de Obra</label>
                <select 
                  value={selectedTipoObra}
                  onChange={(e) => {
                    setSelectedTipoObra(e.target.value);
                    setSelectedCapitulo('');
                    setSelectedSubcapitulo('');
                    setSelectedPartida('');
                  }}
                  className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-2 text-xs transition-colors hover:border-[#324ADD] focus:outline-none focus:border-[#324ADD] focus:ring-2 focus:ring-[#324ADD]/20 cursor-pointer"
                >
                  <option value="">Todos los Tipos...</option>
                  {visibleTree.map(cat => (
                    <option key={cat.code} value={cat.code}>{cat.code} - {cat.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Capítulo</label>
                <select 
                  value={selectedCapitulo}
                  onChange={(e) => {
                    setSelectedCapitulo(e.target.value);
                    setSelectedSubcapitulo('');
                    setSelectedPartida('');
                  }}
                  disabled={!selectedTipoObra}
                  className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-2 text-xs transition-colors hover:border-[#324ADD] focus:outline-none focus:border-[#324ADD] focus:ring-2 focus:ring-[#324ADD]/20 disabled:opacity-50 cursor-pointer"
                >
                  <option value="">Todos los Capítulos...</option>
                  {selectedTipoObra && coveninTree.find(c => c.code === selectedTipoObra)?.children?.map(cap => (
                    <option key={cap.code} value={cap.code}>{cap.code} - {cap.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Subcapítulo</label>
                <select 
                  value={selectedSubcapitulo}
                  onChange={(e) => {
                    const nextSub = e.target.value;
                    setSelectedSubcapitulo(nextSub);
                    setSelectedPartida('');
                    if (nextSub) {
                      const subObj = coveninTree.find(c => c.code === selectedTipoObra)?.children?.find(c => c.code === selectedCapitulo)?.children?.find(s => s.code === nextSub);
                      const hasFourth = subObj?.children?.length > 0;
                      // Si no tiene desglose de 4to nivel, auto-recoger para ver partidas inmediatamente
                      if (!hasFourth) {
                        setCategoriesOpen(false);
                      }
                    }
                  }}
                  disabled={!selectedCapitulo}
                  className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-2 text-xs transition-colors hover:border-[#324ADD] focus:outline-none focus:border-[#324ADD] focus:ring-2 focus:ring-[#324ADD]/20 disabled:opacity-50 cursor-pointer"
                >
                  <option value="">Todos los Subcapítulos...</option>
                  {selectedCapitulo && coveninTree.find(c => c.code === selectedTipoObra)?.children?.find(c => c.code === selectedCapitulo)?.children?.map(sub => (
                    <option key={sub.code} value={sub.code}>{sub.code} - {sub.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Partida Base</label>
                <select 
                  value={selectedPartida}
                  onChange={(e) => {
                    setSelectedPartida(e.target.value);
                    if (e.target.value) {
                      // Al seleccionar la partida base terminal, se recoge automáticamente para ver el listado
                      setCategoriesOpen(false);
                    }
                  }}
                  disabled={!selectedSubcapitulo || !hasFourthLevel}
                  className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-2 text-xs transition-colors hover:border-[#324ADD] focus:outline-none focus:border-[#324ADD] focus:ring-2 focus:ring-[#324ADD]/20 disabled:opacity-50 cursor-pointer"
                >
                  {!selectedSubcapitulo ? (
                    <option value="">Selecciona el Subcapítulo...</option>
                  ) : !hasFourthLevel ? (
                    <option value="">No aplica (sin desglose)</option>
                  ) : (
                    <>
                      <option value="">Todas las Partidas...</option>
                      {currentSub.children.map(par => (
                        <option key={par.code} value={par.code}>{par.code} - {par.name}</option>
                      ))}
                    </>
                  )}
                </select>
              </div>
            </div>

            {/* Barra inferior de confirmación y recoger para ganar espacio */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-2 border-t border-slate-200/90">
              <div className="text-[11px] text-slate-600 font-medium truncate">
                {hasCategoryFilter ? (
                  <span className="text-amber-950 font-bold truncate">
                    Filtro activo: {categorySummary}
                  </span>
                ) : (
                  <span className="text-slate-500">Selecciona los niveles o recoge para ver todo</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {hasCategoryFilter && (
                  <button
                    type="button"
                    onClick={handleClearCategories}
                    className="px-3 py-2 text-xs text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl font-bold border border-rose-200 transition-colors flex items-center justify-center gap-1 cursor-pointer shrink-0"
                    title="Limpiar filtros"
                  >
                    <RotateCcw size={12} />
                    <span>Limpiar</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setCategoriesOpen(false)}
                  className="flex-1 sm:flex-none px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  title="Recoger selectores para dejar espacio al listado de partidas"
                >
                  <ChevronUp size={16} />
                  <span>Recoger y ver partidas</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Barra de Búsqueda Principal y Selectores */}
      <form onSubmit={(e) => { e.preventDefault(); if(onSearch) onSearch(); }} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <div className="flex items-center gap-2">
          <div className="relative w-28 sm:w-[150px] shrink-0">
            <div className="absolute inset-y-0 left-0 pl-2.5 sm:pl-3.5 flex items-center pointer-events-none">
              <FiSearch className="text-slate-400 text-xs sm:text-sm" />
            </div>
            <input
              type="text"
              className="block w-full pl-7 sm:pl-9 pr-2 sm:pr-3 py-1.5 sm:py-2 rounded-xl text-xs placeholder:text-[11px] sm:placeholder:text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all font-medium"
              style={{
                background: 'rgba(255,255,255,0.85)',
                border: '1.5px solid #cbd5e1',
                boxShadow: 'inset 0 1px 3px rgba(80,100,200,0.05)',
              }}
              placeholder="Cód. COVENIN"
              value={searchCovenin}
              onChange={(e) => setSearchCovenin(e.target.value)}
            />
          </div>

          <div className="relative flex-1 min-w-0">
            <div className="absolute inset-y-0 left-0 pl-2.5 sm:pl-3.5 flex items-center pointer-events-none">
              <FiSearch className="text-slate-400 text-xs sm:text-sm" />
            </div>
            <input
              type="text"
              className="block w-full pl-7 sm:pl-9 pr-7 sm:pr-8 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all font-medium"
              style={{
                background: 'rgba(255,255,255,0.85)',
                border: '1.5px solid #cbd5e1',
                boxShadow: 'inset 0 1px 3px rgba(80,100,200,0.05)',
              }}
              placeholder="Ej: excavación a maquina..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <div className="absolute inset-y-0 right-0 pr-2 flex items-center gap-1">
              {isSearching && (
                <div className="text-blue-500 pointer-events-none">
                  <Loader className="animate-spin" size={14} />
                </div>
              )}
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-200/60 transition-colors"
                  title="Limpiar búsqueda"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Búsqueda Inversa Toggles */}
        <div className="flex items-center justify-between sm:justify-start gap-3 shrink-0 px-1 text-xs whitespace-nowrap pt-0.5 sm:pt-0">
          <span className="text-slate-600 font-medium text-[11px] sm:text-xs">Buscar por:</span>
          
          <label className="flex items-center cursor-pointer gap-1.5">
            <div className="relative">
              <input type="checkbox" className="sr-only" checked={searchDesc} onChange={(e) => setSearchDesc(e.target.checked)} />
              <div className={`block w-6 h-[15px] sm:w-7 sm:h-[17px] rounded-full transition-colors ${searchDesc ? 'bg-blue-500' : 'bg-slate-300'}`}></div>
              <div className={`absolute left-[2px] top-[2px] bg-white w-[11px] h-[11px] sm:w-[13px] sm:h-[13px] rounded-full transition-transform ${searchDesc ? 'transform translate-x-[9px] sm:translate-x-[11px]' : ''}`}></div>
            </div>
            <span className="text-slate-700 select-none font-medium text-[11px] sm:text-xs">Descripción</span>
          </label>

          <label className="flex items-center cursor-pointer gap-1.5" title="Busca dentro de los Materiales, Equipos y Mano de Obra de las partidas">
            <div className="relative">
              <input type="checkbox" className="sr-only" checked={searchInsumos} onChange={(e) => setSearchInsumos(e.target.checked)} />
              <div className={`block w-6 h-[15px] sm:w-7 sm:h-[17px] rounded-full transition-colors ${searchInsumos ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
              <div className={`absolute left-[2px] top-[2px] bg-white w-[11px] h-[11px] sm:w-[13px] sm:h-[13px] rounded-full transition-transform ${searchInsumos ? 'transform translate-x-[9px] sm:translate-x-[11px]' : ''}`}></div>
            </div>
            <span className="text-slate-700 select-none font-medium text-[11px] sm:text-xs">Materiales</span>
          </label>
        </div>
      </form>
    </div>
  );
};

export const CostbaseSearchBar = Cost360SearchBar;
export default CostbaseSearchBar;
