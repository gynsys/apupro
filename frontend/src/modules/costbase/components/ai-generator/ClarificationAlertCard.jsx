import React from 'react';
import { Sparkles, X, RotateCcw } from 'lucide-react';

export default function ClarificationAlertCard({
  message,
  recommendation,
  questions = [],
  entryModeSource = 'libre',
  onDismiss,
  onStartGuided,
  onResetChatbot,
  onResetLibre
}) {
  return (
    <div className="mb-6 p-5 bg-amber-50/90 border-2 border-amber-200 rounded-2xl shadow-sm animate-in fade-in zoom-in-95 duration-300">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-amber-500 text-white rounded-xl shrink-0 shadow-sm shadow-amber-500/30">
            <Sparkles size={20} />
          </div>
          <div>
            <h4 className="text-amber-950 font-bold text-base leading-tight">
              {message || "No fue posible interpretar una partida técnica válida"}
            </h4>
            <p className="text-xs text-amber-800 mt-1 font-medium">
              {recommendation || "Te recomendamos utilizar el Asistente Guiado para estructurar tu descripción paso a paso."}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="text-amber-700 hover:text-amber-950 p-1.5 rounded-lg hover:bg-amber-100 transition-colors shrink-0 cursor-pointer"
          title="Cerrar aviso"
          aria-label="Cerrar aviso"
        >
          <X size={18} />
        </button>
      </div>
      
      {questions.length > 0 && (
        <div className="my-3 bg-white/90 border border-amber-200 rounded-xl p-3.5 shadow-xs">
          <p className="text-xs font-bold text-amber-900 mb-2 uppercase tracking-wide">REDACCIÓN RECOMENDADA:</p>
          <ul className="text-sm text-slate-700 space-y-2 font-medium">
            {questions.map((q, idx) => {
              const hasNumber = /^\d+[\.\)]\s*/.test(q);
              return (
                <li key={idx} className="flex items-start gap-2">
                  {!hasNumber && <span className="text-amber-600 font-bold shrink-0">•</span>}
                  <span>{q}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="mt-4 pt-3 border-t border-amber-200/70 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onStartGuided}
          className="px-4 py-2 bg-amber-600 text-white rounded-xl text-xs font-bold hover:bg-amber-700 transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer"
        >
          <Sparkles size={14} /> Usar Asistente Guiado Paso a Paso
        </button>

        {entryModeSource === 'chat' ? (
          <button
            type="button"
            onClick={onResetChatbot}
            className="px-3 py-2 bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 rounded-xl text-xs font-bold transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw size={14} /> Reiniciar Chatbot
          </button>
        ) : (
          <button
            type="button"
            onClick={onResetLibre}
            className="px-3 py-2 bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 rounded-xl text-xs font-bold transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw size={14} /> Reiniciar Entrada Libre
          </button>
        )}
      </div>
    </div>
  );
}
