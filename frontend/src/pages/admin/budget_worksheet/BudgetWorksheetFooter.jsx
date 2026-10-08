import React from 'react';

export default function BudgetWorksheetFooter({
  budget,
  notesText,
  setNotesText,
  onSaveNotes,
  subtotalPresupuesto,
  ivaAmount,
  totalGeneral,
}) {
  if (!budget.items || budget.items.length === 0) return null;

  return (
    <div className="mt-2.5 sm:mt-4 flex-none">
      {/* MOBILE COMPACT TOTALS & NOTES (< md) */}
      <div className="md:hidden flex flex-col gap-2">
        <div className="bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-xs focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-100 transition-all">
          <textarea
            value={notesText}
            onChange={(e) => setNotesText(e.target.value)}
            onBlur={onSaveNotes}
            placeholder="Notas u observaciones del presupuesto..."
            rows={1}
            className="w-full bg-transparent border-0 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none resize-none leading-normal"
          />
        </div>

        <div className="bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider leading-none mb-0.5">SUBTOTAL</span>
            <span className="font-mono font-bold text-slate-700 text-xs leading-none">
              {subtotalPresupuesto.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex flex-col text-center px-2 border-x border-slate-200">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider leading-none mb-0.5">I.V.A. ({budget.iva_percent ?? 16}%)</span>
            <span className="font-mono font-bold text-slate-700 text-xs leading-none">
              {ivaAmount.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex flex-col text-right">
            <span className="text-[10px] text-blue-600 font-bold uppercase tracking-wider leading-none mb-0.5">TOTAL ({budget.currency})</span>
            <span className="font-mono font-extrabold text-blue-900 text-sm leading-none">
              {totalGeneral.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      {/* DESKTOP TOTALS & NOTES (>= md) */}
      <div className="hidden md:flex flex-row items-stretch md:items-start justify-between gap-6">
        <div className="flex-1 max-w-2xl bg-white p-3 rounded-2xl border border-slate-300 shadow-sm focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
          <textarea
            value={notesText}
            onChange={(e) => setNotesText(e.target.value)}
            onBlur={onSaveNotes}
            placeholder="Escribe notas, observaciones, términos de validez o condiciones de pago..."
            rows={2}
            className="w-full bg-transparent border-0 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none resize-none leading-relaxed"
          />
        </div>

        <div className="bg-slate-50 px-4 py-2 rounded-2xl border-2 border-slate-300 shadow-sm w-full md:w-auto md:min-w-[300px] shrink-0">
          <div className="flex justify-between items-center py-1">
            <span className="text-slate-500 font-medium text-sm leading-none">SUBTOTAL</span>
            <span className="text-[14px] font-semibold text-slate-700 leading-none">
              {subtotalPresupuesto.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex justify-between items-center py-1 border-b border-slate-200">
            <span className="text-slate-500 font-medium text-sm leading-none">I.V.A. ({budget.iva_percent ?? 16}%)</span>
            <span className="text-[14px] font-semibold text-slate-700 leading-none">
              {ivaAmount.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex justify-between items-center py-1">
            <span className="text-slate-500 font-medium text-sm leading-none">TOTAL ({budget.currency})</span>
            <span className="text-[14px] font-bold text-slate-800 leading-none">
              {totalGeneral.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
