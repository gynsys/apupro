import React, { useState, useEffect, useRef } from 'react';
import { 
  Filter, 
  ChevronDown, 
  ArrowDownAZ, 
  ArrowUpZA, 
  ArrowDown01, 
  ArrowUp10, 
  X, 
  Search, 
  RotateCcw,
  Check,
  CheckSquare,
  Square
} from 'lucide-react';

/**
 * Componente de menú desplegable de filtro y ordenamiento estilo Excel para encabezados de tabla.
 */
export default function ExcelFilterDropdown({
  title,
  columnKey,
  type = 'text', // 'text' | 'number' | 'unit' | 'status'
  isOpen,
  onToggle,
  onClose,
  isFiltered = false,
  sortState = null,
  onSort,
  onClearSort,
  onClearFilter,
  // Específico para Unidad
  unitStats = [],
  selectedUnits = new Set(),
  onToggleUnit,
  onSelectAllUnits,
  // Específico para Estado
  statusFilter = 'all',
  onSetStatus,
  statusStats = { pending: 0, completed: 0, total: 0 },
  // Específico para Cantidad
  quantityFilter = 'all',
  onSetQuantity,
  quantityStats = { zero: 0, nonZero: 0, total: 0 },
  // Específico para Texto (código o descripción)
  searchValue = '',
  onSearchChange,
  align = 'left' // 'left' | 'right' | 'center'
}) {
  const dropdownRef = useRef(null);
  const [internalUnitSearch, setInternalUnitSearch] = useState('');

  const isCurrentColSorted = sortState && sortState.column === columnKey;
  const sortDirection = isCurrentColSorted ? sortState.direction : null;

  // Cerrar al hacer clic fuera o pulsar Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        onClose();
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Filtrar lista de unidades si el usuario escribe en el buscador del dropdown
  const filteredUnitStats = unitStats.filter(item => 
    item.unit.toLowerCase().includes(internalUnitSearch.toLowerCase())
  );

  return (
    <div className="relative inline-flex items-center" ref={dropdownRef}>
      {/* Botón de gatillo en el encabezado */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        className={`inline-flex items-center justify-center ml-1.5 p-1 rounded transition-colors cursor-pointer ${
          isFiltered || isCurrentColSorted
            ? 'bg-blue-600 text-white shadow-xs hover:bg-blue-700'
            : 'text-slate-400 hover:text-slate-700 hover:bg-slate-200/70'
        }`}
        title={`Filtro tipo Excel para ${title}`}
      >
        {isFiltered ? (
          <Filter size={13} className="fill-current" />
        ) : isCurrentColSorted ? (
          sortDirection === 'asc' ? (
            type === 'number' ? <ArrowDown01 size={13} /> : <ArrowDownAZ size={13} />
          ) : (
            type === 'number' ? <ArrowUp10 size={13} /> : <ArrowUpZA size={13} />
          )
        ) : (
          <ChevronDown size={13} />
        )}
      </button>

      {/* Popover desplegable estilo Excel */}
      {isOpen && (
        <div 
          onClick={e => e.stopPropagation()}
          className={`absolute top-full mt-2 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 text-slate-800 text-xs w-68 p-2.5 normal-case font-normal select-none animate-in fade-in zoom-in-95 ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {/* Cabecera del Popover */}
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 text-slate-700 font-semibold">
            <span className="flex items-center gap-1.5 text-slate-800">
              <Filter size={13} className="text-blue-600" />
              <span>{title}</span>
            </span>
            <button 
              type="button"
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>

          {/* Sección de Ordenamiento */}
          <div className="py-2 space-y-1">
            {type === 'number' ? (
              <>
                <button
                  type="button"
                  onClick={() => { onSort('asc'); onClose(); }}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs transition-colors cursor-pointer ${
                    isCurrentColSorted && sortDirection === 'asc'
                      ? 'bg-blue-50 text-blue-700 font-semibold'
                      : 'hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  <ArrowDown01 size={14} className="text-slate-500" />
                  <span>Ordenar de menor a mayor</span>
                  {isCurrentColSorted && sortDirection === 'asc' && (
                    <Check size={13} className="ml-auto text-blue-600" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => { onSort('desc'); onClose(); }}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs transition-colors cursor-pointer ${
                    isCurrentColSorted && sortDirection === 'desc'
                      ? 'bg-blue-50 text-blue-700 font-semibold'
                      : 'hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  <ArrowUp10 size={14} className="text-slate-500" />
                  <span>Ordenar de mayor a menor</span>
                  {isCurrentColSorted && sortDirection === 'desc' && (
                    <Check size={13} className="ml-auto text-blue-600" />
                  )}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => { onSort('asc'); onClose(); }}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs transition-colors cursor-pointer ${
                    isCurrentColSorted && sortDirection === 'asc'
                      ? 'bg-blue-50 text-blue-700 font-semibold'
                      : 'hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  <ArrowDownAZ size={14} className="text-slate-500" />
                  <span>Ordenar de A a Z</span>
                  {isCurrentColSorted && sortDirection === 'asc' && (
                    <Check size={13} className="ml-auto text-blue-600" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => { onSort('desc'); onClose(); }}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs transition-colors cursor-pointer ${
                    isCurrentColSorted && sortDirection === 'desc'
                      ? 'bg-blue-50 text-blue-700 font-semibold'
                      : 'hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  <ArrowUpZA size={14} className="text-slate-500" />
                  <span>Ordenar de Z a A</span>
                  {isCurrentColSorted && sortDirection === 'desc' && (
                    <Check size={13} className="ml-auto text-blue-600" />
                  )}
                </button>
              </>
            )}

            {isCurrentColSorted && (
              <button
                type="button"
                onClick={() => { onClearSort(); onClose(); }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs text-amber-700 hover:bg-amber-50 transition-colors cursor-pointer"
              >
                <RotateCcw size={13} />
                <span>Restablecer orden natural</span>
              </button>
            )}
          </div>

          <div className="border-t border-slate-100 my-1" />

          {/* Sección de Filtros Específicos por Columna */}
          <div className="py-1.5">
            {/* Caso 1: Filtro de UNIDAD (con Checkboxes y conteos) */}
            {type === 'unit' && (
              <div className="space-y-2">
                <div className="relative">
                  <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar unidad..."
                    value={internalUnitSearch}
                    onChange={e => setInternalUnitSearch(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-7 pr-2 py-1 text-xs focus:outline-none focus:border-blue-500 focus:bg-white transition-colors"
                  />
                  {internalUnitSearch && (
                    <button 
                      onClick={() => setInternalUnitSearch('')} 
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                <div className="max-h-44 overflow-y-auto space-y-1 pr-1 border border-slate-100 rounded-lg p-1.5 bg-slate-50/50">
                  <label className="flex items-center gap-2 px-1.5 py-1 hover:bg-white rounded cursor-pointer text-slate-800 font-medium text-xs">
                    <input
                      type="checkbox"
                      checked={selectedUnits.size === 0}
                      onChange={onSelectAllUnits}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5 cursor-pointer"
                    />
                    <span>(Seleccionar todo)</span>
                  </label>

                  {filteredUnitStats.map(({ unit, count }) => {
                    const isChecked = selectedUnits.size === 0 || selectedUnits.has(unit);
                    return (
                      <label 
                        key={unit} 
                        className="flex items-center justify-between px-1.5 py-1 hover:bg-white rounded cursor-pointer text-slate-700 text-xs"
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => onToggleUnit(unit)}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5 cursor-pointer"
                          />
                          <span className="font-mono truncate">{unit}</span>
                        </span>
                        <span className="text-[10px] text-slate-400 bg-slate-200/60 px-1.5 py-0.2 rounded-full font-mono">
                          {count}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Caso 2: Filtro de ESTADO (Pendientes vs Completadas) */}
            {type === 'status' && (
              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block px-1 mb-1">
                  Filtrar por estado:
                </span>
                <button
                  type="button"
                  onClick={() => onSetStatus('all')}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-xs transition-colors cursor-pointer ${
                    statusFilter === 'all' ? 'bg-blue-50 text-blue-700 font-semibold' : 'hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  <span>Todas las partidas</span>
                  <span className="text-[10px] text-slate-400 font-mono">({statusStats.total})</span>
                </button>

                <button
                  type="button"
                  onClick={() => onSetStatus('pending')}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-xs transition-colors cursor-pointer ${
                    statusFilter === 'pending' ? 'bg-red-50 text-red-700 font-semibold border border-red-200' : 'hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-red-500 inline-block" />
                    <span>Solo pendientes</span>
                  </span>
                  <span className="text-[10px] font-bold text-red-700 bg-red-100 px-1.5 py-0.2 rounded-full font-mono">
                    {statusStats.pending}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => onSetStatus('completed')}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-xs transition-colors cursor-pointer ${
                    statusFilter === 'completed' ? 'bg-blue-50 text-blue-700 font-semibold' : 'hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-slate-300 inline-block" />
                    <span>Solo completadas</span>
                  </span>
                  <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded-full font-mono">
                    {statusStats.completed}
                  </span>
                </button>
              </div>
            )}

            {/* Caso 3: Filtro de CANTIDAD */}
            {type === 'quantity' && (
              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block px-1 mb-1">
                  Filtrar cantidades:
                </span>
                <button
                  type="button"
                  onClick={() => onSetQuantity('all')}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-xs transition-colors cursor-pointer ${
                    quantityFilter === 'all' ? 'bg-blue-50 text-blue-700 font-semibold' : 'hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  <span>Todas las cantidades</span>
                  <span className="text-[10px] text-slate-400 font-mono">({quantityStats.total})</span>
                </button>

                <button
                  type="button"
                  onClick={() => onSetQuantity('zero')}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-xs transition-colors cursor-pointer ${
                    quantityFilter === 'zero' ? 'bg-amber-50 text-amber-800 font-semibold border border-amber-200' : 'hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  <span>Con cantidad = 0</span>
                  <span className="text-[10px] text-amber-800 bg-amber-100 px-1.5 py-0.2 rounded-full font-mono font-bold">
                    {quantityStats.zero}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => onSetQuantity('non_zero')}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-xs transition-colors cursor-pointer ${
                    quantityFilter === 'non_zero' ? 'bg-blue-50 text-blue-700 font-semibold' : 'hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  <span>Con cantidad &gt; 0</span>
                  <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded-full font-mono">
                    {quantityStats.nonZero}
                  </span>
                </button>
              </div>
            )}

            {/* Caso 4: Filtro de TEXTO (Código o Descripción) */}
            {(type === 'text' || type === 'code' || type === 'description') && (
              <div className="space-y-2">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block px-1">
                  Buscar en {title}:
                </span>
                <div className="relative">
                  <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    autoFocus
                    type="text"
                    placeholder={`Escribir ${title.toLowerCase()}...`}
                    value={searchValue}
                    onChange={e => onSearchChange(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-7 pr-7 py-1.5 text-xs focus:outline-none focus:border-blue-500 focus:bg-white transition-colors"
                  />
                  {searchValue && (
                    <button 
                      onClick={() => onSearchChange('')} 
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Pie de acciones del Popover */}
          <div className="pt-2 mt-2 border-t border-slate-100 flex items-center justify-between gap-2">
            {isFiltered ? (
              <button
                type="button"
                onClick={() => { onClearFilter(); onClose(); }}
                className="text-[11px] font-medium text-red-600 hover:text-red-800 hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <X size={12} />
                <span>Borrar filtro</span>
              </button>
            ) : (
              <span />
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-2.5 py-1 text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition-colors cursor-pointer ml-auto"
            >
              Listo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
