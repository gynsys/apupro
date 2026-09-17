import React, { useState, useMemo } from 'react';
import { Sparkles, X, RotateCcw, Check, ArrowRight, Send, Edit3 } from 'lucide-react';

export default function ClarificationAlertCard({
  message,
  recommendation,
  questions = [],
  options = [],
  entryModeSource = 'libre',
  onDismiss,
  onStartGuided,
  onResetChatbot,
  onResetLibre,
  onClarificationSubmit,
  onEditOriginalPrompt
}) {
  const [customInput, setCustomInput] = useState('');

  // Extraer opciones rápidas sugeridas desde el array de opciones o inferir de (Ej: ...)
  const suggestedOptions = useMemo(() => {
    if (Array.isArray(options) && options.length > 0) {
      return options;
    }
    const allText = [message || '', ...(questions || [])].join(' ');
    const match = allText.match(/\(Ej:\s*([^)]+)\)/i);
    if (match && match[1]) {
      return match[1]
        .split(/[,/]/)
        .map(s => s.trim())
        .filter(s => s.length > 0 && s.length < 30);
    }
    return [];
  }, [options, message, questions]);

  const handleOptionClick = (optionText) => {
    if (onClarificationSubmit) {
      onClarificationSubmit(optionText);
    }
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (!customInput.trim()) return;
    if (onClarificationSubmit) {
      onClarificationSubmit(customInput.trim());
      setCustomInput('');
    }
  };

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
              {recommendation || "Indica este parámetro técnico para seleccionar o construir el APU con el costo exacto."}
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
          <p className="text-xs font-bold text-amber-900 mb-2 uppercase tracking-wide">INFORMACIÓN TÉCNICA REQUERIDA:</p>
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

      {/* SECCIÓN INTERACTIVA DE RESPUESTA DIRECTA (SIN SALIR NI BORRAR) */}
      <div className="my-4 p-4 bg-amber-100/70 border border-amber-300 rounded-xl">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
            <Send size={14} className="text-amber-700" />
            Ingresa la información para continuar de inmediato:
          </span>
          {onEditOriginalPrompt && (
            <button
              type="button"
              onClick={onEditOriginalPrompt}
              className="text-xs text-blue-700 hover:text-blue-900 font-semibold underline flex items-center gap-1 cursor-pointer"
            >
              <Edit3 size={12} /> Editar descripción completa
            </button>
          )}
        </div>

        {/* Chips de selección rápida sugeridos */}
        {suggestedOptions.length > 0 && (
          <div className="mb-3">
            <p className="text-[11px] font-bold text-amber-900/80 uppercase tracking-wider mb-1.5">
              Opciones rápidas frecuentes:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {suggestedOptions.map((opt, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleOptionClick(opt)}
                  className="px-3 py-1.5 bg-white hover:bg-amber-600 hover:text-white text-amber-950 border border-amber-300 rounded-lg text-xs font-bold shadow-xs transition-all cursor-pointer active:scale-95 flex items-center gap-1.5"
                >
                  <span>{opt}</span>
                  <ArrowRight size={11} className="opacity-60" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Entrada libre para cualquier parámetro o valor personalizado */}
        <form onSubmit={handleFormSubmit} className="flex gap-2">
          <input
            type="text"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            placeholder="Escribe el parámetro aquí (ej: e=12 cm, 2 HP, calibre 10, etc.)..."
            className="flex-1 px-3 py-2 text-xs sm:text-sm bg-white border border-amber-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-slate-800 placeholder-slate-400"
            autoFocus
          />
          <button
            type="submit"
            disabled={!customInput.trim()}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-95 shrink-0"
          >
            <Check size={14} /> Responder y Generar
          </button>
        </form>
      </div>

      <div className="mt-3 pt-3 border-t border-amber-200/70 flex flex-wrap items-center gap-3">
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
