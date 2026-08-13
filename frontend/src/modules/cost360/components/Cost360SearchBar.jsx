import React, { useState, useEffect } from 'react';
import { FiSearch } from 'react-icons/fi';
import { Loader } from 'lucide-react';
import coveninTreeData from '../data/covenin_tree.json';

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

  // Sincronizar el prefijo hacia el padre
  useEffect(() => {
    const currentPrefix = selectedPartida || selectedSubcapitulo || selectedCapitulo || selectedTipoObra || '';
    if (setSearchCovenin) {
       setSearchCovenin(currentPrefix);
    }
  }, [selectedTipoObra, selectedCapitulo, selectedSubcapitulo, selectedPartida, setSearchCovenin]);

  const currentSub = coveninTree.find(c => c.code === selectedTipoObra)?.children?.find(c => c.code === selectedCapitulo)?.children?.find(c => c.code === selectedSubcapitulo);
  const hasFourthLevel = currentSub?.children?.length > 0;

  return (
    <div className="flex flex-col gap-3">
      {/* Filtros COVENIN */}
      <div className="flex flex-col md:flex-row gap-4 mb-2">
        <div className="flex-1">
          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tipo de Obra</label>
          <select 
            value={selectedTipoObra}
            onChange={(e) => {
              setSelectedTipoObra(e.target.value);
              setSelectedCapitulo('');
              setSelectedSubcapitulo('');
              setSelectedPartida('');
            }}
            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
          >
            <option value="">Todos los Tipos...</option>
            {coveninTree.map(cat => (
              <option key={cat.code} value={cat.code}>{cat.code} - {cat.name}</option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Capítulo</label>
          <select 
            value={selectedCapitulo}
            onChange={(e) => {
              setSelectedCapitulo(e.target.value);
              setSelectedSubcapitulo('');
              setSelectedPartida('');
            }}
            disabled={!selectedTipoObra}
            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 disabled:opacity-50"
          >
            <option value="">Todos los Capítulos...</option>
            {selectedTipoObra && coveninTree.find(c => c.code === selectedTipoObra)?.children?.map(cap => (
              <option key={cap.code} value={cap.code}>{cap.code} - {cap.name}</option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Subcapítulo</label>
          <select 
            value={selectedSubcapitulo}
            onChange={(e) => {
              setSelectedSubcapitulo(e.target.value);
              setSelectedPartida('');
            }}
            disabled={!selectedCapitulo}
            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 disabled:opacity-50"
          >
            <option value="">Todos los Subcapítulos...</option>
            {selectedCapitulo && coveninTree.find(c => c.code === selectedTipoObra)?.children?.find(c => c.code === selectedCapitulo)?.children?.map(sub => (
              <option key={sub.code} value={sub.code}>{sub.code} - {sub.name}</option>
            ))}
          </select>
        </div>
        
        <div className="flex-1">
          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Partida Base</label>
          <select 
            value={selectedPartida}
            onChange={(e) => setSelectedPartida(e.target.value)}
            disabled={!selectedSubcapitulo || !hasFourthLevel}
            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 disabled:opacity-50"
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

      {/* Barra de Búsqueda Principal */}
      <form onSubmit={(e) => { e.preventDefault(); if(onSearch) onSearch(); }} className="flex flex-col sm:flex-row gap-3">
        <div className="relative w-full sm:w-48 shrink-0">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <FiSearch className="text-slate-400 text-base" />
          </div>
          <input
            type="text"
            className="block w-full pl-11 pr-4 py-3 rounded-xl text-sm text-slate-800 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all font-medium"
            style={{
              background: 'rgba(255,255,255,0.8)',
              border: '1px solid rgba(148,163,255,0.35)',
              boxShadow: 'inset 0 1px 4px rgba(80,100,200,0.06)',
            }}
            placeholder="Cód. COVENIN"
            value={searchCovenin}
            onChange={(e) => setSearchCovenin(e.target.value)}
          />
        </div>

        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <FiSearch className="text-slate-400 text-base" />
          </div>
          <input
            type="text"
            className="block w-full pl-11 pr-4 py-3 rounded-xl text-sm text-slate-800 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all font-medium"
            style={{
              background: 'rgba(255,255,255,0.8)',
              border: '1px solid rgba(148,163,255,0.35)',
              boxShadow: 'inset 0 1px 4px rgba(80,100,200,0.06)',
            }}
            placeholder="Buscar partida por código o descripción..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {isSearching && (
            <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-blue-500">
               <Loader className="animate-spin" size={16} />
            </div>
          )}
        </div>
      </form>

      {/* Búsqueda Inversa Toggles & Dropdown */}
      <div className="flex flex-wrap items-center gap-4 px-1 mt-1 text-sm">
        <span className="text-slate-600 font-medium">Buscar por:</span>
        
        <label className="flex items-center cursor-pointer gap-2">
          <div className="relative">
            <input type="checkbox" className="sr-only" checked={searchDesc} onChange={(e) => setSearchDesc(e.target.checked)} />
            <div className={`block w-10 h-6 rounded-full transition-colors ${searchDesc ? 'bg-blue-500' : 'bg-slate-300'}`}></div>
            <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${searchDesc ? 'transform translate-x-4' : ''}`}></div>
          </div>
          <span className="text-slate-700 select-none">Título y Código</span>
        </label>

        <label className="flex items-center cursor-pointer gap-2" title="Busca dentro de los Materiales, Equipos y Mano de Obra de las partidas">
          <div className="relative">
            <input type="checkbox" className="sr-only" checked={searchInsumos} onChange={(e) => setSearchInsumos(e.target.checked)} />
            <div className={`block w-10 h-6 rounded-full transition-colors ${searchInsumos ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
            <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${searchInsumos ? 'transform translate-x-4' : ''}`}></div>
          </div>
          <span className="text-slate-700 select-none">Materiales</span>
        </label>
      </div>
    </div>
  );
};

export default Cost360SearchBar;
