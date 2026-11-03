import React, { useState, useEffect, useMemo, useContext } from 'react';
import { FiSearch } from 'react-icons/fi';
import { Loader, X, Layers, ChevronDown, RotateCcw } from 'lucide-react';
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
          className="w-full flex items-center justify-between px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100/60 transition-colors cursor-pointer select-none"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Layers size={14} className={hasCategoryFilter ? 'text-blue-600 shrink-0' : 'text-amber-700 shrink-0'} />
            <span className="font-bold text-slate-800 text-xs sm:text-sm shrink-0">
              Clasificación COVENIN
            </span>
            {hasCategoryFilter ? (
              <span className="bg-blue-100 text-blue-800 text-[10px] sm:text-xs px-2 py-0.5 rounded-full font-semibold truncate max-w-[130px] sm:max-w-[280px]" title={categorySummary}>
                {categorySummary}
              </span>
            ) : (
              <span className="text-[11px] text-slate-400 font-normal hidden sm:inline">
                (Opcional: filtrar por capítulos y subcapítulos)
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
            <div className="flex items-center gap-1 text-slate-500 text-[11px]">
              <span className="hidden sm:inline font-normal">{categoriesOpen ? 'Ocultar' : 'Explorar'}</span>
              <ChevronDown
                size={15}
                className={`transition-transform duration-200 ${categoriesOpen ? 'rotate-180' : ''}`}
              />
            </div>
          </div>
        </button>

        {categoriesOpen && (
          <div className="p-3 border-t border-slate-200 bg-slate-50/70 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 animate-in fade-in duration-150">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Tipo de Obra</label>
              <select 
                value={selectedTipoObra}
                onChange={(e) => {
                  setSelectedTipoObra(e.target.value);
                  setSelectedCapitulo('');
                  setSelectedSubcapitulo('');
                  setSelectedPartida('');
                }}
                className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs transition-colors hover:border-[#324ADD] focus:outline-none focus:border-[#324ADD] focus:ring-2 focus:ring-[#324ADD]/20"
              >
                <option value="">Todos los Tipos...</option>
                {visibleTree.map(cat => (
                  <option key={cat.code} value={cat.code}>{cat.code} - {cat.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Capítulo</label>
              <select 
                value={selectedCapitulo}
                onChange={(e) => {
                  setSelectedCapitulo(e.target.value);
                  setSelectedSubcapitulo('');
                  setSelectedPartida('');
                }}
                disabled={!selectedTipoObra}
                className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs transition-colors hover:border-[#324ADD] focus:outline-none focus:border-[#324ADD] focus:ring-2 focus:ring-[#324ADD]/20 disabled:opacity-50"
              >
                <option value="">Todos los Capítulos...</option>
                {selectedTipoObra && coveninTree.find(c => c.code === selectedTipoObra)?.children?.map(cap => (
                  <option key={cap.code} value={cap.code}>{cap.code} - {cap.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Subcapítulo</label>
              <select 
                value={selectedSubcapitulo}
                onChange={(e) => {
                  setSelectedSubcapitulo(e.target.value);
                  setSelectedPartida('');
                }}
                disabled={!selectedCapitulo}
                className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs transition-colors hover:border-[#324ADD] focus:outline-none focus:border-[#324ADD] focus:ring-2 focus:ring-[#324ADD]/20 disabled:opacity-50"
              >
                <option value="">Todos los Subcapítulos...</option>
                {selectedCapitulo && coveninTree.find(c => c.code === selectedTipoObra)?.children?.find(c => c.code === selectedCapitulo)?.children?.map(sub => (
                  <option key={sub.code} value={sub.code}>{sub.code} - {sub.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Partida Base</label>
              <select 
                value={selectedPartida}
                onChange={(e) => setSelectedPartida(e.target.value)}
                disabled={!selectedSubcapitulo || !hasFourthLevel}
                className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs transition-colors hover:border-[#324ADD] focus:outline-none focus:border-[#324ADD] focus:ring-2 focus:ring-[#324ADD]/20 disabled:opacity-50"
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
        )}
      </div>

      {/* Barra de Búsqueda Principal y Selectores en la misma fila */}
      <form onSubmit={(e) => { e.preventDefault(); if(onSearch) onSearch(); }} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
        <div className="relative w-full sm:w-[150px] shrink-0">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <FiSearch className="text-slate-400 text-sm" />
          </div>
          <input
            type="text"
            className="block w-full pl-9 pr-3 py-2 rounded-xl text-xs placeholder:text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all font-medium"
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
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <FiSearch className="text-slate-400 text-sm" />
          </div>
          <input
            type="text"
            className="block w-full pl-9 pr-8 py-2 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all font-medium"
            style={{
              background: 'rgba(255,255,255,0.85)',
              border: '1.5px solid #cbd5e1',
              boxShadow: 'inset 0 1px 3px rgba(80,100,200,0.05)',
            }}
            placeholder="Ej: excavación a maquina..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center gap-1.5">
            {isSearching && (
              <div className="text-blue-500 pointer-events-none">
                <Loader className="animate-spin" size={15} />
              </div>
            )}
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-200/60 transition-colors"
                title="Limpiar búsqueda"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Búsqueda Inversa Toggles */}
        <div className="flex items-center justify-between sm:justify-start gap-3 shrink-0 px-1 text-xs whitespace-nowrap pt-0.5 sm:pt-0">
          <span className="text-slate-600 font-medium text-xs">Buscar por:</span>
          
          <label className="flex items-center cursor-pointer gap-1.5">
            <div className="relative">
              <input type="checkbox" className="sr-only" checked={searchDesc} onChange={(e) => setSearchDesc(e.target.checked)} />
              <div className={`block w-7 h-[17px] rounded-full transition-colors ${searchDesc ? 'bg-blue-500' : 'bg-slate-300'}`}></div>
              <div className={`absolute left-[2px] top-[2px] bg-white w-[13px] h-[13px] rounded-full transition-transform ${searchDesc ? 'transform translate-x-[11px]' : ''}`}></div>
            </div>
            <span className="text-slate-700 select-none font-medium text-xs">Descripción</span>
          </label>

          <label className="flex items-center cursor-pointer gap-1.5" title="Busca dentro de los Materiales, Equipos y Mano de Obra de las partidas">
            <div className="relative">
              <input type="checkbox" className="sr-only" checked={searchInsumos} onChange={(e) => setSearchInsumos(e.target.checked)} />
              <div className={`block w-7 h-[17px] rounded-full transition-colors ${searchInsumos ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
              <div className={`absolute left-[2px] top-[2px] bg-white w-[13px] h-[13px] rounded-full transition-transform ${searchInsumos ? 'transform translate-x-[11px]' : ''}`}></div>
            </div>
            <span className="text-slate-700 select-none font-medium text-xs">Materiales</span>
          </label>
        </div>
      </form>
    </div>
  );
};

export const CostbaseSearchBar = Cost360SearchBar;
export default CostbaseSearchBar;
