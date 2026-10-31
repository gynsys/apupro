import React, { useMemo } from 'react';
import { FileSpreadsheet, Printer } from 'lucide-react';
import { calculateBudgetIncidence } from '../../../utils/apuCalculations';
import { exportResourceSummaryToExcel, printResourceSummary } from '../../../utils/resourceSummaryExport';

export default function BudgetWorksheetFooter({
  budget,
  notesText,
  setNotesText,
  onSaveNotes,
  subtotalPresupuesto,
  ivaAmount,
  totalGeneral,
}) {
  const incidence = useMemo(() => calculateBudgetIncidence(budget), [budget]);

  if (!budget.items || budget.items.length === 0) return null;

  const currencyCode = String(budget.currency || 'USD').toUpperCase();
  const currencySymbol = ['BS', 'BS.', 'BSF', 'VES', 'BOLIVAR', 'BOLÍVAR'].some((code) => currencyCode.startsWith(code)) ? 'Bs.' : '$';
  const money = (value) => Number(value || 0).toLocaleString('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const incidenceRows = [
    { key: 'materials', label: 'Materiales', ...incidence.materials },
    { key: 'equipment', label: 'Equipos', ...incidence.equipment },
    { key: 'labor', label: 'Mano de obra', ...incidence.labor },
  ];

  const IncidenceCard = ({ compact = false }) => (
    <div className={`${compact ? 'w-full' : 'w-full md:w-[310px] md:h-[86px] shrink-0'} bg-white border-2 border-slate-300 rounded-2xl px-3 py-1.5 shadow-sm no-print print:hidden flex flex-col justify-between`}>
      <div className="flex items-center justify-between border-b border-slate-200 pb-0.5 leading-none">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Incidencia</span>
        <span className="text-[9px] text-slate-400" title="Porcentaje sobre el costo directo total">costo directo</span>
      </div>
      <div className="flex flex-col justify-around flex-1 py-0.5">
        {incidenceRows.map((row) => (
          <div key={row.key} className="flex items-center justify-between gap-1.5 leading-tight">
            <span className="w-[72px] shrink-0 text-[11px] font-medium text-slate-600 truncate">{row.label}</span>
            <span className="flex-1 text-right text-[11px] font-mono font-semibold text-slate-800 pr-1 whitespace-nowrap">
              {currencySymbol} {money(row.amount)}
            </span>
            <span className="w-10 text-right text-[10px] font-mono font-bold text-[#F59E0B] shrink-0">
              {Number(row.percent || 0).toFixed(1)}%
            </span>
            <div className="flex items-center gap-0.5 shrink-0 pl-1 border-l border-slate-200">
              <button
                type="button"
                onClick={() => exportResourceSummaryToExcel(budget, row.key)}
                className="p-0.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded transition-colors cursor-pointer"
                title={
                  row.key === 'equipment'
                    ? 'Exportar resumen de equipos a Excel (con subcapítulo de vehículos y maquinarias pesadas)'
                    : `Exportar resumen de ${row.label.toLowerCase()} a Excel`
                }
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => printResourceSummary(budget, row.key)}
                className="p-0.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                title={
                  row.key === 'equipment'
                    ? 'Imprimir resumen de equipos (con subcapítulo de vehículos y maquinarias pesadas)'
                    : `Imprimir resumen de ${row.label.toLowerCase()}`
                }
              >
                <Printer className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

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

        <IncidenceCard compact />
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

        <IncidenceCard />

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
