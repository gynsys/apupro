import React from 'react';
import Cost360SearchBar from '../Cost360SearchBar';

export default function ImportFromDbPanel({
  selectedDatabase,
  setSelectedDatabase,
  databases = [],
  searchProps,
  totalMatches = 0,
  searchResults = [],
  onImportApu
}) {
  const {
    searchQuery,
    setSearchQuery,
    searchCovenin,
    setSearchCovenin,
    searchDesc,
    setSearchDesc,
    searchInsumos,
    setSearchInsumos,
    isSearching,
    triggerSearch
  } = searchProps;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-8 animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="rounded-2xl p-4 flex flex-col gap-3" style={{ background: 'rgba(248, 250, 252, 0.5)' }}>
        {/* Database Selector Row */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
          <div className="w-full sm:w-auto">
            <label className="block text-xs font-bold text-slate-500 mb-1">Explora las Bases de Datos, Insumos, Materiales o Personal</label>
            <select
              value={selectedDatabase}
              onChange={(e) => setSelectedDatabase(e.target.value)}
              className="block w-full sm:w-64 px-4 py-2.5 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all appearance-none font-medium bg-white/60 border border-indigo-200/50 shadow-sm"
              style={{
                backgroundImage: 'url("data:image/svg+xml,%3csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 20 20\'%3e%3cpath stroke=\'%236b7280\' stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'1.5\' d=\'M6 8l4 4 4-4\'/%3e%3c/svg%3e")',
                backgroundPosition: 'right 0.75rem center',
                backgroundRepeat: 'no-repeat',
                backgroundSize: '1.2em 1.2em',
                paddingRight: '2.5rem',
              }}
            >
              <option value="master">Base Maestra (Defecto)</option>
              {databases.map(db => (
                <option key={db.id} value={db.id}>{db.name}</option>
              ))}
            </select>
          </div>
        </div>
        
        <Cost360SearchBar
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          searchCovenin={searchCovenin}
          setSearchCovenin={setSearchCovenin}
          searchDesc={searchDesc}
          setSearchDesc={setSearchDesc}
          searchInsumos={searchInsumos}
          setSearchInsumos={setSearchInsumos}
          isSearching={isSearching}
          onSearch={triggerSearch}
          hideSearchButton={false}
        />
      </div>

      <div className="mt-2 text-xs text-slate-500 font-medium">
        <span className="font-bold text-slate-700">
          {totalMatches > 0 ? new Intl.NumberFormat('es-VE').format(totalMatches) : 0}
        </span>{' '}
        {searchQuery || searchCovenin ? (totalMatches === 1 ? 'coincidencia' : 'coincidencias') : (totalMatches === 1 ? 'Partida' : 'Partidas')}
      </div>

      {searchResults.length > 0 && (
        <div className="mt-4 border border-slate-200 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
          <ul className="divide-y divide-slate-100">
            {searchResults.map((res) => (
              <li key={res.CodPar} className="p-3 hover:bg-slate-50 flex items-center justify-between gap-4 transition-colors">
                <div>
                  <p className="text-sm font-bold text-slate-800 font-mono mb-1">{res.CovPar || res.CodPar}</p>
                  <p className="text-xs text-slate-600 line-clamp-1">{res.Descri}</p>
                </div>
                <button
                  onClick={() => onImportApu && onImportApu(res.CodPar)}
                  className="px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-bold rounded-lg hover:bg-blue-100 shrink-0 transition-colors cursor-pointer"
                >
                  Usar como base
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
