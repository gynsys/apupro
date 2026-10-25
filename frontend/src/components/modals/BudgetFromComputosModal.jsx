import React, { useState, useRef, useEffect } from 'react';
import {
  Bot,
  User,
  Send,
  X,
  Sparkles,
  CheckCircle2,
  FolderPlus,
  Calculator,
  ClipboardList,
  Trash2,
  Loader2,
  Layers,
  FileCheck2,
  RefreshCw,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  RotateCcw,
} from 'lucide-react';
import { budgetService } from '../../services/budgetService';

const COMMON_UNITS = ['M2', 'M3', 'ML', 'UND', 'PTO', 'KGF', 'TON', 'GL'];

const UNIT_ALIASES = {
  m2: 'M2',
  'm²': 'M2',
  mt2: 'M2',
  mts2: 'M2',
  m3: 'M3',
  'm³': 'M3',
  mt3: 'M3',
  mts3: 'M3',
  ml: 'ML',
  m: 'ML',
  mt: 'ML',
  mts: 'ML',
  metro: 'ML',
  metros: 'ML',
  und: 'UND',
  unid: 'UND',
  unidad: 'UND',
  pza: 'UND',
  pieza: 'UND',
  pto: 'PTO',
  punto: 'PTO',
  kg: 'KGF',
  kgf: 'KGF',
  kilo: 'KGF',
  ton: 'TON',
  tn: 'TON',
  gl: 'GL',
  global: 'GL',
  sg: 'SG',
  ha: 'HA',
  km: 'KM',
  lt: 'LT',
  l: 'LT',
};

const CHAPTER_PREFIX_RE = /^(?:cap[ií]tulo|cap\.?)\s*[:\-]?\s*(.+)$/i;
const PURE_UNIT_LINE_RE = /^(?:und\.?|unidad\s*[:\-]?)?\s*(m2|m²|mt2|mts2|m3|m³|mt3|mts3|ml|m|mts|und|unid|unidad|pza|pto|punto|kg|kgf|ton|tn|gl|global|sg|ha|km|lt|l)\.?$/i;

const MEASURE_TRAILING_RE =
  /[:\s,=-]+((?:\(?\d+(?:[.,]\d+)?\)?\s*[*xX×/+-]\s*)+\(?\d+(?:[.,]\d+)?\)?|\d+(?:[.,]\d+)?)\s*(m2|m²|mt2|mts2|m3|m³|mt3|mts3|ml|mts|mt|m|metro|metros|und|unid|unidad|unidades|pza|pieza|piezas|pto|ptos|punto|puntos|kgf|kg|kilos|ton|tn|gl|global)?\.?\s*$/i;

/**
 * Infiere la unidad de medida según palabras clave de la descripción de la partida.
 */
function inferUnitFromDescription(desc = '') {
  const d = (desc || '').toLowerCase();
  if (
    /losa|piso|techo|manto|impermeab|pared|friso|pintura|ceramica|porcelanato|muro|tabique|cielorraso|drywall|bloque|sobrepiso|acera|esmalte|epoxi/i.test(
      d
    )
  ) {
    return 'M2';
  }
  if (
    /concreto|vaciado|bote|escombro|excavaci[oó]n|relleno|viga|columna|zapata|pedestal|mortero/i.test(
      d
    )
  ) {
    return 'M3';
  }
  if (
    /tuber[ií]a|tubo|cable|canal|rodapi[eé]|acero|cabilla|costanera|viga corona|conducto/i.test(
      d
    )
  ) {
    return 'ML';
  }
  if (
    /punto|pto|toma|l[aá]mpara|interruptor|grifer[ií]a|lavamanos|poceta|inodoro|tomacorriente/i.test(
      d
    )
  ) {
    return 'PTO';
  }
  return 'UND';
}

/**
 * Evalúa de forma segura una expresión de mediciones como:
 * "10.50*7.50 m", "10,50 x 7,50", "10.50*7.50 + 3.20*2.00", "(4.5+3.2)*2.80", "25 m2", "12.50"
 */
