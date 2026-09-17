import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { CHAT_STEP_DEFINITIONS, getParametricStep3Definition } from '../constants/guidedBuilderConstants';

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
        if (m.step === 0 || m.id === 'msg-bot0') return true;
        if (m.step < prevStep) return true;
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
    setGuidedMessages([createInitialMessage()]);
  };

  const handleChatSubmit = (text) => {
    if (!text || !text.trim()) return;
    const cleanText = text.trim();

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
    const isMaintenance = /mantenimiento|saneamiento|reconstrucci[oó]n|arreglo|reparaci[oó]n|rehabilitaci[oó]n|restauraci[oó]n/i.test(
      `${currentAccion || guidedAccion || ''} ${currentMaterial || guidedMaterial || ''}`
    );

    if (currentChatStep === 5 && isMaintenance) {
      const lower = cleanText.toLowerCase();
      if (lower.includes('omitir') || lower.includes('ninguno') || lower.includes('sugerir')) {
        toast.error('Para actividades de mantenimiento o reparación, la unidad de cómputo es obligatoria. Elige pza, und, m² o m.', {
          id: 'chat-unit-required'
        });
        return;
      }
    }

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
      setChatbotLoadingStage(1);
      setTimeout(() => setChatbotLoadingStage(2), 1500);
      setTimeout(() => setChatbotLoadingStage(3), 3000);
      setTimeout(() => setChatbotLoadingStage(4), 4500);
      setTimeout(() => {
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
        setEntryModeSource('chat');
        lastEntrySourceRef.current = 'chat';
        if (onComplete) {
          onComplete(finalPrompt, 'chat', extractedUnit);
        }
      }, 5000);
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
    handleChatSubmit,
    handleGoBack,
    resetChatbot
  };
}
