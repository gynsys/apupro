import React from 'react';
import { CheckCircle2, Check, Sparkles } from 'lucide-react';

export default function ExactMatchCard({ candidate, onAccept, onReject }) {
  if (!candidate) return null;

  return (
    <div className="mb-6 p-5 bg-emerald-50/95 border-2 border-emerald-300 rounded-2xl shadow-md animate-in fade-in zoom-in-95 duration-300">
      <div className="flex items-start gap-3 mb-3">
        <div className="p-2 bg-emerald-600 text-white rounded-xl shrink-0 shadow-sm shadow-emerald-600/30">
          <CheckCircle2 size={22} />
        </div>
        <div>
          <h4 className="text-emerald-950 font-bold text-base leading-tight">
            Existe una partida que coincide casi al 100% con tu descripción:
          </h4>
          <p className="text-xs text-emerald-800 mt-1 font-medium">
            Encontramos una partida certificada en la base de datos maestra con estructura técnica y costos comprobados.
          </p>
        </div>
      </div>

      <div className="my-3 bg-white border border-emerald-200 rounded-xl p-4 shadow-xs">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-lg font-mono tracking-wide">
            {candidate.cov_par || candidate.cod_par}
          </span>
          <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
            Unidad: {candidate.unit}
          </span>
          <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
            Rendimiento: {candidate.performance || candidate.ren_par || 1.0} {candidate.unit}/día
          </span>
        </div>
        <p className="text-sm font-semibold text-slate-800 uppercase leading-snug">
          {candidate.description}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 mt-4 pt-3 border-t border-emerald-200/70">
        <button
          onClick={onAccept}
          className="w-full sm:w-auto justify-center px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-sm flex items-center gap-2 transition-all transform active:scale-95 cursor-pointer min-h-[44px] touch-target"
        >
          <Check size={18} /> Sí, es esa
        </button>
        <button
          onClick={onReject}
          className="w-full sm:w-auto justify-center px-4 py-2.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-xl text-sm font-bold shadow-sm flex items-center gap-2 transition-all cursor-pointer min-h-[44px] touch-target"
        >
          <Sparkles size={16} className="text-amber-500" /> No es esa (Generar con IA)
        </button>
      </div>
    </div>
  );
}
