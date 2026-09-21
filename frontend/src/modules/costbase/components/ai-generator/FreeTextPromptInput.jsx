import React, { useState } from 'react';
import { Bot, Edit2, AlertTriangle, Loader, Sparkles, CheckCircle2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import ArchitectureModeSelector from './ArchitectureModeSelector';

export default function FreeTextPromptInput({
  prompt,
  setPrompt,
  selectedUnit,
  setSelectedUnit,
  isGuidedMode,
  isSmartMode,
  isClarifying,
  loading,
  exactMatchCandidate,
  subscriptionErrorMsg,
  onOpenSubscriptionModal,
  onGenerate,
  onSwitchToGuided,
  onSwitchToLibre,
  isSuperAdmin = false,
  generationMode = 'rag',
  setGenerationMode,
  useTypesafeJev = false,
  setUseTypesafeJev = null
}) {
  const [unitWarning, setUnitWarning] = useState(false);

  // Detección reactiva de términos de mantenimiento / reparación
  const isMaintenance = /mantenimiento|saneamiento|reconstrucci[oó]n|arreglo|reparaci[oó]n|rehabilitaci[oó]n|restauraci[oó]n/i.test(prompt || '');

  const handleGenerateClick = () => {
    if (!prompt.trim() || isSmartMode || loading) return;

    if (isMaintenance && !selectedUnit) {
      setUnitWarning(true);
      toast.error('Para actividades de mantenimiento o reparación, debes seleccionar la unidad de cómputo obligatoria.', {
        id: 'unit-required-toast',
        duration: 4500,
        icon: '⚠️'
      });
      return;
    }

    setUnitWarning(false);
    onGenerate(prompt, selectedUnit);
  };

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-3">
          <label className="block text-sm font-bold text-slate-700 flex items-center gap-2">
            {isSmartMode
              ? 'Smart Selector: Selecciona las características'
              : 'Descripción Estructurada (APU Builder)'}
          </label>
          {isSuperAdmin && !isSmartMode && !isGuidedMode && (
            <ArchitectureModeSelector
              generationMode={generationMode}
              onChange={setGenerationMode}
              compact={true}
              useTypesafeJev={useTypesafeJev}
              onToggleTypesafeJev={setUseTypesafeJev}
            />
          )}
        </div>

        {!isSmartMode && (
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
            handleGenerateClick();
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
        className={`w-full h-24 p-4 border rounded-xl focus:outline-none focus:ring-2 transition-all text-sm mb-3 disabled:opacity-50 disabled:cursor-not-allowed ${
          isSmartMode
            ? 'bg-blue-50/50 border-blue-300 focus:border-blue-500 focus:ring-blue-500/20'
            : 'bg-slate-50 border-slate-300 hover:border-[#1D4ED8]/50 focus:bg-white focus:border-[#1D4ED8] focus:ring-[#1D4ED8]/25'
        }`}
      />

      {/* PANEL OBLIGATORIO DE UNIDAD PARA MANTENIMIENTO */}
      {!isGuidedMode && !isSmartMode && isMaintenance && (
        <div className={`mb-4 p-3.5 rounded-xl border transition-all animate-in fade-in slide-in-from-top-1 duration-200 ${
          unitWarning && !selectedUnit
            ? 'bg-amber-50/90 border-amber-400 ring-2 ring-amber-400/30'
            : 'bg-blue-50/70 border-blue-200'
        }`}>
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <span className={`w-5 h-5 rounded-full inline-flex items-center justify-center text-xs font-bold shrink-0 ${
                unitWarning && !selectedUnit ? 'bg-amber-500 text-white' : 'bg-blue-600 text-white'
              }`}>
                !
              </span>
              <span className="text-xs font-bold text-slate-800">
                Actividad de mantenimiento/reparación detectada: <span className="text-blue-700 underline">Selecciona la unidad de cómputo</span>
              </span>
            </div>
            {selectedUnit && (
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                <CheckCircle2 size={12} /> Unidad: {selectedUnit}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: 'pza', label: 'pza', sub: 'Por Pieza / Peldaño' },
              { id: 'und', label: 'und', sub: 'Por Unidad' },
              { id: 'm2', label: 'm²', sub: 'Superficie desarrollada' },
              { id: 'm', label: 'm', sub: 'Metro Lineal' },
              { id: 'Gl', label: 'Gl', sub: 'Suma Global' }
            ].map((item) => {
              const isSelected = selectedUnit === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setSelectedUnit(isSelected ? null : item.id);
                    setUnitWarning(false);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-600/30'
                      : 'bg-white text-slate-700 border border-slate-300 hover:border-blue-400 hover:bg-blue-50/60'
                  }`}
                >
                  <span className={isSelected ? 'text-white' : 'text-blue-600 font-extrabold'}>{item.label}</span>
                  <span className={`text-[11px] font-normal ${isSelected ? 'text-blue-100' : 'text-slate-500'}`}>({item.sub})</span>
                </button>
              );
            })}
          </div>
        </div>
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

      {!isGuidedMode && !isSmartMode && !exactMatchCandidate && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleGenerateClick}
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
