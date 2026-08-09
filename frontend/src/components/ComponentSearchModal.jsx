import React, { useState, useEffect } from 'react';
import { X, Plus, Loader2, ChevronDown, Database } from 'lucide-react';
import { budgetService } from '../services/budgetService';
import { useDatabaseContext } from '../contexts/DatabaseContext';
import Cost360SearchBar from '../modules/cost360/components/Cost360SearchBar';

const DatabaseIcon = Database;

export default function ComponentSearchModal({ isOpen, onClose, onAdd, type, title }) {
  const [query, setQuery] = useState('');
  const [searchCovenin, setSearchCovenin] = useState('');
  const [searchChapter, setSearchChapter] = useState('');
  const [searchDesc, setSearchDesc] = useState(true);
  const [searchInsumos, setSearchInsumos] = useState(false);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dbDropdownOpen, setDbDropdownOpen] = useState(false);
  const { activeDatabase, setActiveDatabase, databases } = useDatabaseContext();

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSearchCovenin('');
      setSearchChapter('');
      setResults([]);
    }
  }, [isOpen, type]);

  if (!isOpen) return null;

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim() && !searchCovenin.trim()) return;
    
    try {
      setLoading(true);
      const data = await budgetService.searchComponents(type, query, activeDatabase.id, searchCovenin, searchChapter, searchDesc, searchInsumos);
      setResults(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const mapComponentData = (item) => {
    // Depending on type, map the Cost360 model fields to APU component fields
    if (type === 'materials') {
      return {
        codigo: item.CodMat,
        descripcion: item.Descri,
        unidad: item.UniMat || 'UND',
        cantidad: 1,
        precio_unitario: item.CosMat || 0
      };
    } else if (type === 'equipments') {
      return {
        codigo: item.CodEqu,
        descripcion: item.Descri,
        unidad: 'Día',
        cantidad: 1,
        precio_unitario: item.CosDia || 0
      };
    } else if (type === 'labors') {
      return {
        codigo: item.CodMan,
        descripcion: item.Descri,
        cantidad: 1,
        jornal: item.Jornal || 0,
        bono: item.Bono || 0
      };
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div className="flex items-center gap-4">
            <h2 className="font-bold text-slate-800">{title}</h2>
            {/* Database Selector */}
            <div className="relative">
              <button
                onClick={() => setDbDropdownOpen(!dbDropdownOpen)}
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
              >
                <DatabaseIcon size={16} />
                {activeDatabase.name}
                <ChevronDown size={14} className={dbDropdownOpen ? 'rotate-180' : ''} />
              </button>
              {dbDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10 min-w-[180px]">
                  {databases.map(db => (
                    <button
                      key={db.id}
                      onClick={() => {
                        setActiveDatabase(db);
                        setDbDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors ${
                        activeDatabase.id === db.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700'
                      }`}
                    >
                      {db.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-lg transition-colors text-slate-500">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 flex flex-col flex-1 min-h-0">
          <Cost360SearchBar
            searchQuery={query}
            setSearchQuery={setQuery}
            searchCovenin={searchCovenin}
            setSearchCovenin={setSearchCovenin}
            searchChapter={searchChapter}
            setSearchChapter={setSearchChapter}
            searchDesc={searchDesc}
            setSearchDesc={setSearchDesc}
            searchInsumos={searchInsumos}
            setSearchInsumos={setSearchInsumos}
            isSearching={loading}
            onSearch={handleSearch}
          />

          <div className="flex-1 overflow-y-auto border border-slate-200 rounded-xl">
            {results.length === 0 && !loading && query && (
              <div className="p-8 text-center text-slate-400">
                No se encontraron resultados
              </div>
            )}
            {results.length === 0 && !loading && !query && (
              <div className="p-8 text-center text-slate-400">
                Escribe algo para empezar a buscar
              </div>
            )}

            {results.length > 0 && (
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 shadow-sm">
                  <tr>
                    <th className="p-3 font-semibold text-slate-600 text-xs">Código</th>
                    <th className="p-3 font-semibold text-slate-600 text-xs">Descripción</th>
                    <th className="p-3 font-semibold text-slate-600 text-xs text-right">Costo / Tarifa</th>
                    <th className="p-3 font-semibold text-slate-600 text-xs text-center w-16">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {results.map((item, idx) => (
                    <tr 
                      key={idx} 
                      className="hover:bg-blue-50/50 transition-colors cursor-pointer group"
                      onDoubleClick={() => onAdd(mapComponentData(item))}
                    >
                      <td className="p-3 font-mono text-xs text-slate-500">
                        {item.CodMat || item.CodEqu || item.CodMan}
                      </td>
                      <td className="p-3 text-slate-800">
                        {item.Descri}
                      </td>
                      <td className="p-3 text-right font-semibold text-slate-700">
                        {(item.CosMat || item.CosDia || (item.Jornal + (item.Bono || 0)) || 0).toLocaleString('es-VE', {minimumFractionDigits: 2})}
                      </td>
                      <td className="p-3 text-center">
                        <button 
                          onClick={(e) => { e.stopPropagation(); onAdd(mapComponentData(item)); }}
                          className="bg-blue-100 text-blue-700 hover:bg-blue-600 hover:text-white p-1.5 rounded-lg transition-colors"
                          title="Añadir al APU"
                        >
                          <Plus size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
