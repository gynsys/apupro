import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import {
  CHAT_STEP_DEFINITIONS,
  getParametricStep3Definition,
  getDynamicStepDefinition
} from '../constants/guidedBuilderConstants.js';
import {
  ACCIONES_STEP1_CHIPS,
  getActionPipeline,
  buildPipelinePrompt,
  extractCleanUnit,
  isOmitted,
  DEFAULT_PIPELINE
} from '../constants/actionPipelines.js';

// Raíces y términos de procesos y acciones constructivas reconocibles
export const CONSTRUCTION_ACTION_ROOTS = [
  'suministr', 'instal', 'colocac', 'coloc', 'montaj', 'desmont', 'demol', 'tumbar',
  'derrib', 'picar', 'desmantel', 'constru', 'edific', 'levant', 'fabric', 'hechur',
  'excav', 'vaci', 'echar', 'armad', 'encofr', 'desencofr', 'repar', 'manten', 'saneam',
  'reconstru', 'rehabilit', 'restaur', 'arregl', 'adecuac', 'revest', 'fris', 'tarraj',
  'revoqu', 'enluc', 'salpic', 'estuc', 'empast', 'pint', 'esmalt', 'fond', 'acarr',
  'traslad', 'transpor', 'carg', 'bote', 'botar', 'elimin', 'limpiez', 'limpiar',
  'desmalez', 'deshierb', 'deforest', 'remoc', 'remov', 'trazo', 'replant', 'nivel', 'perfil', 'rellen', 'compact',
  'soldad', 'soldar', 'oxicort', 'cort', 'perfor', 'canaliz', 'cablead', 'cablear',
  'conexion', 'empalm', 'prueb', 'impermeabiliz', 'aislam',
  'confecc', 'tratam'
];

// Raíces de elementos o materiales constructivos
export const ELEMENT_ROOTS = [
  'losa', 'pared', 'muro', 'bloque', 'ladrillo', 'concreto', 'viga', 'columna',
  'zapata', 'fundacion', 'cimiento', 'piso', 'ceramica', 'porcelanato', 'granito',
  'tubo', 'tuberia', 'pvc', 'acero', 'hierro', 'metalic', 'baranda', 'escalera',
  'pasamano', 'bomba', 'motor', 'tablero', 'cable', 'conductor', 'luminaria',
  'aire', 'tanque', 'valvula', 'puerta', 'ventana', 'reja', 'porton', 'descanso',
  'techo', 'cielorraso', 'cubierta', 'mortero', 'friso', 'escombro', 'tierra', 'zanja',
  'armadura', 'cabilla', 'acometida', 'breake', 'drenaje', 'alcantarill', 'estructura',
  'terraplen', 'subbase', 'base', 'vegetac', 'arbol', 'bosque', 'capote', 'descapote'
];

/**
 * Valida si un texto es basura o teclado aporreado ("x", "asdf", "123", caracteres repetidos)
 */
export function isGibberish(text) {
  if (!text || typeof text !== 'string') return true;
  const clean = text.trim();
  if (clean.length < 2) return true;

  // Solo símbolos o números sin letras
  if (/^[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ]+$/.test(clean)) return true;

  // 3 o más letras iguales consecutivas (ej: "xxx", "aaaa", "zzzz")
  if (/([a-zA-Z])\1{2,}/.test(clean)) return true;

  // Patrones de teclado típicos de prueba o relleno rápido
  const junkPatterns = [/^asdf/i, /^qwer/i, /^zxcv/i, /^hjkl/i, /^1234/i, /^test/i, /^prueba$/i];
  if (junkPatterns.some(p => p.test(clean)) && clean.length < 10) return true;

  return false;
}

/**
 * Detecta si el texto ingresado por el usuario es una descripción técnica completa de APU
 * (ej: cuando el usuario pega todo el párrafo de la partida en el chat).
 */
export function isComprehensiveDescription(text) {
  if (!text || typeof text !== 'string') return false;
  const clean = text.trim().toLowerCase();

  const wordCount = clean.split(/\s+/).filter(Boolean).length;
  if (clean.length < 25 && wordCount < 5) return false;

  const hasAction = CONSTRUCTION_ACTION_ROOTS.some(root => clean.includes(root));
  const hasElement = ELEMENT_ROOTS.some(elem => clean.includes(elem));
  const hasTechnicalClauses = /incluye|incluyendo|de ancho|de espesor|e\s*=|d\s*=|calibre|potencia|hp|kva|btu|con mortero|mediante|acabado|descanso/i.test(clean);

  return hasAction && (hasElement || hasTechnicalClauses);
}

/**
 * Desglosa una descripción completa en los componentes de los 5 pasos
 */
