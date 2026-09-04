import React, { useState, useEffect, useRef, useContext } from 'react';
import { Search, X, Wrench, Check, Loader2, Database, ChevronDown, RefreshCw } from 'lucide-react';
import { API_URL } from '../services/api';
import { useDatabaseContext } from '../contexts/DatabaseContext';

export default function EquipmentSelectorModal({
  isOpen,
  onClose,
  onSelect,
  targetRow = null
}) {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [skip, setSkip] = useState(0);
  const [dbDropdownOpen, setDbDropdownOpen] = useState(false);
  const searchInputRef = useRef(null);

  // Safe database context retrieval
  let dbContext = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    dbContext = useDatabaseContext();
  } catch (err) {
    dbContext = null;
  }

  const activeDatabase = dbContext?.activeDatabase || { id: 'master', name: 'Base Maestra' };
  const databases = dbContext?.databases || [{ id: 'master', name: 'Base Maestra' }];
  const setActiveDatabase = dbContext?.setActiveDatabase || (() => {});

  const LIMIT = 50;

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSkip(0);
      fetchEquipments('', 0, false);
      setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }, 100);
    } else {
      setItems([]);
      setTotal(0);
    }
  }, [isOpen, activeDatabase?.id]);

  // Debounced search when query changes
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      setSkip(0);
      fetchEquipments(query, 0, false);
    }, 280);

    return () => clearTimeout(timer);
  }, [query]);

  const fetchEquipments = async (searchStr, currentSkip, isAppend = false) => {
    if (isAppend) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    try {
      const dbParam = activeDatabase?.id ? `&database_id=${encodeURIComponent(activeDatabase.id)}` : '';
      const url = `${API_URL}/cost360/equipments?search=${encodeURIComponent(searchStr.trim())}&skip=${currentSkip}&limit=${LIMIT}${dbParam}`;
      const response = await fetch(url, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Error al cargar equipos');
      }

      const data = await response.json();
      const newItems = Array.isArray(data) ? data : (data.items || []);
      const totalCount = Array.isArray(data) ? data.length : (data.total || newItems.length);

      setTotal(totalCount);
      if (isAppend) {
        setItems(prev => [...prev, ...newItems]);
      } else {
        setItems(newItems);
      }
    } catch (error) {
      console.error('Error fetching equipments:', error);
      if (!isAppend) setItems([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleLoadMore = () => {
    const nextSkip = skip + LIMIT;
    setSkip(nextSkip);
    fetchEquipments(query, nextSkip, true);
  };

  const handleSelectItem = (eq) => {
    const selectedData = {
      codigo: eq.CodEqu || '',
      descripcion: eq.Descri || '',
      precio_unitario: Number(eq.CosDia || 0),
      depreciacion: 1.0,
      cantidad: 1,
      unidad: 'Día'
    };

    if (onSelect) {
      onSelect(selectedData);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[88vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* MODAL HEADER */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shadow-sm">
              <Wrench size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-800 text-base">Catálogo de Equipos</h3>
                <span className="text-[11px] font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                  {total.toLocaleString()} {total === 1 ? 'equipo' : 'equipos'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {targetRow ? (
                  <span>
                    Selecciona un equipo para asignar a la fila <strong className="text-slate-700 font-mono">[{targetRow.codigo || 'Nueva'}]</strong>
                  </span>
                ) : (
                  'Selecciona un equipo del catálogo para incluirlo en el análisis de precios'
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Database Selector Dropdown */}
            {databases.length > 1 && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setDbDropdownOpen(!dbDropdownOpen)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 text-xs font-medium shadow-sm transition-colors"
                >
                  <Database size={13} className="text-slate-500" />
                  <span>{activeDatabase.name}</span>
                  <ChevronDown size={12} className={dbDropdownOpen ? 'rotate-180 transition-transform' : 'transition-transform'} />
                </button>
                {dbDropdownOpen && (
                  <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-20 min-w-[170px] overflow-hidden py-1">
                    {databases.map(db => (
                      <button
                        key={db.id}
                        type="button"
                        onClick={() => {
                          setActiveDatabase(db);
                          setDbDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-50 transition-colors flex items-center gap-2 ${
                          activeDatabase.id === db.id ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-700'
                        }`}
                      >
                        <Database size={12} />
                        {db.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
              title="Cerrar modal"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* SEARCH BAR */}
        <div className="p-4 bg-white border-b border-slate-100">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
            <input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por código (ej: CPT, ALB, CAM) o descripción del equipo..."
              className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 rounded-xl pl-10 pr-10 py-2.5 text-xs text-slate-800 placeholder:text-slate-400 font-medium transition-all focus:outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                title="Limpiar búsqueda"
              >
                <X size={15} />
              </button>
            )}
          </div>
        </div>

        {/* TABLE CONTENT */}
        <div className="flex-1 overflow-y-auto min-h-0 bg-slate-50/50">
          {loading && items.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-2.5">
              <Loader2 size={32} className="animate-spin text-indigo-600" />
              <p className="text-xs font-semibold text-slate-600">Cargando catálogo de equipos...</p>
            </div>
          ) : items.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400 text-center px-4">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-2">
                <Search size={22} />
              </div>
              <p className="text-sm font-bold text-slate-700">No se encontraron equipos</p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                No hay coincidencias con "{query}". Prueba con otra palabra clave o código de referencia.
              </p>
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="mt-3 text-xs font-bold text-indigo-600 hover:underline"
                >
                  Restablecer búsqueda
                </button>
              )}
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 text-slate-600 uppercase font-bold sticky top-0 border-b border-slate-200 z-10 shadow-sm text-[11px]">
                <tr>
                  <th className="py-2.5 px-4 w-28">Ref. / Código</th>
                  <th className="py-2.5 px-4">Descripción del Equipo</th>
                  <th className="py-2.5 px-4 w-32 text-right">Tarifa / Día ($)</th>
                  <th className="py-2.5 px-4 w-28 text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {items.map((eq, idx) => (
                  <tr
                    key={eq.CodEqu || idx}
                    onDoubleClick={() => handleSelectItem(eq)}
                    className="hover:bg-indigo-50/60 transition-colors cursor-pointer group"
                  >
                    <td className="py-2.5 px-4 font-mono font-bold text-indigo-700 whitespace-nowrap">
                      <span className="bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded">
                        {eq.CodEqu}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 font-medium text-slate-700 leading-relaxed">
                      {eq.Descri}
                    </td>
                    <td className="py-2.5 px-4 text-right font-bold text-slate-800 whitespace-nowrap">
                      {(eq.CosDia || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-2.5 px-4 text-center whitespace-nowrap">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectItem(eq);
                        }}
                        className="inline-flex items-center justify-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] px-3 py-1 rounded-lg shadow-sm transition-all active:scale-95 group-hover:shadow"
                      >
                        <Check size={12} />
                        Seleccionar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* LOAD MORE BUTTON */}
          {items.length > 0 && items.length < total && (
            <div className="p-4 text-center bg-white border-t border-slate-100">
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors shadow-sm disabled:opacity-50"
              >
                {loadingMore ? (
                  <>
                    <RefreshCw size={13} className="animate-spin text-indigo-600" />
                    Cargando más equipos...
                  </>
                ) : (
                  <>
                    <span>Cargar más equipos</span>
                    <span className="text-[10px] text-slate-500 font-normal">
                      ({items.length} de {total})
                    </span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span className="text-[11px]">
            💡 Puedes hacer doble clic en cualquier fila para seleccionarla al instante.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}