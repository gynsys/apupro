import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { CHAT_STEP_DEFINITIONS, getParametricStep3Definition } from '../constants/guidedBuilderConstants.js';

// Raíces y términos de procesos y acciones constructivas reconocibles
export const CONSTRUCTION_ACTION_ROOTS = [
  'suministr', 'instal', 'colocac', 'coloc', 'montaj', 'desmont', 'demol', 'tumbar',
  'derrib', 'picar', 'desmantel', 'constru', 'edific', 'levant', 'fabric', 'hechur',
  'excav', 'vaci', 'echar', 'armad', 'encofr', 'desencofr', 'repar', 'manten', 'saneam',
  'reconstru', 'rehabilit', 'restaur', 'arregl', 'adecuac', 'revest', 'fris', 'tarraj',
  'revoqu', 'enluc', 'salpic', 'estuc', 'empast', 'pint', 'esmalt', 'fond', 'acarr',
  'traslad', 'transpor', 'carg', 'bote', 'botar', 'elimin', 'limpiez', 'limpiar',
  'desmalez', 'deshierb', 'trazo', 'replant', 'nivel', 'perfil', 'rellen', 'compact',
  'soldad', 'soldar', 'oxicort', 'cort', 'perfor', 'canaliz', 'cablead', 'cablear',
  'conexion', 'empalm', 'prueb', 'impermeabiliz', 'aislam'
];

