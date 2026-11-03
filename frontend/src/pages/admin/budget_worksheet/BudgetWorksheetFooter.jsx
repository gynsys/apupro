import React, { useMemo, useState } from 'react';
import { FileSpreadsheet, Printer, ChevronUp, X } from 'lucide-react';
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
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
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
  const adminAndProfitAmount = Math.max(0, (subtotalPresupuesto || 0) - (incidence.directTotal || 0));

  const IncidenceCard = ({ compact = false }) => (
    <div className={`${compact ? 'w-full' : 'w-full md:w-[310px] shrink-0'} bg-white border-2 border-slate-300 rounded-2xl px-3 py-1.5 shadow-sm no-print print:hidden flex flex-col justify-between`}>
      <div className="flex items-center justify-between border-b border-slate-200 pb-0.5 leading-none">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Incidencia</span>
      </div>
      <div className="flex flex-col justify-around flex-1 py-0.5 gap-0.5">
        {incidenceRows.map((row) => (
          <div key={row.key} className="flex items-center justify-between gap-1.5 leading-tight">
            <span className="w-[72px] shrink-0 text-[11px] font-medium text-slate-600 truncate">{row.label}</span>
            <span className="flex-1 text-right text-[11px] font-mono font-semibold text-slate-800 pr-1 whitespace-nowrap">
              {currencySymbol} {money(row.amount)}
            </span>
            <span className="w-10 text-right text-[10px] font-mono font-bold text-[#78350F] shrink-0">
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
        <div className="flex items-center justify-between gap-1.5 leading-tight pt-1 mt-0.5 border-t border-slate-100">
          <span className="text-[11px] font-medium text-slate-600 truncate">Admin + Utilidad</span>
          <span className="flex-1 text-right text-[11px] font-mono font-semibold text-slate-800 pr-1 whitespace-nowrap">
            {currencySymbol} {money(adminAndProfitAmount)}
          </span>
          <span className="w-10 shrink-0" />
          <div className="invisible flex items-center gap-0.5 shrink-0 pl-1 border-l border-transparent">
            <div className="p-0.5">
              <div className="w-3.5 h-3.5" />
            </div>
            <div className="p-0.5">
              <div className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="mt-2.5 sm:mt-4 flex-none">
      {/* MOBILE COMPACT STICKY SUMMARY BAR & BOTTOM SHEET (< md) */}
      <div className="md:hidden">
        {/* Barra Compacta Flotante */}
        <div className="bg-white/95 backdrop-blur border border-slate-300 rounded-xl px-3 py-2 shadow-md flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[10px] uppercase font-bold text-slate-500 shrink-0">TOTAL:</span>
            <span className="font-mono font-black text-slate-900 text-sm truncate">
              {currencySymbol} {money(totalGeneral)}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setMobileSheetOpen(true)}
            className="flex items-center gap-1 bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 px-2.5 py-1 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer touch-target"
          >
            <ChevronUp size={14} />
            <span>Desglose</span>
          </button>
        </div>

        {/* BOTTOM SHEET MODAL */}
        {mobileSheetOpen && (
          <div className="fixed inset-0 z-50 flex flex-col justify-end">
            <div
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
              onClick={() => setMobileSheetOpen(false)}
            />
            <div className="relative bg-white rounded-t-3xl shadow-2xl p-4 pb-safe max-h-[85dvh] overflow-y-auto flex flex-col gap-3 z-10 border-t border-slate-200 animate-in slide-in-from-bottom-6 duration-200">
              {/* Drag Handle & Header */}
              <div className="flex flex-col items-center gap-1.5 -mt-1 pb-2 border-b border-slate-100">
                <div className="w-10 h-1 bg-slate-300 rounded-full" />
                <div className="flex items-center justify-between w-full pt-1">
                  <h3 className="font-bold text-sm text-slate-800">Resumen y Desglose de Totales</h3>
                  <button
                    type="button"
                    onClick={() => setMobileSheetOpen(false)}
                    className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 text-xs"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Totales principales */}
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 flex flex-col gap-2">
                <div className="flex justify-between items-center text-xs text-slate-600">
                  <span>Subtotal Costo Directo + Admin/Utilidad:</span>
                  <span className="font-mono font-semibold text-slate-800">
                    {currencySymbol} {money(subtotalPresupuesto)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs text-slate-600">
                  <span>I.V.A. ({budget.iva_percent ?? 16}%):</span>
                  <span className="font-mono font-semibold text-slate-800">
                    {currencySymbol} {money(ivaAmount)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm font-bold text-blue-900 pt-2 border-t border-slate-200">
                  <span>TOTAL GENERAL ({budget.currency}):</span>
                  <span className="font-mono text-base font-black text-blue-700">
                    {currencySymbol} {money(totalGeneral)}
                  </span>
                </div>
              </div>

              {/* Incidencias de Insumos */}
              <IncidenceCard compact />

              {/* Notas del Presupuesto */}
              <div className="bg-white p-2.5 rounded-2xl border border-slate-200">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  Notas u Observaciones:
                </label>
                <textarea
                  value={notesText}
                  onChange={(e) => setNotesText(e.target.value)}
                  onBlur={onSaveNotes}
                  placeholder="Escribe notas, términos de validez o condiciones de pago..."
                  rows={2}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              <button
                type="button"
                onClick={() => setMobileSheetOpen(false)}
                className="w-full py-2.5 bg-blue-600 text-white font-semibold rounded-xl text-xs hover:bg-blue-700 transition-colors shadow-sm cursor-pointer"
              >
                Cerrar Desglose
              </button>
            </div>
          </div>
        )}
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
