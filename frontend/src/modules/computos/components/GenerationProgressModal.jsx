import React from 'react';
import { RefreshCw } from 'lucide-react';

export default function GenerationProgressModal({ isOpen, text, stepInfo }) {
  if (!isOpen) return null;
  const { current = 0, total = 0 } = stepInfo || {};

  return (
    <div className="absolute inset-0 z-[120] bg-[#FEF3C7]/95 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md w-full bg-white border-2 border-amber-300 rounded-3xl p-6 sm:p-8 shadow-xl space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-amber-500 text-white flex items-center justify-center mx-auto shadow-lg shadow-amber-500/30">
          <RefreshCw className="w-7 h-7 animate-spin" />
        </div>
        <h3 className="text-amber-950 font-extrabold text-lg">Procesando Cómputos y Generando Presupuesto</h3>
        <p className="text-xs sm:text-sm text-amber-800 leading-relaxed font-medium">
          {text || 'Buscando coincidencias en la base de datos y estructurando APUs...'}
        </p>
        {total > 0 && (
          <div className="space-y-1.5 pt-1">
            <div className="w-full h-2.5 bg-amber-100 rounded-full overflow-hidden border border-amber-200">
              <div
                className="h-full bg-amber-500 transition-all duration-300 rounded-full"
                style={{ width: `${Math.min(100, Math.round((current / total) * 100))}%` }}
              />
            </div>
            <p className="text-[11px] font-bold text-amber-700">Partida {current} de {total}</p>
          </div>
        )}
      </div>
    </div>
  );
}
