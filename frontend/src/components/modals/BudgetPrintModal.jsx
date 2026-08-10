import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X, CheckSquare, Square, Type, DollarSign } from 'lucide-react';

export default function BudgetPrintModal({ onClose, onPrint, initialCurrency = 'USD' }) {
  const [config, setConfig] = useState({
    type: 'general', // 'general' or 'capitulos' - cambiado a 'general' por defecto
    includeLogo: true,
    includeRif: true,
    includeIva: true,
    currency: initialCurrency,
    title: 'PRESUPUESTO'
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onPrint(config);
  };

  const handleTypeChange = (type) => {
    setConfig(prev => ({ ...prev, type }));
  };

  const toggleCheckbox = (field) => {
    setConfig(prev => ({ ...prev, [field]: !prev[field] }));
  };

  return createPortal(
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-[450px] bg-amber-100 rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.08)] overflow-hidden font-sans flex flex-col animate-in fade-in zoom-in-95 duration-200">
        
        {/* Encabezado */}
        <div className="flex justify-between items-center px-6 py-4 bg-white/40 border-b border-amber-600/15">
          <h2 className="m-0 text-xl font-bold text-amber-900 flex items-center gap-2">
            <Printer className="text-sky-600" /> Imprimir Reporte
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
        <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-5">
          
          {/* Tipo de Presupuesto (Mutuamente excluyente) */}
          <div className="flex flex-col gap-3">
            <label className="text-[13px] font-bold text-amber-900 uppercase tracking-wide">Formato</label>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-3 cursor-pointer group">
                <div onClick={() => handleTypeChange('general')} className="text-sky-600 transition-transform group-active:scale-95">
                  {config.type === 'general' ? <CheckSquare className="text-sky-600" size={20} /> : <Square className="text-sky-300" size={20} />}
                </div>
                <span className="text-sm font-medium text-slate-700 select-none group-hover:text-amber-900 transition-colors" onClick={() => handleTypeChange('general')}>Presupuesto General</span>
              </label>
              
              <label className="flex items-center gap-3 cursor-pointer group">
                <div onClick={() => handleTypeChange('capitulos')} className="text-sky-600 transition-transform group-active:scale-95">
                  {config.type === 'capitulos' ? <CheckSquare className="text-sky-600" size={20} /> : <Square className="text-sky-300" size={20} />}
                </div>
                <span className="text-sm font-medium text-slate-700 select-none group-hover:text-amber-900 transition-colors" onClick={() => handleTypeChange('capitulos')}>Presupuesto por Capítulos</span>
              </label>
            </div>
          </div>

          <hr className="border-amber-600/15" />

          {/* Opciones Adicionales */}
          <div className="flex flex-col gap-3">
            <label className="text-[13px] font-bold text-amber-900 uppercase tracking-wide">Incluir en el membrete</label>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex items-center gap-3 cursor-pointer group">
                <div onClick={() => toggleCheckbox('includeLogo')} className="text-sky-600 transition-transform group-active:scale-95">
                  {config.includeLogo ? <CheckSquare className="text-sky-600" size={20} /> : <Square className="text-sky-300" size={20} />}
                </div>
                <span className="text-sm font-medium text-slate-700 select-none" onClick={() => toggleCheckbox('includeLogo')}>Logotipo</span>
              </label>
              
              <label className="flex items-center gap-3 cursor-pointer group">
                <div onClick={() => toggleCheckbox('includeRif')} className="text-sky-600 transition-transform group-active:scale-95">
                  {config.includeRif ? <CheckSquare className="text-sky-600" size={20} /> : <Square className="text-sky-300" size={20} />}
                </div>
                <span className="text-sm font-medium text-slate-700 select-none" onClick={() => toggleCheckbox('includeRif')}>RIF de la Empresa</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer group">
                <div onClick={() => toggleCheckbox('includeIva')} className="text-sky-600 transition-transform group-active:scale-95">
                  {config.includeIva ? <CheckSquare className="text-sky-600" size={20} /> : <Square className="text-sky-300" size={20} />}
                </div>
                <span className="text-sm font-medium text-slate-700 select-none" onClick={() => toggleCheckbox('includeIva')}>Desglose I.V.A</span>
              </label>
            </div>
          </div>

          <hr className="border-amber-600/15" />

          {/* Textos y Selectores */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-[13px] font-semibold text-amber-900 flex items-center gap-1">
                <Type size={14}/> Título del Documento
              </label>
              <input 
                type="text" 
                value={config.title}
                onChange={e => setConfig({...config, title: e.target.value})}
                className="px-3 py-1.5 border border-sky-200 rounded-xl text-sm text-sky-700 bg-sky-50 outline-none transition-all focus:border-sky-600 focus:bg-sky-100 focus:ring-4 focus:ring-sky-700/10 font-bold uppercase"
              />
            </div>
            
            <div className="flex flex-col gap-2">
              <label className="text-[13px] font-semibold text-amber-900 flex items-center gap-1">
                <DollarSign size={14}/> Moneda a mostrar
              </label>
              <select 
                value={config.currency}
                onChange={e => setConfig({...config, currency: e.target.value})}
                className="px-3 py-1.5 border border-sky-200 rounded-xl text-sm text-sky-700 bg-sky-50 outline-none transition-all focus:border-sky-600 focus:bg-sky-100 focus:ring-4 focus:ring-sky-700/10 font-bold"
              >
                <option value="USD">Dólares (USD)</option>
                <option value="BS">Bolívares (BS)</option>
              </select>
            </div>
          </div>
          
          {/* Botones */}
          <div className="flex justify-end gap-3 mt-4">
            <button 
              type="button"
              onClick={onClose}
              className="bg-transparent border-none text-amber-700 text-sm font-semibold px-5 py-2 cursor-pointer rounded-xl hover:bg-white/30 transition-colors"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              className="flex items-center gap-2 bg-sky-600 text-white border-none text-sm font-semibold px-6 py-2 rounded-xl cursor-pointer shadow-[0_4px_6px_rgba(2,132,199,0.2)] transition-all hover:bg-sky-700 hover:-translate-y-[1px]"
            >
              <Printer size={16} /> Generar Impresión
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
