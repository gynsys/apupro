import React from 'react';
import { FiSearch } from 'react-icons/fi';
import { Loader } from 'lucide-react';

const Cost360SearchBar = ({
  searchQuery,
  setSearchQuery,
  searchCovenin,
  setSearchCovenin,
  searchChapter,
  setSearchChapter,
  searchDesc,
  setSearchDesc,
  searchInsumos,
  setSearchInsumos,
  isSearching,
  onSearch,
  hideSearchButton = false
}) => {
  return (
    <div className="flex flex-col gap-3">
      {/* Barra de Búsqueda Principal */}
      <form onSubmit={(e) => { e.preventDefault(); onSearch(); }} className="flex flex-col sm:flex-row gap-3">
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
            placeholder="Buscar partida por código (ej. E01) o descripción..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {!hideSearchButton && (
          <button
            type="submit"
            disabled={isSearching}
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSearching ? <Loader className="animate-spin" size={16} /> : null}
            Filtrar
          </button>
        )}
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

        <div className="sm:w-56 ml-auto">
          <select
            value={searchChapter}
            onChange={(e) => setSearchChapter(e.target.value)}
            className="block w-full px-4 py-2 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all appearance-none"
            style={{
              background: 'rgba(255,255,255,0.5)',
              border: '1px solid rgba(148,163,255,0.25)',
              backgroundImage: 'url("data:image/svg+xml,%3csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 20 20\'%3e%3cpath stroke=\'%236b7280\' stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'1.5\' d=\'M6 8l4 4 4-4\'/%3e%3c/svg%3e")',
              backgroundPosition: 'right 0.5rem center',
              backgroundRepeat: 'no-repeat',
              backgroundSize: '1.5em 1.5em',
              paddingRight: '2.5rem',
            }}
          >
            <option value="">Todas las Categorías</option>
            <option value="E">Edificaciones (E)</option>
            <option value="I">Instalaciones (I)</option>
            <option value="C">Vialidad (C)</option>
            <option value="V">Vivienda (V)</option>
            <option value="U">Urbanismo (U)</option>
            <option value="M">Mantenimiento (M)</option>
          </select>
        </div>
      </div>
    </div>
  );
};

export default Cost360SearchBar;
