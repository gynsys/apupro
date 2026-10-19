import React from 'react';
import { Calculator, Sparkles, Zap, Layers } from 'lucide-react';

/**
 * Selector de Arquitectura para Superadmin.
 * Permite alternar mutuamente entre:
 * - Modo Matemático (Síntesis Inversa Component-First)
 * - Modo Adaptativo (Adaptación RAG Clásica v1)
 * - Motor v2.0 (WorkSpec + Compositor Determinista)
 * Y opcionalmente activar el Copiloto de decisión rápida TypeSafe Jev System One.
 */
export default function ArchitectureModeSelector({
  generationMode = 'rag',
  onChange,
  className = '',
  compact = false,
  useTypesafeJev = false,
  onToggleTypesafeJev = null
}) {
  return (
    <div
      className={`inline-flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-300 shadow-xs ${className}`}
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
        title="Modo Adaptativo (v1): Búsqueda de partida base similar en 17.408 partidas COVENIN y adaptación por Gemini/DeepSeek."
      >
        <Sparkles size={compact ? 13 : 14} className={generationMode === 'rag' ? 'text-indigo-600' : 'text-slate-500'} />
        <span>Modo Adaptativo (v1)</span>
      </button>

      <button
        type="button"
        onClick={() => onChange && onChange('v2')}
        className={`flex items-center gap-1.5 rounded-lg font-bold transition-all cursor-pointer ${
          compact ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'
        } ${
          generationMode === 'v2'
            ? 'bg-white text-emerald-700 shadow-xs ring-1 ring-emerald-500/20'
            : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
        }`}
        title="Motor v2.0 (WorkSpec): Fase 1 rápida (LLM extrae WorkSpec tipado en 2s) + Fase 2 determinista (Compositor sin alucinaciones)."
      >
        <Layers size={compact ? 13 : 14} className={generationMode === 'v2' ? 'text-emerald-600' : 'text-slate-500'} />
        <span>Motor v2.0 (WorkSpec)</span>
      </button>

      {onToggleTypesafeJev && (
        <>
          <div className="w-px h-4 bg-slate-300 mx-0.5" />
          <button
            type="button"
            onClick={() => onToggleTypesafeJev(!useTypesafeJev)}
            className={`flex items-center gap-1 rounded-lg font-bold transition-all cursor-pointer ${
              compact ? 'px-2 py-1 text-[11px]' : 'px-2.5 py-1.5 text-xs'
            } ${
              useTypesafeJev
                ? 'bg-teal-600 text-white shadow-xs'
                : 'text-slate-500 hover:text-teal-700 hover:bg-white/60'
            }`}
            title="Copiloto TypeSafe Jev System One: Pre-evaluación estructurada y tipada (<500ms) para comparar resultados."
          >
            <Zap size={compact ? 12 : 13} className={useTypesafeJev ? 'text-amber-300' : 'text-teal-600'} />
            <span>Jev {useTypesafeJev ? 'ON' : 'OFF'}</span>
          </button>
        </>
      )}
    </div>
  );
}