export function decomposeComprehensivePrompt(prompt) {
  let accion = '';
  let material = '';
  let ubicacion = '';
  let incluye = '';

  const clean = (prompt || '').trim();

  const incluyeMatch = clean.match(/(?:,\s*)?(?:incluye|incluyendo)\s+(.+)$/i);
  let basePart = clean;
  if (incluyeMatch) {
    incluye = `Incluye ${incluyeMatch[1].trim()}`;
    basePart = clean.slice(0, incluyeMatch.index).trim();
  }

  const ubiMatch = basePart.match(/(?:,\s*)?(?:en|sobre|para)\s+([^,]+(?:,\s*[^,]+)*)$/i);
  let mainPart = basePart;
  if (ubiMatch && ubiMatch.index > 10) {
    ubicacion = ubiMatch[1].trim();
    mainPart = basePart.slice(0, ubiMatch.index).trim();
  }

  const deMatch = mainPart.match(/^(.*?)\s+(?:de|del|para)\s+(.*)$/i);
  if (deMatch) {
    accion = deMatch[1].trim();
    material = deMatch[2].trim();
  } else {
    accion = mainPart;
    material = 'Elemento indicado';
  }

  return { accion, material, ubicacion, incluye };
}

/**
 * Validador estricto para cada paso del asistente guiado
 */
export function validateStepInput(text, step, isMaintenance = false, currentStepDef = null) {
  if (!text || typeof text !== 'string') {
    return { isValid: false, error: 'Por favor ingresa una respuesta válida.' };
  }
  const clean = text.trim();
  const isUnitStep = Boolean(currentStepDef?.isUnit || step === 6);

  // Opciones estándar de omisión
  const isSkip = /^(omitir|ninguno|ninguno \/ omitir|sugerir por ia|sugerir)$/i.test(clean);
  if (isSkip && step !== 1 && (!isUnitStep || !isMaintenance)) {
    return { isValid: true };
  }

  // Filtro anti-basura (excepto para "m" como unidad de metro)
  if (isGibberish(clean) && clean.toLowerCase() !== 'm') {
    return {
      isValid: false,
      error: `La respuesta "${clean}" no parece una descripción técnica válida. Por favor utiliza términos constructivos o selecciona una opción sugerida.`
    };
  }

  if (step === 1) {
    const hasAction = CONSTRUCTION_ACTION_ROOTS.some(root => clean.toLowerCase().includes(root));
    if (!hasAction && clean.length < 15) {
      return {
        isValid: false,
        error: `"${clean}" no describe un proceso constructivo. Indica qué acción se va a realizar (ej: Suministro e instalación, Construcción, Demolición, Reparación, Vaciado de concreto, Pintura) o selecciona una opción.`
      };
    }
  } else if (isUnitStep) {
    const cleanLower = clean.toLowerCase();
    if (isMaintenance && (cleanLower.includes('omitir') || cleanLower.includes('ninguno') || cleanLower.includes('sugerir'))) {
      return {
        isValid: false,
        error: 'Para actividades de mantenimiento o reparación, la unidad de cómputo es obligatoria. Elige pza, und, m², m o Gl.'
      };
    }
    const VALID_UNITS = [
      'und', 'unidad', 'unidades', 'pza', 'pieza', 'piezas', 'm', 'ml', 'metro', 'metros',
      'm2', 'm²', 'm3', 'm³', 'kg', 'kgf', 'ton', 'tonf', 'pto', 'punto', 'puntos',
      'gl', 'sg', 'global', 'suma global',
      'gln', 'galon', 'galones', 'jgo', 'juego', 'saco', 'sacos', 'sac', 'viaje', 'viajes',
      'mes', 'dia', 'hora', 'sugerir por ia', 'omitir', 'ninguno', 'm3-km', 'm³-km', 't-km', 'ton-km'
    ];
    const isRecognizedUnit = VALID_UNITS.some(u => cleanLower.includes(u));
    if (!isRecognizedUnit && clean.length < 8) {
      return {
        isValid: false,
        error: `"${clean}" no es una unidad de cómputo válida. Por favor selecciona o indica una unidad estándar (ej: und, pza, m², m³, m, Gl, kgf, pto).`
      };
    }
  } else if (clean.length < 2) {
    return {
      isValid: false,
      error: 'Por favor indica una especificación constructiva válida o selecciona una opción sugerida.'
    };
  }

  return { isValid: true };
}

