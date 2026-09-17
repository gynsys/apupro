import React, { useRef, useEffect } from 'react';
import { Sparkles, X, Check, Bot, Edit2, Loader2, ArrowLeft, ArrowRight } from 'lucide-react';
import { getParametricStep3Definition } from '../../constants/guidedBuilderConstants';

export default function GuidedAssistantModal({
  isOpen = true,
  onClose,
  currentChatStep,
  guidedMessages = [],
  guidedAccion,
  guidedMaterial,
  chatbotLoadingStage = 0,
  chatInputValue,
  setChatInputValue,
  handleChatSubmit,
  handleGoBack,
  onSwitchToFreeText
}) {
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [guidedMessages, chatbotLoadingStage]);

  if (!isOpen) return null;

  const isSupplyOrInstall = /suministr|instalac|colocac|montaje/i.test(guidedAccion || '');
  const isAcarreo = /acarreo|acarrear|bote|botar|transporte|transportar|traslado/i.test(guidedAccion || '');
  const isMaintenance = /mantenimiento|saneamiento|reconstrucci[oó]n|arreglo|reparaci[oó]n|rehabilitaci[oó]n|restauraci[oó]n/i.test(
    `${guidedAccion || ''} ${guidedMaterial || ''}`
  );
  const isParametric = Boolean(getParametricStep3Definition(guidedMaterial, guidedAccion));
  const stepperItems = [
    { step: 1, label: 'Acción' },
    { step: 2, label: isAcarreo ? 'Material' : (isSupplyOrInstall ? '¿Qué es?' : 'Elemento') },
    { step: 3, label: isAcarreo ? 'Distancia' : (isParametric ? 'Medida / Capacidad' : (isSupplyOrInstall ? '¿Para qué?' : 'Ubicación')) },
    { step: 4, label: isAcarreo ? 'Equipo' : 'Alcance' },
    { step: 5, label: 'Unidad' },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-2 sm:p-4 overflow-hidden animate-in fade-in duration-200">
      <div 
        className="bg-[#FEF3C7] border-2 border-[#FEF3C7] rounded-2xl p-3.5 sm:p-6 relative flex flex-col max-w-lg w-full shadow-2xl animate-in zoom-in-95 duration-200" 
        style={{ minHeight: '380px', maxHeight: '90dvh' }}
      >
        <button 
          onClick={onClose}
          className="absolute top-3 right-3 text-amber-700 hover:text-amber-900 hover:bg-amber-200/50 rounded-full p-2 touch-target flex items-center justify-center transition-colors cursor-pointer"
          aria-label="Cerrar asistente"
        >
          <X size={20} />
        </button>

        <div className="flex items-center gap-3 mb-3 border-b border-amber-200/50 pb-3 flex-shrink-0">
          <div className="w-10 h-10 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold shadow-md shadow-amber-500/30">
            <Sparkles size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-amber-900">Asistente CostBase</h3>
            <p className="text-xs text-amber-800 truncate">Te guiaré paso a paso para crear tu APU.</p>
          </div>
        </div>

        {/* Stepper Interactivo de 5 Pasos */}
        {currentChatStep > 0 && chatbotLoadingStage === 0 && (
          <div className="mb-3 pb-3 border-b border-amber-200/50 flex-shrink-0">
            <div className="flex items-center justify-between gap-1 text-[11px]">
              {stepperItems.map(({ step, label }) => {
                const isDone = currentChatStep > step;
                const isCurrent = currentChatStep === step;
                return (
                  <button
                    key={step}
                    type="button"
                    disabled={!isDone}
                    onClick={() => isDone && handleGoBack && handleGoBack(step)}
                    className={`flex-1 flex flex-col items-center py-1 px-1 rounded-lg transition-all ${
                      isCurrent
                        ? 'bg-amber-500 text-white font-bold shadow-xs'
                        : isDone
                        ? 'bg-amber-200/80 text-amber-900 font-semibold hover:bg-amber-300/80 cursor-pointer'
                        : 'text-amber-800/40 cursor-not-allowed'
                    }`}
                    title={isDone ? `Volver al paso ${step}: ${label}` : label}
                  >
                    <span className="flex items-center gap-0.5">
                      {isDone && <Check size={10} className="text-amber-900" />}
                      <span>{step}. {label}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto pr-2 space-y-6 flex flex-col pb-4 scrollbar-thin scrollbar-thumb-amber-200">
          {guidedMessages.map((msg, idx) => (
            <div key={msg.id || idx} className={`animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col gap-3 ${msg.sender === 'user' ? 'items-end' : ''}`}>
              <div className={`flex items-end gap-2 ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}>
                {msg.sender === 'bot' && (
                  <div className="w-8 h-8 rounded-full bg-amber-500 flex-shrink-0 flex items-center justify-center text-white mb-1 shadow-sm shadow-amber-500/20">
                    <Bot size={18} />
                  </div>
                )}
                {msg.sender === 'user' && msg.step > 0 && chatbotLoadingStage === 0 && (
                  <button
                    type="button"
                    onClick={() => handleGoBack && handleGoBack(msg.step)}
                    title={`Editar o cambiar respuesta del paso ${msg.step}`}
                    className="opacity-70 hover:opacity-100 p-1 text-amber-800 hover:text-amber-950 hover:bg-amber-200/60 rounded-full transition-all cursor-pointer shrink-0"
                  >
                    <Edit2 size={13} />
                  </button>
                )}
                <div className={`${msg.sender === 'bot' ? 'bg-white border border-amber-200 rounded-2xl rounded-bl-none p-4' : 'bg-amber-600 text-white rounded-2xl rounded-br-none px-4 py-2.5'} shadow-sm w-fit max-w-[280px] sm:max-w-[400px]`}>
                  <p className={`text-sm leading-relaxed whitespace-pre-wrap ${msg.sender === 'bot' ? 'text-amber-950' : 'text-white'}`}>{msg.text}</p>
                </div>
              </div>
              {msg.sender === 'bot' && msg.chips && (msg.step === currentChatStep || idx === guidedMessages.length - 1) && (
                <div className="pl-10 flex flex-wrap gap-2 pt-1 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  {msg.chips.map(chip => (
                    <button 
                      key={chip}
                      type="button"
                      onClick={() => handleChatSubmit && handleChatSubmit(chip)}
                      className="bg-white border border-amber-300 hover:border-amber-600 hover:bg-amber-100 text-amber-950 font-semibold text-xs px-3.5 py-1.5 rounded-xl transition-all shadow-sm hover:shadow active:scale-95 cursor-pointer"
                    >
                      {chip}
                    </button>
                  ))}
                  {currentChatStep === 0 && (
                    <button 
                      type="button"
                      onClick={onSwitchToFreeText}
                      className="bg-transparent border border-amber-400 hover:bg-amber-200/60 text-amber-800 font-semibold text-xs px-3.5 py-1.5 rounded-xl transition-all cursor-pointer"
                    >
                      Escribir libremente
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
          
          {chatbotLoadingStage > 0 && (
            <div className="flex items-end gap-2 mt-2 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="w-8 h-8 rounded-full bg-amber-500 flex-shrink-0 flex items-center justify-center text-white mb-1 shadow-sm shadow-amber-500/20">
                <Bot size={18} />
              </div>
              <div className="bg-white border border-amber-200 rounded-2xl rounded-bl-none p-4 shadow-sm w-fit max-w-[280px] sm:max-w-[400px]">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-3 text-amber-700 font-bold">
                    <Loader2 className="animate-spin flex-shrink-0" size={20} />
                    <span className="text-sm">
                      {chatbotLoadingStage === 1 && "Working..."}
                      {chatbotLoadingStage === 2 && "Iniciando preproceso semántico..."}
                      {chatbotLoadingStage === 3 && "Buscando en la BD Maestra con RAG Híbrido..."}
                      {chatbotLoadingStage === 4 && "Construyendo y adaptando APU con IA..."}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-amber-100 rounded-full overflow-hidden mt-1">
                    <div 
                      className="h-full bg-amber-500 transition-all duration-500 ease-out" 
                      style={{ width: `${(chatbotLoadingStage / 4) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Chat Input */}
        {chatbotLoadingStage === 0 && (
          <div className="mt-4 pt-4 border-t border-amber-200 flex-shrink-0">
            <div className="flex gap-2 items-center">
              {currentChatStep > 0 && (
                <button 
                  type="button"
                  onClick={() => handleGoBack && handleGoBack()}
                  title="Volver al paso anterior"
                  className="bg-white border-2 border-amber-300 hover:bg-amber-100 text-amber-900 rounded-full px-3 py-2 text-xs font-bold flex items-center gap-1 transition-all shrink-0 shadow-xs cursor-pointer active:scale-95"
                >
                  <ArrowLeft size={14} />
                  <span className="hidden sm:inline">Atrás</span>
                </button>
              )}
              <input 
                type="text"
                value={chatInputValue}
                onChange={e => setChatInputValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleChatSubmit && handleChatSubmit(chatInputValue);
                }}
                placeholder={
                  currentChatStep === 1 ? "Ej: Suministro e instalación, Suministro, Construcción..." :
                  currentChatStep === 2 ? (isSupplyOrInstall ? "Ej: Bomba centrífuga, Tablero eléctrico, Tubería PVC..." : "Ej: Paredes de bloques, Losa de concreto...") :
                  currentChatStep === 3 ? (isParametric ? "Ej: 2 HP, e=15 cm, 1/2 pulgada, 15 kVA, hasta 1.50 m..." : (isSupplyOrInstall ? "Ej: Para pozo profundo, para aguas blancas, en sala de bombas..." : "Ej: En planta baja, en sótano...")) :
                  currentChatStep === 4 ? "Ej: Incluye conexiones, todo incluido, solo mano de obra..." :
                  currentChatStep === 5 ? (isMaintenance ? "Obligatorio: pza, und, m², m..." : "Ej: und, m², ml, pza...") :
                  "Escribe tu respuesta..."
                }
                className="flex-1 bg-white border-2 border-amber-300 rounded-full px-4 py-2 text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-amber-900 placeholder:text-amber-700/50"
              />
              <button 
                onClick={() => handleChatSubmit && handleChatSubmit(chatInputValue)}
                disabled={!chatInputValue || !chatInputValue.trim()}
                className="bg-amber-500 hover:bg-amber-600 text-white rounded-full p-2.5 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0 shadow-xs cursor-pointer"
              >
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
