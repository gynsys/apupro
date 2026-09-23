import React, { useState, useMemo } from 'react';
import { Sparkles, X, RotateCcw, Check, ArrowRight, ArrowLeft, Send, Ruler, Truck } from 'lucide-react';

const ACARREO_UNITS = [
  {
    id: 'm3.m',
    symbol: 'm³.m',
    title: 'Acarreo interno por metro lineal',
    desc: 'Traslado en obra con carretilla a mano (distancias de 10m a 100m)',
    defaultDistanceExamples: ['20m', '30m', '50m', '80m', 'En carretilla a mano']
  },
  {
    id: 'm3xkm',
    symbol: 'm³ × km',
    title: 'Camión volteo por kilómetro',
    desc: 'Bote de escombros o transporte vial a botadero oficial o cantera',
    defaultDistanceExamples: ['5 km', '10 km', '15 km', '25 km', 'Camión volteo 7m3']
  },
  {
    id: 'm3',
    symbol: 'm³',
    title: 'Volumen fijo en obra',
    desc: 'Cómputo en sitio sin cómputo métrico por distancia',
    defaultDistanceExamples: ['En sitio', 'A pie de obra', 'Acopio temporal']
  },
  {
    id: 'sac.m',
    symbol: 'sac.m',
    title: 'Sacos por metro lineal',
    desc: 'Acarreo de cemento o materiales embolsados por metro',
    defaultDistanceExamples: ['20m', '30m', '50m', 'A mano al hombro']
  },
  {
    id: 'vje',
    symbol: 'vje',
    title: 'Por viaje o flete',
    desc: 'Tarifa completa por viaje en camión o plataforma',
    defaultDistanceExamples: ['1 viaje', 'Viaje a botadero', '15 km en plataforma']
  }
];

