import React from 'react';
import { Calculator, Sparkles } from 'lucide-react';

/**
 * Selector de Arquitectura para Superadmin.
 * Permite alternar mutuamente entre:
 * - Modo Matemático (Síntesis Inversa Component-First)
 * - Modo Adaptativo (Adaptación RAG Clásica)
 * Sin emojis, únicamente con iconos de React Icons (lucide-react).
 */
export default function ArchitectureModeSelector({
  generationMode = 'rag',
  onChange,
  className = '',
  compact = false
}) {
  return (
    <div
      className={`inline-flex items-center p-1 bg-slate-100 rounded-xl border border-slate-300 shadow-xs ${className}`}
      role="group"
      aria-label="Selector de arquitectura de generación APU"
    >
      <button
        type="button"
        onClick={() => onChange && onChange('inverse')}
        className={`flex items-center gap-1.5 rounded-lg font-bold transition-all cursor-pointer ${
          compact ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'
        } ${
          generationMode === 'inverse'
            ? 'bg-white text-blue-700 shadow-xs ring-1 ring-blue-500/20'
            : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
        }`}
        title="Modo Matemático: Cuadrilla canónica y rendimiento determinista por horas-hombre con fusible biomecánico + auditoría IA."
      >
        <Calculator size={compact ? 13 : 14} className={generationMode === 'inverse' ? 'text-blue-600' : 'text-slate-500'} />
        <span>Modo Matemático</span>
      </button>

      <button
        type="button"
        onClick={() => onChange && onChange('rag')}
        className={`flex items-center gap-1.5 rounded-lg font-bold transition-all cursor-pointer ${
          compact ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'
        } ${
          generationMode === 'rag'
            ? 'bg-white text-indigo-700 shadow-xs ring-1 ring-indigo-500/20'
            : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
        }`}
        title="Modo Adaptativo: Búsqueda de partida base similar en 17.408 partidas COVENIN y adaptación por Gemini."
      >
        <Sparkles size={compact ? 13 : 14} className={generationMode === 'rag' ? 'text-indigo-600' : 'text-slate-500'} />
        <span>Modo Adaptativo</span>
      </button>
    </div>
  );
}
