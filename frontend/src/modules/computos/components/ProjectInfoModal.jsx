import React from 'react';
import { FileSpreadsheet, X } from 'lucide-react';

export default function ProjectInfoModal({
  isOpen,
  budgetName,
  projectName,
  clientName,
  currency,
  onBudgetNameChange,
  onProjectNameChange,
  onClientNameChange,
  onCurrencyChange,
  onClose,
}) {
  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-[130] bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-6 border-2 border-amber-300 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-amber-200 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-sm">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-amber-950 font-bold text-base leading-tight">Datos del Presupuesto</h3>
              <p className="text-xs text-amber-800">Configura el nombre, proyecto, cliente y moneda</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3.5 py-1">
          <div>
            <label className="block text-xs font-bold text-amber-900 mb-1">Nombre del Presupuesto *</label>
            <input
              type="text"
              value={budgetName}
              onChange={(e) => onBudgetNameChange(e.target.value)}
              placeholder="Ej. Presupuesto Inicial"
              className="w-full px-3.5 py-2 rounded-xl border-2 border-amber-300 text-amber-950 text-sm font-bold focus:outline-none focus:border-amber-500 bg-amber-50/30"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-amber-900 mb-1">Proyecto / Obra</label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => onProjectNameChange(e.target.value)}
              placeholder="Ej. Residencia Las Palmas"
              className="w-full px-3.5 py-2 rounded-xl border-2 border-amber-300 text-amber-950 text-sm focus:outline-none focus:border-amber-500 bg-amber-50/30"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-bold text-amber-900 mb-1">Cliente</label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => onClientNameChange(e.target.value)}
                placeholder="Nombre del cliente o empresa"
                className="w-full px-3.5 py-2 rounded-xl border-2 border-amber-300 text-amber-950 text-sm focus:outline-none focus:border-amber-500 bg-amber-50/30"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-amber-900 mb-1">Moneda</label>
              <select
                value={currency}
                onChange={(e) => onCurrencyChange(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border-2 border-amber-300 text-amber-950 text-sm font-bold bg-amber-100 cursor-pointer focus:outline-none focus:border-amber-500"
              >
                <option value="USD">USD ($)</option>
                <option value="VES">VES (Bs.)</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-amber-200">
          <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-extrabold text-amber-950 bg-amber-400 hover:bg-amber-500 rounded-xl transition-colors cursor-pointer shadow-sm">
            Listo
          </button>
        </div>
      </div>
    </div>
  );
}