export default function ClarificationAlertCard({
  message,
  recommendation,
  questions = [],
  options = [],
  internalCode,
  clarificationType,
  entryModeSource = 'libre',
  onDismiss,
  onStartGuided,
  onResetChatbot,
  onResetLibre,
  onClarificationSubmit
}) {
  // Detección de aclaratoria de acarreo/transporte (unidad + distancia)
  const isAcarreo = useMemo(() => {
    if (clarificationType === 'acarreo_unit_distance' || internalCode === 'RAG_ACARREO_MISSING_UNIT') {
      return true;
    }
    const combined = [message || '', ...(questions || [])].join(' ').toLowerCase();
    const hasAcarreoTerm = combined.includes('acarreo') || combined.includes('transporte') || combined.includes('bote');
    const hasUnitAndDist = combined.includes('unidad') && (combined.includes('distancia') || combined.includes('método') || combined.includes('metodo'));
    return hasAcarreoTerm && hasUnitAndDist;
  }, [clarificationType, internalCode, message, questions]);

  // Estados para flujo de Acarreo (Paso 1: Unidad, Paso 2: Distancia)
  const [acarreoStep, setAcarreoStep] = useState(1);
  const [selectedUnit, setSelectedUnit] = useState('m3.m');
  const [isCustomUnit, setIsCustomUnit] = useState(false);
  const [customUnitInput, setCustomUnitInput] = useState('');
  const [distanceInput, setDistanceInput] = useState('');

  // Estados para flujo genérico secuencial
  const [genericStep, setGenericStep] = useState(0);
  const [genericAnswers, setGenericAnswers] = useState([]);
  const [genericCurrentInput, setGenericCurrentInput] = useState('');

  // Información de la unidad de acarreo seleccionada
  const activeUnitConfig = useMemo(() => {
    return ACARREO_UNITS.find(u => u.id === selectedUnit) || null;
  }, [selectedUnit]);

  // Manejador del avance en Acarreo
  const handleAcarreoNextToDistance = () => {
    const effectiveUnit = isCustomUnit ? customUnitInput.trim() : selectedUnit;
    if (!effectiveUnit) return;
    setAcarreoStep(2);
  };

  const handleAcarreoFinalSubmit = (e) => {
    if (e) e.preventDefault();
    const effectiveUnit = isCustomUnit ? customUnitInput.trim() : selectedUnit;
    const effectiveDist = distanceInput.trim();
    if (!effectiveUnit || !effectiveDist) return;

    const combinedAnswer = `${effectiveUnit}, ${effectiveDist}`;
    if (onClarificationSubmit) {
      onClarificationSubmit(combinedAnswer, effectiveUnit);
    }
  };

  // Manejador del flujo genérico
  const handleGenericSubmit = (e) => {
    if (e) e.preventDefault();
    if (!genericCurrentInput.trim()) return;

    const nextAnswers = [...genericAnswers, genericCurrentInput.trim()];
    if (questions.length > 1 && genericStep < questions.length - 1) {
      setGenericAnswers(nextAnswers);
      setGenericCurrentInput('');
      setGenericStep(prev => prev + 1);
    } else {
      const fullAnswer = nextAnswers.join(', ');
      if (onClarificationSubmit) {
        onClarificationSubmit(fullAnswer);
      }
    }
  };

  return (
    <div className="mb-6 p-5 bg-amber-50/90 border-2 border-amber-200 rounded-2xl shadow-sm animate-in fade-in zoom-in-95 duration-300">
      {/* CABECERA DEL MENSAJE */}
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
              {recommendation || "Indica los parámetros técnicos requeridos para calcular los rendimientos y el costo exacto del APU."}
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

      {/* ========================================================================= */}
      {/* CASO A: FLUJO SECUENCIAL ACARREO / TRANSPORTE (UNIDAD LUEGO DISTANCIA)     */}
      {/* ========================================================================= */}
      {isAcarreo ? (
        <div className="my-4 p-4 bg-white border border-amber-300 rounded-2xl shadow-xs">
          {/* STEPPER VISUAL */}
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-amber-100 text-xs font-bold">
            <button
              type="button"
              onClick={() => setAcarreoStep(1)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                acarreoStep === 1
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'bg-amber-100/70 text-amber-900 hover:bg-amber-200/80'
              }`}
            >
              <Ruler size={13} />
              <span>1. Unidad de Medida</span>
              {acarreoStep === 2 && (
                <span className="ml-1 bg-amber-600/30 px-1.5 py-0.5 rounded text-[10px] text-amber-950">
                  {isCustomUnit ? customUnitInput || 'Personalizada' : selectedUnit}
                </span>
              )}
            </button>

            <span className="text-amber-400 font-bold">→</span>

            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${
                acarreoStep === 2
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              <Truck size={13} />
              <span>2. Distancia o Método</span>
            </div>
          </div>

          {/* PASO 1: SELECCIÓN DE UNIDAD DE MEDIDA */}
          {acarreoStep === 1 && (
            <div className="animate-in fade-in duration-200">
              <div className="mb-3">
                <label className="block text-xs font-bold text-amber-950 uppercase tracking-wide mb-1">
                  Paso 1: ¿En qué unidad de medida deseas computar?
                </label>
                <p className="text-xs text-slate-600">
                  Selecciona la unidad técnica COVENIN correspondiente al tipo de traslado de la obra:
                </p>
              </div>

              {/* Grid de opciones estándar de acarreo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                {ACARREO_UNITS.map((unit) => {
                  const isSelected = !isCustomUnit && selectedUnit === unit.id;
                  return (
                    <button
                      key={unit.id}
                      type="button"
                      onClick={() => {
                        setSelectedUnit(unit.id);
                        setIsCustomUnit(false);
                      }}
                      className={`text-left p-3 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? 'border-amber-500 bg-amber-50/90 shadow-sm'
                          : 'border-slate-200 hover:border-amber-300 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className={`text-sm font-black ${isSelected ? 'text-amber-900' : 'text-slate-800'}`}>
                          {unit.symbol}
                        </span>
                        {isSelected && (
                          <span className="p-0.5 bg-amber-500 text-white rounded-full">
                            <Check size={12} />
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-bold text-slate-700 leading-tight">
                        {unit.title}
                      </span>
                      <span className="text-[11px] text-slate-500 mt-1 leading-snug">
                        {unit.desc}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Opción Otra Unidad */}
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl mb-4">
                <label className="flex items-center gap-2 cursor-pointer mb-1.5">
                  <input
                    type="radio"
                    name="acarreo_unit_choice"
                    checked={isCustomUnit}
                    onChange={() => setIsCustomUnit(true)}
                    className="text-amber-600 focus:ring-amber-500"
                  />
                  <span className="text-xs font-bold text-slate-700">
                    Otra unidad técnica personalizada (ej: ton.km, pza.m, etc.)
                  </span>
                </label>
                {isCustomUnit && (
                  <input
                    type="text"
                    value={customUnitInput}
                    onChange={(e) => setCustomUnitInput(e.target.value)}
                    placeholder="Escribe la unidad (ej: ton.km)..."
                    className="w-full mt-1 px-3 py-1.5 text-xs bg-white border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-800"
                    autoFocus
                  />
                )}
              </div>

              {/* Botón Siguiente a Distancia */}
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleAcarreoNextToDistance}
                  disabled={isCustomUnit && !customUnitInput.trim()}
                  className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-95"
                >
                  <span>Continuar: Indicar Distancia</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* PASO 2: INGRESO DE DISTANCIA O MÉTODO */}
          {acarreoStep === 2 && (
            <div className="animate-in fade-in duration-200">
              <div className="mb-3">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <label className="block text-xs font-bold text-amber-950 uppercase tracking-wide">
                    Paso 2: ¿Cuál es la distancia aproximada o método de transporte?
                  </label>
                  <button
                    type="button"
                    onClick={() => setAcarreoStep(1)}
                    className="text-xs text-amber-700 hover:text-amber-900 font-semibold underline cursor-pointer"
                  >
                    Cambiar unidad ({isCustomUnit ? customUnitInput : activeUnitConfig?.symbol || selectedUnit})
                  </button>
                </div>
                <p className="text-xs text-slate-600">
                  {selectedUnit === 'm3.m' || selectedUnit === 'sac.m'
                    ? 'Indica los metros de recorrido y el medio de acarreo (ej: 30 metros a mano en carretilla).'
                    : selectedUnit === 'm3xkm'
                    ? 'Indica los kilómetros hasta el botadero o destino (ej: 10 km en camión volteo 7m3).'
                    : selectedUnit === 'vje'
                    ? 'Indica la distancia, medio de transporte o ruta prevista (ej: 15 km, camión plataforma).'
                    : 'Indica el método de bote o disposición en obra (ej: en sitio, a pie de obra).'}
                </p>
              </div>

              {/* Sugerencias contextuales rápidas según la unidad elegida */}
              {activeUnitConfig?.defaultDistanceExamples && (
                <div className="mb-3">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                    Sugerencias frecuentes:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {activeUnitConfig.defaultDistanceExamples.map((ex, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setDistanceInput(ex)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                          distanceInput === ex
                            ? 'bg-amber-100 border-amber-400 text-amber-900 shadow-xs'
                            : 'bg-slate-50 hover:bg-amber-50 text-slate-700 border-slate-200'
                        }`}
                      >
                        {ex}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Formulario de envío final */}
              <form onSubmit={handleAcarreoFinalSubmit} className="space-y-3">
                <input
                  type="text"
                  value={distanceInput}
                  onChange={(e) => setDistanceInput(e.target.value)}
                  placeholder={
                    selectedUnit === 'm3.m' || selectedUnit === 'sac.m'
                      ? 'Ej: 30m en carretilla a mano, 50 metros...'
                      : selectedUnit === 'm3xkm'
                      ? 'Ej: 10 km en camión volteo 7m3, 15 km a botadero...'
                      : 'Ej: 30m, 10 km, camión volteo...'
                  }
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-white border border-amber-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-800 placeholder-slate-400"
                  autoFocus
                />

                <div className="flex items-center justify-between gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setAcarreoStep(1)}
                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <ArrowLeft size={13} />
                    <span>Volver a Unidad</span>
                  </button>

                  <button
                    type="submit"
                    disabled={!distanceInput.trim()}
                    className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-95"
                  >
                    <Check size={14} />
                    <span>Responder y Generar APU</span>
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      ) : (
        /* ========================================================================= */
        /* CASO B: FLUJO SECUENCIAL GENERAL (NO ACARREO)                             */
        /* ========================================================================= */
        <div className="my-4 p-4 bg-white border border-amber-300 rounded-2xl shadow-xs">
          {questions.length > 1 ? (
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs font-bold text-amber-950 uppercase tracking-wide">
                  Pregunta {genericStep + 1} de {questions.length}
                </span>
                {genericStep > 0 && (
                  <button
                    type="button"
                    onClick={() => setGenericStep(prev => Math.max(0, prev - 1))}
                    className="text-xs text-amber-700 hover:text-amber-900 font-semibold underline cursor-pointer"
                  >
                    ← Pregunta anterior
                  </button>
                )}
              </div>
              <p className="text-sm font-semibold text-slate-800 mb-3">
                {questions[genericStep]}
              </p>
            </div>
          ) : (
            <div className="mb-2">
              <label className="block text-xs font-bold text-amber-950 uppercase tracking-wide mb-1">
                Información técnica requerida:
              </label>
              <p className="text-xs text-slate-600">
                {questions[0] || message || "Indica la especificación técnica faltante para continuar:"}
              </p>
            </div>
          )}

          <form onSubmit={handleGenericSubmit} className="flex gap-2 mt-2">
            <input
              type="text"
              value={genericCurrentInput}
              onChange={(e) => setGenericCurrentInput(e.target.value)}
              placeholder="Ingresa la respuesta aquí..."
              className="flex-1 px-3 py-2 text-xs sm:text-sm bg-white border border-amber-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-800 placeholder-slate-400"
              autoFocus
            />
            <button
              type="submit"
              disabled={!genericCurrentInput.trim()}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-95 shrink-0"
            >
              {questions.length > 1 && genericStep < questions.length - 1 ? (
                <>
                  <span>Siguiente</span>
                  <ArrowRight size={14} />
                </>
              ) : (
                <>
                  <Check size={14} />
                  <span>Responder y Generar</span>
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* ACCIONES DE SALIDA Y REINICIO */}
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
