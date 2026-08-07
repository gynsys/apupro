import React, { useState } from 'react';
import { X, Printer } from 'lucide-react';

export default function PrintAPUModal({ isOpen, onClose, onPrint, budgetName = "" }) {
  const [options, setOptions] = useState({
    scope: 'current',
    format: 'lines',
    color: true,
    showCompany: false,
    companyName: budgetName,
    showManHours: false,
    showPercentages: false,
    dateType: 'none',
  });

  if (!isOpen) return null;

  const handleChange = (field, value) => {
    setOptions(prev => ({ ...prev, [field]: value }));
  };

  const handlePrint = () => {
    onPrint(options);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:hidden">
      <div className="bg-slate-100 rounded-lg shadow-xl w-full max-w-md overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-b from-gray-100 to-gray-200 border-b border-gray-300 p-2 flex justify-between items-center px-4 rounded-t-lg">
          <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2">
            Tipo de Impresión
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-300 rounded-full text-red-500 transition-colors shadow-sm bg-gray-200 border border-gray-300">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3">
          
          {/* Scope Box */}
          <div className="bg-gray-100 border border-gray-300 p-3 shadow-inner rounded-sm space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="scope" checked={options.scope === 'current'} onChange={() => handleChange('scope', 'current')} className="w-3.5 h-3.5" />
              <span className="text-xs text-gray-800">Imprimir APU Actual</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer opacity-50">
              <input type="radio" name="scope" checked={options.scope === 'all'} disabled onChange={() => handleChange('scope', 'all')} className="w-3.5 h-3.5" />
              <span className="text-xs text-gray-800">Imprimir Todos los APU Visualizados</span>
            </label>
          </div>

          {/* Format Box */}
          <div className="bg-gray-100 border border-gray-300 p-3 shadow-inner rounded-sm space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="format" checked={options.format === 'lines'} onChange={() => handleChange('format', 'lines')} className="w-3.5 h-3.5" />
              <span className="text-xs text-gray-800">Formato con Líneas Divisorias</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="format" checked={options.format === 'no-lines'} onChange={() => handleChange('format', 'no-lines')} className="w-3.5 h-3.5" />
              <span className="text-xs text-gray-800">Formato sin Líneas Divisorias</span>
            </label>
          </div>

          {/* Settings Box */}
          <div className="bg-gray-100 border border-gray-300 p-3 shadow-inner rounded-sm space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={options.color} onChange={(e) => handleChange('color', e.target.checked)} className="w-3.5 h-3.5 rounded-sm" />
              <span className="text-xs text-gray-800">Formato a Color</span>
            </label>

            <div className="space-y-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={options.showCompany} onChange={(e) => handleChange('showCompany', e.target.checked)} className="w-3.5 h-3.5 rounded-sm" />
                <span className="text-xs text-gray-800">Nombre de Empresa</span>
              </label>
              {options.showCompany && (
                <div className="pl-5">
                  <input 
                    type="text" 
                    value={options.companyName}
                    onChange={(e) => handleChange('companyName', e.target.value)}
                    className="w-full text-xs p-1 border border-gray-300 bg-white"
                  />
                </div>
              )}
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={options.showManHours} onChange={(e) => handleChange('showManHours', e.target.checked)} className="w-3.5 h-3.5 rounded-sm" />
              <span className="text-xs text-gray-800">Imprimir Horas Hombre</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={options.showPercentages} onChange={(e) => handleChange('showPercentages', e.target.checked)} className="w-3.5 h-3.5 rounded-sm" />
              <span className="text-xs text-gray-800">Porcentajes respecto a el costo Directo</span>
            </label>
          </div>

          {/* Date Box */}
          <div className="bg-gray-100 border border-gray-300 p-3 shadow-inner rounded-sm space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="dateType" checked={options.dateType === 'none'} onChange={() => handleChange('dateType', 'none')} className="w-3.5 h-3.5" />
              <span className="text-xs text-gray-800">Sin Fecha</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="dateType" checked={options.dateType === 'db'} onChange={() => handleChange('dateType', 'db')} className="w-3.5 h-3.5" />
              <span className="text-xs text-gray-800">Fecha en Base de Datos</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="dateType" checked={options.dateType === 'current'} onChange={() => handleChange('dateType', 'current')} className="w-3.5 h-3.5" />
              <span className="text-xs text-gray-800">Fecha Actual</span>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-gray-200 border-t border-gray-300 flex justify-end gap-2">
          <button 
            onClick={handlePrint}
            className="bg-gradient-to-b from-gray-100 to-gray-300 border border-gray-400 hover:bg-gray-300 text-gray-800 text-xs font-bold py-1.5 px-6 rounded shadow-sm flex items-center gap-2"
          >
            Imprimir
          </button>
          <button 
            onClick={onClose}
            className="bg-gradient-to-b from-gray-100 to-gray-300 border border-gray-400 hover:bg-gray-300 text-gray-800 text-xs font-bold py-1.5 px-6 rounded shadow-sm"
          >
            Salir
          </button>
        </div>
      </div>
    </div>
  );
}
