import React from 'react';
import { Bot, Edit2, AlertTriangle, Loader, Sparkles } from 'lucide-react';

export default function FreeTextPromptInput({
  prompt,
  setPrompt,
  isGuidedMode,
  isSmartMode,
  isClarifying,
  loading,
  exactMatchCandidate,
  subscriptionErrorMsg,
  onOpenSubscriptionModal,
  onGenerate,
  onSwitchToGuided,
  onSwitchToLibre
}) {
  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <label className="block text-sm font-bold text-slate-700 flex items-center gap-2">
          {isSmartMode
            ? 'Smart Selector: Selecciona las características'
            : isClarifying
            ? 'Responde a la IA para continuar'
            : 'Descripción Estructurada (APU Builder)'}
        </label>

        {!isSmartMode && !isClarifying && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onSwitchToGuided}
              className={`relative overflow-hidden group px-4 py-2 rounded-xl transition-all active:scale-95 cursor-pointer ${
                isGuidedMode
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 shadow-md shadow-blue-500/25 text-white'
                  : 'bg-white border-2 border-slate-300 text-slate-700 shadow-xs hover:border-blue-300'
              }`}
            >
              <div className="absolute inset-0 bg-[#e0f2fe] transform scale-x-0 origin-left transition-transform duration-400 ease-[cubic-bezier(0.25,1,0.5,1)] group-hover:scale-x-100"></div>
              <div
                className={`relative z-10 flex items-center gap-2 text-xs font-bold transition-colors ${
                  isGuidedMode ? 'text-white group-hover:text-[#1e3a8a]' : 'text-slate-700 group-hover:text-[#1e3a8a]'
                }`}
              >
                <Bot size={15} />
                <span>Asistente IA</span>
              </div>
            </button>
            <button
              type="button"
              onClick={onSwitchToLibre}
              className={`relative overflow-hidden group px-4 py-2 rounded-xl transition-all active:scale-95 cursor-pointer ${
                !isGuidedMode
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 shadow-md shadow-blue-500/25 text-white'
                  : 'bg-white border border-slate-200 text-slate-700 shadow-xs hover:border-blue-300'
              }`}
            >
              <div className="absolute inset-0 bg-[#e0f2fe] transform scale-x-0 origin-left transition-transform duration-400 ease-[cubic-bezier(0.25,1,0.5,1)] group-hover:scale-x-100"></div>
              <div
                className={`relative z-10 flex items-center gap-2 text-xs font-bold transition-colors ${
                  !isGuidedMode ? 'text-white group-hover:text-[#1e3a8a]' : 'text-slate-700 group-hover:text-[#1e3a8a]'
                }`}
              >
                <Edit2 size={14} />
                <span>Modo Libre</span>
              </div>
            </button>
          </div>
        )}
      </div>

      {!isClarifying && (
        <textarea
          value={prompt}
          onChange={(e) => {
            if (!isGuidedMode) {
              setPrompt(e.target.value);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (prompt.trim() && !isSmartMode && !exactMatchCandidate) {
                onGenerate(prompt);
              }
            }
          }}
          disabled={isSmartMode || isGuidedMode}
          placeholder={
            isSmartMode
              ? 'Responde las preguntas del filtro inteligente arriba...'
              : isGuidedMode
              ? 'Usa los selectores de arriba para formar la descripción...'
              : 'Modo experto: Escribe la partida libremente...'
          }
          className={`w-full h-24 p-4 border rounded-xl focus:outline-none focus:ring-2 transition-all text-sm mb-4 disabled:opacity-50 disabled:cursor-not-allowed ${
            isSmartMode
              ? 'bg-blue-50/50 border-blue-300 focus:border-blue-500 focus:ring-blue-500/20'
              : 'bg-slate-50 border-slate-300 hover:border-[#1D4ED8]/50 focus:bg-white focus:border-[#1D4ED8] focus:ring-[#1D4ED8]/25'
          }`}
        />
      )}

      {subscriptionErrorMsg && (
        <div className="mb-4 p-4 bg-amber-50 border border-amber-300 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-2 bg-amber-200/70 text-amber-800 rounded-lg shrink-0 mt-0.5 sm:mt-0">
              <AlertTriangle size={20} />
            </div>
            <div>
              <p className="text-sm font-bold text-amber-900 leading-snug">{subscriptionErrorMsg}</p>
              <p className="text-xs text-amber-800/80 mt-0.5">
                El Generador APU con IA es una función premium. Activa o renueva tu suscripción para obtener acceso ilimitado.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenSubscriptionModal}
            className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white text-xs font-bold rounded-lg shadow-sm shrink-0 transition-all cursor-pointer"
          >
            Ver Planes
          </button>
        </div>
      )}

      {!isGuidedMode && !isSmartMode && !isClarifying && !exactMatchCandidate && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => onGenerate(prompt)}
            disabled={loading || !prompt.trim() || isSmartMode}
            className="flex items-center gap-2 text-white px-6 py-3 rounded-xl transition-all shadow-md font-bold disabled:opacity-50 active:scale-95 cursor-pointer bg-[#1D4ED8] hover:bg-blue-800 shadow-blue-600/25"
          >
            {loading ? <Loader className="animate-spin" size={18} /> : <Sparkles size={18} />}
            {loading ? 'Generando APU...' : 'Generar APU'}
          </button>
        </div>
      )}
    </>
  );
}
