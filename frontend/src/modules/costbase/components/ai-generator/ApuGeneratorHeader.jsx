import React from 'react';
import { ArrowLeft, Plus, FileText, Sparkles } from 'lucide-react';
import ArchitectureModeSelector from './ArchitectureModeSelector';

export default function ApuGeneratorHeader({
  creationMode,
  item,
  onBack,
  generationMode = 'rag',
  setGenerationMode,
  useTypesafeJev = false,
  setUseTypesafeJev,
  isSuperAdmin = true
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
      <div className="flex items-center gap-4">
        {creationMode !== 'manual' && (creationMode !== 'import' || Boolean(item)) && (
          <button 
            onClick={onBack}
            className="p-2 bg-white border border-slate-300 rounded-xl hover:bg-slate-100 hover:text-blue-600 transition-colors shrink-0 shadow-sm cursor-pointer"
            title={item ? (creationMode === 'import' ? "Volver al Selector de APU" : "Volver al Generador") : "Volver a CostBase"}
          >
            <ArrowLeft size={20} />
          </button>
        )}
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

      {creationMode === 'ia' && setGenerationMode && isSuperAdmin && (
        <div className="flex items-center gap-2">
          <ArchitectureModeSelector
            generationMode={generationMode}
            onChange={setGenerationMode}
            compact={false}
            useTypesafeJev={useTypesafeJev}
            onToggleTypesafeJev={setUseTypesafeJev}
          />
        </div>
      )}
    </div>
  );
}
