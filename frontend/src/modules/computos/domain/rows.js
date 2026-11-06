/**
 * Filas, capítulos y parser de texto de la planilla de cómputos.
 */

import {
  inferUnitFromDescription,
  normalizeUnitStr,
} from './units.js';
import {
  CHAPTER_PREFIX_RE,
  PURE_UNIT_LINE_RE,
  MEASURE_TRAILING_RE,
} from './patterns.js';
import { evaluateMeasurementFormula, round2, cleanFormulaDisplay } from './formulas.js';

function createBlankRow(chapter = '') {
  return {
    id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    chapter: (chapter ?? '').trim().toUpperCase(),
    description: '',
    unit: 'M2',
    length: '',
    width: '',
    height: '',
    times: 1,
    factor: '',
    distance: '',
    m3: '',
    partial: 0,
    quantity: 0,
    formula: '',
    observations: '',
    isDefaultQty: false,
    partials: null,
  };
}

/**
 * Evalúa si una fila está completamente vacía (sin descripción, medidas ni cantidad)
 */

function isItemEmpty(item) {
  if (!item) return true;
  const desc = (item.description || '').trim();
  const hasPartials = Array.isArray(item.partials) && item.partials.length > 0;
  const hasDims =
    (item.length !== '' && item.length != null) ||
    (item.width !== '' && item.width != null) ||
    (item.height !== '' && item.height != null) ||
    (item.factor !== '' && item.factor != null) ||
    (item.distance !== '' && item.distance != null) ||
    (item.m3 !== '' && item.m3 != null);
  const hasQty = item.quantity && Number(item.quantity) > 0;
  const hasObs = (item.observations || '').trim() !== '';

  return !desc && !hasDims && !hasQty && !hasObs && !hasPartials;
}

/**
 * Extrae las palabras clave esenciales para buscar en el catálogo COVENIN.
 * Remueve palabras vacías (de, en, la, los, para, con, etc.) y limita a 2 o 3 términos clave
 * para evitar que búsquedas con frases largas devuelvan 0 coincidencias por exceso de filtros AND.
 */

function extractCoveninSearchKeywords(text) {
  if (!text || typeof text !== 'string') return '';
  const stopWords = new Set([
    'DE', 'LA', 'EL', 'LOS', 'LAS', 'EN', 'CON', 'PARA', 'POR', 'Y', 'O', 'A',
    'DEL', 'AL', 'UN', 'UNA', 'UNOS', 'UNAS', 'SEGUN', 'SEGÚN', 'EJE', 'TIPO',
    'INCLUYE', 'SIN', 'SOBRE', 'BAJO', 'DESDE', 'HASTA', 'ENTRE'
  ]);

  const clean = text
    .toUpperCase()
    .replace(/[^A-Z0-9ÁÉÍÓÚÜÑ\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w));

  if (clean.length === 0) return '';
  // Tomar hasta 2 o 3 palabras clave más relevantes
  return clean.slice(0, 2).join(' ');
}

function sanitizeItemDecimals(item) {
  if (!item) return item;
  const parseRound = (v) => {
    if (v === '' || v == null) return v;
    const n = parseFloat(String(v).replace(',', '.'));
    return isNaN(n) ? v : round2(n);
  };
  const sanitized = {
    ...item,
    formula: item.formula ? cleanFormulaDisplay(item.formula) : item.formula,
    quantity: parseRound(item.quantity) ?? 0,
    partial: parseRound(item.partial) ?? 0,
  };
  if (item.m3 !== '' && item.m3 != null) {
    sanitized.m3 = parseRound(item.m3);
  }
  if (Array.isArray(item.partials) && item.partials.length > 0) {
    sanitized.partials = item.partials.map((p) => ({
      ...p,
      formula: p.formula ? cleanFormulaDisplay(p.formula) : p.formula,
      partial: parseRound(p.partial) ?? 0,
      m3: p.m3 !== '' && p.m3 != null ? parseRound(p.m3) : p.m3,
    }));
  }
  return sanitized;
}

/**
 * Asegura que la planilla SIEMPRE tenga exactamente una fila libre al final para continuar escribiendo
 */

