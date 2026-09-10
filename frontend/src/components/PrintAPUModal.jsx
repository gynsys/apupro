import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Printer, CheckSquare, Square } from 'lucide-react';

export default function PrintAPUModal({ isOpen, onClose, onPrint, budgetName = "" }) {
  const [options, setOptions] = useState({
    scope: 'current',
    format: 'lines',      // fijo: siempre con líneas
    color: true,          // fijo: siempre a color
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

  const toggle = (field) => {
    setOptions(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const handlePrint = () => {
    onPrint(options);
  };

  return createPortal(
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:hidden">
      <div className="w-full max-w-[420px] bg-amber-100 rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.08)] overflow-hidden font-sans flex flex-col animate-in fade-in zoom-in-95 duration-200">

        {/* Encabezado */}
        <div className="flex justify-between items-center px-6 py-4 bg-white/40 border-b border-amber-600/15">
          <h2 className="m-0 text-xl font-bold text-amber-900 flex items-center gap-2">
            <Printer className="text-sky-600" /> Tipo de Impresión
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-amber-700 hover:text-amber-900 bg-transparent transition-colors p-1"
          >
            <X size={24} />
          </button>
        </div>

        {/* Cuerpo */}
        <div className="px-6 py-5 flex flex-col gap-5">

          {/* Alcance */}
          <div className="flex flex-col gap-3">
            <label className="text-[13px] font-bold text-amber-900 uppercase tracking-wide">
              Alcance
            </label>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-3 cursor-pointer group">
                <div onClick={() => handleChange('scope', 'current')} className="text-sky-600 transition-transform group-active:scale-95">
                  {options.scope === 'current' ? <CheckSquare className="text-sky-600" size={20} /> : <Square className="text-sky-300" size={20} />}
                </div>
                <span
                  className="text-sm font-medium text-slate-700 select-none group-hover:text-amber-900 transition-colors"
                  onClick={() => handleChange('scope', 'current')}
                >
                  Imprimir APU Actual
                </span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer group">
                <div onClick={() => handleChange('scope', 'all')} className="text-sky-600 transition-transform group-active:scale-95">
                  {options.scope === 'all' ? <CheckSquare className="text-sky-600" size={20} /> : <Square className="text-sky-300" size={20} />}
                </div>
                <span
                  className="text-sm font-medium text-slate-700 select-none group-hover:text-amber-900 transition-colors"
                  onClick={() => handleChange('scope', 'all')}
                >
                  Imprimir Todos los APU
                </span>
              </label>
            </div>
          </div>

          <hr className="border-amber-600/15" />

          {/* Opciones de contenido */}
          <div className="flex flex-col gap-3">
            <label className="text-[13px] font-bold text-amber-900 uppercase tracking-wide">
              Incluir en el documento
            </label>
            <div className="flex flex-col gap-2">

              {/* Nombre de Empresa */}
              <div className="flex flex-col gap-1">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div onClick={() => toggle('showCompany')} className="text-sky-600 transition-transform group-active:scale-95">
                    {options.showCompany ? <CheckSquare className="text-sky-600" size={20} /> : <Square className="text-sky-300" size={20} />}
                  </div>
                  <span
                    className="text-sm font-medium text-slate-700 select-none group-hover:text-amber-900 transition-colors"
                    onClick={() => toggle('showCompany')}
                  >
                    Nombre de Empresa
                  </span>
                </label>
                {options.showCompany && (
                  <div className="pl-9">
                    <input
                      type="text"
                      value={options.companyName}
                      onChange={(e) => handleChange('companyName', e.target.value)}
                      className="w-full px-3 py-1.5 border border-sky-200 rounded-xl text-sm text-sky-700 bg-sky-50 outline-none focus:border-sky-600 focus:ring-4 focus:ring-sky-700/10 font-medium"
                    />
                  </div>
                )}
              </div>

              {/* Horas Hombre */}
              <label className="flex items-center gap-3 cursor-pointer group">
                <div onClick={() => toggle('showManHours')} className="text-sky-600 transition-transform group-active:scale-95">
                  {options.showManHours ? <CheckSquare className="text-sky-600" size={20} /> : <Square className="text-sky-300" size={20} />}
                </div>
                <span
                  className="text-sm font-medium text-slate-700 select-none group-hover:text-amber-900 transition-colors"
                  onClick={() => toggle('showManHours')}
                >
                  Imprimir Horas Hombre
                </span>
              </label>

              {/* Porcentajes */}
              <label className="flex items-center gap-3 cursor-pointer group">
                <div onClick={() => toggle('showPercentages')} className="text-sky-600 transition-transform group-active:scale-95">
                  {options.showPercentages ? <CheckSquare className="text-sky-600" size={20} /> : <Square className="text-sky-300" size={20} />}
                </div>
                <span
                  className="text-sm font-medium text-slate-700 select-none group-hover:text-amber-900 transition-colors"
                  onClick={() => toggle('showPercentages')}
                >
                  Porcentajes respecto al Costo Directo
                </span>
              </label>

            </div>
          </div>

          <hr className="border-amber-600/15" />

          {/* Fecha */}
          <div className="flex flex-col gap-3">
            <label className="text-[13px] font-bold text-amber-900 uppercase tracking-wide">
              Fecha
            </label>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-3 cursor-pointer group">
                <div onClick={() => handleChange('dateType', 'none')} className="text-sky-600 transition-transform group-active:scale-95">
                  {options.dateType === 'none' ? <CheckSquare className="text-sky-600" size={20} /> : <Square className="text-sky-300" size={20} />}
                </div>
                <span
                  className="text-sm font-medium text-slate-700 select-none group-hover:text-amber-900 transition-colors"
                  onClick={() => handleChange('dateType', 'none')}
                >
                  Sin Fecha
                </span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer group">
                <div onClick={() => handleChange('dateType', 'current')} className="text-sky-600 transition-transform group-active:scale-95">
                  {options.dateType === 'current' ? <CheckSquare className="text-sky-600" size={20} /> : <Square className="text-sky-300" size={20} />}
                </div>
                <span
                  className="text-sm font-medium text-slate-700 select-none group-hover:text-amber-900 transition-colors"
                  onClick={() => handleChange('dateType', 'current')}
                >
                  Fecha Actual
                </span>
              </label>
            </div>
          </div>

          {/* Botones */}
          <div className="flex justify-end gap-3 mt-1">
            <button
              type="button"
              onClick={onClose}
              className="bg-transparent border-none text-amber-700 text-sm font-semibold px-5 py-2 cursor-pointer rounded-xl hover:bg-white/30 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-2 bg-sky-600 text-white border-none text-sm font-semibold px-6 py-2 rounded-xl cursor-pointer shadow-[0_4px_6px_rgba(2,132,199,0.2)] transition-all hover:bg-sky-700 hover:-translate-y-[1px]"
            >
              <Printer size={16} /> Imprimir
            </button>
          </div>

        </div>
      </div>
    </div>,
    document.body
  );
}
