import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUp, ArrowDown, Trash2, Settings, Printer, Calculator } from 'lucide-react';
import MathQuantityInput from './MathQuantityInput';
import ExportApuExcelButton from '../../../modules/costbase/components/ExportApuExcelButton';

export default function BudgetMobileItemCard({
  item,
  idx,
  totalItems,
  isSelected,
  onSelect,
  budget,
  pu,
  onMoveItem,
  onDeleteItem,
  editingChapterId,
  setEditingChapterId,
  editingChapterName,
  setEditingChapterName,
  onSaveChapterEdit,
  onQuantityChange,
  onSaveQuantity,
  onPrintApu,
  itemNumber,
}) {
  const navigate = useNavigate();

  if (item.is_chapter) {
    return (
      <div 
        onClick={onSelect}
        className={`rounded-xl px-3 py-1.5 shadow-xs border transition-all flex items-center justify-between gap-2 min-h-[34px] ${
          isSelected 
            ? 'bg-[#fef3c7] ring-2 ring-amber-500 border-[#f59e0b]' 
            : 'bg-[#fef3c7] border-[#f59e0b] hover:bg-amber-200/60'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="flex items-center gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
            <button 
              type="button"
              disabled={idx === 0}
              onClick={() => onMoveItem(idx, 'up')}
              className="p-1 text-amber-800 hover:text-amber-950 disabled:opacity-20 rounded hover:bg-amber-200/80 active:scale-95 transition-all"
              title="Subir capítulo"
            >
              <ArrowUp size={13} />
            </button>
            <button 
              type="button"
              disabled={idx === totalItems - 1}
              onClick={() => onMoveItem(idx, 'down')}
              className="p-1 text-amber-800 hover:text-amber-950 disabled:opacity-20 rounded hover:bg-amber-200/80 active:scale-95 transition-all"
              title="Bajar capítulo"
            >
              <ArrowDown size={13} />
            </button>
          </div>
          
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
              className="w-full bg-white border border-amber-500 rounded px-2 py-0.5 text-[#78350f] font-bold uppercase text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
              onClick={e => e.stopPropagation()}
            />
          ) : (
            <span 
              onClick={(e) => {
                e.stopPropagation();
                setEditingChapterId(item.id);
                setEditingChapterName(item.description);
              }}
              className="font-bold text-xs uppercase tracking-wider text-[#78350f] truncate cursor-pointer"
              title="Tocar para editar capítulo"
            >
              {item.description}
            </span>
          )}
        </div>

        <button 
          onClick={(e) => {
            e.stopPropagation();
            onDeleteItem(item.id);
          }}
          className="p-1 text-amber-800 hover:text-red-600 hover:bg-amber-200/80 rounded-lg transition-colors shrink-0"
          title="Eliminar capítulo"
        >
          <Trash2 size={15} />
        </button>
      </div>
    );
  }

  const qty = parseFloat(item.quantity) || 0;
  const total = Math.round((pu * qty + Number.EPSILON) * 100) / 100;

  return (
    <div 
      onClick={onSelect}
      className={`bg-white rounded-2xl border transition-all p-3.5 space-y-2.5 shadow-sm ${
        isSelected ? 'ring-2 ring-blue-500 border-blue-300 bg-blue-50/20' : 'border-slate-200 hover:border-slate-300'
      }`}
    >
      {/* FILA 1: Identificación y Reordenamiento */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200/80 shrink-0" onClick={e => e.stopPropagation()}>
            <span className="text-xs font-bold text-slate-700 px-1.5 min-w-[20px] text-center">
              {itemNumber}
            </span>
            <div className="flex flex-col border-l border-slate-200 pl-0.5">
              <button
                type="button"
                disabled={idx === 0}
                onClick={() => onMoveItem(idx, 'up')}
                className="p-0.5 text-slate-500 hover:text-blue-600 disabled:opacity-20 hover:bg-slate-200 rounded active:scale-95 transition-all"
                title="Mover arriba"
              >
                <ArrowUp size={11} />
              </button>
              <button
                type="button"
                disabled={idx === totalItems - 1}
                onClick={() => onMoveItem(idx, 'down')}
                className="p-0.5 text-slate-500 hover:text-blue-600 disabled:opacity-20 hover:bg-slate-200 rounded active:scale-95 transition-all"
                title="Mover abajo"
              >
                <ArrowDown size={11} />
              </button>
            </div>
          </div>

          <span className="font-mono font-bold text-[11px] text-slate-700 bg-slate-100/90 px-2 py-0.5 rounded border border-slate-200/70 truncate">
            {item.cov_par || item.cod_par || 'S/C'}
          </span>
        </div>

        <span className="text-[11px] font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200/60 shrink-0">
          {item.unit || 'UND'}
        </span>
      </div>

      {/* FILA 2: Descripción */}
      <div className="text-xs text-slate-800 font-medium leading-relaxed line-clamp-3">
        {item.description}
      </div>

      {/* FILA 3: Cálculos (3 columnas: Cantidad, P.U., Total) */}
      <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-100" onClick={e => e.stopPropagation()}>
        <div className="bg-slate-50 p-2 rounded-xl border border-slate-200 flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center mb-1 flex items-center justify-center gap-1">
            <Calculator size={10} className="text-amber-600 shrink-0" />
            Cant.
          </span>
          <MathQuantityInput 
            className="w-full text-center bg-white border border-slate-200 focus:border-blue-500 rounded-lg py-1 px-1 font-mono text-xs font-bold text-slate-900 shadow-inner"
            value={item.quantity}
            onChange={val => onQuantityChange(item.id, val)}
            onSave={val => onSaveQuantity(item.id, val)}
          />
        </div>

        <div className="bg-slate-50 p-2 rounded-xl border border-slate-200 flex flex-col justify-between text-center">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
            P.U.
          </span>
          <span className="font-mono text-xs font-semibold text-slate-800 py-1 truncate">
            {pu.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

        <div className="bg-blue-50/70 p-2 rounded-xl border border-blue-200 flex flex-col justify-between text-center">
          <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block mb-1">
            Total
          </span>
          <span className="font-mono text-xs font-extrabold text-blue-900 py-1 truncate">
            {total.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* FILA 4: STRICTLY ONLY ICONS (NO TEXT) */}
      <div className="grid grid-cols-4 gap-2 pt-1.5 border-t border-slate-100" onClick={e => e.stopPropagation()}>
        <button 
          type="button"
          onClick={() => navigate(`/budgets/${budget.id}/item/${item.id}`)} 
          className="p-2.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 active:bg-blue-100 border border-slate-200 rounded-xl transition-colors flex items-center justify-center cursor-pointer"
          title="Editar APU"
        >
          <Settings size={18} />
        </button>
        
        <button 
          type="button"
          onClick={() => onPrintApu(item)} 
          className="p-2.5 text-slate-600 hover:text-green-600 hover:bg-green-50 active:bg-green-100 border border-slate-200 rounded-xl transition-colors flex items-center justify-center cursor-pointer"
          title="Imprimir APU"
        >
          <Printer size={18} />
        </button>
        
        <ExportApuExcelButton 
          item={item} 
          materials={item.materials || []}
          equipments={item.equipments || []}
          labors={item.labors || []}
          settings={budget.settings}
          className="p-2.5 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 active:bg-emerald-100 border border-slate-200 rounded-xl transition-colors flex items-center justify-center w-full cursor-pointer"
          iconSize={18}
        />
        
        <button 
          type="button"
          onClick={() => onDeleteItem(item.id)} 
          className="p-2.5 text-slate-600 hover:text-red-600 hover:bg-red-50 active:bg-red-100 border border-slate-200 rounded-xl transition-colors flex items-center justify-center cursor-pointer"
          title="Eliminar"
        >
          <Trash2 size={18} />
        </button>
      </div>
    </div>
  );
}