function normalizeRowsWithSingleTrailingBlank(items, defaultChapter = '') {
  if (!items || items.length === 0) {
    return [createBlankRow(defaultChapter)];
  }

  const cleaned = items.map(sanitizeItemDecimals);
  // Quitar filas vacías consecutivas del final excepto una
  while (cleaned.length > 1 && isItemEmpty(cleaned[cleaned.length - 1]) && isItemEmpty(cleaned[cleaned.length - 2])) {
    cleaned.pop();
  }

  // Si la última fila tiene contenido, agregar una nueva fila vacía al final
  if (!isItemEmpty(cleaned[cleaned.length - 1])) {
    const lastChapter = cleaned[cleaned.length - 1].chapter ?? defaultChapter ?? '';
    cleaned.push(createBlankRow(lastChapter));
  }

  return cleaned;
}

/**
 * Analiza un mensaje del usuario (multilínea, partida única, o lista de partidas).
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

    // ¿Es una línea de unidad pura suelta?
    const uStandalone = line.match(PURE_UNIT_LINE_RE);
    if (uStandalone && uStandalone[1]) {
      const matchedU = normalizeUnitStr(uStandalone[1]);
      if (items.length > 0) {
        items[items.length - 1].unit = matchedU;
      }
      i += 1;
      continue;
    }

    // Detectar si el texto incluye factor de acero o distancia de acarreo
    const factorMatch = line.match(/(?:factor|peso|kg\/m|kgf\/m)\s*[:=]?\s*(\d+(?:[.,]\d+)?)/i);
    const parsedFactor = factorMatch ? parseFloat(factorMatch[1].replace(',', '.')) : '';

    const distMatch = line.match(/(?:distancia|dist|dist\.|km)\s*[:=]?\s*(\d+(?:[.,]\d+)?)/i);
    const parsedDistance = distMatch ? parseFloat(distMatch[1].replace(',', '.')) : '';

    // ¿Línea de una sola partida con medición al final?
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
        normalizeUnitStr(rawUnit) ||
        formulaEval?.inferredUnit ||
        inferUnitFromDescription(desc);

      const multFactor = parsedFactor ? Number(parsedFactor) : 1;
      const multDist = parsedDistance ? Number(parsedDistance) : 1;
      const finalQuantity = round2(qty * multFactor * multDist);

      items.push({
        chapter: currentChap,
        description: desc.toUpperCase(),
        quantity: finalQuantity,
        formula: cleanFormula,
        unit,
        length: formulaEval?.length ?? '',
        width: formulaEval?.width ?? '',
        height: formulaEval?.height ?? '',
        times: formulaEval?.times ?? 1,
        factor: parsedFactor,
        distance: parsedDistance,
        partial: formulaEval?.partial ? round2(formulaEval.partial * multFactor) : finalQuantity,
        observations: '',
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
    let length = '';
    let width = '';
    let height = '';
    let times = 1;
    let partial = 1;

    if (i + 1 < rawLines.length) {
      const nextLine = rawLines[i + 1];
      const measEval = evaluateMeasurementFormula(nextLine);
      if (measEval) {
        qty = measEval.quantity;
        formula = measEval.formula;
        unit = measEval.explicitUnit || measEval.inferredUnit;
        length = measEval.length ?? '';
        width = measEval.width ?? '';
        height = measEval.height ?? '';
        times = measEval.times ?? 1;
        partial = measEval.partial ?? qty;
        isDefaultQty = false;
        i += 1;

        if (i + 1 < rawLines.length) {
          const unitLineMatch = rawLines[i + 1].match(PURE_UNIT_LINE_RE);
          if (unitLineMatch && unitLineMatch[1]) {
            unit = normalizeUnitStr(unitLineMatch[1]);
            i += 1;
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

    const multFactor = parsedFactor ? Number(parsedFactor) : 1;
    const multDist = parsedDistance ? Number(parsedDistance) : 1;
    const finalQuantity = round2(qty * multFactor * multDist);

    items.push({
      chapter: currentChap,
      description: desc.toUpperCase(),
      quantity: finalQuantity,
      formula,
      unit,
      length,
      width,
      height,
      times,
      factor: parsedFactor,
      distance: parsedDistance,
      partial: round2(partial * multFactor),
      observations: '',
      isDefaultQty,
    });
    i += 1;
  }

  return { items, activeChapter: currentChap };
}

export {
  createBlankRow,
  isItemEmpty,
  extractCoveninSearchKeywords,
  sanitizeItemDecimals,
  normalizeRowsWithSingleTrailingBlank,
  parseComputosInput,
};
