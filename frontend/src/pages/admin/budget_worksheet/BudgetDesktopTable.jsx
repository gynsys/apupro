import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { 
  GripVertical, 
  Trash2, 
  Settings, 
  Printer, 
  Layers, 
  Plus, 
  CheckSquare, 
  Square,
  Filter,
  RotateCcw
} from 'lucide-react';
import MathQuantityInput from './MathQuantityInput';
import ExportApuExcelButton from '../../../modules/costbase/components/ExportApuExcelButton';
import ExcelFilterDropdown from './ExcelFilterDropdown';
import { useBudgetTableFilters } from './useBudgetTableFilters';

export default function BudgetDesktopTable({
  budget,
  selectedItemId,
  setSelectedItemId,
  onDragEnd,
  onDeleteItem,
  editingChapterId,
  setEditingChapterId,
  editingChapterName,
  setEditingChapterName,
  onSaveChapterEdit,
  calculatePU,
  onQuantityChange,
  onSaveQuantity,
  onPrintApu,
  onOpenSearchModal,
  onTogglePending,
}) {
  const navigate = useNavigate();

  // Hook de filtros y ordenamiento estilo Excel
  const tableFilters = useBudgetTableFilters(budget?.items || [], calculatePU);

  // Mapeo del número oficial de partida para conservarlo siempre exacto (como filas de Excel)
  const originalNumberMap = useMemo(() => {
    const map = new Map();
    let num = 0;
    (budget?.items || []).forEach(it => {
      if (!it.is_chapter) {
        num++;
        map.set(it.id, num);
      }
    });
    return map;
  }, [budget?.items]);

  // Si hay filtros u orden activo, el reordenamiento manual por arrastre se pausa
  const handleDragEndInternal = (result) => {
    if (tableFilters.hasActiveFiltersOrSort) return;
    onDragEnd(result);
  };

  return (
    <div className="hidden md:block">
      {/* Barra de estado de filtros activos estilo Excel */}
      {tableFilters.hasActiveFiltersOrSort && (
        <div className="bg-blue-50/90 border border-blue-200/80 rounded-xl px-4 py-2.5 mb-3 flex flex-wrap items-center justify-between gap-3 text-xs shadow-xs animate-in fade-in duration-200">
          <div className="flex flex-wrap items-center gap-2.5 text-blue-900 font-medium">
            <Filter size={15} className="text-blue-600 shrink-0" />
            <span>
              Filtro activo: mostrando <strong>{tableFilters.filteredNonChapterCount}</strong> de <strong>{tableFilters.totalNonChapterCount}</strong> partidas
            </span>
            {tableFilters.sortState && (
              <span className="text-blue-700 bg-blue-100/90 border border-blue-200 px-2 py-0.5 rounded-md font-mono text-[11px] font-semibold">
                Ordenado por {tableFilters.sortState.column === 'number' ? '#' : tableFilters.sortState.column === 'cod_par' ? 'Código' : tableFilters.sortState.column === 'description' ? 'Descripción' : tableFilters.sortState.column === 'unit' ? 'Unidad' : tableFilters.sortState.column === 'quantity' ? 'Cantidad' : tableFilters.sortState.column === 'pu' ? 'P.U.' : 'Total'} ({tableFilters.sortState.direction === 'asc' ? 'Ascendente' : 'Descendente'})
              </span>
            )}
            <span className="text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md text-[11px] font-normal">
              Arrastre manual en pausa con filtros activos
            </span>
          </div>
          <button
            type="button"
            onClick={tableFilters.clearAllFiltersAndSort}
            className="inline-flex items-center gap-1.5 px-3 py-1 text-blue-700 hover:text-blue-950 bg-white hover:bg-blue-100/60 border border-blue-300 rounded-lg font-semibold transition-colors shadow-2xs cursor-pointer"
          >
            <RotateCcw size={13} />
            Limpiar todos los filtros
          </button>
        </div>
      )}

      <DragDropContext onDragEnd={handleDragEndInternal}>
        <table className="w-full text-left border-separate border-spacing-0">
          <thead className="sticky top-0 z-30 shadow-md ring-1 ring-slate-200 bg-white">
            <tr className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 font-semibold shadow-sm">
              {/* COLUMNA # */}
              <th className="p-3 w-16 text-center bg-slate-50 border-b border-slate-200 relative">
                <div className="inline-flex items-center justify-center">
                  <span>#</span>
                  <ExcelFilterDropdown
                    title="#"
                    columnKey="number"
                    type="number"
                    align="left"
                    isOpen={tableFilters.openDropdown === 'number'}
                    onToggle={() => tableFilters.setOpenDropdown(prev => prev === 'number' ? null : 'number')}
                    onClose={() => tableFilters.setOpenDropdown(null)}
                    isFiltered={false}
                    sortState={tableFilters.sortState}
                    onSort={(dir) => tableFilters.handleSort('number', dir)}
                    onClearSort={tableFilters.clearSort}
                    onClearFilter={() => {}}
                  />
                </div>
              </th>

              {/* COLUMNA CÓDIGO */}
              <th className="p-3 w-32 bg-slate-50 border-b border-slate-200 relative">
                <div className="flex items-center justify-between">
                  <span>Código</span>
                  <ExcelFilterDropdown
                    title="Código"
                    columnKey="cod_par"
                    type="code"
                    align="left"
                    isOpen={tableFilters.openDropdown === 'cod_par'}
                    onToggle={() => tableFilters.setOpenDropdown(prev => prev === 'cod_par' ? null : 'cod_par')}
                    onClose={() => tableFilters.setOpenDropdown(null)}
                    isFiltered={tableFilters.isColFiltered('cod_par')}
                    sortState={tableFilters.sortState}
                    onSort={(dir) => tableFilters.handleSort('cod_par', dir)}
                    onClearSort={tableFilters.clearSort}
                    searchValue={tableFilters.filters.code}
                    onSearchChange={tableFilters.setCodeFilter}
                    onClearFilter={() => tableFilters.clearColFilter('cod_par')}
                  />
                </div>
              </th>

              {/* COLUMNA DESCRIPCIÓN */}
              <th className="p-3 bg-slate-50 border-b border-slate-200 relative">
                <div className="flex items-center justify-between">
                  <span>Descripción</span>
                  <ExcelFilterDropdown
                    title="Descripción"
                    columnKey="description"
                    type="description"
                    align="left"
                    isOpen={tableFilters.openDropdown === 'description'}
                    onToggle={() => tableFilters.setOpenDropdown(prev => prev === 'description' ? null : 'description')}
                    onClose={() => tableFilters.setOpenDropdown(null)}
                    isFiltered={tableFilters.isColFiltered('description')}
                    sortState={tableFilters.sortState}
                    onSort={(dir) => tableFilters.handleSort('description', dir)}
                    onClearSort={tableFilters.clearSort}
                    searchValue={tableFilters.filters.description}
                    onSearchChange={tableFilters.setDescriptionFilter}
                    onClearFilter={() => tableFilters.clearColFilter('description')}
                  />
                </div>
              </th>

              {/* COLUMNA UNIDAD */}
              <th className="p-3 w-24 text-center bg-slate-50 border-b border-slate-200 relative">
                <div className="inline-flex items-center justify-center">
                  <span>Unidad</span>
                  <ExcelFilterDropdown
                    title="Unidad"
                    columnKey="unit"
                    type="unit"
                    align="center"
                    isOpen={tableFilters.openDropdown === 'unit'}
                    onToggle={() => tableFilters.setOpenDropdown(prev => prev === 'unit' ? null : 'unit')}
                    onClose={() => tableFilters.setOpenDropdown(null)}
                    isFiltered={tableFilters.isColFiltered('unit')}
                    sortState={tableFilters.sortState}
                    onSort={(dir) => tableFilters.handleSort('unit', dir)}
                    onClearSort={tableFilters.clearSort}
                    unitStats={tableFilters.unitStats}
                    selectedUnits={tableFilters.filters.unit}
                    onToggleUnit={tableFilters.toggleUnitFilter}
                    onSelectAllUnits={tableFilters.selectAllUnits}
                    onClearFilter={() => tableFilters.clearColFilter('unit')}
                  />
                </div>
              </th>

              {/* COLUMNA CANTIDAD */}
              <th className="p-3 w-28 text-center bg-slate-50 border-b border-slate-200 relative">
                <div className="inline-flex items-center justify-center">
                  <div className="inline-flex items-center justify-center gap-1 group/th relative cursor-help">
                    <span>Cantidad</span>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 hidden group-hover/th:flex flex-col w-64 p-3.5 bg-[#fef3c7] text-[#78350f] text-[11px] rounded-2xl shadow-xl z-50 pointer-events-none normal-case font-normal leading-relaxed border-2 border-[#f59e0b] animate-in fade-in zoom-in-95 text-left">
                      <p className="font-semibold text-amber-950 text-[11px]">
                        Puedes escribir operaciones matemáticas básicas directamente:
                      </p>
                      <div className="mt-2 font-mono text-[11px] text-amber-900 bg-amber-100/80 border border-amber-300/80 p-2.5 rounded-xl space-y-1 font-semibold">
                        <div>• 12.5 * 3</div>
                        <div>• (4.5 + 3.2) * 2.60</div>
                        <div>• 100 / 4 + 15</div>
                      </div>
                      <span className="text-[10px] text-amber-800/80 mt-2 italic font-medium">Pulsa Enter o sal del campo para resolver automáticamente.</span>
                    </div>
                  </div>
                  <ExcelFilterDropdown
                    title="Cantidad"
                    columnKey="quantity"
                    type="quantity"
                    align="center"
                    isOpen={tableFilters.openDropdown === 'quantity'}
                    onToggle={() => tableFilters.setOpenDropdown(prev => prev === 'quantity' ? null : 'quantity')}
                    onClose={() => tableFilters.setOpenDropdown(null)}
                    isFiltered={tableFilters.isColFiltered('quantity')}
                    sortState={tableFilters.sortState}
                    onSort={(dir) => tableFilters.handleSort('quantity', dir)}
                    onClearSort={tableFilters.clearSort}
                    quantityFilter={tableFilters.filters.quantity}
                    onSetQuantity={tableFilters.setQuantityFilter}
                    quantityStats={tableFilters.quantityStats}
                    onClearFilter={() => tableFilters.clearColFilter('quantity')}
                  />
                </div>
              </th>

              {/* COLUMNA P.U. */}
              <th className="p-3 w-28 text-right bg-slate-50 border-b border-slate-200 relative">
                <div className="inline-flex items-center justify-end w-full">
                  <span>P.U.</span>
                  <ExcelFilterDropdown
                    title="P.U."
                    columnKey="pu"
                    type="number"
                    align="right"
                    isOpen={tableFilters.openDropdown === 'pu'}
                    onToggle={() => tableFilters.setOpenDropdown(prev => prev === 'pu' ? null : 'pu')}
                    onClose={() => tableFilters.setOpenDropdown(null)}
                    isFiltered={false}
                    sortState={tableFilters.sortState}
                    onSort={(dir) => tableFilters.handleSort('pu', dir)}
                    onClearSort={tableFilters.clearSort}
                    onClearFilter={() => {}}
                  />
                </div>
              </th>

              {/* COLUMNA TOTAL */}
              <th className="p-3 w-32 text-right bg-slate-50 border-b border-slate-200 relative">
                <div className="inline-flex items-center justify-end w-full">
                  <span>Total</span>
                  <ExcelFilterDropdown
                    title="Total"
                    columnKey="total"
                    type="number"
                    align="right"
                    isOpen={tableFilters.openDropdown === 'total'}
                    onToggle={() => tableFilters.setOpenDropdown(prev => prev === 'total' ? null : 'total')}
                    onClose={() => tableFilters.setOpenDropdown(null)}
                    isFiltered={false}
                    sortState={tableFilters.sortState}
                    onSort={(dir) => tableFilters.handleSort('total', dir)}
                    onClearSort={tableFilters.clearSort}
                    onClearFilter={() => {}}
                  />
                </div>
              </th>

              {/* COLUMNA ACCIONES / ESTADO */}
              <th className="p-3 w-32 text-center bg-slate-50 border-b border-slate-200 relative">
                <div className="inline-flex items-center justify-center">
                  <span>Acciones</span>
                  <ExcelFilterDropdown
                    title="Estado"
                    columnKey="status"
                    type="status"
                    align="right"
                    isOpen={tableFilters.openDropdown === 'status'}
                    onToggle={() => tableFilters.setOpenDropdown(prev => prev === 'status' ? null : 'status')}
                    onClose={() => tableFilters.setOpenDropdown(null)}
                    isFiltered={tableFilters.isColFiltered('status')}
                    sortState={null}
                    statusFilter={tableFilters.filters.status}
                    onSetStatus={tableFilters.setStatusFilter}
                    statusStats={tableFilters.statusStats}
                    onClearFilter={() => tableFilters.clearColFilter('status')}
                  />
                </div>
              </th>
            </tr>
          </thead>
          <Droppable droppableId="budget-items">
            {(provided) => (
              <tbody 
                className="divide-y divide-slate-100"
                {...provided.droppableProps}
                ref={provided.innerRef}
              >
                {tableFilters.displayItems.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="p-12 text-center text-slate-500">
                      <Layers className="mx-auto mb-3 text-slate-300" size={32} />
                      {budget.items.length === 0 ? (
                        <>
                          <p>No hay partidas en este presupuesto.</p>
                          <button 
                            onClick={onOpenSearchModal}
                            className="mt-4 text-blue-600 font-medium hover:underline inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Plus size={16} /> Buscar e incluir la primera partida
                          </button>
                        </>
                      ) : (
                        <>
                          <p className="font-semibold text-slate-700">No se encontraron partidas con los filtros aplicados.</p>
                          <p className="text-xs text-slate-400 mt-1">Prueba cambiando los criterios de filtro o restableciendo las columnas.</p>
                          <button
                            type="button"
                            onClick={tableFilters.clearAllFiltersAndSort}
                            className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg font-semibold transition-colors cursor-pointer"
                          >
                            <RotateCcw size={14} /> Limpiar todos los filtros
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ) : (
                  <>
                    {tableFilters.displayItems.map((item, idx) => {
                      const isSelected = selectedItemId === item.id;
                      
                      if (item.is_chapter) {
                        return (
                          <Draggable 
                            key={item.id} 
                            draggableId={item.id} 
                            index={idx}
                            isDragDisabled={tableFilters.hasActiveFiltersOrSort}
                          >
                            {(dragProvided, snapshot) => (
                              <tr 
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                onClick={() => setSelectedItemId(isSelected ? null : item.id)}
                                className={`hover:bg-[#FEF3C7] transition-colors cursor-pointer group ${isSelected ? 'bg-blue-50/50 ring-inset ring-2 ring-blue-500/50' : 'bg-slate-100/50'} ${snapshot.isDragging ? 'shadow-lg ring-1 ring-blue-400 bg-white z-50 relative' : ''}`}
                              >
                                <td className="p-4 text-center">
                                  <div 
                                    {...dragProvided.dragHandleProps} 
                                    className={`inline-flex items-center justify-center p-1.5 text-slate-400 rounded-lg transition-colors ${
                                      tableFilters.hasActiveFiltersOrSort 
                                        ? 'opacity-40 cursor-not-allowed' 
                                        : 'hover:text-blue-600 cursor-grab active:cursor-grabbing hover:bg-slate-200/50'
                                    }`}
                                    title={tableFilters.hasActiveFiltersOrSort ? "Arrastre en pausa mientras haya filtros activos" : "Arrastrar capítulo"}
                                  >
                                    <GripVertical size={16} />
                                  </div>
                                </td>
                                <td 
                                  colSpan="6" 
                                  className="p-4 text-sm font-bold text-slate-900 tracking-wide uppercase"
                                  onDoubleClick={(e) => {
                                    e.stopPropagation();
                                    setEditingChapterId(item.id);
                                    setEditingChapterName(item.description);
                                  }}
                                >
                                  {editingChapterId === item.id ? (
                                    <input
                                      autoFocus
                                      type="text"
                                      value={editingChapterName}
                                      onChange={e => setEditingChapterName(e.target.value)}
                                      onBlur={() => onSaveChapterEdit(item.id)}
                                      onKeyDown={e => {
                                        if (e.key === 'Enter') onSaveChapterEdit(item.id);
                                        if (e.key === 'Escape') setEditingChapterId(null);
                                      }}
                                      className="w-full bg-white border border-blue-400 rounded px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 font-bold uppercase"
                                      onClick={e => e.stopPropagation()}
                                    />
                                  ) : (
                                    <div title="Doble clic para editar" className="w-full h-full">
                                      {item.description}
                                    </div>
                                  )}
                                </td>
                                <td className="p-4 text-center">
                                  <div className="flex items-center justify-center gap-1">
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); onDeleteItem(item.id); }} 
                                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg border border-transparent hover:border-red-200 transition-colors cursor-pointer" 
                                      title="Eliminar"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Draggable>
                        );
                      }

                      // Número oficial correlativo de partida (igual que las filas de Excel)
                      const currentNumber = originalNumberMap.get(item.id) || idx + 1;
                      const isPending = !!item.is_pending;
                      const pu = calculatePU(item);
                      const qty = parseFloat(item.quantity) || 0;
                      const total = Math.round((pu * qty + Number.EPSILON) * 100) / 100;

                      let rowBgClass = 'hover:bg-[#FEF3C7]';
                      if (isPending) {
                        rowBgClass = isSelected
                          ? 'bg-red-500/[0.38] ring-inset ring-2 ring-red-500 hover:bg-red-500/[0.42]'
                          : 'bg-red-500/[0.30] hover:bg-red-500/[0.38]';
                      } else if (isSelected) {
                        rowBgClass = 'bg-blue-50 ring-inset ring-2 ring-blue-400';
                      }

                      return (
                        <Draggable 
                          key={item.id} 
                          draggableId={item.id} 
                          index={idx}
                          isDragDisabled={tableFilters.hasActiveFiltersOrSort}
                        >
                          {(dragProvided, snapshot) => (
                            <tr 
                              ref={dragProvided.innerRef}
                              {...dragProvided.draggableProps}
                              onClick={() => setSelectedItemId(isSelected ? null : item.id)}
                              className={`transition-colors duration-200 cursor-pointer group ${rowBgClass} ${snapshot.isDragging ? 'shadow-xl ring-1 ring-blue-500 bg-white z-50 relative' : ''}`}
                            >
                              <td className="p-4 text-center">
                                <div 
                                  {...dragProvided.dragHandleProps} 
                                  className={`inline-flex items-center justify-center p-1.5 rounded-lg transition-colors w-8 h-8 ${
                                    tableFilters.hasActiveFiltersOrSort 
                                      ? 'opacity-40 cursor-not-allowed' 
                                      : 'cursor-grab active:cursor-grabbing hover:bg-slate-200/50'
                                  }`}
                                  title={tableFilters.hasActiveFiltersOrSort ? "Arrastre en pausa mientras haya filtros activos" : "Arrastrar partida"}
                                >
                                  <span className="text-slate-500 font-bold text-sm group-hover:hidden">{currentNumber}</span>
                                  <GripVertical size={16} className="hidden group-hover:block text-slate-400 hover:text-blue-600" />
                                </div>
                              </td>
                              <td className="p-4 text-sm font-mono text-slate-600">{item.cov_par || item.cod_par}</td>
                              <td className="p-4 text-sm text-slate-800">
                                <div
                                  className="line-clamp-2 leading-relaxed cursor-pointer"
                                  title={`${item.description} — Doble clic para abrir el APU`}
                                  onDoubleClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/budgets/${budget.id}/item/${item.id}`);
                                  }}
                                >
                                  {item.description}
                                </div>
                              </td>
                              <td className="p-4 text-center text-sm font-medium text-slate-500">{item.unit}</td>
                              <td className="p-4 text-center" onClick={e => e.stopPropagation()}>
                                <MathQuantityInput 
                                  className="w-full text-center bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none transition-colors font-mono text-sm font-semibold text-slate-800"
                                  value={item.quantity}
                                  onChange={val => onQuantityChange(item.id, val)}
                                  onSave={val => onSaveQuantity(item.id, val)}
                                />
                              </td>
                              <td className="p-4 text-right text-sm font-medium text-slate-700">
                                {pu.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td className="p-4 text-right text-sm font-bold text-slate-900">
                                {total.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td className="p-4 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <button 
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); onTogglePending?.(item.id); }} 
                                    className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                                      isPending 
                                        ? 'text-red-700 bg-red-200/90 border-red-400 hover:bg-red-300 shadow-xs' 
                                        : 'text-slate-400 hover:text-red-600 hover:bg-red-50 border-transparent hover:border-red-200'
                                    }`}
                                    title={isPending ? "Partida marcada como pendiente (clic para desmarcar)" : "Marcar partida como pendiente"}
                                  >
                                    {isPending ? <CheckSquare size={16} className="text-red-700 stroke-[2.2]" /> : <Square size={16} />}
                                  </button>
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); navigate(`/budgets/${budget.id}/item/${item.id}`); }} 
                                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded-lg border border-transparent hover:border-slate-200 transition-colors cursor-pointer" 
                                    title="Editar APU"
                                  >
                                    <Settings size={16} />
                                  </button>
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); onPrintApu(item); }} 
                                    className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-slate-100 rounded-lg border border-transparent hover:border-slate-200 transition-colors cursor-pointer" 
                                    title="Imprimir APU"
                                  >
                                    <Printer size={16} />
                                  </button>
                                  <ExportApuExcelButton 
                                    item={item} 
                                    materials={item.materials || []}
                                    equipments={item.equipments || []}
                                    labors={item.labors || []}
                                    settings={budget}
                                    className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-slate-100 rounded-lg border border-transparent hover:border-slate-200 transition-colors cursor-pointer"
                                    iconSize={16}
                                  />
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); onDeleteItem(item.id); }} 
                                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg border border-transparent hover:border-red-200 transition-colors cursor-pointer" 
                                    title="Eliminar"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Draggable>
                      );
                    })}
                    {provided.placeholder}
                  </>
                )}
              </tbody>
            )}
          </Droppable>
        </table>
      </DragDropContext>
    </div>
  );
}