function evaluateMeasurementFormula(rawLine) {
  if (!rawLine || typeof rawLine !== 'string') return null;
  const trimmed = rawLine.trim();
  if (!trimmed) return null;

  const words = trimmed.match(/[a-zA-ZáéíóúÁÉÍÓÚñÑ]+/g) || [];
  const allowedMeasureWords = new Set([
    'x', 'm', 'mt', 'mts', 'metro', 'metros', 'ml', 'm2', 'm3',
    'cm', 'mm', 'und', 'pza', 'pto', 'kg', 'kgf', 'ton', 'gl', 'de', 'por',
  ]);
  const nonMeasureWords = words.filter((w) => !allowedMeasureWords.has(w.toLowerCase()));
  if (nonMeasureWords.length > 1) return null;

  let explicitUnit = null;
  const trailingUnitMatch = trimmed.match(/\b(m2|m²|mt2|mts2|m3|m³|mt3|mts3|ml|mts|mt|m|metro|metros|und|pza|pto|kgf|kg|ton|gl)\s*$/i);
  if (trailingUnitMatch) {
    const rawU = trailingUnitMatch[1].toLowerCase();
    explicitUnit = UNIT_ALIASES[rawU] || rawU.toUpperCase();
  }

  let expr = trimmed
    .replace(/(\d),(\d)/g, '$1.$2')
    .replace(/(\d+(?:\.\d+)?)\s*(?:m2|m²|mt2|mts2|m3|m³|mt3|mts3|ml|mts|mt|m|metro|metros|cm|mm|und|pza|pto|kgf|kg|ton|gl)\b/gi, '$1')
    .replace(/\b(?:por|x|×)\b/gi, '*')
    .replace(/[x×]/gi, '*')
    .replace(/[^0-9+\-*/().\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!expr || !/\d/.test(expr)) return null;
  if (!/^[0-9+\-*/().\s]+$/.test(expr)) return null;
  expr = expr.replace(/^[+\-*/.]+|[+\-*/.]+$/g, '').trim();
  if (!expr || !/\d/.test(expr)) return null;

  try {
    // eslint-disable-next-line no-new-func
    const val = Function(`"use strict"; return (${expr});`)();
    if (typeof val !== 'number' || !Number.isFinite(val) || val <= 0) return null;

    const quantity = Math.round(val * 10000) / 10000;
    const multParts = expr.split('*').length;
    const inferredUnit = explicitUnit || (multParts === 3 ? 'M3' : multParts === 2 ? 'M2' : null);
    const cleanFormula = expr.replace(/\*/g, ' × ');

    return {
      quantity,
      formula: cleanFormula,
      hasOperator: /[+\-*/]/.test(expr),
      inferredUnit,
      explicitUnit,
    };
  } catch {
    return null;
  }
}

/**
 * Analiza un mensaje del usuario (multilínea, partida única, o lista de partidas).
 * Extrae capítulos, partidas, fórmulas de medición y unidades.
 */
function parseComputosInput(text, defaultChapter = 'OBRAS PRELIMINARES') {
  if (!text || typeof text !== 'string') {
    return { items: [], activeChapter: defaultChapter };
  }

  const rawLines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (rawLines.length === 0) {
    return { items: [], activeChapter: defaultChapter };
  }

  const items = [];
  let currentChap = defaultChapter;
  let i = 0;

  while (i < rawLines.length) {
    const line = rawLines[i];

    // ¿Es cabecera de capítulo?
    const chapMatch = line.match(CHAPTER_PREFIX_RE);
    if (chapMatch && chapMatch[1]) {
      currentChap = chapMatch[1].trim().toUpperCase();
      i += 1;
      continue;
    }

    // ¿Línea de una sola partida con medición al final? Ej: "Friso en paredes 25 m2" o "Losa 10.5*7.5 m2"
    const inlineMatch = line.match(MEASURE_TRAILING_RE);
    const prefixText = inlineMatch ? line.slice(0, inlineMatch.index).trim() : '';
    if (inlineMatch && prefixText.replace(/^[\d+.)\-#\s]+/, '').length >= 3) {
      const desc = prefixText.replace(/^[\d+.)\-#\s]+/, '').trim();
      const rawFormula = inlineMatch[1];
      const rawUnit = inlineMatch[2];
      const formulaEval = evaluateMeasurementFormula(rawFormula);
      const qty = formulaEval?.quantity || parseFloat(rawFormula.replace(',', '.')) || 1;
      const cleanFormula = formulaEval?.formula || rawFormula.replace(/\*/g, ' × ');
      const unit =
        (rawUnit && UNIT_ALIASES[rawUnit.toLowerCase()]) ||
        formulaEval?.inferredUnit ||
        inferUnitFromDescription(desc);

      items.push({
        chapter: currentChap,
        description: desc.toUpperCase(),
        quantity: qty,
        formula: cleanFormula,
        unit,
        isDefaultQty: false,
      });
      i += 1;
      continue;
    }

    // Bloque multilínea o partida descriptiva
    const desc = line.replace(/^[\d+.)\-#\s]+/, '').trim();
    let formula = null;
    let unit = null;
    let qty = 1;
    let isDefaultQty = true;

    // Mirar si la siguiente línea es la fórmula de medición
    if (i + 1 < rawLines.length) {
      const nextLine = rawLines[i + 1];
      const measEval = evaluateMeasurementFormula(nextLine);
      if (measEval) {
        qty = measEval.quantity;
        formula = measEval.formula;
        unit = measEval.explicitUnit || measEval.inferredUnit;
        isDefaultQty = false;
        i += 1; // consumir línea de medición

        // Mirar si la subsiguiente línea es la unidad pura (ej: M2)
        if (!unit && i + 1 < rawLines.length) {
          const unitLineMatch = rawLines[i + 1].match(PURE_UNIT_LINE_RE);
          if (unitLineMatch && unitLineMatch[1]) {
            const k = unitLineMatch[1].toLowerCase();
            unit = UNIT_ALIASES[k] || k.toUpperCase();
            i += 1; // consumir línea de unidad
          }
        }
      }
    }

    if (!unit) {
      unit = inferUnitFromDescription(desc);
    }
    if (!formula) {
      formula = String(qty);
    }

    items.push({
      chapter: currentChap,
      description: desc.toUpperCase(),
      quantity: qty,
      formula,
      unit,
      isDefaultQty,
    });
    i += 1;
  }

  return { items, activeChapter: currentChap };
}

const STORAGE_KEY = 'costbase_computos_draft_v1';
// Purgar cualquier borrador huérfano que haya quedado en localStorage
try {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.removeItem(STORAGE_KEY);
  }
} catch {
  // noop
}

const INITIAL_WELCOME_MESSAGE = {
  id: 'welcome',
  role: 'bot',
  type: 'welcome',
  content:
    '¡Hola! Soy tu asistente de cómputos en campo. Anota tus partidas aquí (capítulo, descripción, mediciones y unidad) y al finalizar presiona "Confirmar y Generar Presupuesto" para buscar las coincidencias en la BD o generar sus APUs.',
};

export default function BudgetFromComputosModal({ isOpen, onClose, onCreated }) {
  const [activeChapter, setActiveChapter] = useState('OBRAS PRELIMINARES');
  const [isEditingChapter, setIsEditingChapter] = useState(false);
  const [chapterInput, setChapterInput] = useState('');
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  const [messages, setMessages] = useState([INITIAL_WELCOME_MESSAGE]);
  const [inputText, setInputText] = useState('');

  // Estado conversacional cuando el usuario escribe paso a paso
  const [pendingDraft, setPendingDraft] = useState(null);
  const [lastCapturedItemId, setLastCapturedItemId] = useState(null);

  // Lista de partidas levantadas en el chat (en memoria, se reinicia al refrescar o al pulsar Limpiar)
  const [capturedItems, setCapturedItems] = useState([]);
  const [showSummaryDrawer, setShowSummaryDrawer] = useState(false);

  // Datos de encabezado del presupuesto para guardar
  const [budgetName, setBudgetName] = useState(() => {
    const today = new Date().toLocaleDateString('es-VE');
    return `Presupuesto de Inspección - ${today}`;
  });
  const [projectName, setProjectName] = useState('');
  const [clientName, setClientName] = useState('');
  const [currency, setCurrency] = useState('USD');

  // Estado del proceso final "Confirmar y Generar Presupuesto"
  const [isCommitting, setIsCommitting] = useState(false);
  const [commitProgressText, setCommitProgressText] = useState('');
  const [commitStepInfo, setCommitStepInfo] = useState({ current: 0, total: 0 });
  const [commitError, setCommitError] = useState(null);

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    const onUp = () => setIsOnline(true);
    const onDown = () => setIsOnline(false);
    window.addEventListener('online', onUp);
    window.addEventListener('offline', onDown);
    return () => {
      window.removeEventListener('online', onUp);
      window.removeEventListener('offline', onDown);
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  if (!isOpen) return null;

  const appendMessage = (msg) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        ...msg,
      },
    ]);
  };

  /**
   * Registra de inmediato el cómputo en la lista local sin bloquear al usuario en campo.
   * La búsqueda en la BD y la generación del APU se ejecutan al presionar "Confirmar y Generar Presupuesto".
   */
  const registerCapturedComputo = ({
    chapter,
    description,
    quantity,
    formula,
    unit,
    isDefaultQty = false,
  }) => {
    const normalizedUnit = (unit || 'M2').toUpperCase();
    const itemId = `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const finalQty = Number(quantity) || 1;
    const finalFormula = formula || String(finalQty);
    const newItem = {
      id: itemId,
      chapter: (chapter || activeChapter || 'GENERAL').trim().toUpperCase(),
      description: (description || '').trim().toUpperCase(),
      unit: normalizedUnit,
      quantity: finalQty,
      formula: finalFormula,
      isDefaultQty,
    };

    setCapturedItems((prev) => [...prev, newItem]);
    setLastCapturedItemId(itemId);

    if (isDefaultQty) {
      appendMessage({
        role: 'bot',
        type: 'item_captured',
        itemId,
        content: `Cómputo registrado: **${newItem.description}** (${newItem.quantity} ${newItem.unit}). Puedes anotar otra partida, ajustar la medida respondiendo (ej: \`10.50*7.50 m2\` o \`25\`) o ver la lista en "Cómputos".`,
      });
    } else {
      appendMessage({
        role: 'bot',
        type: 'item_captured',
        itemId,
        content: `Cómputo registrado: **${newItem.description}** (${newItem.formula} = ${newItem.quantity} ${newItem.unit}). Puedes anotar otra partida o presionar "Confirmar y Generar Presupuesto".`,
      });
    }

    return newItem;
  };

  const handleSendMessage = (overrideText = null) => {
    const raw = (overrideText !== null ? overrideText : inputText).trim();
    if (!raw || isCommitting) return;

    if (overrideText === null) {
      setInputText('');
    }
    appendMessage({ role: 'user', content: raw });

    // 1. ¿Es una actualización de medidas para el último cómputo registrado?
    const pureMeas = evaluateMeasurementFormula(raw);
    if (pureMeas && lastCapturedItemId) {
      const targetItem = capturedItems.find((it) => it.id === lastCapturedItemId);
      if (targetItem) {
        const finalUnit = pureMeas.explicitUnit || pureMeas.inferredUnit || targetItem.unit;
        setCapturedItems((prev) =>
          prev.map((it) =>
            it.id === lastCapturedItemId
              ? {
                  ...it,
                  quantity: pureMeas.quantity,
                  formula: pureMeas.formula,
                  unit: finalUnit,
                  isDefaultQty: false,
                }
              : it
          )
        );
        appendMessage({
          role: 'bot',
          type: 'item_captured',
          itemId: lastCapturedItemId,
          content: `📐 Medición actualizada para **${targetItem.description}**: ${pureMeas.formula} = **${pureMeas.quantity} ${finalUnit}**.`,
        });
        return;
      }
    }

    // 2. ¿Es sólo una selección de unidad directa (ej: si se pulsa un chip 'M2')?
    const rawUnitKey = raw.replace(/[^a-zA-Z0-9²³]/g, '').toLowerCase();
    if (UNIT_ALIASES[rawUnitKey] && lastCapturedItemId) {
      const chosenUnit = UNIT_ALIASES[rawUnitKey];
      const targetItem = capturedItems.find((it) => it.id === lastCapturedItemId);
      if (targetItem) {
        setCapturedItems((prev) =>
          prev.map((it) =>
            it.id === lastCapturedItemId ? { ...it, unit: chosenUnit } : it
          )
        );
        appendMessage({
          role: 'bot',
          type: 'item_captured',
          itemId: lastCapturedItemId,
          content: `Unidad actualizada a **${chosenUnit}** para **${targetItem.description}**.`,
        });
        return;
      }
    }

    // 3. Analizar input con el analizador inteligente de cómputos
    const parsed = parseComputosInput(raw, activeChapter);

    if (parsed.activeChapter && parsed.activeChapter !== activeChapter) {
      setActiveChapter(parsed.activeChapter);
    }

    // Si solo escribió el capítulo
    if (parsed.items.length === 0) {
      if (parsed.activeChapter) {
        appendMessage({
          role: 'bot',
          content: `📂 Capítulo activo cambiado a **${parsed.activeChapter}**. Ahora escribe la descripción de la partida, sus mediciones y unidad.`,
        });
        return;
      }
      appendMessage({
        role: 'bot',
        content:
          'Escribe la descripción de la partida junto con sus medidas y unidad, por ejemplo:\n`Capitulo Impermeabilizacion`\n`Remoción de manto asfáltico en losa de techo`\n`10.50*7.50 m`\n`M2`\nO en una sola línea:\n`Remoción de manto asfáltico 10.50*7.50 m2`',
      });
      return;
    }

    // Registrar todas las partidas interpretadas
    for (const it of parsed.items) {
      registerCapturedComputo({
        chapter: it.chapter || parsed.activeChapter || activeChapter,
        description: it.description,
        quantity: it.quantity,
        formula: it.formula,
        unit: it.unit,
        isDefaultQty: it.isDefaultQty,
      });
    }
  };

  const handleClearAll = (force = false) => {
    if (!force && capturedItems.length > 0) {
      const confirmClear = window.confirm(
        '¿Deseas limpiar todos los cómputos y mensajes de esta inspección para comenzar de nuevo?'
      );
      if (!confirmClear) return;
    }
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // noop
    }
    setCapturedItems([]);
    setLastCapturedItemId(null);
    setPendingDraft(null);
    setInputText('');
    setBudgetName(`Presupuesto de Inspección - ${new Date().toLocaleDateString('es-VE')}`);
    setProjectName('');
    setClientName('');
    setActiveChapter('OBRAS PRELIMINARES');
    setMessages([INITIAL_WELCOME_MESSAGE]);
    setShowSummaryDrawer(false);
  };

  const handleRemoveItem = (itemId) => {
    setCapturedItems((prev) => prev.filter((it) => it.id !== itemId));
  };

  const handleInsertTemplate = () => {
    const sample = `Capitulo Impermeabilizacion\nRemoción de manto asfáltico en losa de techo\n10.50*7.50 m\nM2`;
    setInputText(sample);
    textareaRef.current?.focus();
  };

  /**
   * Al presionar "Confirmar y Generar Presupuesto":
   * 1. Busca coincidencia de cada descripción en la BD maestra (COVENIN / cost360_items).
   * 2. Si hay coincidencia, recupera la partida de la BD (código, descripción oficial, unidad, rendimiento e insumos APU).
   * 3. Si NO hay coincidencia, genera el APU con el generador de IA (Motor V3/V2) y asigna S/C 01, S/C 02...
   * 4. Crea el presupuesto, cierra el chatbot y abre el presupuesto creado.
   */
  const handleConfirmAndGenerateBudget = async () => {
    if (capturedItems.length === 0 || isCommitting) return;
    const cleanBudgetName = (budgetName || '').trim() || `Presupuesto de Inspección - ${new Date().toLocaleDateString('es-VE')}`;

    setIsCommitting(true);
    setCommitError(null);
    setCommitStepInfo({ current: 0, total: capturedItems.length });

    try {
      const payloadItems = [];
      let lastChapter = null;
      let scCounter = 1;

      for (let i = 0; i < capturedItems.length; i += 1) {
        const it = capturedItems[i];
        const chapName = (it.chapter || 'GENERAL').trim().toUpperCase();
        if (chapName && chapName !== lastChapter) {
          payloadItems.push({
            description: chapName,
            unit: '',
            quantity: 0,
            is_chapter: true,
          });
          lastChapter = chapName;
        }

        setCommitStepInfo({ current: i + 1, total: capturedItems.length });
        setCommitProgressText(
          `Buscando en BD o generando APU (${i + 1}/${capturedItems.length}): ${it.description}`
        );

        let resolved = null;
        try {
          resolved = await budgetService.resolveComputo({
            description: it.description,
            unit: it.unit || 'M2',
            sc_index: scCounter,
            auto_generate_sc: true,
          });
        } catch (errResolve) {
          console.error('Error resolviendo partida de cómputo:', errResolve);
        }

        if (resolved && resolved.resolution_type === 'covenin' && resolved.cod_par) {
          // Coincidencia encontrada en la BD -> Recupera la partida de la BD
          payloadItems.push({
            description: (resolved.matched_description || it.description).trim().toUpperCase(),
            unit: (resolved.matched_unit || it.unit || 'M2').toUpperCase(),
            quantity: Number(it.quantity) || 0,
            performance: Number(resolved.performance) || 1.0,
            is_chapter: false,
            cod_par: resolved.cod_par,
            cov_par: resolved.cov_par || resolved.cod_par,
            code: '',
            materials: [],
            equipments: [],
            labors: [],
          });
        } else {
          // Sin coincidencia en la BD -> Usa el APU generado con nuestro generador IA y código S/C XX
          const scCode = `S/C ${String(scCounter).padStart(2, '0')}`;
          scCounter += 1;

          payloadItems.push({
            description: (resolved?.matched_description || it.description).trim().toUpperCase(),
            unit: (resolved?.matched_unit || it.unit || 'M2').toUpperCase(),
            quantity: Number(it.quantity) || 0,
            performance: Number(resolved?.performance) || 1.0,
            is_chapter: false,
            cod_par: scCode,
            cov_par: scCode,
            code: scCode,
            materials: resolved?.materials || [],
            equipments: resolved?.equipments || [],
            labors: resolved?.labors || [],
          });
        }
      }

      setCommitProgressText('Guardando presupuesto y abriendo hoja de trabajo...');

      const result = await budgetService.commitImport({
        name: cleanBudgetName,
        project_name: (projectName || cleanBudgetName).trim(),
        client_name: clientName.trim() || null,
        currency,
        items: payloadItems,
        source_filename: 'Cómputos de Inspección Móvil',
      });

      // Limpiar completamente el estado del chatbot al confirmar y generar con éxito
      handleClearAll(true);
      if (onCreated) {
        onCreated(result);
      } else if (onClose) {
        onClose();
      }
    } catch (err) {
      setCommitError(err.message || 'No se pudo generar el presupuesto. Inténtalo de nuevo.');
    } finally {
      setIsCommitting(false);
      setCommitProgressText('');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] w-full h-[100dvh] bg-[#FEF3C7] flex flex-col overflow-hidden select-none sm:select-auto">
      {/* Overlay de progreso al presionar "Confirmar y Generar Presupuesto" */}
      {isCommitting && (
        <div className="absolute inset-0 z-[120] bg-[#FEF3C7]/95 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
          <div className="max-w-md w-full bg-white border-2 border-amber-300 rounded-3xl p-6 sm:p-8 shadow-xl space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-500 text-white flex items-center justify-center mx-auto shadow-lg shadow-amber-500/30">
              <RefreshCw className="w-7 h-7 animate-spin" />
            </div>
            <h3 className="text-amber-950 font-extrabold text-lg">
              Procesando Cómputos y Generando Presupuesto
            </h3>
            <p className="text-xs sm:text-sm text-amber-800 leading-relaxed font-medium">
              {commitProgressText || 'Buscando coincidencias en la base de datos y estructurando APUs...'}
            </p>
            {commitStepInfo.total > 0 && (
              <div className="space-y-1.5 pt-1">
                <div className="w-full h-2.5 bg-amber-100 rounded-full overflow-hidden border border-amber-200">
                  <div
                    className="h-full bg-amber-500 transition-all duration-300 rounded-full"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.round((commitStepInfo.current / commitStepInfo.total) * 100)
                      )}%`,
                    }}
                  />
                </div>
                <p className="text-[11px] font-bold text-amber-700">
                  Partida {commitStepInfo.current} de {commitStepInfo.total}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Header Tipo App Full-Screen con colores del Chatbot APU */}
      <header className="px-4 sm:px-6 py-3 border-b border-amber-200 flex items-center justify-between bg-[#FEF3C7] shrink-0 shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/30 shrink-0">
            <Calculator className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-amber-900 font-bold text-base sm:text-lg leading-tight truncate">
                Presupuesto desde Cómputos
              </h2>
              <span
                className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                  isOnline
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    : 'bg-amber-200 text-amber-900 border-amber-400 animate-pulse'
                }`}
              >
                {isOnline ? '● En línea' : '⚡ Modo Offline'}
              </span>
            </div>
            <p className="text-xs text-amber-800 truncate">
              Inspección móvil • Busca en BD o genera APU al confirmar
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleClearAll}
            disabled={isCommitting}
            className="px-2.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 hover:border-amber-400 cursor-pointer shadow-xs"
            title="Limpiar conversación y reiniciar cómputos"
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-700" />
            <span className="hidden sm:inline">Limpiar</span>
          </button>

          <button
            type="button"
            onClick={() => setShowSummaryDrawer((v) => !v)}
            className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all shadow-sm ${
              capturedItems.length > 0
                ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20'
                : 'bg-white border border-amber-300 text-amber-900 hover:bg-amber-100'
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            <span>Cómputos ({capturedItems.length})</span>
            {showSummaryDrawer ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          <button
            type="button"
            onClick={onClose}
            disabled={isCommitting}
            className="text-amber-700 hover:text-amber-900 hover:bg-amber-200/50 rounded-full p-2 transition-colors"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Barra de Capítulo Activo */}
      <div className="px-4 sm:px-6 py-2 bg-amber-100/80 border-b border-amber-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 text-xs sm:text-sm text-amber-950 font-semibold min-w-0">
          <Layers className="w-4 h-4 text-amber-600 shrink-0" />
          <span className="text-amber-800 font-medium">Capítulo activo:</span>
          {!isEditingChapter ? (
            <span className="px-2.5 py-0.5 rounded-lg bg-white border border-amber-300 text-amber-950 font-bold truncate max-w-[180px] sm:max-w-xs">
              {activeChapter}
            </span>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (chapterInput.trim()) {
                  setActiveChapter(chapterInput.trim().toUpperCase());
                }
                setIsEditingChapter(false);
              }}
              className="flex items-center gap-1.5"
            >
              <input
                type="text"
                value={chapterInput}
                onChange={(e) => setChapterInput(e.target.value)}
                placeholder="Ej. IMPERMEABILIZACIÓN"
                autoFocus
                className="px-2.5 py-1 text-xs rounded-lg bg-white border border-amber-400 text-amber-950 focus:outline-none"
              />
              <button
                type="submit"
                className="px-2.5 py-1 rounded-lg bg-amber-500 text-white text-xs font-bold hover:bg-amber-600"
              >
                OK
              </button>
            </form>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!isEditingChapter && (
            <button
              type="button"
              onClick={() => {
                setChapterInput(activeChapter);
                setIsEditingChapter(true);
              }}
              className="text-xs font-semibold text-amber-800 hover:text-amber-950 bg-white/80 hover:bg-white border border-amber-300 px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors"
            >
              <FolderPlus className="w-3.5 h-3.5 text-amber-600" />
              Cambiar capítulo
            </button>
          )}
          <button
            type="button"
            onClick={handleInsertTemplate}
            className="text-xs font-semibold text-amber-800 hover:text-amber-950 bg-white/80 hover:bg-white border border-amber-300 px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors"
            title="Insertar ejemplo de cómputo"
          >
            <HelpCircle className="w-3.5 h-3.5 text-amber-600" />
            Ejemplo
          </button>
        </div>
      </div>

      {/* Cuerpo Principal: Vista de Resumen o Vista de Chat */}
      {showSummaryDrawer ? (
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-[#FEF3C7]">
          <div className="max-w-4xl mx-auto space-y-5">
            <div className="bg-white border border-amber-200 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-amber-100 pb-3">
                <div>
                  <h3 className="text-amber-950 font-bold text-base">Datos del Presupuesto</h3>
                  <p className="text-xs text-amber-700">
                    Al confirmar, se buscará cada partida en la BD maestra o se generará su APU con IA.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSummaryDrawer(false)}
                  className="text-xs font-bold text-amber-700 hover:text-amber-950 px-3 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 transition-colors"
                >
                  Volver al Chat
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-amber-900 mb-1">
                    Nombre del Presupuesto *
                  </label>
                  <input
                    type="text"
                    value={budgetName}
                    onChange={(e) => setBudgetName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-amber-300 text-amber-950 text-sm focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-amber-900 mb-1">Proyecto / Obra</label>
                  <input
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="Opcional"
                    className="w-full px-3 py-2 rounded-xl border border-amber-300 text-amber-950 text-sm focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-amber-900 mb-1">Cliente / Moneda</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      placeholder="Cliente"
                      className="w-full px-3 py-2 rounded-xl border border-amber-300 text-amber-950 text-sm focus:outline-none focus:border-amber-500"
                    />
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="px-2.5 py-2 rounded-xl border border-amber-300 text-amber-950 text-sm font-bold bg-amber-50"
                    >
                      <option value="USD">USD</option>
                      <option value="VES">VES</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white border border-amber-200 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-amber-950 font-bold text-sm sm:text-base">
                  Cómputos Levantados ({capturedItems.length})
                </h4>
                {capturedItems.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="text-xs text-red-600 hover:text-red-700 font-semibold flex items-center gap-1 hover:underline cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Vaciar todo</span>
                  </button>
                )}
              </div>

              {capturedItems.length === 0 ? (
                <div className="text-center py-8 text-amber-800 text-sm">
                  Aún no has cargado partidas. Vuelve al chat y escribe tu primera nota de inspección.
                </div>
              ) : (
                <div className="space-y-3">
                  {capturedItems.map((it, idx) => (
                    <div
                      key={it.id}
                      className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-500 text-white">
                            #{idx + 1}
                          </span>
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-200/80 text-amber-950">
                            {it.chapter}
                          </span>
                          <span className="text-xs text-amber-800 font-semibold">
                            Medición: {it.formula} ={' '}
                            <strong className="text-amber-950">
                              {Number(it.quantity).toLocaleString('es-VE', { maximumFractionDigits: 2 })}{' '}
                              {it.unit}
                            </strong>
                          </span>
                        </div>
                        <p className="text-sm font-bold text-amber-950">{it.description}</p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <input
                          type="number"
                          step="0.01"
                          value={it.quantity}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setCapturedItems((prev) =>
                              prev.map((row) => (row.id === it.id ? { ...row, quantity: val } : row))
                            );
                          }}
                          className="w-24 px-2.5 py-1.5 rounded-lg border border-amber-300 text-amber-950 text-xs font-bold text-right bg-white"
                          title="Cantidad"
                        />
                        <span className="text-xs font-bold text-amber-900 w-10">{it.unit}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(it.id)}
                          className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                          title="Eliminar partida"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Vista de Chat */
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-[#FEF3C7]">
          <div className="max-w-3xl mx-auto space-y-4">
            {messages.map((msg) => {
              const isBot = msg.role === 'bot';
              const relatedItem = msg.itemId
                ? capturedItems.find((it) => it.id === msg.itemId)
                : null;

              return (
                <div
                  key={msg.id}
                  className={`flex gap-2.5 sm:gap-3 ${isBot ? 'items-start' : 'items-end justify-end'}`}
                >
                  {isBot && (
                    <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center shrink-0 mt-1 shadow-sm text-white">
                      <Bot className="w-4 h-4" />
                    </div>
                  )}

                  <div
                    className={`max-w-[90%] sm:max-w-[82%] ${
                      isBot
                        ? 'bg-white border border-amber-200 rounded-2xl rounded-bl-none p-4 text-amber-950 text-sm leading-relaxed shadow-sm space-y-3'
                        : 'bg-amber-600 text-white rounded-2xl rounded-br-none px-4 py-3 text-sm shadow-sm whitespace-pre-wrap'
                    }`}
                  >
                    {msg.type === 'welcome' ? (
                      <div className="space-y-3">
                        <p className="font-medium text-amber-950">{msg.content}</p>
                        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1.5">
                          <p className="font-bold text-amber-950 flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                            Ejemplo de escritura rápida en inspección:
                          </p>
                          <pre className="font-mono text-xs bg-white p-2.5 rounded-lg border border-amber-200 text-amber-950 whitespace-pre-wrap">
{`Capitulo Impermeabilizacion
Remoción de manto asfáltico en losa de techo
10.50*7.50 m
M2`}
                          </pre>
                          <button
                            type="button"
                            onClick={handleInsertTemplate}
                            className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-amber-700 hover:text-amber-950 underline"
                          >
                            Probar con este ejemplo en el cuadro de texto
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    )}

                    {/* Chips rápidos cuando pide unidad */}
                    {msg.type === 'unit_prompt' && pendingDraft?.step === 'awaiting_unit' && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {COMMON_UNITS.map((u) => (
                          <button
                            key={u}
                            type="button"
                            onClick={() => handleSendMessage(u)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                              msg.suggestedUnit === u
                                ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
                                : 'bg-white border-amber-300 text-amber-950 hover:bg-amber-100'
                            }`}
                          >
                            {u}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Tarjeta de cómputo anotado en el chat */}
                    {msg.type === 'item_captured' && relatedItem && (
                      <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md bg-amber-200/80 text-amber-950">
                            {relatedItem.chapter}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(relatedItem.id)}
                            className="text-xs text-red-600 hover:text-red-800 inline-flex items-center gap-1 font-semibold"
                            title="Quitar cómputo"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Quitar
                          </button>
                        </div>

                        <div>
                          <p className="text-sm font-bold text-amber-950">{relatedItem.description}</p>
                        </div>

                        <div className="grid grid-cols-3 gap-2 pt-1">
                          <div className="bg-white p-2 rounded-lg border border-amber-200">
                            <span className="block text-[10px] uppercase font-bold text-amber-700">
                              Medición
                            </span>
                            <span className="text-xs font-mono font-bold text-amber-950">
                              {relatedItem.formula}
                            </span>
                          </div>
                          <div className="bg-white p-2 rounded-lg border border-amber-200">
                            <span className="block text-[10px] uppercase font-bold text-amber-700">
                              Cantidad
                            </span>
                            <span className="text-xs font-extrabold text-amber-950">
                              {Number(relatedItem.quantity).toLocaleString('es-VE', {
                                maximumFractionDigits: 2,
                              })}
                            </span>
                          </div>
                          <div className="bg-white p-2 rounded-lg border border-amber-200">
                            <span className="block text-[10px] uppercase font-bold text-amber-700">
                              Unidad
                            </span>
                            <span className="text-xs font-extrabold text-amber-950">
                              {relatedItem.unit}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {!isBot && (
                    <div className="w-8 h-8 rounded-full bg-amber-200 flex items-center justify-center shrink-0 mt-1 text-amber-900">
                      <User className="w-4 h-4" />
                    </div>
                  )}
                </div>
              );
            })}

            <div ref={messagesEndRef} />
          </div>
        </div>
      )}

      {/* Barra Inferior: Input de Chat + Botón directo "Confirmar y Generar Presupuesto" */}
      <div className="p-3 sm:p-4 bg-[#FEF3C7] border-t border-amber-200 shrink-0">
        <div className="max-w-3xl mx-auto space-y-2.5">
          {commitError && (
            <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
              {commitError}
            </div>
          )}

          {!showSummaryDrawer && (
            <div className="flex items-end gap-2">
              <textarea
                ref={textareaRef}
                rows={3}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                disabled={isCommitting}
                placeholder={
                  pendingDraft?.step === 'awaiting_measurement'
                    ? 'Escribe las medidas (ej: 10.50*7.50 m)...'
                    : pendingDraft?.step === 'awaiting_unit'
                    ? 'Escribe la unidad (ej: M2, M3, ML, UND)...'
                    : 'Escribe Capítulo, Descripción, Medidas (ej: 10.50*7.50 m) y Unidad (M2)...'
                }
                className="flex-1 bg-white border-2 border-amber-300 rounded-2xl px-4 py-2.5 text-sm text-amber-950 focus:outline-none focus:border-amber-500 placeholder:text-amber-700/60 shadow-inner resize-none"
              />
              <button
                type="button"
                onClick={() => handleSendMessage()}
                disabled={!inputText.trim() || isCommitting}
                className="h-12 px-4 sm:px-5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-bold flex items-center justify-center gap-1.5 disabled:opacity-50 transition-all shadow-md shadow-amber-500/20 shrink-0"
                title="Agregar partida a los cómputos"
              >
                <Send className="w-4 h-4" />
                <span className="hidden sm:inline text-sm">Agregar</span>
              </button>
            </div>
          )}

          {/* Barra de Confirmación y Generación del Presupuesto */}
          {capturedItems.length > 0 && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1 bg-amber-100/80 border border-amber-300 rounded-2xl p-2.5">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <FileCheck2 className="w-4 h-4 text-amber-600 shrink-0 ml-1" />
                <input
                  type="text"
                  value={budgetName}
                  onChange={(e) => setBudgetName(e.target.value)}
                  disabled={isCommitting}
                  placeholder="Nombre del presupuesto..."
                  className="flex-1 min-w-0 bg-white border border-amber-300 rounded-xl px-3 py-1.5 text-xs sm:text-sm font-bold text-amber-950 focus:outline-none focus:border-amber-500"
                />
              </div>

              <button
                type="button"
                onClick={handleConfirmAndGenerateBudget}
                disabled={isCommitting}
                className="px-4 sm:px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 shadow-md shadow-amber-600/25 disabled:opacity-50 transition-all shrink-0 cursor-pointer"
              >
                {isCommitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Generando Presupuesto...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirmar y Generar Presupuesto ({capturedItems.length})</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
