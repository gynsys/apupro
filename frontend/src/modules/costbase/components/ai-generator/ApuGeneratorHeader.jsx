import React from 'react';
import { ArrowLeft, Plus, FileText, Sparkles } from 'lucide-react';

export default function ApuGeneratorHeader({ creationMode, item, onBack }) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-4">
        <button 
          onClick={onBack}
          className="p-2 bg-white border border-slate-300 rounded-xl hover:bg-slate-100 hover:text-blue-600 transition-colors shrink-0 shadow-sm cursor-pointer"
          title={item ? "Volver al Generador" : "Volver a Cost360"}
        >
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          {creationMode === 'manual' ? (
            <Plus size={20} className="text-blue-600" />
          ) : creationMode === 'import' ? (
            <FileText size={20} className="text-indigo-600" />
          ) : (
            <Sparkles size={20} className="text-[#1D4ED8]" />
          )}
          {creationMode === 'manual'
            ? 'Nuevo APU (Desde Cero)'
            : creationMode === 'import'
            ? 'Importar / Clonar APU'
            : 'Generador de APU con IA'}
        </h2>
      </div>
    </div>
  );
}
