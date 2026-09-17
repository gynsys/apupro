import { useState, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { generateAIApu } from '../services/cost360Service';

export function useApuGenerator({ setSettings }) {
  const [loading, setLoading] = useState(false);
  const [item, setItem] = useState(null);

  // Estados de aclaratoria
  const [isClarifying, setIsClarifying] = useState(false);
  const [aiClarificationMessage, setAiClarificationMessage] = useState('');
  const [aiClarificationRecommendation, setAiClarificationRecommendation] = useState('');
  const [aiOptions, setAiOptions] = useState([]);
  const [aiQuestions, setAiQuestions] = useState([]);
  const [aiGuiaRedaccion, setAiGuiaRedaccion] = useState(null);
  const [chatHistory, setChatHistory] = useState([]);

  // Estados de Match Exacto
  const [exactMatchCandidate, setExactMatchCandidate] = useState(null);
  const [basePrompt, setBasePrompt] = useState('');

  // Debug y suscripción
  const [debugInfo, setDebugInfo] = useState(null);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [subscriptionErrorMsg, setSubscriptionErrorMsg] = useState(null);

  const dismissClarification = useCallback(() => {
    setIsClarifying(false);
    setAiClarificationMessage('');
    setAiClarificationRecommendation('');
    setAiOptions([]);
    setAiQuestions([]);
    setAiGuiaRedaccion(null);
  }, []);

  const processAIResponse = useCallback((response, textToSubmit) => {
    let currentDebug = null;
    if (response.debug_rag_trace || response.debug_base_apu) {
      currentDebug = {
        message: 'Generación asistida por RAG Híbrido y Adaptación de Partida Base',
        solicitud_usuario: textToSubmit,
        rag_trace: response.debug_rag_trace || null,
        base_apu: response.debug_base_apu || null,
        prompt_enviado_al_llm: response.prompt_enviado_al_llm || null,
        respuesta_cruda_llm: {
          partida: response.partida,
          notas_adaptacion: response.notas_adaptacion || [],
          advertencias: response.advertencias,
          materials: response.materials || [],
          equipments: response.equipments || [],
          labors: response.labors || [],
          conteo_materiales: (response.materials || []).length,
          conteo_equipos: (response.equipments || []).length,
          conteo_mano_obra: (response.labors || []).length
        }
      };
      setDebugInfo(currentDebug);
    } else if (response.debug_preprocesamiento) {
      currentDebug = response.debug_preprocesamiento;
      setDebugInfo(currentDebug);
    } else {
      setDebugInfo(null);
    }

    // Auto-descarga de Debug JSON si está habilitado desde Utilitarios
    const shouldDownloadDebug = localStorage.getItem('auto_download_debug_json') === 'true';
    if (shouldDownloadDebug && currentDebug) {
      try {
        const blob = new Blob([JSON.stringify(currentDebug, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `debug_apu_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        toast.success('Debug JSON descargado automáticamente', { icon: '📥' });
      } catch (err) {
        console.error('Error al auto-descargar Debug JSON:', err);
      }
    }

    if (response.status === 'exact_match_candidate') {
      setExactMatchCandidate(response.matched_item);
      setBasePrompt(textToSubmit);
      setIsClarifying(false);
      toast('Existe una partida que coincide con tu descripción', { icon: '🎯' });
      return;
    }

    if (response.status === 'clarification_needed') {
      setChatHistory(prev => [...prev, { role: 'user', content: textToSubmit }]);
      setAiClarificationMessage(response.clarification_message || 'No se pudo interpretar una partida técnica válida.');
      setAiClarificationRecommendation(response.recommendation || 'Te recomendamos utilizar el Asistente Guiado para estructurar tu descripción paso a paso.');
      setAiOptions(response.options || []);
      setAiQuestions(response.questions || []);
      setAiGuiaRedaccion(response.guia_redaccion || null);
      setIsClarifying(true);
      toast.error('Se requiere una descripción técnica estructurada.', { icon: '⚠️' });
    } else {
      dismissClarification();
      setChatHistory([]);
      setExactMatchCandidate(null);

      // Filtrar advertencias para la vista pública
      const rawAdvertencias = response.advertencias || [];
      const advertenciasPublicas = rawAdvertencias.filter(adv => {
        const lower = adv.toLowerCase();
        if (
          lower.includes('adaptado desde la partida base') ||
          lower.includes('apu adaptado') ||
          lower.includes('se mantuvieron rendimientos') ||
          lower.includes('se eliminaron los insumos') ||
          lower.includes('[alcance]') ||
          lower.includes('se excluye')
        ) {
          return false;
        }
        return true;
      });

      if (setSettings) {
        setSettings(prev => ({ ...prev, iva_percent: 0 }));
      }
      setItem({
        ...response.partida,
        materials: response.materials || [],
        equipments: response.equipments || [],
        labors: response.labors || [],
        advertencias: advertenciasPublicas,
        source: response.source || null,
        similarity: response.similarity || null
      });
      if (response.source === 'user_semantic_cache') {
        toast.success(`⚡ APU recuperado de tus partidas guardadas (${Math.round((response.similarity || 1) * 100)}% similitud)`, {
          duration: 4500,
          icon: '⚡'
        });
      } else {
        toast.success('APU generado con éxito');
      }
    }
  }, [dismissClarification, setSettings]);

  const handleGenerate = useCallback(async (textToSubmit, onlyPreprocess = false, bypassSmart = false, bypassExactMatch = false, acceptExactMatchCode = null) => {
    if (!textToSubmit || !textToSubmit.trim()) {
      toast.error('Ingresa una descripción para generar el APU');
      return;
    }

    setLoading(true);
    setItem(null);
    setExactMatchCandidate(null);

    try {
      const context = 'Generación Libre de APU (Búsqueda Híbrida Inteligente)';
      const prefixToSend = '';

      if (acceptExactMatchCode) {
        const response = await generateAIApu(textToSubmit, prefixToSend, context, [], false, false, acceptExactMatchCode);
        processAIResponse(response, textToSubmit);
        return;
      }

      const newHistory = isClarifying ? [...chatHistory, { role: 'user', content: textToSubmit }] : [{ role: 'user', content: textToSubmit }];
      const response = await generateAIApu(textToSubmit, prefixToSend, context, newHistory, onlyPreprocess, bypassExactMatch);
      processAIResponse(response, textToSubmit);
    } catch (error) {
      console.error('Error en generación APU con IA:', error);
      const status = error.response?.status;
      const detail = error.response?.data?.detail;

      if (status === 403) {
        const errorMsg = detail || 'No tienes una suscripción activa o permiso para utilizar el Generador de APU asistido por IA.';
        toast.error(errorMsg, { duration: 7000, icon: '🔒' });
        setSubscriptionErrorMsg(errorMsg);
        setShowSubscriptionModal(true);
      } else if (status === 401) {
        toast.error('Tu sesión ha expirado o no estás autenticado. Por favor inicia sesión nuevamente.', { duration: 5000 });
      } else {
        toast.error(detail || 'Error al generar APU con IA. Inténtalo nuevamente.');
      }
    } finally {
      setLoading(false);
    }
  }, [chatHistory, isClarifying, processAIResponse]);

  const handleAcceptExactMatch = useCallback(async () => {
    if (!exactMatchCandidate) return;
    const itemCode = exactMatchCandidate.cod_par;
    const textPrompt = basePrompt;
    setExactMatchCandidate(null);
    await handleGenerate(textPrompt, false, true, false, itemCode);
  }, [exactMatchCandidate, basePrompt, handleGenerate]);

  const handleRejectExactMatch = useCallback(async () => {
    const textPrompt = basePrompt;
    setExactMatchCandidate(null);
    await handleGenerate(textPrompt, false, true, true, null);
  }, [basePrompt, handleGenerate]);

  return {
    loading,
    item,
    setItem,
    isClarifying,
    setIsClarifying,
    aiClarificationMessage,
    aiClarificationRecommendation,
    aiOptions,
    aiQuestions,
    aiGuiaRedaccion,
    exactMatchCandidate,
    setExactMatchCandidate,
    basePrompt,
    setBasePrompt,
    debugInfo,
    showSubscriptionModal,
    setShowSubscriptionModal,
    subscriptionErrorMsg,
    setSubscriptionErrorMsg,
    handleGenerate,
    handleAcceptExactMatch,
    handleRejectExactMatch,
    dismissClarification
  };
}