// Raíces de elementos o materiales constructivos
export const ELEMENT_ROOTS = [
  'losa', 'pared', 'muro', 'bloque', 'ladrillo', 'concreto', 'viga', 'columna',
  'zapata', 'fundacion', 'cimiento', 'piso', 'ceramica', 'porcelanato', 'granito',
  'tubo', 'tuberia', 'pvc', 'acero', 'hierro', 'metalic', 'baranda', 'escalera',
  'pasamano', 'bomba', 'motor', 'tablero', 'cable', 'conductor', 'luminaria',
  'aire', 'tanque', 'valvula', 'puerta', 'ventana', 'reja', 'porton', 'descanso',
  'techo', 'cielorraso', 'cubierta', 'mortero', 'friso', 'escombro', 'tierra', 'zanja',
  'armadura', 'cabilla', 'acometida', 'breake', 'drenaje', 'alcantarill', 'estructura'
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
export function validateStepInput(text, step, isMaintenance = false) {
  if (!text || typeof text !== 'string') {
    return { isValid: false, error: 'Por favor ingresa una respuesta válida.' };
  }
  const clean = text.trim();

  // Opciones estándar de omisión
  const isSkip = /^(omitir|ninguno|ninguno \/ omitir|sugerir por ia|sugerir)$/i.test(clean);
  if (isSkip && step !== 1 && (step !== 5 || !isMaintenance)) {
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
  } else if (step === 2) {
    if (clean.length < 2) {
      return {
        isValid: false,
        error: 'Por favor indica qué material, equipo o elemento se va a intervenir (ej: Bomba sumergible, Bloques de arcilla, Tubería PVC), o selecciona "Omitir".'
      };
    }
  } else if (step === 3) {
    if (clean.length < 2) {
      return {
        isValid: false,
        error: 'Por favor indica la ubicación o especificación técnica (ej: En planta baja, 2 HP, e=15 cm), o selecciona "Omitir".'
      };
    }
  } else if (step === 4) {
    if (clean.length < 2) {
      return {
        isValid: false,
        error: 'Por favor describe el alcance adicional (ej: Incluye andamios, Incluye acarreo), o selecciona "Omitir".'
      };
    }
  } else if (step === 5) {
    const cleanLower = clean.toLowerCase();
    if (isMaintenance && (cleanLower.includes('omitir') || cleanLower.includes('ninguno') || cleanLower.includes('sugerir'))) {
      return {
        isValid: false,
        error: 'Para actividades de mantenimiento o reparación, la unidad de cómputo es obligatoria. Elige pza, und, m² o m.'
      };
    }
    const VALID_UNITS = [
      'und', 'unidad', 'unidades', 'pza', 'pieza', 'piezas', 'm', 'ml', 'metro', 'metros',
      'm2', 'm²', 'm3', 'm³', 'kg', 'kgf', 'ton', 'tonf', 'pto', 'punto', 'puntos',
      'gln', 'galon', 'galones', 'jgo', 'juego', 'saco', 'sacos', 'sac', 'viaje', 'viajes',
      'mes', 'dia', 'hora', 'sugerir por ia', 'omitir', 'ninguno'
    ];
    const isRecognizedUnit = VALID_UNITS.some(u => cleanLower.includes(u));
    if (!isRecognizedUnit && clean.length < 8) {
      return {
        isValid: false,
        error: `"${clean}" no es una unidad de cómputo válida. Por favor selecciona o indica una unidad estándar (ej: und, pza, m², m³, m, kgf, pto).`
      };
    }
  }

  return { isValid: true };
}

export function useGuidedAssistant({ user, initialGuided = true, onComplete }) {
  const [isGuidedMode, setIsGuidedMode] = useState(initialGuided);
  const [entryModeSource, setEntryModeSource] = useState(initialGuided ? 'chat' : 'libre');
  const lastEntrySourceRef = useRef(initialGuided ? 'chat' : 'libre');

  const [guidedAccion, setGuidedAccion] = useState(null);
  const [guidedUbicacion, setGuidedUbicacion] = useState(null);
  const [guidedMaterial, setGuidedMaterial] = useState(null);
  const [guidedIncluye, setGuidedIncluye] = useState(null);
  const [guidedUnidad, setGuidedUnidad] = useState(null);

  const [currentChatStep, setCurrentChatStep] = useState(0);
  const [chatInputValue, setChatInputValue] = useState('');
  const [chatbotLoadingStage, setChatbotLoadingStage] = useState(0);
  const [guidedMessages, setGuidedMessages] = useState([]);
  const [detectedFullPrompt, setDetectedFullPrompt] = useState(null);

  // Inicializar mensaje de bienvenida según el usuario
  const createInitialMessage = useCallback(() => {
    const userName = user?.full_name || user?.email?.split('@')[0] || '';
    const greetingName = userName ? ` ${userName}` : '';
    return {
      id: 'msg-bot0',
      sender: 'bot',
      step: 0,
      text: `¡Hola${greetingName}! Construir una descripción detallada de una partida es lo esencial para evitar ambigüedades al momento de la ejecución en campo, y es la clave para que la Inteligencia Artificial encuentre exactamente lo que necesitas.\n\nEn 5 pasos rápidos armaremos la mejor descripción basándonos en la información suministrada. ¿Comenzamos?`,
      chips: ['Sí, comenzar']
    };
  }, [user]);

  useEffect(() => {
    setGuidedMessages([createInitialMessage()]);
  }, [createInitialMessage]);

  const getStepValue = (step) => {
    if (step === 1) return guidedAccion;
    if (step === 2) return guidedMaterial;
    if (step === 3) return guidedUbicacion;
    if (step === 4) return guidedIncluye;
    if (step === 5) return guidedUnidad;
    return '';
  };

  const handleGoBack = (targetStep = null) => {
    if (chatbotLoadingStage > 0) return;
    setDetectedFullPrompt(null);
    const prevStep = targetStep !== null ? targetStep : currentChatStep - 1;
    if (prevStep < 0) return;

    if (prevStep === 0) {
      setCurrentChatStep(0);
      setGuidedAccion(null);
      setGuidedMaterial(null);
      setGuidedUbicacion(null);
      setGuidedIncluye(null);
      setGuidedUnidad(null);
      setChatInputValue('');
      setGuidedMessages(prev => prev.filter(m => m.id === 'msg-bot0'));
      return;
    }

    setCurrentChatStep(prevStep);

    // Limpiar campos posteriores
    if (prevStep < 5) setGuidedUnidad(null);
    if (prevStep < 4) setGuidedIncluye(null);
    if (prevStep < 3) setGuidedUbicacion(null);
    if (prevStep < 2) setGuidedMaterial(null);
    if (prevStep < 1) setGuidedAccion(null);

    const prevVal = getStepValue(prevStep);
    setChatInputValue(prevVal && prevVal !== 'Omitir' && prevVal !== 'Ninguno' && prevVal !== 'Ninguno / Omitir' ? prevVal : '');

    // Rebobinar mensajes
    setGuidedMessages(prev => {
      return prev.filter(m => {
        if (m.id === 'msg-bot0' || m.step === 0) return true;
        if (typeof m.step === 'number' && m.step < prevStep) return true;
        if (m.step === prevStep && m.sender === 'bot') return true;
        return false;
      });
    });
  };

  const resetChatbot = () => {
    setCurrentChatStep(0);
    setGuidedAccion(null);
    setGuidedUbicacion(null);
    setGuidedMaterial(null);
    setGuidedIncluye(null);
    setGuidedUnidad(null);
    setChatInputValue('');
    setChatbotLoadingStage(0);
    setDetectedFullPrompt(null);
    setGuidedMessages([createInitialMessage()]);
  };

  const triggerGeneration = (promptToUse, unitToUse = null) => {
    setChatbotLoadingStage(1);
    setTimeout(() => setChatbotLoadingStage(2), 1200);
    setTimeout(() => setChatbotLoadingStage(3), 2500);
    setTimeout(() => setChatbotLoadingStage(4), 3800);
    setTimeout(() => {
      setEntryModeSource('chat');
      lastEntrySourceRef.current = 'chat';
      if (onComplete) {
        onComplete(promptToUse, 'chat', unitToUse);
      }
    }, 4500);
  };

  const handleChatSubmit = (text) => {
    if (!text || !text.trim()) return;
    const cleanText = text.trim();

    // 1. Manejo de Fast-Track cuando se detectó previamente un prompt completo
    if (detectedFullPrompt) {
      if (cleanText === 'Generar APU directamente') {
        const newUserMsg = { id: Date.now().toString(), sender: 'user', text: cleanText, step: 'fast_track' };
        setGuidedMessages(prev => [...prev, newUserMsg]);
        setChatInputValue('');
        triggerGeneration(detectedFullPrompt, null);
        return;
      }
      if (cleanText.startsWith('Unidad: ')) {
        let chosenUnit = cleanText.replace('Unidad: ', '').trim();
        if (chosenUnit === 'm²') chosenUnit = 'm2';
        if (chosenUnit === 'm³') chosenUnit = 'm3';
        const newUserMsg = { id: Date.now().toString(), sender: 'user', text: cleanText, step: 'fast_track' };
        setGuidedMessages(prev => [...prev, newUserMsg]);
        setChatInputValue('');
        triggerGeneration(detectedFullPrompt, chosenUnit);
        return;
      }
      if (cleanText === 'Desglosar en los 5 pasos') {
        const newUserMsg = { id: Date.now().toString(), sender: 'user', text: cleanText, step: 'fast_track' };
        const { accion, material, ubicacion, incluye } = decomposeComprehensivePrompt(detectedFullPrompt);
        setGuidedAccion(accion);
        setGuidedMaterial(material);
        setGuidedUbicacion(ubicacion);
        setGuidedIncluye(incluye);
        setCurrentChatStep(5);
        setDetectedFullPrompt(null);

        const isMaint = /mantenimiento|saneamiento|reconstrucci[oó]n|arreglo|reparaci[oó]n|rehabilitaci[oó]n|restauraci[oó]n/i.test(
          `${accion} ${material}`
        );
        const botMsg = {
          id: `bot-step-5-${Date.now()}`,
          sender: 'bot',
          step: 5,
          text: `He estructurado tu descripción técnica:\n• Acción: ${accion}\n• Elemento: ${material}\n• Ubicación: ${ubicacion || 'General'}\n• Alcance: ${incluye || 'Estándar'}\n\nÚltimo paso (5 de 5): Unidad de Medida\n¿En qué unidad deseas presupuestar la partida?`,
          chips: isMaint ? CHAT_STEP_DEFINITIONS[5].mantenimiento.chips : CHAT_STEP_DEFINITIONS[5].chips
        };
        setGuidedMessages(prev => [...prev, newUserMsg, botMsg]);
        setChatInputValue('');
        return;
      }
      // Si el usuario escribe una unidad en texto directo
      const unitVal = validateStepInput(cleanText, 5, false);
      if (unitVal.isValid && cleanText.length <= 10) {
        let directUnit = cleanText.toLowerCase().replace('m²', 'm2').replace('m³', 'm3');
        const newUserMsg = { id: Date.now().toString(), sender: 'user', text: cleanText, step: 'fast_track' };
        setGuidedMessages(prev => [...prev, newUserMsg]);
        setChatInputValue('');
        triggerGeneration(detectedFullPrompt, directUnit);
        return;
      }
    }

    // 2. Detección Inteligente de Descripción Completa (en paso 0, 1 o 2)
    if ((currentChatStep === 0 || currentChatStep === 1 || currentChatStep === 2) && isComprehensiveDescription(cleanText)) {
      setDetectedFullPrompt(cleanText);
      const newUserMsg = { id: Date.now().toString(), sender: 'user', text: cleanText, step: currentChatStep };
      const botMsg = {
        id: `bot-full-prompt-${Date.now()}`,
        sender: 'bot',
        step: 'fast_track',
        text: `He detectado que ingresaste una descripción técnica completa con acción, elemento y alcance de obra:\n\n«${cleanText}»\n\nPuedo generar tu APU de inmediato con esta descripción completa, o si prefieres, puedes seleccionar una unidad de cómputo para el cálculo:`,
        chips: [
          'Generar APU directamente',
          'Unidad: und',
          'Unidad: pza',
          'Unidad: m²',
          'Unidad: m',
          'Unidad: m³',
          'Desglosar en los 5 pasos'
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
        const nextBotMsg = {
          id: `bot-step-1-${Date.now()}`,
          sender: 'bot',
          step: 1,
          text: CHAT_STEP_DEFINITIONS[1].text,
          chips: CHAT_STEP_DEFINITIONS[1].chips
        };
        setGuidedMessages(prev => [...prev, newUserMsg, nextBotMsg]);
        setChatInputValue('');
        return;
      }
      // Si el usuario escribe una acción directamente en paso 0
      const actionVal = validateStepInput(cleanText, 1, false);
      if (actionVal.isValid) {
        setGuidedAccion(cleanText);
        setCurrentChatStep(2);
        const newUserMsg = { id: Date.now().toString(), sender: 'user', text: cleanText, step: 0 };
        const isSupplyOrInstall = /suministr|instalac|colocac|montaje/i.test(cleanText);
        const isAcarreo = /acarreo|acarrear|bote|botar|transporte|transportar|traslado/i.test(cleanText);
        let nextBotMsg;
        if (isAcarreo) {
          nextBotMsg = { id: `bot-step-2-${Date.now()}`, sender: 'bot', step: 2, text: CHAT_STEP_DEFINITIONS[2].acarreo.text, chips: CHAT_STEP_DEFINITIONS[2].acarreo.chips };
        } else if (isSupplyOrInstall) {
          const def = CHAT_STEP_DEFINITIONS[2].supplyOrInstall(cleanText);
          nextBotMsg = { id: `bot-step-2-${Date.now()}`, sender: 'bot', step: 2, text: def.text, chips: def.chips };
        } else {
          nextBotMsg = { id: `bot-step-2-${Date.now()}`, sender: 'bot', step: 2, text: CHAT_STEP_DEFINITIONS[2].general.text, chips: CHAT_STEP_DEFINITIONS[2].general.chips };
        }
        setGuidedMessages(prev => [...prev, newUserMsg, nextBotMsg]);
        setChatInputValue('');
        return;
      }
      toast.error('Por favor haz clic en "Sí, comenzar" o describe la acción constructiva a realizar.', { id: 'chat-welcome-err' });
      return;
    }

    // 4. Validación de Entrada del Paso Actual (Pasos 1 a 5)
    const isMaintenance = /mantenimiento|saneamiento|reconstrucci[oó]n|arreglo|reparaci[oó]n|rehabilitaci[oó]n|restauraci[oó]n/i.test(
      `${guidedAccion || ''} ${guidedMaterial || ''}`
    );
    const lastBotMsg = [...guidedMessages].reverse().find(m => m.sender === 'bot');
    const isChipSelection = lastBotMsg?.chips?.includes(cleanText);

    if (!isChipSelection) {
      const validation = validateStepInput(cleanText, currentChatStep, isMaintenance);
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

    // 5. Asignación de Estado de Paso Válido
    const newUserMsg = { id: Date.now().toString(), sender: 'user', text: cleanText, step: currentChatStep };

    let currentAccion = guidedAccion;
    let currentMaterial = guidedMaterial;
    let currentUbicacion = guidedUbicacion;
    let currentIncluye = guidedIncluye;
    let currentUnidad = guidedUnidad;

    if (currentChatStep === 1) {
      setGuidedAccion(cleanText);
      currentAccion = cleanText;
    } else if (currentChatStep === 2) {
      setGuidedMaterial(cleanText);
      currentMaterial = cleanText;
    } else if (currentChatStep === 3) {
      setGuidedUbicacion(cleanText);
      currentUbicacion = cleanText;
    } else if (currentChatStep === 4) {
      setGuidedIncluye(cleanText);
      currentIncluye = cleanText;
    } else if (currentChatStep === 5) {
      setGuidedUnidad(cleanText);
      currentUnidad = cleanText;
    }

    const isSupplyOrInstall = /suministr|instalac|colocac|montaje/i.test(currentAccion || guidedAccion || '');
    const isAcarreo = /acarreo|acarrear|bote|botar|transporte|transportar|traslado/i.test(currentAccion || guidedAccion || '');

    const nextStep = currentChatStep === 0 ? 1 : currentChatStep + 1;
    setCurrentChatStep(nextStep);

    let nextBotMsg = null;
    if (nextStep === 1) {
      nextBotMsg = {
        id: `bot-step-1-${Date.now()}`,
        sender: 'bot',
        step: 1,
        text: CHAT_STEP_DEFINITIONS[1].text,
        chips: CHAT_STEP_DEFINITIONS[1].chips
      };
    } else if (nextStep === 2) {
      if (isAcarreo) {
        nextBotMsg = { id: `bot-step-2-${Date.now()}`, sender: 'bot', step: 2, text: CHAT_STEP_DEFINITIONS[2].acarreo.text, chips: CHAT_STEP_DEFINITIONS[2].acarreo.chips };
      } else if (isSupplyOrInstall) {
        const def = CHAT_STEP_DEFINITIONS[2].supplyOrInstall(currentAccion);
        nextBotMsg = { id: `bot-step-2-${Date.now()}`, sender: 'bot', step: 2, text: def.text, chips: def.chips };
      } else {
        nextBotMsg = { id: `bot-step-2-${Date.now()}`, sender: 'bot', step: 2, text: CHAT_STEP_DEFINITIONS[2].general.text, chips: CHAT_STEP_DEFINITIONS[2].general.chips };
      }
    } else if (nextStep === 3) {
      const parametricDef = getParametricStep3Definition(currentMaterial, currentAccion);
      if (parametricDef) {
        nextBotMsg = { id: `bot-step-3-${Date.now()}`, sender: 'bot', step: 3, text: parametricDef.text, chips: parametricDef.chips };
      } else if (isAcarreo) {
        nextBotMsg = { id: `bot-step-3-${Date.now()}`, sender: 'bot', step: 3, text: CHAT_STEP_DEFINITIONS[3].acarreo.text, chips: CHAT_STEP_DEFINITIONS[3].acarreo.chips };
      } else if (isSupplyOrInstall) {
        nextBotMsg = { id: `bot-step-3-${Date.now()}`, sender: 'bot', step: 3, text: CHAT_STEP_DEFINITIONS[3].supplyOrInstall.text, chips: CHAT_STEP_DEFINITIONS[3].supplyOrInstall.chips };
      } else {
        nextBotMsg = { id: `bot-step-3-${Date.now()}`, sender: 'bot', step: 3, text: CHAT_STEP_DEFINITIONS[3].general.text, chips: CHAT_STEP_DEFINITIONS[3].general.chips };
      }
    } else if (nextStep === 4) {
      if (isAcarreo) {
        nextBotMsg = {
          id: `bot-step-4-${Date.now()}`,
          sender: 'bot',
          step: 4,
          text: CHAT_STEP_DEFINITIONS[4].acarreo.text,
          chips: CHAT_STEP_DEFINITIONS[4].acarreo.chips
        };
      } else {
        nextBotMsg = {
          id: `bot-step-4-${Date.now()}`,
          sender: 'bot',
          step: 4,
          text: CHAT_STEP_DEFINITIONS[4].text,
          chips: CHAT_STEP_DEFINITIONS[4].chips
        };
      }
    } else if (nextStep === 5) {
      if (isMaintenance) {
        nextBotMsg = {
          id: `bot-step-5-${Date.now()}`,
          sender: 'bot',
          step: 5,
          text: CHAT_STEP_DEFINITIONS[5].mantenimiento.text,
          chips: CHAT_STEP_DEFINITIONS[5].mantenimiento.chips
        };
      } else if (isAcarreo) {
        nextBotMsg = {
          id: `bot-step-5-${Date.now()}`,
          sender: 'bot',
          step: 5,
          text: CHAT_STEP_DEFINITIONS[5].acarreo.text,
          chips: CHAT_STEP_DEFINITIONS[5].acarreo.chips
        };
      } else {
        nextBotMsg = {
          id: `bot-step-5-${Date.now()}`,
          sender: 'bot',
          step: 5,
          text: CHAT_STEP_DEFINITIONS[5].text,
          chips: CHAT_STEP_DEFINITIONS[5].chips
        };
      }
    } else if (nextStep === 6) {
      const parts = [];

      // 1. Acción
      if (currentAccion && currentAccion !== 'Omitir' && currentAccion !== 'Ninguno' && currentAccion !== 'Ninguno / Omitir') {
        parts.push(currentAccion);
      }

      // 2. Material / Equipo / Elemento
      if (currentMaterial && currentMaterial !== 'Omitir' && currentMaterial !== 'Ninguno' && currentMaterial !== 'Ninguno / Omitir') {
        const matLower = currentMaterial.toLowerCase();
        const accLower = (currentAccion || '').toLowerCase();
        if (!accLower.endsWith('de') && !accLower.endsWith('en') && !matLower.startsWith('de ') && !matLower.startsWith('del ') && !matLower.startsWith('en ')) {
          parts.push(`de ${currentMaterial}`);
        } else {
          parts.push(currentMaterial);
        }
      }

      // 3. Destino / Ubicación / Distancia / Parámetro técnico
      if (currentUbicacion && currentUbicacion !== 'Omitir' && currentUbicacion !== 'Ninguno' && currentUbicacion !== 'Ninguno / Omitir') {
        const ubiLower = currentUbicacion.toLowerCase();
        const hasPrep = ubiLower.startsWith('para ') || ubiLower.startsWith('en ') || ubiLower.startsWith('sobre ') || ubiLower.startsWith('hacia ') || ubiLower.startsWith('bajo ') || ubiLower.startsWith('distancia ') || ubiLower.startsWith('a ') || ubiLower.startsWith('de ') || ubiLower.startsWith('hasta ');
        const isParametric = /^(espesor|di[aá]metro|calibre|\d|e\s*=|d\s*=|hasta\s*\d)/i.test(ubiLower);
        if (isParametric) {
          parts.push(currentUbicacion);
        } else if (!hasPrep) {
          const isSupply = /suministr|instalac|colocac|montaje/i.test(currentAccion || '');
          parts.push(isSupply ? `para ${currentUbicacion}` : `en ${currentUbicacion}`);
        } else {
          parts.push(currentUbicacion);
        }
      }

      // 4. Alcance y Condiciones
      if (currentIncluye && currentIncluye !== 'Omitir' && currentIncluye !== 'Ninguno' && currentIncluye !== 'Ninguno / Omitir') {
        parts.push(currentIncluye);
      }

      // 5. Unidad de medida
      let extractedUnit = null;
      if (cleanText && cleanText !== 'Sugerir por IA' && cleanText !== 'Ninguno / Omitir' && cleanText !== 'Ninguno' && cleanText !== 'Omitir') {
        let rawUnit = cleanText.includes('(') ? cleanText.split('(')[0].trim() : cleanText.trim();
        if (rawUnit === 'm²') rawUnit = 'm2';
        else if (rawUnit === 'm³') rawUnit = 'm3';
        extractedUnit = rawUnit.toLowerCase();
        parts.push(`unidad ${extractedUnit}`);
      }

      const finalPrompt = parts.join(' ').replace(/\s+/g, ' ').trim();
      triggerGeneration(finalPrompt, extractedUnit);
    }

    if (nextBotMsg) {
      setGuidedMessages(prev => [...prev, newUserMsg, nextBotMsg]);
    } else {
      setGuidedMessages(prev => [...prev, newUserMsg]);
    }
    setChatInputValue('');
  };

  return {
    isGuidedMode,
    setIsGuidedMode,
    entryModeSource,
    setEntryModeSource,
    lastEntrySourceRef,
    guidedAccion,
    setGuidedAccion,
    guidedUbicacion,
    setGuidedUbicacion,
    guidedMaterial,
    setGuidedMaterial,
    guidedIncluye,
    setGuidedIncluye,
    guidedUnidad,
    setGuidedUnidad,
    currentChatStep,
    setCurrentChatStep,
    chatInputValue,
    setChatInputValue,
    chatbotLoadingStage,
    setChatbotLoadingStage,
    guidedMessages,
    setGuidedMessages,
    detectedFullPrompt,
    handleChatSubmit,
    handleGoBack,
    resetChatbot
  };
}