export function useGuidedAssistant({ user, initialGuided = true, onComplete }) {
  const [isGuidedMode, setIsGuidedMode] = useState(true);
  const [entryModeSource, setEntryModeSource] = useState('chat');
  const lastEntrySourceRef = useRef('chat');

  // Estados de partida sincronizados con el pipeline
  const [guidedAccion, setGuidedAccion] = useState(null);
  const [guidedElemento, setGuidedElemento] = useState(null);
  const [guidedMaterial, setGuidedMaterial] = useState(null);
  const [guidedUbicacion, setGuidedUbicacion] = useState(null);
  const [guidedIncluye, setGuidedIncluye] = useState(null);
  const [guidedUnidad, setGuidedUnidad] = useState(null);

  // Estados de Pipeline Dinámico
  const [activePipeline, setActivePipeline] = useState(null);
  const activePipelineRef = useRef(null);
  const [stepAnswers, setStepAnswers] = useState({});
  const stepAnswersRef = useRef({});

  const [currentChatStep, setCurrentChatStep] = useState(0);
  const [chatInputValue, setChatInputValue] = useState('');
  const [chatbotLoadingStage, setChatbotLoadingStage] = useState(0);
  const [guidedMessages, setGuidedMessages] = useState([]);
  const [detectedFullPrompt, setDetectedFullPrompt] = useState(null);
  const [waitingForGlobalDays, setWaitingForGlobalDays] = useState(false);
  const [pendingPromptForGlobal, setPendingPromptForGlobal] = useState(null);
  const [waitingForClarification, setWaitingForClarification] = useState(false);
  const [pendingClarification, setPendingClarification] = useState(null);
  const loadingTimeoutsRef = useRef([]);

  const clearLoadingTimeouts = useCallback(() => {
    loadingTimeoutsRef.current.forEach(t => clearTimeout(t));
    loadingTimeoutsRef.current = [];
  }, []);

  useEffect(() => {
    return () => {
      loadingTimeoutsRef.current.forEach(t => clearTimeout(t));
    };
  }, []);

  // Inicializar mensaje de bienvenida según el usuario
  const createInitialMessage = useCallback(() => {
    const userName = user?.full_name || user?.email?.split('@')[0] || '';
    const greetingName = userName ? ` ${userName}` : '';
    return {
      id: 'msg-bot0',
      sender: 'bot',
      step: 0,
      text: `¡Hola${greetingName}! Construir una descripción detallada de una partida es lo esencial para evitar ambigüedades al momento de la ejecución en campo.\n\nEn pocos pasos armaremos la mejor descripción.\n¿Comenzamos?`,
      chips: ['Sí, comenzar']
    };
  }, [user]);

  useEffect(() => {
    setGuidedMessages([createInitialMessage()]);
  }, [createInitialMessage]);

  const getStepValue = (step) => {
    if (step === 1) return guidedAccion;
    const pipeline = activePipelineRef.current || (guidedAccion ? getActionPipeline(guidedAccion) : null);
    if (pipeline) {
      const idx = step - 2;
      const stepDef = pipeline[idx];
      if (stepDef) {
        return stepAnswersRef.current[stepDef.id] || '';
      }
    }
    if (step === 2) return guidedElemento;
    if (step === 3) return guidedMaterial;
    if (step === 4) return guidedUbicacion;
    if (step === 5) return guidedIncluye;
    if (step === 6) return guidedUnidad;
    return '';
  };

  const handleGoBack = (targetStep = null) => {
    if (chatbotLoadingStage > 0) return;
    if (waitingForClarification) {
      clearLoadingTimeouts();
      setWaitingForClarification(false);
      setPendingClarification(null);
      setChatInputValue('');
      setGuidedMessages(prev => prev.filter(m => !m.id.startsWith('bot-clarification-')));
      return;
    }
    if (waitingForGlobalDays) {
      setWaitingForGlobalDays(false);
      setPendingPromptForGlobal(null);
      setChatInputValue('');
      setGuidedMessages(prev => prev.slice(0, -2));
      return;
    }
    if (detectedFullPrompt) {
      const savedPrompt = detectedFullPrompt;
      setDetectedFullPrompt(null);
      setCurrentChatStep(1);
      setChatInputValue(savedPrompt);
      const step1Def = getDynamicStepDefinition(1);
      setGuidedMessages([
        createInitialMessage(),
        {
          id: `bot-step-1-${Date.now()}`,
          sender: 'bot',
          step: 1,
          text: step1Def.text,
          chips: step1Def.chips
        }
      ]);
      return;
    }

    const prevStep = targetStep !== null ? targetStep : currentChatStep - 1;
    if (prevStep < 0) return;

    if (prevStep === 0) {
      setCurrentChatStep(0);
      setActivePipeline(null);
      activePipelineRef.current = null;
      setStepAnswers({});
      stepAnswersRef.current = {};
      setGuidedAccion(null);
      setGuidedElemento(null);
      setGuidedMaterial(null);
      setGuidedUbicacion(null);
      setGuidedIncluye(null);
      setGuidedUnidad(null);
      setChatInputValue('');
      setGuidedMessages(prev => prev.filter(m => m.id === 'msg-bot0'));
      return;
    }

    if (prevStep === 1) {
      setCurrentChatStep(1);
      setActivePipeline(null);
      activePipelineRef.current = null;
      setStepAnswers({});
      stepAnswersRef.current = {};
      setGuidedElemento(null);
      setGuidedMaterial(null);
      setGuidedUbicacion(null);
      setGuidedIncluye(null);
      setGuidedUnidad(null);
      const prevAction = guidedAccion;
      setChatInputValue(prevAction && !isOmitted(prevAction) ? prevAction : '');
      const step1Def = getDynamicStepDefinition(1);
      setGuidedMessages([
        createInitialMessage(),
        {
          id: `bot-step-1-${Date.now()}`,
          sender: 'bot',
          step: 1,
          text: step1Def.text,
          chips: step1Def.chips
        }
      ]);
      return;
    }

    // prevStep >= 2: Volver a un paso dentro del pipeline
    const pipeline = activePipelineRef.current || (guidedAccion ? getActionPipeline(guidedAccion) : DEFAULT_PIPELINE);
    const targetIdx = prevStep - 2;
    const targetStepDef = pipeline[targetIdx];

    setCurrentChatStep(prevStep);

    // Filtrar stepAnswers para conservar solo las respuestas anteriores a targetIdx
    const keptAnswers = {};
    for (let i = 0; i < targetIdx; i++) {
      const s = pipeline[i];
      if (s && stepAnswersRef.current[s.id] !== undefined) {
        keptAnswers[s.id] = stepAnswersRef.current[s.id];
      }
    }
    setStepAnswers(keptAnswers);
    stepAnswersRef.current = keptAnswers;

    // Resincronizar variables legadas
    setGuidedElemento(null);
    setGuidedMaterial(null);
    setGuidedUbicacion(null);
    setGuidedIncluye(null);
    setGuidedUnidad(null);
    for (let i = 0; i < targetIdx; i++) {
      const s = pipeline[i];
      const val = keptAnswers[s.id];
      if (val && !isOmitted(val)) {
        if (s.field === 'elemento') setGuidedElemento(val);
        else if (s.field === 'material') setGuidedMaterial(val);
        else if (s.field === 'ubicacion') setGuidedUbicacion(val);
        else if (s.field === 'incluye') setGuidedIncluye(val);
        else if (s.field === 'unidad') setGuidedUnidad(val);
      }
    }

    // Colocar respuesta anterior en input si existía
    const prevAnswer = stepAnswersRef.current[targetStepDef?.id];
    setChatInputValue(prevAnswer && !isOmitted(prevAnswer) ? prevAnswer : '');

    // Rebobinar mensajes del chat
    const targetChips = targetStepDef
      ? (typeof targetStepDef.chips === 'function' ? targetStepDef.chips(keptAnswers) : targetStepDef.chips)
      : [];

    setGuidedMessages(prev => {
      const filtered = prev.filter(m => {
        if (m.id === 'msg-bot0' || m.step === 0) return true;
        if (typeof m.step === 'number' && m.step < prevStep) return true;
        if (m.step === prevStep && m.sender === 'bot') return true;
        return false;
      });
      return filtered.map(m => {
        if (m.step === prevStep && m.sender === 'bot' && targetStepDef) {
          return {
            ...m,
            text: targetStepDef.text,
            chips: targetChips
          };
        }
        return m;
      });
    });
  };

  const resetChatbot = (startAtStep = 0, initialInput = '') => {
    clearLoadingTimeouts();
    setActivePipeline(null);
    activePipelineRef.current = null;
    setStepAnswers({});
    stepAnswersRef.current = {};
    setGuidedAccion(null);
    setGuidedElemento(null);
    setGuidedMaterial(null);
    setGuidedUbicacion(null);
    setGuidedIncluye(null);
    setGuidedUnidad(null);
    setChatInputValue(initialInput || '');
    setChatbotLoadingStage(0);
    setDetectedFullPrompt(null);
    setWaitingForGlobalDays(false);
    setPendingPromptForGlobal(null);
    setWaitingForClarification(false);
    setPendingClarification(null);

    if (startAtStep === 1) {
      setCurrentChatStep(1);
      const step1Def = getDynamicStepDefinition(1);
      setGuidedMessages([
        {
          id: `bot-step-1-${Date.now()}`,
          sender: 'bot',
          step: 1,
          text: step1Def.text,
          chips: step1Def.chips
        }
      ]);
    } else {
      setCurrentChatStep(0);
      setGuidedMessages([createInitialMessage()]);
    }
  };

  const triggerGeneration = (promptToUse, unitToUse = null, executionDays = null, bypassOntology = false) => {
    clearLoadingTimeouts();
    setChatbotLoadingStage(1);
    loadingTimeoutsRef.current.push(setTimeout(() => setChatbotLoadingStage(2), 1200));
    loadingTimeoutsRef.current.push(setTimeout(() => setChatbotLoadingStage(3), 2500));
    loadingTimeoutsRef.current.push(setTimeout(() => setChatbotLoadingStage(4), 3800));
    loadingTimeoutsRef.current.push(setTimeout(() => {
      setEntryModeSource('chat');
      lastEntrySourceRef.current = 'chat';
      if (onComplete) {
        onComplete(promptToUse, 'chat', unitToUse, executionDays, bypassOntology);
      }
    }, 4500));
  };

  const injectClarification = useCallback(({ message, options, prompt: promptBase, unit }) => {
    clearLoadingTimeouts();
    setChatbotLoadingStage(0);
    setWaitingForClarification(true);
    setPendingClarification({
      prompt: promptBase,
      unit: unit
    });
    setCurrentChatStep(prev => Math.max(prev, 1));

    const botClarificationMsg = {
      id: `bot-clarification-${Date.now()}`,
      sender: 'bot',
      step: 7,
      text: message || 'Se requiere una aclaratoria técnica para dimensionar el APU:',
      chips: options && Array.isArray(options) && options.length > 0 ? options : null
    };

    setGuidedMessages(prev => [...prev, botClarificationMsg]);
    setChatInputValue('');
  }, [clearLoadingTimeouts]);

  const handleChatSubmit = (text) => {
    if (!text || !text.trim()) return;
    const cleanText = text.trim();

    // -1. Manejo de Aclaratorias Técnicas de la IA (kVA, profundidad de pozo, tubería, etc.)
    if (waitingForClarification && pendingClarification) {
      clearLoadingTimeouts();
      const clarifPrompt = pendingClarification.prompt || '';
      const clarifUnit = pendingClarification.unit || guidedUnidad;
      const combined = clarifPrompt ? `${clarifPrompt}, ${cleanText}` : cleanText;

      setWaitingForClarification(false);
      setPendingClarification(null);

      const newUserMsg = { id: Date.now().toString(), sender: 'user', text: cleanText, step: 7 };
      setGuidedMessages(prev => [...prev, newUserMsg]);
      setChatInputValue('');
      triggerGeneration(combined, clarifUnit, null, true);
      return;
    }

    // 0. Manejo cuando se está esperando la cantidad de días para partida Global (Gl)
    if (waitingForGlobalDays) {
      const match = cleanText.match(/(\d+(?:[.,]\d+)?)/);
      const parsedDays = match ? parseFloat(match[1].replace(',', '.')) : null;
      if (!parsedDays || parsedDays <= 0 || isNaN(parsedDays)) {
        toast.error('Por favor selecciona una opción o ingresa un número válido de días (ej: 0.5, 1, 2, 3, 5).', { id: 'days-val-error' });
        const newUserMsg = { id: Date.now().toString(), sender: 'user', text: cleanText, step: currentChatStep };
        const botRetryMsg = {
          id: `bot-days-retry-${Date.now()}`,
          sender: 'bot',
          step: currentChatStep,
          text: `"${cleanText}" no es un número de días válido.\n\nIndica cuántos días de trabajo tomará la cuadrilla:`,
          chips: ['0.5 día', '1 día', '2 días', '3 días', '5 días']
        };
        setGuidedMessages(prev => [...prev, newUserMsg, botRetryMsg]);
        setChatInputValue('');
        return;
      }

      setWaitingForGlobalDays(false);
      const promptToGenerate = pendingPromptForGlobal || detectedFullPrompt;
      setPendingPromptForGlobal(null);
      const newUserMsg = { id: Date.now().toString(), sender: 'user', text: cleanText, step: currentChatStep };
      setGuidedMessages(prev => [...prev, newUserMsg]);
      setChatInputValue('');
      triggerGeneration(promptToGenerate, 'Gl', parsedDays);
      return;
    }

    // 1. Manejo cuando se detectó previamente un prompt completo y estamos solicitando la unidad
    if (detectedFullPrompt) {
      const unitVal = validateStepInput(cleanText, 6, false);
      if (unitVal.isValid) {
        const cleanLower = cleanText.toLowerCase().trim();
        const isGlobalUnit = ['gl', 'sg', 'global', 'suma global'].includes(cleanLower) || cleanText.trim() === 'Gl' || cleanText.includes('Gl (');

        if (isGlobalUnit) {
          setWaitingForGlobalDays(true);
          setPendingPromptForGlobal(detectedFullPrompt);
          const newUserMsg = { id: Date.now().toString(), sender: 'user', text: cleanText, step: 6 };
          const botDaysMsg = {
            id: `bot-global-days-${Date.now()}`,
            sender: 'bot',
            step: 6,
            text: 'Has seleccionado unidad Global (Gl).\n\nIndica los días de trabajo estimados para la cuadrilla:',
            chips: ['0.5 día', '1 día', '2 días', '3 días', '5 días']
          };
          setGuidedMessages(prev => [...prev, newUserMsg, botDaysMsg]);
          setChatInputValue('');
          return;
        }

        let chosenUnit = cleanLower.replace('m²', 'm2').replace('m³', 'm3');
        const newUserMsg = { id: Date.now().toString(), sender: 'user', text: cleanText, step: 6 };
        setGuidedMessages(prev => [...prev, newUserMsg]);
        setChatInputValue('');
        triggerGeneration(detectedFullPrompt, chosenUnit);
        return;
      } else {
        toast.error(unitVal.error || 'Por favor indica una unidad válida (ej: und, pza, m², m, m³, Gl)', { id: 'chat-val-error', duration: 4500 });
        const newUserMsg = { id: Date.now().toString(), sender: 'user', text: cleanText, step: 6 };
        const botValMsg = {
          id: `bot-val-${Date.now()}`,
          sender: 'bot',
          step: 6,
          text: `Aviso: "${cleanText}" no es una unidad de cómputo válida.\n\nPor favor selecciona una unidad o escribe una unidad estándar (und, pza, m², m, m³, Gl):`,
          chips: ['und', 'pza', 'm²', 'm', 'm³', 'Gl']
        };
        setGuidedMessages(prev => [...prev, newUserMsg, botValMsg]);
        setChatInputValue('');
        return;
      }
    }

    // 2. Detección Inteligente de Descripción Completa (en paso 0, 1 o 2)
    if ((currentChatStep === 0 || currentChatStep === 1 || currentChatStep === 2) && isComprehensiveDescription(cleanText)) {
      setDetectedFullPrompt(cleanText);
      setCurrentChatStep(6);
      const newUserMsg = { id: Date.now().toString(), sender: 'user', text: cleanText, step: currentChatStep };
      const botMsg = {
        id: `bot-full-prompt-${Date.now()}`,
        sender: 'bot',
        step: 6,
        text: `«${cleanText}»\n\nIndica la unidad de la partida:`,
        chips: [
          'und',
          'pza',
          'm²',
          'm',
          'm³',
          'Gl'
        ]
      };
      setGuidedMessages(prev => [...prev, newUserMsg, botMsg]);
      setChatInputValue('');
      return;
    }

    // 3. Manejo de Paso 0 (Bienvenida)
    if (currentChatStep === 0) {
      if (cleanText === 'Sí, comenzar' || cleanText === 'Comenzar') {
        const newUserMsg = { id: Date.now().toString(), sender: 'user', text: cleanText, step: 0 };
        setCurrentChatStep(1);
        const step1Def = getDynamicStepDefinition(1);
        const nextBotMsg = {
          id: `bot-step-1-${Date.now()}`,
          sender: 'bot',
          step: 1,
          text: step1Def.text,
          chips: step1Def.chips
        };
        setGuidedMessages(prev => [...prev, newUserMsg, nextBotMsg]);
        setChatInputValue('');
        return;
      }
      // Si el usuario escribe una acción directamente en paso 0
      const actionVal = validateStepInput(cleanText, 1, false);
      if (actionVal.isValid) {
        const pipeline = getActionPipeline(cleanText);
        setGuidedAccion(cleanText);
        setActivePipeline(pipeline);
        activePipelineRef.current = pipeline;
        setStepAnswers({});
        stepAnswersRef.current = {};
        setGuidedElemento(null);
        setGuidedMaterial(null);
        setGuidedUbicacion(null);
        setGuidedIncluye(null);
        setGuidedUnidad(null);

        const firstStep = pipeline[0] || DEFAULT_PIPELINE[0];
        const chips = typeof firstStep.chips === 'function' ? firstStep.chips({}) : (firstStep.chips || []);
        const newUserMsg = { id: Date.now().toString(), sender: 'user', text: cleanText, step: 0 };
        const nextBotMsg = {
          id: `bot-step-2-${Date.now()}`,
          sender: 'bot',
          step: 2,
          text: firstStep.text,
          chips
        };
        setCurrentChatStep(2);
        setGuidedMessages(prev => [...prev, newUserMsg, nextBotMsg]);
        setChatInputValue('');
        return;
      }
      toast.error('Por favor haz clic en "Sí, comenzar" o describe la acción constructiva a realizar.', { id: 'chat-welcome-err' });
      return;
    }

    // 4. Manejo de Paso 1 (Selección de Acción Constructiva)
    if (currentChatStep === 1) {
      const isChipSelection = ACCIONES_STEP1_CHIPS.includes(cleanText);
      const actionVal = isChipSelection ? { isValid: true } : validateStepInput(cleanText, 1, false);

      if (!actionVal.isValid) {
        toast.error(actionVal.error, { id: 'chat-val-error', duration: 4500 });
        const newUserMsg = { id: Date.now().toString(), sender: 'user', text: cleanText, step: 1 };
        const botValMsg = {
          id: `bot-val-step-1-${Date.now()}`,
          sender: 'bot',
          step: 1,
          text: `Aviso: La respuesta ingresada ("${cleanText}") no es una acción constructiva válida.\n\n${actionVal.error}`,
          chips: ACCIONES_STEP1_CHIPS
        };
        setGuidedMessages(prev => [...prev, newUserMsg, botValMsg]);
        setChatInputValue('');
        return;
      }

      const pipeline = getActionPipeline(cleanText);
      setGuidedAccion(cleanText);
      setActivePipeline(pipeline);
      activePipelineRef.current = pipeline;
      setStepAnswers({});
      stepAnswersRef.current = {};
      setGuidedElemento(null);
      setGuidedMaterial(null);
      setGuidedUbicacion(null);
      setGuidedIncluye(null);
      setGuidedUnidad(null);

      const firstStep = pipeline[0] || DEFAULT_PIPELINE[0];
      const chips = typeof firstStep.chips === 'function' ? firstStep.chips({}) : (firstStep.chips || []);
      const newUserMsg = { id: Date.now().toString(), sender: 'user', text: cleanText, step: 1 };
      const nextBotMsg = {
        id: `bot-step-2-${Date.now()}`,
        sender: 'bot',
        step: 2,
        text: firstStep.text,
        chips
      };
      setCurrentChatStep(2);
      setGuidedMessages(prev => [...prev, newUserMsg, nextBotMsg]);
      setChatInputValue('');
      return;
    }

    // 5. Manejo de Pasos Dinámicos del Pipeline (Paso k >= 2)
    const pipeline = activePipelineRef.current || (guidedAccion ? getActionPipeline(guidedAccion) : DEFAULT_PIPELINE);
    const stepIdx = currentChatStep - 2;
    const currentStepDef = pipeline[stepIdx] || DEFAULT_PIPELINE[stepIdx] || DEFAULT_PIPELINE[0];

    const isMaintenance = /\b(mantenimiento|mantener|saneamiento|sanear|reconstrucci[oó]n|reconstruir|arreglo|arreglar|reparaci[oó]n|reparar|rehabilitaci[oó]n|rehabilitar|restauraci[oó]n|restaurar|reacondicionamiento|reacondicionar|acondicionamiento|acondicionar|recuperaci[oó]n|recuperar|adecuaci[oó]n|adecuar|refacci[oó]n|refaccionar|remodelaci[oó]n|remodelar|resane|resanado|resanar|escarificaci[oó]n|escarificar|repicado|repicar|desmanchado|desmanchar|decapado|decapar)\b/i.test(
      `${guidedAccion || ''} ${guidedElemento || ''} ${guidedMaterial || ''}`
    );

    const lastBotMsg = [...guidedMessages].reverse().find(m => m.sender === 'bot');
    const isChipSelection = lastBotMsg?.chips?.includes(cleanText);

    if (!isChipSelection) {
      const validation = validateStepInput(cleanText, currentChatStep, isMaintenance, currentStepDef);
      if (!validation.isValid) {
        toast.error(validation.error, { id: 'chat-val-error', duration: 4500 });
        const newUserMsg = { id: Date.now().toString(), sender: 'user', text: cleanText, step: currentChatStep };
        const botValMsg = {
          id: `bot-val-${Date.now()}`,
          sender: 'bot',
          step: currentChatStep,
          text: `Aviso: La respuesta ingresada ("${cleanText}") no es válida para este paso.\n\n${validation.error}`,
          chips: lastBotMsg?.chips || []
        };
        setGuidedMessages(prev => [...prev, newUserMsg, botValMsg]);
        setChatInputValue('');
        return;
      }
    }

    // Registrar respuesta en stepAnswers
    const newAnswers = { ...stepAnswersRef.current, [currentStepDef.id]: cleanText };
    setStepAnswers(newAnswers);
    stepAnswersRef.current = newAnswers;

    // Resincronizar campos legados para retrocompatibilidad
    if (currentStepDef.field === 'elemento') setGuidedElemento(cleanText);
    else if (currentStepDef.field === 'material') setGuidedMaterial(cleanText);
    else if (currentStepDef.field === 'ubicacion') setGuidedUbicacion(cleanText);
    else if (currentStepDef.field === 'incluye') setGuidedIncluye(cleanText);
    else if (currentStepDef.field === 'unidad') setGuidedUnidad(cleanText);

    const newUserMsg = { id: Date.now().toString(), sender: 'user', text: cleanText, step: currentChatStep };
    const nextStepIdx = stepIdx + 1;
    const nextStepNum = currentChatStep + 1;

    // ¿Hay más pasos en el pipeline?
    if (nextStepIdx < pipeline.length) {
      const nextStepDef = pipeline[nextStepIdx];
      const chips = typeof nextStepDef.chips === 'function' ? nextStepDef.chips(newAnswers) : (nextStepDef.chips || []);
      const nextBotMsg = {
        id: `bot-step-${nextStepNum}-${Date.now()}`,
        sender: 'bot',
        step: nextStepNum,
        text: nextStepDef.text,
        chips
      };
      setCurrentChatStep(nextStepNum);
      setGuidedMessages(prev => [...prev, newUserMsg, nextBotMsg]);
      setChatInputValue('');
      return;
    }

    // Si terminó el pipeline, ensamblar prompt técnico y verificar unidad
    const { finalPrompt, unit, isGlobal } = buildPipelinePrompt(guidedAccion, newAnswers, pipeline);

    if (isGlobal) {
      setWaitingForGlobalDays(true);
      setPendingPromptForGlobal(finalPrompt);
      const botDaysMsg = {
        id: `bot-global-days-${Date.now()}`,
        sender: 'bot',
        step: currentChatStep,
        text: 'Has seleccionado unidad Global (Gl).\n\nIndica los días de trabajo estimados para la cuadrilla:',
        chips: ['0.5 día', '1 día', '2 días', '3 días', '5 días']
      };
      setGuidedMessages(prev => [...prev, newUserMsg, botDaysMsg]);
      setChatInputValue('');
      return;
    }

    // Disparar generación del APU con IA
    setGuidedMessages(prev => [...prev, newUserMsg]);
    setChatInputValue('');
    triggerGeneration(finalPrompt, unit);
  };

  const chatPlaceholder = (() => {
    if (waitingForGlobalDays) {
      return 'Indica los días estimados (ej: 0.5, 1, 2, 3, 5)...';
    }
    if (waitingForClarification) {
      return 'Selecciona una opción o escribe tu respuesta...';
    }
    if (currentChatStep === 0) {
      return 'Haz clic en "Sí, comenzar" o describe la acción constructiva...';
    }
    if (currentChatStep === 1) {
      return 'Ej: Suministro e instalación, Construcción, Compactación, Transporte...';
    }
    const pipeline = activePipelineRef.current || (guidedAccion ? getActionPipeline(guidedAccion) : null);
    if (pipeline) {
      const idx = currentChatStep - 2;
      const currentStepDef = pipeline[idx];
      if (currentStepDef) {
        if (currentStepDef.isUnit) {
          return 'Ej: m², ml, und, pza, m³, Gl...';
        }
        return 'Selecciona una opción sugerida o escribe tu respuesta...';
      }
    }
    return 'Escribe tu respuesta...';
  })();

  return {
    isGuidedMode,
    setIsGuidedMode,
    entryModeSource,
    setEntryModeSource,
    lastEntrySourceRef,
    guidedAccion,
    setGuidedAccion,
    guidedElemento,
    setGuidedElemento,
    guidedUbicacion,
    setGuidedUbicacion,
    guidedMaterial,
    setGuidedMaterial,
    guidedIncluye,
    setGuidedIncluye,
    guidedUnidad,
    setGuidedUnidad,
    activePipeline,
    stepAnswers,
    currentChatStep,
    setCurrentChatStep,
    chatInputValue,
    setChatInputValue,
    chatPlaceholder,
    chatbotLoadingStage,
    setChatbotLoadingStage,
    guidedMessages,
    setGuidedMessages,
    detectedFullPrompt,
    waitingForGlobalDays,
    waitingForClarification,
    injectClarification,
    clearLoadingTimeouts,
    handleChatSubmit,
    handleGoBack,
    resetChatbot
  };
}
