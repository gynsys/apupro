import React from 'react';
import { useNavigate } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { GripVertical, Trash2, Settings, Printer, Layers, Plus } from 'lucide-react';
import MathQuantityInput from './MathQuantityInput';
import ExportApuExcelButton from '../../../modules/costbase/components/ExportApuExcelButton';

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
}) {
  const navigate = useNavigate();

  return (
    <div className="hidden md:block">
      <DragDropContext onDragEnd={onDragEnd}>
        <table className="w-full text-left border-separate border-spacing-0">
          <thead className="sticky top-0 z-30 shadow-md ring-1 ring-slate-200 bg-white">
            <tr className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 font-semibold shadow-sm">
              <th className="p-4 w-16 text-center bg-slate-50 border-b border-slate-200">#</th>
              <th className="p-4 w-32 bg-slate-50 border-b border-slate-200">Código</th>
              <th className="p-4 bg-slate-50 border-b border-slate-200">Descripción</th>
              <th className="p-4 w-20 text-center bg-slate-50 border-b border-slate-200">Unidad</th>
              <th className="p-4 w-28 text-center bg-slate-50 border-b border-slate-200">
                <div className="inline-flex items-center justify-center gap-1.5 group/th relative cursor-help w-full">
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
              </th>
              <th className="p-4 w-24 text-right bg-slate-50 border-b border-slate-200">P.U.</th>
              <th className="p-4 w-32 text-right bg-slate-50 border-b border-slate-200">Total</th>
              <th className="p-4 w-32 text-center bg-slate-50 border-b border-slate-200">Acciones</th>
            </tr>
          </thead>
          <Droppable droppableId="budget-items">
            {(provided) => (
              <tbody 
                className="divide-y divide-slate-100"
                {...provided.droppableProps}
                ref={provided.innerRef}
              >
                {budget.items.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="p-12 text-center text-slate-500">
                      <Layers className="mx-auto mb-3 text-slate-300" size={32} />
                      <p>No hay partidas en este presupuesto.</p>
                      <button 
                        onClick={onOpenSearchModal}
                        className="mt-4 text-blue-600 font-medium hover:underline inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Plus size={16} /> Buscar e incluir la primera partida
                      </button>
                    </td>
                  </tr>
                ) : (
                  (() => {
                    let itemNumber = 0;
                    return (
                      <>
                        {budget.items.map((item, idx) => {
                          const isSelected = selectedItemId === item.id;
                          
                          if (item.is_chapter) {
                            return (
                              <Draggable key={item.id} draggableId={item.id} index={idx}>
                                {(dragProvided, snapshot) => (
                                  <tr 
                                    ref={dragProvided.innerRef}
                                    {...dragProvided.draggableProps}
                                    onClick={() => setSelectedItemId(isSelected ? null : item.id)}
                                    className={`hover:bg-[#FEF3C7] transition-colors cursor-pointer group ${isSelected ? 'bg-blue-50/50 ring-inset ring-2 ring-blue-500/50' : 'bg-slate-100/50'} ${snapshot.isDragging ? 'shadow-lg ring-1 ring-blue-400 bg-white z-50 relative' : ''}`}
                                  >
                                    <td className="p-4 text-center">
                                      <div {...dragProvided.dragHandleProps} className="inline-flex items-center justify-center p-1.5 text-slate-400 hover:text-blue-600 rounded-lg cursor-grab active:cursor-grabbing hover:bg-slate-200/50 transition-colors">
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

                          itemNumber++;
                          const currentNumber = itemNumber;
                          const pu = calculatePU(item);
                          const qty = parseFloat(item.quantity) || 0;
                          const total = Math.round((pu * qty + Number.EPSILON) * 100) / 100;

                          return (
                            <Draggable key={item.id} draggableId={item.id} index={idx}>
                              {(dragProvided, snapshot) => (
                                <tr 
                                  ref={dragProvided.innerRef}
                                  {...dragProvided.draggableProps}
                                  onClick={() => setSelectedItemId(isSelected ? null : item.id)}
                                  className={`hover:bg-[#FEF3C7] transition-colors duration-200 cursor-pointer group ${isSelected ? 'bg-blue-50 ring-inset ring-2 ring-blue-400' : ''} ${snapshot.isDragging ? 'shadow-xl ring-1 ring-blue-500 bg-white z-50 relative' : ''}`}
                                >
                                  <td className="p-4 text-center">
                                    <div {...dragProvided.dragHandleProps} className="inline-flex items-center justify-center p-1.5 rounded-lg cursor-grab active:cursor-grabbing hover:bg-slate-200/50 transition-colors w-8 h-8">
                                      <span className="text-slate-500 font-bold text-sm group-hover:hidden">{currentNumber}</span>
                                      <GripVertical size={16} className="hidden group-hover:block text-slate-400 hover:text-blue-600" />
                                    </div>
                                  </td>
                                  <td className="p-4 text-sm font-mono text-slate-600">{item.cov_par || item.cod_par}</td>
                                  <td className="p-4 text-sm text-slate-800">
                                    <div className="line-clamp-2 leading-relaxed" title={item.description}>
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
                                        settings={budget.settings}
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
                    );
                  })()
                )}
              </tbody>
            )}
          </Droppable>
        </table>
      </DragDropContext>
    </div>
  );
}
