import React, { useState, useRef, useEffect, useContext } from 'react';
import { toast } from 'react-hot-toast';
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
  RotateCcw,
  Table,
  Edit3,
  Plus,
  Save,
  Copy,
  Info,
  FolderOpen,
  Search,
  Database,
  AlertTriangle,
  Check,
  Printer,
  FileSpreadsheet,
  Smartphone,
  ChevronDown,
  ChevronUp,
  Split,
} from 'lucide-react';
import { budgetService } from '../../services/budgetService';
import BudgetSearchModal from '../../pages/admin/budget_worksheet/BudgetSearchModal';
import PartidasCalibrationModal from './PartidasCalibrationModal';
import { auditDescription, generateEnrichedSuggestion } from '../../utils/descriptionAuditor';
import { useDatabaseContext } from '../../contexts/DatabaseContext';
import { useCostbaseSearch as useCost360Search } from '../../modules/costbase/hooks/useCostbaseSearch';
import { SiteConfigContext } from '../../App';

const COMMON_UNITS = [
  'M2',
  'M3',
  'ML',
  'UND',
  'PTO',
  'KGF',
  'TON',
  'M3-KM',
  'M3-M',
  'TON-KM',
  'VIAJE',
  'FLETE',
  'GL',
  'HA',
];

const UNIT_PATTERN =
  '(?:m3[\\s*xX×.\\-/]km|m³[\\s*xX×.\\-/]km|m3km|m³km|m3[\\s*xX×.\\-/]m|m³[\\s*xX×.\\-/]m|m3m|m³m|m3x50|ton[\\s*xX×.\\-/]km|tonkm|tf[\\s*xX×.\\-/]km|tfkm|kgf?[\\s*xX×.\\-/]km|kgf?[\\s*xX×.\\-/]m|viajes?|vje|fletes?|flt|gand(?:olas?)?|m2|m²|mt2|mts2|m3|m³|mt3|mts3|ml|mts|mt|m|metro|metros|und|unid|unidad|unidades|pza|pieza|piezas|pto|ptos|punto|puntos|kgf|kg|kilos|ton|tn|gl|global|sg|ha|km|lt|l)';

const UNIT_ALIASES = {
  // Acarreo y transporte
  'm3*km': 'M3-KM',
  'm3-km': 'M3-KM',
  'm3xkm': 'M3-KM',
  'm3.km': 'M3-KM',
  'm3/km': 'M3-KM',
  'm3 km': 'M3-KM',
  m3km: 'M3-KM',
  'm³*km': 'M3-KM',
  'm³-km': 'M3-KM',
  'm³xkm': 'M3-KM',
  'm³km': 'M3-KM',
  'm3*m': 'M3-M',
  'm3-m': 'M3-M',
  'm3xm': 'M3-M',
  'm3.m': 'M3-M',
  'm3/m': 'M3-M',
  'm3 m': 'M3-M',
  m3m: 'M3-M',
  m3x50: 'M3X50',
  'ton*km': 'TON-KM',
  'ton-km': 'TON-KM',
  'tonxkm': 'TON-KM',
  'ton/km': 'TON-KM',
  'ton.km': 'TON-KM',
  tonkm: 'TON-KM',
  'tf*km': 'TON-KM',
  'tf-km': 'TON-KM',
  'tfxkm': 'TON-KM',
  'tf.km': 'TON-KM',
  tfkm: 'TON-KM',
  'kgf*km': 'KGF-KM',
  'kgf-km': 'KGF-KM',
  'kg*km': 'KGF-KM',
  'kg-km': 'KGF-KM',
  'kgxkm': 'KGF-KM',
  'kgf*m': 'KGF-M',
  'kgf-m': 'KGF-M',
  'kg*m': 'KGF-M',
  'kg-m': 'KGF-M',
  viaje: 'VIAJE',
  viajes: 'VIAJE',
  vje: 'VIAJE',
  flete: 'FLETE',
  fletes: 'FLETE',
  flt: 'FLETE',
  gand: 'GAND',
  gandola: 'GAND',
  gandolas: 'GAND',

  // Unidades estándar
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

function normalizeUnitStr(u) {
  if (!u || typeof u !== 'string') return null;
  const key = u.trim().toLowerCase();
  const cleanDash = key.replace(/[\s.\-xX×/]+/g, '-');
  const cleanStar = key.replace(/[\s.\-xX×/]+/g, '*');
  return (
    UNIT_ALIASES[key] ||
    UNIT_ALIASES[cleanDash] ||
    UNIT_ALIASES[cleanStar] ||
    u.trim().toUpperCase()
  );
}

const CHAPTER_PREFIX_RE = /^(?:cap[ií]tulo|cap\.?)\s*[:-]?\s*(.+)$/i;
const PURE_UNIT_LINE_RE = new RegExp(
  `^(?:und\\.?|unidad\\s*[:-]?)?\\s*(${UNIT_PATTERN})\\.?$`,
  'i'
);

const MEASURE_TRAILING_RE = new RegExp(
  `[:\\s,=-]+((?:\\(?\\d+(?:[.,]\\d+)?\\)?\\s*[*xX×/+-]\\s*)+\\(?\\d+(?:[.,]\\d+)?\\)?|\\d+(?:[.,]\\d+)?)\\s*(${UNIT_PATTERN})?\\.?$`,
  'i'
);

/**
 * Infiere la unidad de medida según palabras clave de la descripción de la partida.
 */
function inferUnitFromDescription(desc = '') {
  const d = (desc || '').toLowerCase();
  if (/acarreo|transporte|flete|viaje|botadero|bote.*escombro/i.test(d)) {
    if (/km|kil[oó]metro|distancia/i.test(d)) return 'M3-KM';
    if (/ton|acero|metal|estructura/i.test(d)) return 'TON-KM';
    if (/viaje|camion|volteo|gandola/i.test(d)) return 'VIAJE';
    if (/50m|primeros 50|m3xm|m3-m/i.test(d)) return 'M3-M';
    return 'M3-KM';
  }
  if (/acero|cabilla|malla|refuerzo|hierro/i.test(d)) {
    return 'KGF';
  }
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
    /tuber[ií]a|tubo|cable|canal|rodapi[eé]|costanera|viga corona|conducto/i.test(
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
 * Evalúa de forma segura una expresión de mediciones y extrae sus factores (Largo, Ancho, Alto, Veces).
 */
function evaluateMeasurementFormula(rawLine) {
  if (!rawLine || typeof rawLine !== 'string') return null;
  const trimmed = rawLine.trim();
  if (!trimmed) return null;

  let explicitUnit = null;
  let exprPart = trimmed;
  const trailingUnitMatch = trimmed.match(new RegExp(`(${UNIT_PATTERN})\\s*$`, 'i'));
  if (trailingUnitMatch) {
    explicitUnit = normalizeUnitStr(trailingUnitMatch[1]);
    exprPart = trimmed.slice(0, trailingUnitMatch.index).trim();
  }

  const words = exprPart.match(/[a-zA-ZáéíóúÁÉÍÓÚñÑ]+/g) || [];
  const allowedMeasureWords = new Set([
    'x', 'm', 'mt', 'mts', 'metro', 'metros', 'ml', 'cm', 'mm', 'de', 'por',
  ]);
  const nonMeasureWords = words.filter((w) => !allowedMeasureWords.has(w.toLowerCase()));
  if (nonMeasureWords.length > 1) return null;

  let expr = exprPart
    .replace(/(\d),(\d)/g, '$1.$2')
    .replace(new RegExp(`\\b${UNIT_PATTERN}\\b`, 'gi'), '')
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
    const val = Function(`"use strict"; return (${expr});`)();
    if (typeof val !== 'number' || !Number.isFinite(val) || val <= 0) return null;

    const quantity = Math.round(val * 10000) / 10000;

    let length = '';
    let width = '';
    let height = '';
    let times = 1;
    let partial = quantity;

    if (!/[+/-]/.test(expr) && expr.includes('*')) {
      const parts = expr
        .split('*')
        .map((s) => parseFloat(s.trim()))
        .filter((n) => !isNaN(n) && n > 0);
      if (parts.length === 2) {
        length = parts[0];
        width = parts[1];
        partial = Math.round(length * width * 10000) / 10000;
      } else if (parts.length === 3) {
        length = parts[0];
        width = parts[1];
        height = parts[2];
        partial = Math.round(length * width * height * 10000) / 10000;
      } else if (parts.length >= 4) {
        times = parts[0];
        length = parts[1];
        width = parts[2];
        height = parts[3];
        partial = Math.round(length * width * height * 10000) / 10000;
      }
    }

    const multParts = expr.split('*').length;
    const inferredUnit = explicitUnit || (multParts === 3 ? 'M3' : multParts === 2 ? 'M2' : null);
    const cleanFormula = expr.replace(/\*/g, ' × ');

    return {
      quantity,
      partial,
      formula: cleanFormula,
      hasOperator: /[+\-*/]/.test(expr),
      inferredUnit,
      explicitUnit,
      length,
      width,
      height,
      times,
    };
  } catch {
    return null;
  }
}

function escapeHtml(text) {
  if (text == null) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Calcula el subtotal parcial de un renglón o tramo individual (ej: una pared específica)
 */
function computePartial(p) {
  if (!p) return 0;
  const l = p.length !== '' && p.length != null ? parseFloat(p.length) : null;
  const w = p.width !== '' && p.width != null ? parseFloat(p.width) : null;
  const h = p.height !== '' && p.height != null ? parseFloat(p.height) : null;
  const t = p.times !== '' && p.times != null && !isNaN(parseFloat(p.times)) ? parseFloat(p.times) : 1;
  const f = p.factor !== '' && p.factor != null && !isNaN(parseFloat(p.factor)) ? parseFloat(p.factor) : null;
  const dist = p.distance !== '' && p.distance != null && !isNaN(parseFloat(p.distance)) ? parseFloat(p.distance) : null;

  const multFactor = f !== null && f > 0 ? f : 1;
  const multDist = dist !== null && dist > 0 ? dist : 1;

  const dims = [];
  if (l !== null && !isNaN(l) && l > 0) dims.push(l);
  if (w !== null && !isNaN(w) && w > 0) dims.push(w);
  if (h !== null && !isNaN(h) && h > 0) dims.push(h);

  if (dims.length > 0) {
    const baseGeom = dims.reduce((acc, curr) => acc * curr, 1);
    return Math.round(baseGeom * multFactor * multDist * t * 10000) / 10000;
  }
  if (p.partial !== '' && p.partial != null && !isNaN(parseFloat(p.partial))) {
    return Math.round(parseFloat(p.partial) * multFactor * multDist * t * 10000) / 10000;
  }
  return 0;
}

/**
 * Recalcula la cantidad total de una partida a partir de la suma de sus parciales (paredes/tramos)
 */
function recomputeItemWithPartials(item) {
  if (!item.partials || item.partials.length === 0) {
    return item;
  }
  const total = item.partials.reduce((sum, p) => sum + computePartial(p), 0);
  const roundedTotal = Math.round(total * 10000) / 10000;
  return {
    ...item,
    quantity: roundedTotal,
    partial: 0,
    length: '',
    width: '',
    height: '',
    factor: '',
    distance: '',
  };
}

/**
 * Recalcula dinámicamente las dimensiones, factor de acero y distancia de acarreo
 * según el estándar completo de la Planilla de Cómputos Métricos.
 */
function recomputeRow(row, field, value) {
  const updated = { ...row, [field]: value };

  if (field === 'description' || field === 'chapter' || field === 'observations' || field === 'unit') {
    return updated;
  }

  // Si la partida tiene parciales (paredes), su cantidad total está gobernada por la suma de parciales
  if (updated.partials && updated.partials.length > 0) {
    return recomputeItemWithPartials(updated);
  }

  const l = updated.length !== '' && updated.length != null ? parseFloat(updated.length) : null;
  const w = updated.width !== '' && updated.width != null ? parseFloat(updated.width) : null;
  const h = updated.height !== '' && updated.height != null ? parseFloat(updated.height) : null;
  const t = updated.times !== '' && updated.times != null ? Math.max(1, parseFloat(updated.times) || 1) : 1;
  const f = updated.factor !== '' && updated.factor != null && !isNaN(parseFloat(updated.factor)) ? parseFloat(updated.factor) : null;
  const dist = updated.distance !== '' && updated.distance != null && !isNaN(parseFloat(updated.distance)) ? parseFloat(updated.distance) : null;

  const multFactor = f !== null && f > 0 ? f : 1;
  const multDist = dist !== null && dist > 0 ? dist : 1;

  if (field === 'quantity') {
    const qVal = Math.max(0, parseFloat(value) || 0);
    updated.quantity = qVal;
    const divisor = t * multDist;
    updated.partial = divisor > 0 ? Math.round((qVal / divisor) * 10000) / 10000 : qVal;
    return updated;
  }

  const dims = [];
  if (l !== null && !isNaN(l) && l > 0) dims.push(l);
  if (w !== null && !isNaN(w) && w > 0) dims.push(w);
  if (h !== null && !isNaN(h) && h > 0) dims.push(h);

  if (dims.length > 0) {
    const baseGeom = dims.reduce((acc, curr) => acc * curr, 1);
    
    // Parcial = base geométrica * Factor (ej: metros lineales de cabilla * kg/m)
    const parcial = Math.round(baseGeom * multFactor * 10000) / 10000;
    
    // Total = Parcial * N° Veces * Distancia (si aplica acarreo M3-KM)
    const total = Math.round(parcial * t * multDist * 10000) / 10000;

    updated.partial = parcial;
    updated.quantity = total;

    // Actualizar fórmula visible
    let formulaParts = [];
    if (t > 1) formulaParts.push(`${t} ×`);
    const dimsStr = dims.map((d) => String(d)).join(' × ');
    formulaParts.push(dimsStr);
    if (f !== null) formulaParts.push(`× ${f}`);
    if (dist !== null) formulaParts.push(`× ${dist}km`);
    updated.formula = formulaParts.join(' ');
  } else if (field === 'partial') {
    const pVal = Math.max(0, parseFloat(value) || 0);
    updated.partial = pVal;
    updated.quantity = Math.round(pVal * t * multDist * 10000) / 10000;
  } else {
    // Si no hay dimensiones pero se modifica Factor, Distancia o Veces sobre una cantidad base
    const currentBase = updated.partial > 0 ? updated.partial : (parseFloat(updated.quantity) || 0);
    if (currentBase > 0) {
      const total = Math.round(currentBase * t * multFactor * multDist * 10000) / 10000;
      updated.quantity = total;
    }
  }

  return updated;
}

/**
 * Genera una nueva fila vacía estándar
 */
function createBlankRow(chapter = 'OBRAS PRELIMINARES') {
  return {
    id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    chapter: (chapter || 'OBRAS PRELIMINARES').trim().toUpperCase(),
    description: '',
    unit: 'M2',
    length: '',
    width: '',
    height: '',
    times: 1,
    factor: '',
    distance: '',
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
    (item.distance !== '' && item.distance != null);
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

/**
 * Asegura que la planilla SIEMPRE tenga exactamente una fila libre al final para continuar escribiendo
 */
function normalizeRowsWithSingleTrailingBlank(items, defaultChapter = 'OBRAS PRELIMINARES') {
  if (!items || items.length === 0) {
    return [createBlankRow(defaultChapter)];
  }

  const cleaned = [...items];
  // Quitar filas vacías consecutivas del final excepto una
  while (cleaned.length > 1 && isItemEmpty(cleaned[cleaned.length - 1]) && isItemEmpty(cleaned[cleaned.length - 2])) {
    cleaned.pop();
  }

  // Si la última fila tiene contenido, agregar una nueva fila vacía al final
  if (!isItemEmpty(cleaned[cleaned.length - 1])) {
    const lastChapter = cleaned[cleaned.length - 1].chapter || defaultChapter;
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
      const finalQuantity = Math.round(qty * multFactor * multDist * 10000) / 10000;

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
        partial: formulaEval?.partial ? Math.round(formulaEval.partial * multFactor * 10000) / 10000 : finalQuantity,
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
    const finalQuantity = Math.round(qty * multFactor * multDist * 10000) / 10000;

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
      partial: Math.round(partial * multFactor * 10000) / 10000,
      observations: '',
      isDefaultQty,
    });
    i += 1;
  }

  return { items, activeChapter: currentChap };
}

// Claves persistentes para guardar borradores de trabajo
const DRAFT_STORAGE_KEY = 'costbase_computos_saved_draft_v2';
const SAVED_LIST_STORAGE_KEY = 'costbase_computos_saved_list_v2';

function getSavedComputosList() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const data = window.localStorage.getItem(SAVED_LIST_STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) return parsed;
      }
    }
  } catch (_e) {
    // ignore
  }
  return [];
}

const INITIAL_WELCOME_MESSAGE = {
  id: 'welcome',
  role: 'bot',
  type: 'welcome',
  content:
    '¡Hola! Soy tu asistente de cómputos en campo. Anota tus partidas aquí o edítalas directamente en la Planilla de Cómputos Métricos. Puedes pulsar "Guardar" en cualquier momento para pausar y retomar tu trabajo después.',
};

export default function BudgetFromComputosModal({ isOpen, onClose, onCreated }) {
  // Pestaña activa: 'sheet' (Planilla de Cómputos) | 'chat' (Asistente de Campo)
  const [activeTab, setActiveTab] = useState('sheet');

  const [activeChapter, setActiveChapter] = useState(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = window.localStorage.getItem(DRAFT_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed?.activeChapter) return parsed.activeChapter;
        }
      }
    } catch (_e) {
      // ignore
    }
    return 'OBRAS PRELIMINARES';
  });

  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  const [messages, setMessages] = useState([INITIAL_WELCOME_MESSAGE]);
  const [inputText, setInputText] = useState('');

  // Estado para editar un cómputo en vivo (en el chat)
  const [editingItemId, setEditingItemId] = useState(null);
  const [editForm, setEditForm] = useState(null);

  const [lastCapturedItemId, setLastCapturedItemId] = useState(null);
  const [saveStatus, setSaveStatus] = useState(null);
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showChapterModal, setShowChapterModal] = useState(false);
  const [chapterModalInput, setChapterModalInput] = useState('');
  const [renameChapterTarget, setRenameChapterTarget] = useState(null);
  const [renameChapterInput, setRenameChapterInput] = useState('');
  const [showProjectInfoModal, setShowProjectInfoModal] = useState(false);
  const [showCatalogModal, setShowCatalogModal] = useState(false);
  const [coveninTargetItemId, setCoveninTargetItemId] = useState(null);
  const [isCalibrationOpen, setIsCalibrationOpen] = useState(false);
  const [pendingBudgetItems, setPendingBudgetItems] = useState([]);
  const [availableBudgets, setAvailableBudgets] = useState([]);

  // Base de datos y configuración del catálogo COVENIN
  const dbContext = useDatabaseContext?.() || {};
  const { activeDatabase = { id: 'master', name: 'Base Maestra' }, setActiveDatabase, databases = [] } = dbContext;
  const siteConfig = useContext(SiteConfigContext) || {};
  const config = siteConfig.config;

  const {
    searchQuery,
    setSearchQuery,
    searchCovenin,
    setSearchCovenin,
    searchDesc,
    setSearchDesc,
    searchInsumos,
    setSearchInsumos,
    results: searchResults,
    totalResults: totalSearchResults,
    isSearching: searching,
    forceSearch: searchDatabase,
    hasMore: hasMoreSearchResults,
    loadMore: loadMoreSearchResults,
  } = useCost360Search({
    databaseId: activeDatabase?.id || 'master',
    onlyCoded: config?.forceOnlyCodedMaster === true,
    limit: 30,
    autoSearch: showCatalogModal,
  });
  const [savedList, setSavedList] = useState(getSavedComputosList);
  const [currentDraftId, setCurrentDraftId] = useState(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = window.localStorage.getItem(DRAFT_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed?.id) return parsed.id;
        }
      }
    } catch (_e) {
      // ignore
    }
    return `draft-${Date.now()}`;
  });

  // Lista de partidas en la Planilla de Cómputos (inicializada con borrador previo o con 1 fila libre)
  const [capturedItems, setCapturedItems] = useState(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = window.localStorage.getItem(DRAFT_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && Array.isArray(parsed.items) && parsed.items.length > 0) {
            return normalizeRowsWithSingleTrailingBlank(parsed.items, parsed.activeChapter || 'OBRAS PRELIMINARES');
          }
        }
      }
    } catch (e) {
      console.error('Error cargando borrador previo de cómputos:', e);
    }
    return [createBlankRow('OBRAS PRELIMINARES')];
  });

  // Datos del presupuesto para guardar
  const [budgetName, setBudgetName] = useState(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = window.localStorage.getItem(DRAFT_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed?.budgetName) return parsed.budgetName;
        }
      }
    } catch (_e) {
      // ignore
    }
    const today = new Date().toLocaleDateString('es-VE');
    return `Presupuesto de Cómputos - ${today}`;
  });

  const [projectName, setProjectName] = useState(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = window.localStorage.getItem(DRAFT_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed?.projectName) return parsed.projectName;
        }
      }
    } catch (_e) {
      // ignore
    }
    return '';
  });

  const [clientName, setClientName] = useState(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = window.localStorage.getItem(DRAFT_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed?.clientName) return parsed.clientName;
        }
      }
    } catch (_e) {
      // ignore
    }
    return '';
  });

  const [currency, setCurrency] = useState(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = window.localStorage.getItem(DRAFT_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed?.currency) return parsed.currency;
        }
      }
    } catch (_e) {
      // ignore
    }
    return 'USD';
  });

  // Estado del proceso de confirmación y generación
  const [isCommitting, setIsCommitting] = useState(false);
  const [commitProgressText, setCommitProgressText] = useState('');
  const [commitStepInfo, setCommitStepInfo] = useState({ current: 0, total: 0 });
  const [commitError, setCommitError] = useState(null);

  // Modo de visualización: 'cards' (móvil apilado hacia abajo) o 'table' (tabla clásica)
  const [viewMode, setViewMode] = useState(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      return 'cards';
    }
    return 'table';
  });
  const [expandedPartials, setExpandedPartials] = useState({});

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  // Auto-guardado en segundo plano de borradores para no perder nada si se cierra inesperadamente
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const nonBlank = capturedItems.filter((it) => !isItemEmpty(it));
        if (nonBlank.length > 0 || projectName || clientName) {
          const draftPayload = {
            savedAt: new Date().toISOString(),
            budgetName: (budgetName || '').trim(),
            projectName: (projectName || '').trim(),
            clientName: (clientName || '').trim(),
            currency,
            activeChapter,
            items: nonBlank,
          };
          localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draftPayload));
        }
      } catch (e) {
        // noop
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [capturedItems, budgetName, projectName, clientName, currency, activeChapter]);

  useEffect(() => {
    if (isOpen) {
      budgetService.getAll()
        .then((res) => {
          if (Array.isArray(res)) setAvailableBudgets(res);
          else if (Array.isArray(res?.data)) setAvailableBudgets(res.data);
        })
        .catch(() => {});
    }
  }, [isOpen]);

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
    if (isOpen && activeTab === 'chat') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, activeTab]);

  // Cantidad real de partidas cargadas (sin contar la fila vacía de edición)
  const validItems = capturedItems.filter((it) => !isItemEmpty(it));
  const validCount = validItems.length;

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
   * Guarda explícitamente el borrador actual en localStorage y en la lista de guardados (con sincronización en la nube)
   */
  const handleSaveDraft = async () => {
    try {
      const nonBlank = capturedItems.filter((it) => !isItemEmpty(it));
      const cleanName =
        (budgetName || '').trim() ||
        `Presupuesto de Cómputos - ${new Date().toLocaleDateString('es-VE')}`;
      const nowIso = new Date().toISOString();

      const draftPayload = {
        id: currentDraftId,
        savedAt: nowIso,
        budgetName: cleanName,
        projectName: (projectName || '').trim(),
        clientName: (clientName || '').trim(),
        currency,
        activeChapter,
        items: nonBlank,
        itemCount: nonBlank.length,
      };

      // 1. Guardar de inmediato en el borrador activo local
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draftPayload));

      // 2. Guardar o actualizar en la lista histórica local
      const existingList = getSavedComputosList();
      const updatedList = [
        draftPayload,
        ...existingList.filter((item) => item.id !== currentDraftId && item.budgetName !== cleanName),
      ];
      localStorage.setItem(SAVED_LIST_STORAGE_KEY, JSON.stringify(updatedList));
      setSavedList(updatedList);

      const timeStr = new Date().toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });
      setSaveStatus(`Guardado ${timeStr}`);
      toast.success(`Cómputo guardado correctamente (${timeStr})`);
      setTimeout(() => {
        setSaveStatus(null);
      }, 3500);

      // 3. Sincronizar en la cuenta (nube) para que esté disponible en PC y móvil
      try {
        const res = await budgetService.saveComputosDraft(draftPayload);
        if (res && Array.isArray(res.drafts)) {
          setSavedList(res.drafts);
          try {
            localStorage.setItem(SAVED_LIST_STORAGE_KEY, JSON.stringify(res.drafts));
          } catch (_e) {
            // ignore
          }
        }
      } catch (cloudErr) {
        console.warn('Aviso: Guardado local exitoso, pero falló sincronización en la nube:', cloudErr);
      }
    } catch (err) {
      console.error('Error al guardar borrador de cómputos:', err);
      toast.error('No se pudo guardar el borrador en el almacenamiento local.');
    }
  };

  /**
   * Carga un cómputo guardado previamente
   */
  const executeLoadSavedComputo = (savedItem) => {
    setCurrentDraftId(savedItem.id || `draft-${Date.now()}`);
    setBudgetName(savedItem.budgetName || `Presupuesto de Cómputos`);
    setProjectName(savedItem.projectName || '');
    setClientName(savedItem.clientName || '');
    setCurrency(savedItem.currency || 'USD');
    setActiveChapter(savedItem.activeChapter || 'OBRAS PRELIMINARES');

    if (Array.isArray(savedItem.items) && savedItem.items.length > 0) {
      setCapturedItems(
        normalizeRowsWithSingleTrailingBlank(
          savedItem.items,
          savedItem.activeChapter || 'OBRAS PRELIMINARES'
        )
      );
    } else {
      setCapturedItems([createBlankRow(savedItem.activeChapter || 'OBRAS PRELIMINARES')]);
    }

    try {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(savedItem));
    } catch (_e) {
      // ignore
    }

    setShowOpenModal(false);
    toast.success(`Cómputo "${savedItem.budgetName}" cargado en pantalla`);
  };

  const handleLoadSavedComputo = (savedItem) => {
    if (!savedItem) return;
    if (validCount > 0) {
      toast(
        (t) => (
          <div className="flex flex-col gap-2.5 py-1">
            <p className="font-semibold text-slate-800 text-sm leading-snug">
              ¿Deseas abrir el cómputo &ldquo;{savedItem.budgetName}&rdquo;?
            </p>
            <p className="text-xs text-slate-500">
              Se reemplazarán las partidas actuales en pantalla.
            </p>
            <div className="flex gap-2 justify-end pt-1">
              <button
                type="button"
                onClick={() => toast.dismiss(t.id)}
                className="px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  toast.dismiss(t.id);
                  executeLoadSavedComputo(savedItem);
                }}
                className="px-3 py-1.5 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors shadow-sm cursor-pointer"
              >
                Abrir cómputo
              </button>
            </div>
          </div>
        ),
        { duration: Infinity, id: 'toast-load-saved-computo' }
      );
      return;
    }

    executeLoadSavedComputo(savedItem);
  };

  /**
   * Abre la ventana modal de cómputos guardados refrescando la lista desde la nube
   */
  const handleOpenLoadModal = async () => {
    setShowOpenModal(true);
    try {
      const serverDrafts = await budgetService.getComputosDrafts();
      if (Array.isArray(serverDrafts)) {
        const localList = getSavedComputosList();
        const draftMap = new Map();
        serverDrafts.forEach((d) => {
          if (d && d.id) draftMap.set(d.id, d);
        });
        localList.forEach((d) => {
          if (d && d.id && !draftMap.has(d.id)) {
            draftMap.set(d.id, d);
          }
        });
        const merged = Array.from(draftMap.values()).sort(
          (a, b) => new Date(b.savedAt || 0) - new Date(a.savedAt || 0)
        );
        setSavedList(merged);
        try {
          localStorage.setItem(SAVED_LIST_STORAGE_KEY, JSON.stringify(merged));
        } catch (_e) {
          // ignore
        }
      }
    } catch (_err) {
      // ignore
    }
  };

  /**
   * Sincronización multidispositivo (Nube <-> Local) al abrir el modal principal
   */
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const syncCloudAndLocalDrafts = async () => {
      try {
        const localList = getSavedComputosList();
        // Recoger también si hay un borrador activo en local que aún no esté en la lista
        try {
          const rawActive = localStorage.getItem(DRAFT_STORAGE_KEY);
          if (rawActive) {
            const parsedActive = JSON.parse(rawActive);
            if (parsedActive?.id && Array.isArray(parsedActive.items) && parsedActive.items.length > 0) {
              if (!localList.some((d) => d.id === parsedActive.id)) {
                localList.unshift(parsedActive);
              }
            }
          }
        } catch (_e) {
          // ignore
        }

        const serverDrafts = await budgetService.getComputosDrafts().catch(() => null);
        if (!isMounted) return;

        if (Array.isArray(serverDrafts)) {
          const draftMap = new Map();
          serverDrafts.forEach((d) => {
            if (d && d.id) draftMap.set(d.id, d);
          });

          // Detectar borradores locales que no estén en la nube para subirlos (ej. guardados desde el móvil)
          const unsyncedLocals = [];
          localList.forEach((d) => {
            if (d && d.id) {
              if (!draftMap.has(d.id)) {
                draftMap.set(d.id, d);
                unsyncedLocals.push(d);
              }
            }
          });

          const merged = Array.from(draftMap.values()).sort(
            (a, b) => new Date(b.savedAt || 0) - new Date(a.savedAt || 0)
          );

          try {
            localStorage.setItem(SAVED_LIST_STORAGE_KEY, JSON.stringify(merged));
          } catch (_e) {
            // ignore
          }
          setSavedList(merged);

          // Si la pantalla actual está vacía (sin partidas válidas) y no había borrador local activo con partidas,
          // cargar automáticamente el último cómputo guardado para que el usuario en PC vea de inmediato lo que hizo en el móvil.
          const currentNonBlank = capturedItems.filter((it) => !isItemEmpty(it));
          if (currentNonBlank.length === 0 && merged.length > 0) {
            let localHasItems = false;
            try {
              const rawLocal = localStorage.getItem(DRAFT_STORAGE_KEY);
              if (rawLocal) {
                const p = JSON.parse(rawLocal);
                if (Array.isArray(p.items) && p.items.some((it) => !isItemEmpty(it))) {
                  localHasItems = true;
                }
              }
            } catch (_e) {
              // ignore
            }

            if (!localHasItems) {
              executeLoadSavedComputo(merged[0]);
            }
          }

          // Subir borradores locales pendientes a la nube en segundo plano
          if (unsyncedLocals.length > 0) {
            for (const localDraft of unsyncedLocals) {
              budgetService.saveComputosDraft(localDraft).catch((err) => {
                console.warn('Aviso: Sincronización de borrador local a la nube:', err);
              });
            }
          }
        }
      } catch (err) {
        console.warn('Error sincronizando cómputos en la nube:', err);
      }
    };

    syncCloudAndLocalDrafts();
    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  /**
   * Elimina un cómputo de la lista de guardados y de la nube
   */
  const handleDeleteSavedComputo = (savedId, e) => {
    e.stopPropagation();
    toast(
      (t) => (
        <div className="flex flex-col gap-2.5 py-1">
          <p className="font-semibold text-slate-800 text-sm leading-snug">
            ¿Deseas eliminar este cómputo guardado de la lista?
          </p>
          <div className="flex gap-2 justify-end pt-1">
            <button
              type="button"
              onClick={() => toast.dismiss(t.id)}
              className="px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={async () => {
                toast.dismiss(t.id);
                const existingList = getSavedComputosList();
                const updated = existingList.filter((it) => it.id !== savedId);
                try {
                  localStorage.setItem(SAVED_LIST_STORAGE_KEY, JSON.stringify(updated));
                } catch (_e) {
                  // ignore
                }
                setSavedList(updated);
                toast.success('Cómputo eliminado de la lista');

                try {
                  const res = await budgetService.deleteComputosDraft(savedId);
                  if (res && Array.isArray(res.drafts)) {
                    setSavedList(res.drafts);
                    try {
                      localStorage.setItem(SAVED_LIST_STORAGE_KEY, JSON.stringify(res.drafts));
                    } catch (_e) {
                      // ignore
                    }
                  }
                } catch (cloudErr) {
                  console.warn('Aviso: Eliminado localmente, pero falló en la nube:', cloudErr);
                }
              }}
              className="px-3 py-1.5 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors shadow-sm cursor-pointer"
            >
              Eliminar
            </button>
          </div>
        </div>
      ),
      { duration: Infinity, id: `toast-del-${savedId}` }
    );
  };

  /**
   * Crea un nuevo cómputo en blanco
   */
  const executeCreateNewComputo = () => {
    const newId = `draft-${Date.now()}`;
    setCurrentDraftId(newId);
    setCapturedItems([createBlankRow('OBRAS PRELIMINARES')]);
    setBudgetName(`Presupuesto de Cómputos - ${new Date().toLocaleDateString('es-VE')}`);
    setProjectName('');
    setClientName('');
    setActiveChapter('OBRAS PRELIMINARES');
    setMessages([INITIAL_WELCOME_MESSAGE]);
    setSaveStatus(null);
    setShowOpenModal(false);
    toast.success('Nueva planilla en blanco iniciada');
  };

  const handleCreateNewComputo = () => {
    if (validCount > 0) {
      toast(
        (t) => (
          <div className="flex flex-col gap-2.5 py-1">
            <p className="font-semibold text-slate-800 text-sm leading-snug">
              ¿Deseas comenzar un nuevo cómputo en blanco?
            </p>
            <p className="text-xs text-slate-500">
              Asegúrate de haber guardado el actual si deseas conservarlo.
            </p>
            <div className="flex gap-2 justify-end pt-1">
              <button
                type="button"
                onClick={() => toast.dismiss(t.id)}
                className="px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  toast.dismiss(t.id);
                  executeCreateNewComputo();
                }}
                className="px-3 py-1.5 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors shadow-sm cursor-pointer"
              >
                Nuevo cómputo
              </button>
            </div>
          </div>
        ),
        { duration: Infinity, id: 'toast-create-new-computo' }
      );
      return;
    }
    executeCreateNewComputo();
  };

  /**
   * Agrega un nuevo capítulo a la planilla de cómputos y lo deja listo con una fila libre
   */
  const handleAddChapterToSheet = (newChapName) => {
    const name = (newChapName || '').trim().toUpperCase();
    if (!name) return;

    setActiveChapter(name);

    setCapturedItems((prev) => {
      const items = [...prev];
      // Si la última fila era una fila vacía no utilizada, le asignamos el nuevo capítulo
      if (items.length > 0 && isItemEmpty(items[items.length - 1])) {
        items[items.length - 1] = {
          ...items[items.length - 1],
          chapter: name,
        };
        return items;
      }
      // Si la última fila ya tenía datos, agregamos una fila libre con el nuevo capítulo
      return [...items, createBlankRow(name)];
    });

    setShowChapterModal(false);
    setChapterModalInput('');
  };

  /**
   * Abre modal para renombrar un capítulo directamente desde su encabezado en la tabla
   */
  const handleRenameChapter = (oldName) => {
    if (!oldName) return;
    setRenameChapterTarget(oldName);
    setRenameChapterInput(oldName);
  };

  /**
   * Confirma y aplica el renombre del capítulo
   */
  const handleConfirmRenameChapter = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!renameChapterTarget) return;

    const clean = (renameChapterInput || '').trim().toUpperCase();
    if (!clean) {
      toast.error('El nombre del capítulo no puede estar vacío');
      return;
    }

    if (clean === renameChapterTarget) {
      setRenameChapterTarget(null);
      setRenameChapterInput('');
      return;
    }

    setCapturedItems((prev) =>
      prev.map((it) => (it.chapter === renameChapterTarget ? { ...it, chapter: clean } : it))
    );
    if (activeChapter === renameChapterTarget) {
      setActiveChapter(clean);
    }
    toast.success(`Capítulo renombrado a "${clean}"`);
    setRenameChapterTarget(null);
    setRenameChapterInput('');
  };

  /**
   * Elimina únicamente el texto/encabezado del capítulo, conservando intactos todos los cómputos y mediciones.
   */
  const handleRemoveChapterHeader = (chapterName) => {
    if (!chapterName) return;
    const targetChap = chapterName.trim().toUpperCase();

    setCapturedItems((prev) => {
      // Encontrar el primer elemento con este capítulo
      const firstIdx = prev.findIndex(
        (it) => (it.chapter || '').trim().toUpperCase() === targetChap
      );
      if (firstIdx === -1) return prev;

      // Si hay un capítulo anterior en la lista antes de este bloque, las partidas pasan al capítulo anterior.
      // Si era el primer capítulo, el capítulo queda vacío ("") para ocultar el encabezado.
      let fallbackChapter = '';
      if (firstIdx > 0 && prev[firstIdx - 1]?.chapter) {
        fallbackChapter = prev[firstIdx - 1].chapter;
      }

      const updated = prev.map((it) => {
        if ((it.chapter || '').trim().toUpperCase() === targetChap) {
          return { ...it, chapter: fallbackChapter };
        }
        return it;
      });

      // Actualizar activeChapter si correspondía al capítulo eliminado
      if ((activeChapter || '').trim().toUpperCase() === targetChap) {
        const remainingChapters = Array.from(
          new Set(updated.map((it) => (it.chapter || '').trim()).filter(Boolean))
        );
        setActiveChapter(fallbackChapter || remainingChapters[0] || '');
      }

      return normalizeRowsWithSingleTrailingBlank(updated, fallbackChapter || activeChapter || '');
    });

    toast.success(`Encabezado "${chapterName}" eliminado (cómputos conservados)`);
  };

  /**
   * Registra un cómputo tanto en la Planilla como en el Chat
   */
  const registerCapturedComputo = ({
    chapter,
    description,
    quantity,
    formula,
    unit,
    length = '',
    width = '',
    height = '',
    times = 1,
    factor = '',
    distance = '',
    partial = null,
    observations = '',
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
      length: length !== '' && length != null ? length : '',
      width: width !== '' && width != null ? width : '',
      height: height !== '' && height != null ? height : '',
      times: times || 1,
      factor: factor !== '' && factor != null ? factor : '',
      distance: distance !== '' && distance != null ? distance : '',
      partial: partial != null ? partial : finalQty,
      quantity: finalQty,
      formula: finalFormula,
      observations: observations || '',
      isDefaultQty,
    };

    setCapturedItems((prev) => {
      const nonBlank = prev.filter((it) => !isItemEmpty(it));
      return normalizeRowsWithSingleTrailingBlank([...nonBlank, newItem], activeChapter);
    });
    setLastCapturedItemId(itemId);

    if (isDefaultQty) {
      appendMessage({
        role: 'bot',
        type: 'item_captured',
        itemId,
        content: `Cómputo registrado: **${newItem.description}** (${newItem.quantity} ${newItem.unit}). Puedes editarlo con el botón "✏️ Editar" o continuar anotando.`,
      });
    } else {
      appendMessage({
        role: 'bot',
        type: 'item_captured',
        itemId,
        content: `Cómputo registrado: **${newItem.description}** (${newItem.formula} = ${newItem.quantity} ${newItem.unit}).`,
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

    // 1. ¿Actualización de medidas para el último cómputo registrado?
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
                  partial: pureMeas.partial,
                  formula: pureMeas.formula,
                  unit: finalUnit,
                  length: pureMeas.length ?? '',
                  width: pureMeas.width ?? '',
                  height: pureMeas.height ?? '',
                  times: pureMeas.times ?? 1,
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

    // 2. ¿Selección de unidad directa?
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

    if (parsed.items.length === 0) {
      if (parsed.activeChapter) {
        appendMessage({
          role: 'bot',
          content: `📂 Capítulo activo cambiado a **${parsed.activeChapter}**. Ahora escribe la descripción de la partida, sus dimensiones y unidad.`,
        });
        return;
      }
      appendMessage({
        role: 'bot',
        content:
          'Escribe la partida con sus medidas y unidad, por ejemplo:\n`Capitulo Impermeabilizacion`\n`Remoción de manto asfáltico 10.50*7.50 m2`\nO cambia a la pestaña "Planilla" para editar directamente en la tabla.',
      });
      return;
    }

    for (const it of parsed.items) {
      registerCapturedComputo({
        chapter: it.chapter || parsed.activeChapter || activeChapter,
        description: it.description,
        quantity: it.quantity,
        formula: it.formula,
        unit: it.unit,
        length: it.length,
        width: it.width,
        height: it.height,
        times: it.times,
        factor: it.factor,
        distance: it.distance,
        partial: it.partial,
        observations: it.observations,
        isDefaultQty: it.isDefaultQty,
      });
    }
  };

  /**
   * Actualiza directamente cualquier celda de la Planilla de Cómputos
   * y garantiza que SIEMPRE exista una fila libre al final
   */
  const handleUpdateItemField = (itemId, field, value) => {
    setCapturedItems((prev) => {
      const updated = prev.map((it) => {
        if (it.id !== itemId) return it;
        return recomputeRow(it, field, value);
      });
      return normalizeRowsWithSingleTrailingBlank(updated, activeChapter);
    });
  };

  /**
   * Duplica una partida existente
   */
  const handleDuplicateRow = (item) => {
    const newId = `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const duplicated = {
      ...item,
      id: newId,
    };
    setCapturedItems((prev) => {
      const nonBlank = prev.filter((it) => !isItemEmpty(it));
      return normalizeRowsWithSingleTrailingBlank([...nonBlank, duplicated], activeChapter);
    });
  };

  /**
   * Inserta una nueva fila vacía justo debajo de la fila actual
   */
  const handleInsertRowBelow = (targetItem) => {
    const newRow = createBlankRow(targetItem?.chapter || activeChapter);
    setCapturedItems((prev) => {
      const targetIdx = prev.findIndex((it) => it.id === targetItem.id);
      if (targetIdx === -1) {
        return normalizeRowsWithSingleTrailingBlank([...prev, newRow], activeChapter);
      }
      const updated = [...prev];
      updated.splice(targetIdx + 1, 0, newRow);
      return normalizeRowsWithSingleTrailingBlank(updated, activeChapter);
    });
  };

  /**
   * Habilita el desglose de sub-cómputos/parciales (múltiples paredes/tramos) para una partida
   */
  const handleTogglePartials = (itemId) => {
    setCapturedItems((prev) => {
      const updated = prev.map((it) => {
        if (it.id !== itemId) return it;
        if (it.partials && it.partials.length > 0) {
          return it;
        }
        const initialPartials = [
          {
            id: `part-${Date.now()}-1`,
            description: 'Parcial 1',
            times: it.times || 1,
            length: it.length || '',
            width: it.width || '',
            height: it.height || '',
            factor: it.factor || '',
            distance: it.distance || '',
            partial: it.partial || 0,
            observations: '',
          },
          {
            id: `part-${Date.now()}-2`,
            description: 'Parcial 2',
            times: 1,
            length: '',
            width: '',
            height: '',
            factor: '',
            distance: '',
            partial: 0,
            observations: '',
          },
        ];
        initialPartials[0].partial = computePartial(initialPartials[0]);
        return recomputeItemWithPartials({ ...it, partials: initialPartials });
      });
      return updated;
    });
    setExpandedPartials((prev) => ({ ...prev, [itemId]: true }));
    toast.success('Desglose de parciales activado');
  };

  /**
   * Remueve completamente el desglose de parciales de una partida
   */
  const handleClearPartials = (itemId) => {
    setCapturedItems((prev) => {
      const updated = prev.map((it) => {
        if (it.id !== itemId) return it;
        return { ...it, partials: null };
      });
      return updated;
    });
    toast.success('Desglose de parciales removido');
  };

  /**
   * Agrega un nuevo parcial / fila adicional a una partida
   */
  const handleAddPartial = (itemId) => {
    setCapturedItems((prev) => {
      const updated = prev.map((it) => {
        if (it.id !== itemId) return it;
        const currentList = it.partials || [];
        const nextNum = currentList.length + 1;
        const newPartial = {
          id: `part-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          description: `Parcial ${nextNum}`,
          times: 1,
          length: '',
          width: '',
          height: '',
          factor: '',
          distance: '',
          partial: 0,
          observations: '',
        };
        const newList = [...currentList, newPartial];
        return recomputeItemWithPartials({ ...it, partials: newList });
      });
      return updated;
    });
    setExpandedPartials((prev) => ({ ...prev, [itemId]: true }));
  };

  /**
   * Actualiza un campo de un parcial individual y recalcula automáticamente la cantidad total de la partida
   */
  const handleUpdatePartialField = (itemId, partialId, field, value) => {
    setCapturedItems((prev) => {
      const updated = prev.map((it) => {
        if (it.id !== itemId) return it;
        if (!it.partials) return it;
        const updatedPartials = it.partials.map((p) => {
          if (p.id !== partialId) return p;
          const updatedP = { ...p, [field]: value };
          updatedP.partial = computePartial(updatedP);
          return updatedP;
        });
        return recomputeItemWithPartials({ ...it, partials: updatedPartials });
      });
      return updated;
    });
  };

  /**
   * Elimina un tramo / pared individual del desglose
   */
  const handleRemovePartial = (itemId, partialId) => {
    setCapturedItems((prev) => {
      const updated = prev.map((it) => {
        if (it.id !== itemId) return it;
        if (!it.partials) return it;
        const filtered = it.partials.filter((p) => p.id !== partialId);
        if (filtered.length === 0) {
          return { ...it, partials: null };
        }
        return recomputeItemWithPartials({ ...it, partials: filtered });
      });
      return updated;
    });
  };

  /**
   * Expande o colapsa el panel de paredes/parciales de una partida
   */
  const handleToggleExpandPartials = (itemId) => {
    setExpandedPartials((prev) => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  };

  /**
   * Exportación de contingencia en el navegador en caso de estar sin conexión
   */
  const exportExcelComputosFallback = (validItems) => {
    const cleanName = (budgetName || 'Planilla_de_Computos').trim().replace(/[/\\?%*:|"<>]/g, '_');
    const today = new Date().toLocaleDateString('es-VE');

    let rowsHtml = '';
    let currentChapter = null;
    let itemNumber = 1;

    validItems.forEach((it) => {
      const chap = (it.chapter || 'GENERAL').trim().toUpperCase();
      if (chap !== currentChapter) {
        currentChapter = chap;
        rowsHtml += `
          <tr style="background-color: #fef3c7; font-weight: bold; font-size: 12px;">
            <td colspan="12" style="padding: 8px; border: 1px solid #d97706; color: #78350f;">
              CAPÍTULO: ${escapeHtml(chap)}
            </td>
          </tr>
        `;
      }

      const hasPartials = it.partials && it.partials.length > 0;
      rowsHtml += `
        <tr style="border-bottom: 1px solid #cbd5e1; font-size: 11px;">
          <td style="text-align: center; border: 1px solid #cbd5e1; font-weight: bold; background-color: #f8fafc; vertical-align: top;">${itemNumber}</td>
          <td style="border: 1px solid #cbd5e1; font-weight: 600; width: 550px; white-space: normal; word-wrap: break-word; vertical-align: top; mso-line-break-rule: exactly;">${escapeHtml(it.description || '')}</td>
          <td style="text-align: center; border: 1px solid #cbd5e1; font-size: 11px; font-weight: bold; color: #1e293b; vertical-align: top;">${escapeHtml(it.unit || '')}</td>
          <td style="text-align: right; border: 1px solid #cbd5e1; vertical-align: top;">${hasPartials ? '—' : (it.length || '')}</td>
          <td style="text-align: right; border: 1px solid #cbd5e1; vertical-align: top;">${hasPartials ? '—' : (it.width || '')}</td>
          <td style="text-align: right; border: 1px solid #cbd5e1; vertical-align: top;">${hasPartials ? '—' : (it.height || '')}</td>
          <td style="text-align: center; border: 1px solid #cbd5e1; vertical-align: top;">${hasPartials ? '—' : (it.times || 1)}</td>
          <td style="text-align: right; border: 1px solid #cbd5e1; vertical-align: top;">${hasPartials ? '—' : (it.factor || '')}</td>
          <td style="text-align: right; border: 1px solid #cbd5e1; vertical-align: top;">${hasPartials ? '—' : (it.distance || '')}</td>
          <td style="text-align: right; border: 1px solid #cbd5e1; font-weight: 600; vertical-align: top;">${hasPartials ? '—' : (it.partial || '')}</td>
          <td style="text-align: right; border: 1px solid #cbd5e1; font-weight: bold; background-color: #fef3c7; vertical-align: top;">${it.quantity || 0}</td>
          <td style="border: 1px solid #cbd5e1; vertical-align: top;">${escapeHtml(it.observations || '')}</td>
        </tr>
      `;

      if (hasPartials) {
        it.partials.forEach((p, pIdx) => {
          rowsHtml += `
            <tr style="border-bottom: 1px dashed #cbd5e1; font-size: 10px; background-color: #fffbeb;">
              <td style="text-align: center; border: 1px solid #cbd5e1; color: #d97706; vertical-align: top;">↳ ${pIdx + 1}</td>
              <td style="border: 1px solid #cbd5e1; padding-left: 20px; font-style: italic; color: #78350f; width: 550px; white-space: normal; word-wrap: break-word; vertical-align: top;">
                ${escapeHtml(p.description || `Pared ${pIdx + 1}`)}
              </td>
              <td style="text-align: center; border: 1px solid #cbd5e1; font-size: 10px; color: #64748b; vertical-align: top;">${escapeHtml(it.unit || '')}</td>
              <td style="text-align: right; border: 1px solid #cbd5e1; vertical-align: top;">${p.length || ''}</td>
              <td style="text-align: right; border: 1px solid #cbd5e1; vertical-align: top;">${p.width || ''}</td>
              <td style="text-align: right; border: 1px solid #cbd5e1; vertical-align: top;">${p.height || ''}</td>
              <td style="text-align: center; border: 1px solid #cbd5e1; vertical-align: top;">${p.times || 1}</td>
              <td style="text-align: right; border: 1px solid #cbd5e1; vertical-align: top;">${p.factor || ''}</td>
              <td style="text-align: right; border: 1px solid #cbd5e1; vertical-align: top;">${p.distance || ''}</td>
              <td style="text-align: right; border: 1px solid #cbd5e1; font-weight: bold; color: #b45309; vertical-align: top;">${p.partial || 0}</td>
              <td style="text-align: right; border: 1px solid #cbd5e1; color: #94a3b8; vertical-align: top;">—</td>
              <td style="border: 1px solid #cbd5e1; font-style: italic; color: #64748b; vertical-align: top;">${escapeHtml(p.observations || '')}</td>
            </tr>
          `;
        });
      }

      itemNumber += 1;
    });

    const excelTemplate = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
          <!--[if gte mso 9]>
          <xml>
            <x:ExcelWorkbook>
              <x:ExcelWorksheets>
                <x:ExcelWorksheet>
                  <x:Name>Cómputos Métricos</x:Name>
                  <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
                </x:ExcelWorksheet>
              </x:ExcelWorksheets>
            </x:ExcelWorkbook>
          </xml>
          <![endif]-->
          <style>
            th { background-color: #d97706; color: #ffffff; border: 1px solid #b45309; padding: 6px 3px; font-size: 9px; vertical-align: middle; white-space: nowrap; text-align: center; }
            td { padding: 5px; vertical-align: top; }
          </style>
        </head>
        <body>
          <table style="width: 100%; border-collapse: collapse; font-family: Arial, sans-serif;">
            <tr>
              <td colspan="12" style="font-size: 22px; font-weight: bold; text-align: center; padding: 14px 6px; color: #1e293b; border: none;">
                Planilla de Cómputos Métricos
              </td>
            </tr>
            <tr>
              <td colspan="12" style="padding: 4px 6px; font-size: 11px; text-align: left; font-weight: bold; color: #1e293b; border: none;">
                Obra: <span style="font-weight: normal;">${escapeHtml(projectName || budgetName || '—')}</span>
              </td>
            </tr>
            <tr>
              <td colspan="12" style="padding: 4px 6px; font-size: 11px; text-align: left; font-weight: bold; color: #1e293b; border: none;">
                Fecha: <span style="font-weight: normal;">${today}</span>
              </td>
            </tr>
            <tr><td colspan="12" style="height: 8px; border: none;"></td></tr>
            <thead>
              <tr>
                <th style="width: 35px; font-size: 10px; text-align: center;">N°</th>
                <th style="width: 550px; text-align: left; font-size: 11px; white-space: normal;">DESCRIPCIÓN DE LA PARTIDA</th>
                <th style="width: 55px; font-size: 11px; font-weight: bold; text-align: center;">UND</th>
                <th style="width: 75px; font-size: 9px; white-space: nowrap; text-align: center;">LARGO</th>
                <th style="width: 75px; font-size: 9px; white-space: nowrap; text-align: center;">ANCHO</th>
                <th style="width: 75px; font-size: 9px; white-space: nowrap; text-align: center;">ALTO</th>
                <th style="width: 65px; font-size: 9px; white-space: nowrap; text-align: center;">VECES</th>
                <th style="width: 75px; font-size: 9px; white-space: nowrap; text-align: center;">FACTOR</th>
                <th style="width: 80px; font-size: 9px; white-space: nowrap; text-align: center;">DIST. (km)</th>
                <th style="width: 85px; font-size: 9px; white-space: nowrap; text-align: center;">PARCIAL</th>
                <th style="width: 85px; font-size: 9px; white-space: nowrap; text-align: center;">TOTAL</th>
                <th style="width: 220px; font-size: 9px; text-align: left; white-space: nowrap;">OBSERVACIONES</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </body>
      </html>
    `;

    const blob = new Blob([excelTemplate], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${cleanName}_${new Date().toISOString().slice(0, 10)}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Planilla exportada a Excel');
  };

  /**
   * Exporta la Planilla de Cómputos Métricos a un archivo Excel (.xlsx) nativo genuino
   * con encabezados en negrita y centrados tanto vertical como horizontalmente sin advertencias de Excel.
   */
  const handleExportExcelComputos = async () => {
    const validItems = capturedItems.filter((it) => !isItemEmpty(it));
    if (validItems.length === 0) {
      toast.error('No hay datos en la planilla para exportar.');
      return;
    }

    const payload = {
      budgetName: budgetName || 'Planilla de Cómputos Métricos',
      projectName: projectName || '',
      items: validItems,
    };

    const toastId = toast.loading('Generando archivo Excel (.xlsx)...');
    try {
      await budgetService.exportComputosExcel(payload);
      toast.success('Planilla exportada a Excel (.xlsx) con éxito', { id: toastId });
    } catch (err) {
      console.warn('Fallo exportación nativa por backend, usando exportación de contingencia:', err);
      toast.dismiss(toastId);
      exportExcelComputosFallback(validItems);
    }
  };

  /**
   * Imprime la Planilla de Cómputos Métricos en formato técnico de ingeniería
   */
  const handlePrintComputos = () => {
    const validItems = capturedItems.filter((it) => !isItemEmpty(it));
    if (validItems.length === 0) {
      toast.error('No hay datos en la planilla para imprimir.');
      return;
    }

    const today = new Date().toLocaleDateString('es-VE');
    let rowsHtml = '';
    let currentChapter = null;
    let itemNumber = 1;

    validItems.forEach((it) => {
      const chap = (it.chapter || 'GENERAL').trim().toUpperCase();
      if (chap !== currentChapter) {
        currentChapter = chap;
        rowsHtml += `
          <tr class="chapter-row">
            <td colspan="12">CAPÍTULO: ${escapeHtml(chap)}</td>
          </tr>
        `;
      }

      const hasPartials = it.partials && it.partials.length > 0;
      rowsHtml += `
        <tr class="item-row">
          <td class="text-center font-bold" style="vertical-align: top;">${itemNumber}</td>
          <td class="font-bold text-left" style="width: 500px; white-space: normal; word-wrap: break-word; vertical-align: top;">${escapeHtml(it.description || '')}</td>
          <td class="text-center font-bold" style="font-size: 11px; vertical-align: top;">${escapeHtml(it.unit || '')}</td>
          <td class="text-right" style="vertical-align: top;">${hasPartials ? '—' : (it.length || '')}</td>
          <td class="text-right" style="vertical-align: top;">${hasPartials ? '—' : (it.width || '')}</td>
          <td class="text-right" style="vertical-align: top;">${hasPartials ? '—' : (it.height || '')}</td>
          <td class="text-center" style="vertical-align: top;">${hasPartials ? '—' : (it.times || 1)}</td>
          <td class="text-right" style="vertical-align: top;">${hasPartials ? '—' : (it.factor || '')}</td>
          <td class="text-right" style="vertical-align: top;">${hasPartials ? '—' : (it.distance || '')}</td>
          <td class="text-right font-semibold" style="vertical-align: top;">${hasPartials ? '—' : (it.partial || '')}</td>
          <td class="text-right font-black bg-amber-50" style="vertical-align: top;">${it.quantity || 0}</td>
          <td style="vertical-align: top;">${escapeHtml(it.observations || '')}</td>
        </tr>
      `;

      if (hasPartials) {
        it.partials.forEach((p, pIdx) => {
          rowsHtml += `
            <tr class="partial-row">
              <td class="text-center text-amber-700" style="vertical-align: top;">↳ ${pIdx + 1}</td>
              <td class="partial-name" style="width: 500px; white-space: normal; word-wrap: break-word; vertical-align: top;">${escapeHtml(p.description || `Pared ${pIdx + 1}`)}</td>
              <td class="text-center text-muted" style="font-size: 10px; vertical-align: top;">${escapeHtml(it.unit || '')}</td>
              <td class="text-right" style="vertical-align: top;">${p.length || ''}</td>
              <td class="text-right" style="vertical-align: top;">${p.width || ''}</td>
              <td class="text-right" style="vertical-align: top;">${p.height || ''}</td>
              <td class="text-center" style="vertical-align: top;">${p.times || 1}</td>
              <td class="text-right" style="vertical-align: top;">${p.factor || ''}</td>
              <td class="text-right" style="vertical-align: top;">${p.distance || ''}</td>
              <td class="text-right font-bold text-amber-800" style="vertical-align: top;">${p.partial || 0}</td>
              <td class="text-center text-muted" style="vertical-align: top;">—</td>
              <td class="text-muted text-xs" style="vertical-align: top;">${escapeHtml(p.observations || '')}</td>
            </tr>
          `;
        });
      }

      itemNumber += 1;
    });

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Por favor permite ventanas emergentes para imprimir la planilla.');
      return;
    }

    const printHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Planilla de Cómputos Métricos - ${escapeHtml(budgetName || 'APUPro')}</title>
          <style>
            @page {
              size: landscape;
              margin: 12mm;
            }
            body {
              font-family: Arial, Helvetica, sans-serif;
              font-size: 10px;
              color: #1e293b;
              margin: 0;
              padding: 10px;
            }
            .header {
              border-bottom: 2px solid #b45309;
              padding-bottom: 8px;
              margin-bottom: 12px;
              text-align: center;
            }
            .header h1 {
              font-size: 22px;
              color: #1e293b;
              margin: 0 0 6px 0;
              text-transform: uppercase;
              letter-spacing: 1px;
            }
            .meta-left {
              text-align: left;
              font-size: 11px;
              color: #1e293b;
              line-height: 1.5;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 10px;
            }
            th, td {
              border: 1px solid #cbd5e1;
              padding: 4px 6px;
            }
            th {
              background-color: #d97706;
              color: white;
              font-size: 8.5px;
              text-transform: uppercase;
              text-align: center;
              white-space: nowrap;
            }
            .chapter-row td {
              background-color: #fef3c7;
              font-weight: bold;
              font-size: 11px;
              color: #78350f;
              border-color: #d97706;
            }
            .item-row td {
              font-size: 10px;
            }
            .partial-row td {
              background-color: #fffbeb;
              font-size: 9px;
              border-bottom: 1px dashed #e2e8f0;
            }
            .partial-name {
              padding-left: 18px !important;
              font-style: italic;
              color: #78350f;
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .font-bold { font-weight: bold; }
            .font-black { font-weight: 900; }
            .text-muted { color: #94a3b8; }
            .signatures {
              margin-top: 30px;
              display: flex;
              justify-content: space-around;
              page-break-inside: avoid;
            }
            .sig-box {
              width: 200px;
              border-top: 1px solid #475569;
              text-align: center;
              padding-top: 6px;
              font-size: 10px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Planilla de Cómputos Métricos</h1>
            <div class="meta-left">
              <div><strong>Obra:</strong> ${escapeHtml(projectName || budgetName || '—')}</div>
              <div><strong>Fecha:</strong> ${today}</div>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width: 30px;">N°</th>
                <th style="width: 500px; text-align: left;">DESCRIPCIÓN DE LA PARTIDA</th>
                <th style="width: 45px; font-size: 8px;">UND</th>
                <th style="width: 55px;">LARGO</th>
                <th style="width: 55px;">ANCHO</th>
                <th style="width: 55px;">ALTO</th>
                <th style="width: 50px;">VECES</th>
                <th style="width: 55px;">FACTOR</th>
                <th style="width: 60px;">DIST. (km)</th>
                <th style="width: 65px;">PARCIAL</th>
                <th style="width: 75px;">TOTAL</th>
                <th style="width: 140px;">OBSERVACIONES</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
                <th style="width: 55px;">LARGO</th>
                <th style="width: 55px;">ANCHO</th>
                <th style="width: 55px;">ALTO</th>
                <th style="width: 50px;">VECES</th>
                <th style="width: 55px;">FACTOR</th>
                <th style="width: 60px;">DIST. (km)</th>
                <th style="width: 65px;">PARCIAL</th>
                <th style="width: 75px;">TOTAL</th>
                <th style="width: 140px;">OBSERVACIONES</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
          <div class="signatures">
            <div class="sig-box">Elaborado por (Ingeniero Inspector)</div>
            <div class="sig-box">Revisado por (Ingeniero Residente)</div>
            <div class="sig-box">Aprobado por (Cliente / Ente Contratante)</div>
          </div>
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(printHtml);
    printWindow.document.close();
  };

  /**
   * Abre el modal de búsqueda de partidas COVENIN para reemplazar o ajustar la descripción
   */
  const handleOpenCoveninModal = (targetItem) => {
    setCoveninTargetItemId(targetItem.id);
    const keywords = extractCoveninSearchKeywords(targetItem.description);
    setSearchQuery(keywords);
    setSearchCovenin('');
    setShowCatalogModal(true);
  };

  /**
   * Aplica la partida COVENIN seleccionada en la fila objetivo
   */
  const handleSelectCoveninPartida = (coveninItem) => {
    if (!coveninTargetItemId || !coveninItem) return;
    const cleanDesc = (coveninItem.Descri || '').trim().toUpperCase();
    const cleanUnit = normalizeUnitStr(coveninItem.UniPar) || 'UND';

    setCapturedItems((prev) => {
      const updated = prev.map((it) => {
        if (it.id !== coveninTargetItemId) return it;
        return {
          ...it,
          description: cleanDesc,
          unit: cleanUnit,
          cod_par: coveninItem.CodPar || '',
          cov_par: coveninItem.CovPar || coveninItem.CodPar || '',
          coveninCode: coveninItem.CovPar || coveninItem.CodPar || '',
        };
      });
      return normalizeRowsWithSingleTrailingBlank(updated, activeChapter);
    });

    setPendingBudgetItems((prev) =>
      prev.map((it) => {
        if (it.id !== coveninTargetItemId) return it;
        return {
          ...it,
          description: cleanDesc,
          unit: cleanUnit,
          cod_par: coveninItem.CodPar || '',
          cov_par: coveninItem.CovPar || coveninItem.CodPar || '',
          coveninCode: coveninItem.CovPar || coveninItem.CodPar || '',
        };
      })
    );

    toast.success(`Partida actualizada según COVENIN: "${cleanDesc.slice(0, 35)}..."`);
    setShowCatalogModal(false);
    setCoveninTargetItemId(null);
  };

  /**
   * Manejadores para edición en vivo de cómputos en el Chat
   */
  const handleStartEdit = (item) => {
    setEditingItemId(item.id);
    setEditForm({ ...item });
  };

  const handleEditFormFieldChange = (field, value) => {
    if (!editForm) return;
    setEditForm((prev) => recomputeRow(prev, field, value));
  };

  const handleSaveEdit = () => {
    if (!editForm) return;
    const finalDesc = (editForm.description || '').trim().toUpperCase();
    setCapturedItems((prev) => {
      const updated = prev.map((it) =>
        it.id === editForm.id ? { ...editForm, description: finalDesc } : it
      );
      return normalizeRowsWithSingleTrailingBlank(updated, activeChapter);
    });
    setEditingItemId(null);
    setEditForm(null);
    appendMessage({
      role: 'bot',
      content: `✏️ Cómputo actualizado: **${finalDesc}** (${editForm.quantity} ${editForm.unit}).`,
    });
  };

  const handleCancelEdit = () => {
    setEditingItemId(null);
    setEditForm(null);
  };

  const handleRemoveItem = (itemId) => {
    setCapturedItems((prev) => {
      const filtered = prev.filter((it) => it.id !== itemId);
      return normalizeRowsWithSingleTrailingBlank(filtered, activeChapter);
    });
    if (editingItemId === itemId) {
      setEditingItemId(null);
      setEditForm(null);
    }
  };

  const executeClearAll = () => {
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch {
      // noop
    }
    setCapturedItems([createBlankRow('OBRAS PRELIMINARES')]);
    setLastCapturedItemId(null);
    setEditingItemId(null);
    setEditForm(null);
    setInputText('');
    setBudgetName(`Presupuesto de Cómputos - ${new Date().toLocaleDateString('es-VE')}`);
    setProjectName('');
    setClientName('');
    setActiveChapter('OBRAS PRELIMINARES');
    setMessages([INITIAL_WELCOME_MESSAGE]);
    setSaveStatus(null);
    toast.success('Planilla reiniciada');
  };

  const handleClearAll = (force = false) => {
    if (!force && validCount > 0) {
      toast(
        (t) => (
          <div className="flex flex-col gap-2.5 py-1">
            <p className="font-semibold text-slate-800 text-sm leading-snug">
              ¿Deseas limpiar todos los cómputos y reiniciar la planilla?
            </p>
            <p className="text-xs text-slate-500">
              Esta acción vaciará la tabla y no se puede deshacer si no has guardado.
            </p>
            <div className="flex gap-2 justify-end pt-1">
              <button
                type="button"
                onClick={() => toast.dismiss(t.id)}
                className="px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  toast.dismiss(t.id);
                  executeClearAll();
                }}
                className="px-3 py-1.5 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors shadow-sm cursor-pointer"
              >
                Limpiar todo
              </button>
            </div>
          </div>
        ),
        { duration: Infinity, id: 'toast-clear-all-computos' }
      );
      return;
    }

    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch {
      // noop
    }
    setCapturedItems([createBlankRow('OBRAS PRELIMINARES')]);
    setLastCapturedItemId(null);
    setEditingItemId(null);
    setEditForm(null);
    setInputText('');
    setBudgetName(`Presupuesto de Cómputos - ${new Date().toLocaleDateString('es-VE')}`);
    setProjectName('');
    setClientName('');
    setActiveChapter('OBRAS PRELIMINARES');
    setMessages([INITIAL_WELCOME_MESSAGE]);
    setSaveStatus(null);
  };

  /**
   * Enriquecer la descripción de una partida con especificaciones técnicas estándar
   */
  const handleEnrichItem = (id, enrichedText) => {
    handleUpdateItemField(id, 'description', (enrichedText || '').toUpperCase());
    toast.success('Descripción enriquecida con especificaciones técnicas');
  };

  /**
   * Proceso de Confirmar y Generar Presupuesto con Validación Previa Anti-alucinación
   */
  const handleConfirmAndGenerateBudget = async () => {
    const finalItems = capturedItems.filter((it) => !isItemEmpty(it) && it.description.trim());
    if (finalItems.length === 0 || isCommitting) {
      if (validCount === 0) {
        toast.error('Debes ingresar al menos una partida antes de generar el presupuesto.');
      } else {
        toast.error('Las partidas en la planilla deben tener una descripción válida.');
      }
      return;
    }

    // Verificar si hay partidas S/C con descripciones incompletas o ambiguas
    const itemsNeedingCalibration = finalItems.filter((it) => {
      const audit = auditDescription(it.description, it.cod_par, it.unit);
      return audit.status === 'warning';
    });

    if (itemsNeedingCalibration.length > 0) {
      setPendingBudgetItems(finalItems);
      setIsCalibrationOpen(true);
      return;
    }

    await executeBudgetGeneration(finalItems);
  };

  /**
   * Confirmación desde el modal de calibración de partidas
   */
  const handleCalibrationConfirmed = async (calibratedList) => {
    setIsCalibrationOpen(false);

    // Actualizar capturedItems con las descripciones calibradas para persistir cambios en el borrador
    setCapturedItems((prev) =>
      prev.map((it) => {
        const match = calibratedList.find((c) => c.id === it.id);
        return match ? { ...it, description: match.description } : it;
      })
    );

    await executeBudgetGeneration(calibratedList);
  };

  /**
   * Ejecuta la resolución y commit del presupuesto en el backend
   */
  const executeBudgetGeneration = async (itemsToProcess) => {
    const cleanBudgetName =
      (budgetName || '').trim() ||
      `Presupuesto de Cómputos - ${new Date().toLocaleDateString('es-VE')}`;

    setIsCommitting(true);
    setCommitError(null);
    setCommitStepInfo({ current: 0, total: itemsToProcess.length });

    try {
      const payloadItems = [];
      let lastChapter = null;
      let scCounter = 1;

      const formatDescWithPartials = (baseDesc, item) => {
        const cleanBase = (baseDesc || '').trim().toUpperCase();
        if (!item.partials || item.partials.length === 0) return cleanBase;
        const breakdown = item.partials
          .map((p) => {
            const name = (p.description || 'Pared').trim();
            const dims = [
              p.length ? `L=${p.length}` : '',
              p.width ? `A=${p.width}` : '',
              p.height ? `H=${p.height}` : '',
              p.times && p.times > 1 ? `x${p.times}` : '',
            ]
              .filter(Boolean)
              .join('×');
            return `${name}${dims ? ` (${dims})` : ''}: ${p.partial || 0}`;
          })
          .join(', ');
        const combined = `${cleanBase} [Desglose: ${breakdown}]`;
        return combined.length <= 580 ? combined : cleanBase;
      };

      for (let i = 0; i < itemsToProcess.length; i += 1) {
        const it = itemsToProcess[i];
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

        // Si la partida ya fue seleccionada de la norma COVENIN (tiene cod_par),
        // se toma directamente de la base de datos sin necesidad de llamar a IA ni resolver.
        if (it.cod_par) {
          payloadItems.push({
            description: formatDescWithPartials(it.description, it),
            unit: (it.unit || 'M2').toUpperCase(),
            quantity: Number(it.quantity) || 0,
            performance: 1.0,
            is_chapter: false,
            cod_par: it.cod_par,
            cov_par: it.cov_par || it.cod_par,
            code: '',
            materials: [],
            equipments: [],
            labors: [],
          });
          continue;
        }

        setCommitStepInfo({ current: i + 1, total: itemsToProcess.length });
        setCommitProgressText(
          `Buscando en BD o generando APU (${i + 1}/${itemsToProcess.length}): ${it.description}`
        );

        let resolved = null;
        try {
          resolved = await budgetService.resolveComputo({
            description: it.description,
            unit: it.unit || 'M2',
            sc_index: scCounter,
            auto_generate_sc: true,
            quantity: Number(it.quantity) || 1.0,
          });
        } catch (errResolve) {
          console.error('Error resolviendo partida de cómputo:', errResolve);
        }

        if (resolved && resolved.resolution_type === 'covenin' && resolved.cod_par) {
          payloadItems.push({
            description: formatDescWithPartials(resolved.matched_description || it.description, it),
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
          const scCode = `S/C ${String(scCounter).padStart(2, '0')}`;
          scCounter += 1;

          payloadItems.push({
            description: formatDescWithPartials(resolved?.matched_description || it.description, it),
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
        source_filename: 'Planilla de Cómputos Métricos',
      });

      // Limpiar borrador local tras crear el presupuesto con éxito
      try {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
      } catch (_e) {
        // ignore
      }

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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] w-full h-[100dvh] bg-[#FEF3C7] flex flex-col overflow-hidden select-none sm:select-auto">
      {/* Overlay de Progreso al Generar Presupuesto */}
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

      {/* Modal / Diálogo para Abrir Cómputos Guardados */}
      {showOpenModal && (
        <div className="absolute inset-0 z-[130] bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-6 border-2 border-amber-300 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-amber-200 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-sm">
                  <FolderOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-amber-950 font-bold text-base leading-tight">Cómputos Guardados</h3>
                  <p className="text-xs text-amber-800">Selecciona un archivo guardado para continuar</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowOpenModal(false)}
                className="text-amber-700 hover:text-amber-950 p-1 rounded-full hover:bg-amber-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-900">
                {savedList.length} archivo(s) disponible(s)
              </span>
              <button
                type="button"
                onClick={handleCreateNewComputo}
                className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold flex items-center gap-1 shadow-xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nuevo Cómputo</span>
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
              {savedList.length === 0 ? (
                <div className="py-8 text-center text-amber-800 text-xs">
                  <FolderOpen className="w-8 h-8 text-amber-400 mx-auto mb-2" />
                  <p className="font-bold">No hay cómputos guardados en tu cuenta.</p>
                  <p className="text-amber-700 mt-1">
                    Presiona el botón <strong>Guardar</strong> en la parte inferior para almacenar tus planillas y sincronizarlas entre tu teléfono y tu PC.
                  </p>
                </div>
              ) : (
                savedList.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleLoadSavedComputo(item)}
                    className="p-3 rounded-2xl border border-amber-200 hover:border-amber-400 bg-amber-50/50 hover:bg-amber-100/60 transition-all flex items-center justify-between gap-3 cursor-pointer group"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm font-extrabold text-amber-950 truncate group-hover:text-amber-900">
                        {item.budgetName}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-0.5 text-[11px] text-amber-800">
                        {item.projectName && <span>Obra: <strong>{item.projectName}</strong></span>}
                        <span>• {item.itemCount || (item.items?.length || 0)} partida(s)</span>
                        <span>
                          • {new Date(item.savedAt).toLocaleDateString('es-VE')}{' '}
                          {new Date(item.savedAt).toLocaleTimeString('es-VE', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleLoadSavedComputo(item)}
                        className="px-2.5 py-1 text-xs font-bold rounded-lg bg-amber-600 text-white hover:bg-amber-700 shadow-xs cursor-pointer"
                      >
                        Abrir
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteSavedComputo(item.id, e)}
                        className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        title="Eliminar de la lista"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="border-t border-amber-200 pt-3 flex justify-end">
              <button
                type="button"
                onClick={() => setShowOpenModal(false)}
                className="px-4 py-1.5 rounded-xl border border-amber-300 text-amber-950 text-xs font-bold hover:bg-amber-100 cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal / Diálogo para Agregar Nuevo Capítulo a la Planilla */}
      {showChapterModal && (
        <div className="absolute inset-0 z-[130] bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 border-2 border-amber-300 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-amber-200 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-sm">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-amber-950 font-bold text-base leading-tight">Agregar Capítulo a la Planilla</h3>
                  <p className="text-xs text-amber-800">Crea una nueva sección para agrupar partidas</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowChapterModal(false)}
                className="text-amber-700 hover:text-amber-950 p-1 rounded-full hover:bg-amber-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (chapterModalInput.trim()) {
                  handleAddChapterToSheet(chapterModalInput.trim());
                }
              }}
              className="space-y-3"
            >
              <div>
                <label className="block text-xs font-bold text-amber-950 mb-1">
                  Nombre del Capítulo:
                </label>
                <input
                  type="text"
                  value={chapterModalInput}
                  onChange={(e) => setChapterModalInput(e.target.value)}
                  placeholder="Ej. ESTRUCTURAS, ALBAÑILERÍA..."
                  autoFocus
                  className="w-full px-3 py-2 text-sm font-bold border-2 border-amber-300 rounded-xl bg-amber-50/30 text-amber-950 focus:outline-none focus:border-amber-500 uppercase"
                />
              </div>

              <div>
                <p className="text-[11px] font-bold text-amber-800 mb-1.5">Capítulos frecuentes:</p>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'OBRAS PRELIMINARES',
                    'MOVIMIENTO DE TIERRAS',
                    'ESTRUCTURAS',
                    'ALBAÑILERÍA',
                    'INSTALACIONES ELÉCTRICAS',
                    'INSTALACIONES SANITARIAS',
                    'ACABADOS',
                    'IMPERMEABILIZACIÓN',
                  ].map((sug) => (
                    <button
                      key={sug}
                      type="button"
                      onClick={() => setChapterModalInput(sug)}
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                        chapterModalInput === sug
                          ? 'bg-amber-500 text-white border-amber-600'
                          : 'bg-amber-50 hover:bg-amber-100 text-amber-950 border-amber-200'
                      }`}
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-amber-200">
                <button
                  type="button"
                  onClick={() => setShowChapterModal(false)}
                  className="px-3.5 py-1.5 rounded-xl border border-amber-300 text-amber-950 text-xs font-bold hover:bg-amber-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!chapterModalInput.trim()}
                  className="px-4 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-extrabold shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                >
                  + Agregar a la Planilla
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal / Diálogo para Renombrar Capítulo */}
      {renameChapterTarget && (
        <div className="absolute inset-0 z-[130] bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 border-2 border-amber-300 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-amber-200 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-sm">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-amber-950 font-bold text-base leading-tight">Renombrar Capítulo</h3>
                  <p className="text-xs text-amber-800">Actualiza el título del capítulo en la planilla</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setRenameChapterTarget(null);
                  setRenameChapterInput('');
                }}
                className="text-amber-700 hover:text-amber-950 p-1 rounded-full hover:bg-amber-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmRenameChapter} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-amber-950 mb-1">
                  Nuevo nombre para este capítulo:
                </label>
                <input
                  type="text"
                  value={renameChapterInput}
                  onChange={(e) => setRenameChapterInput(e.target.value)}
                  placeholder="Ej. ESTRUCTURAS DE CONCRETO..."
                  autoFocus
                  className="w-full px-3 py-2 text-sm font-bold border-2 border-amber-300 rounded-xl bg-amber-50/30 text-amber-950 focus:outline-none focus:border-amber-500 uppercase"
                />
              </div>

              <div>
                <p className="text-[11px] font-bold text-amber-800 mb-1.5">Sugerencias rápidas:</p>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'OBRAS PRELIMINARES',
                    'MOVIMIENTO DE TIERRAS',
                    'ESTRUCTURAS',
                    'ALBAÑILERÍA',
                    'INSTALACIONES ELÉCTRICAS',
                    'INSTALACIONES SANITARIAS',
                    'ACABADOS',
                    'IMPERMEABILIZACIÓN',
                  ].map((sug) => (
                    <button
                      key={sug}
                      type="button"
                      onClick={() => setRenameChapterInput(sug)}
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                        renameChapterInput === sug
                          ? 'bg-amber-500 text-white border-amber-600'
                          : 'bg-amber-50 hover:bg-amber-100 text-amber-950 border-amber-200'
                      }`}
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-amber-200">
                <button
                  type="button"
                  onClick={() => {
                    setRenameChapterTarget(null);
                    setRenameChapterInput('');
                  }}
                  className="px-3.5 py-1.5 rounded-xl border border-amber-300 text-amber-950 text-xs font-bold hover:bg-amber-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!renameChapterInput.trim()}
                  className="px-4 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-extrabold shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                >
                  Guardar Nombre
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Datos del Presupuesto y Proyecto */}
      {showProjectInfoModal && (
        <div className="absolute inset-0 z-[130] bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-6 border-2 border-amber-300 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-amber-200 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-sm">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-amber-950 font-bold text-base leading-tight">
                    Datos del Presupuesto
                  </h3>
                  <p className="text-xs text-amber-800">
                    Configura el nombre, proyecto, cliente y moneda
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowProjectInfoModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5 py-1">
              <div>
                <label className="block text-xs font-bold text-amber-900 mb-1">
                  Nombre del Presupuesto *
                </label>
                <input
                  type="text"
                  value={budgetName}
                  onChange={(e) => setBudgetName(e.target.value)}
                  placeholder="Ej. Presupuesto Inicial"
                  className="w-full px-3.5 py-2 rounded-xl border-2 border-amber-300 text-amber-950 text-sm font-bold focus:outline-none focus:border-amber-500 bg-amber-50/30"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-amber-900 mb-1">
                  Proyecto / Obra
                </label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="Ej. Residencia Las Palmas"
                  className="w-full px-3.5 py-2 rounded-xl border-2 border-amber-300 text-amber-950 text-sm focus:outline-none focus:border-amber-500 bg-amber-50/30"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-amber-900 mb-1">
                    Cliente
                  </label>
                  <input
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Nombre del cliente o empresa"
                    className="w-full px-3.5 py-2 rounded-xl border-2 border-amber-300 text-amber-950 text-sm focus:outline-none focus:border-amber-500 bg-amber-50/30"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-amber-900 mb-1">
                    Moneda
                  </label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border-2 border-amber-300 text-amber-950 text-sm font-bold bg-amber-100 cursor-pointer focus:outline-none focus:border-amber-500"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="VES">VES (Bs.)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-amber-200">
              <button
                type="button"
                onClick={() => setShowProjectInfoModal(false)}
                className="px-4 py-2 text-xs font-extrabold text-amber-950 bg-amber-400 hover:bg-amber-500 rounded-xl transition-colors cursor-pointer shadow-sm"
              >
                Listo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Búsqueda e Inclusión COVENIN (sin opciones IA ni Compartir) */}
      <BudgetSearchModal
        isOpen={showCatalogModal}
        onClose={() => {
          setShowCatalogModal(false);
          setCoveninTargetItemId(null);
        }}
        zIndexClass="z-[160]"
        activeDatabase={activeDatabase}
        setActiveDatabase={setActiveDatabase}
        databases={databases}
        availableBudgets={availableBudgets}
        showAiOption={false}
        showSharedOption={false}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        searchCovenin={searchCovenin}
        setSearchCovenin={setSearchCovenin}
        searchDesc={searchDesc}
        setSearchDesc={setSearchDesc}
        searchInsumos={searchInsumos}
        setSearchInsumos={setSearchInsumos}
        searching={searching}
        searchDatabase={searchDatabase}
        totalSearchResults={totalSearchResults}
        searchResults={searchResults}
        hasMoreSearchResults={hasMoreSearchResults}
        loadMoreSearchResults={loadMoreSearchResults}
        onAddItem={handleSelectCoveninPartida}
      />

      {/* Modal de Calibración Técnica de Partidas antes de Generar con IA */}
      <PartidasCalibrationModal
        isOpen={isCalibrationOpen}
        items={pendingBudgetItems}
        onClose={() => setIsCalibrationOpen(false)}
        onConfirm={handleCalibrationConfirmed}
        onOpenCoveninSearch={(item) => {
          handleOpenCoveninModal(item);
        }}
      />

      {/* Header Principal con Selector de Modo (Planilla vs Asistente/Chat) */}
      <header className="px-4 sm:px-6 py-2.5 border-b border-amber-200 flex items-center justify-between bg-[#FEF3C7] shrink-0 shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/30 shrink-0">
            <Calculator className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-amber-900 font-bold text-base sm:text-lg leading-tight truncate">
                Cómputos Métricos
              </h2>
              <span
                className={`hidden sm:inline-block text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                  isOnline
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    : 'bg-amber-200 text-amber-900 border-amber-400 animate-pulse'
                }`}
              >
                {isOnline ? '● En línea' : '⚡ Modo Offline'}
              </span>
            </div>
          </div>
        </div>

        {/* Selector de Pestaña Central: Planilla de Cómputos vs Chat Asistente */}
        <div className="flex items-center gap-1 bg-amber-200/80 p-1 rounded-xl border border-amber-300 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('sheet')}
            className={`px-3 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'sheet'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-amber-900 hover:bg-amber-300/60'
            }`}
          >
            <Table className="w-4 h-4" />
            <span>Planilla ({validCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('chat')}
            className={`px-3 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'chat'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-amber-900 hover:bg-amber-300/60'
            }`}
          >
            <Bot className="w-4 h-4" />
            <span>Asistente / Chat</span>
          </button>
        </div>

        {/* Acciones de Cabecera: Acciones Rápidas (Iconos con Tooltips) + Abrir, Reiniciar y Cerrar */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Datos del Presupuesto */}
          <button
            type="button"
            onClick={() => setShowProjectInfoModal(true)}
            disabled={isCommitting}
            className="p-1.5 sm:p-2 rounded-xl text-xs font-bold flex items-center justify-center transition-all bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 hover:text-amber-950 cursor-pointer shadow-xs"
            title="Datos del Presupuesto (Nombre, Proyecto, Cliente, Moneda)"
          >
            <Edit3 className="w-4 h-4 text-amber-700" />
          </button>

          {/* Imprimir Planilla */}
          <button
            type="button"
            onClick={handlePrintComputos}
            disabled={isCommitting || validCount === 0}
            className="p-1.5 sm:p-2 rounded-xl text-xs font-bold flex items-center justify-center transition-all bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 hover:text-amber-950 cursor-pointer shadow-xs disabled:opacity-40"
            title="Imprimir planilla de cómputos en formato técnico"
          >
            <Printer className="w-4 h-4 text-amber-700" />
          </button>

          {/* Exportar a Excel */}
          <button
            type="button"
            onClick={handleExportExcelComputos}
            disabled={isCommitting || validCount === 0}
            className="p-1.5 sm:p-2 rounded-xl text-xs font-bold flex items-center justify-center transition-all bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 hover:text-amber-950 cursor-pointer shadow-xs disabled:opacity-40"
            title="Exportar planilla de cómputos a Excel (.xls)"
          >
            <FileSpreadsheet className="w-4 h-4 text-amber-700" />
          </button>

          <div className="h-5 w-px bg-amber-300 mx-0.5 hidden sm:block" />

          <button
            type="button"
            onClick={handleOpenLoadModal}
            disabled={isCommitting}
            className="px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 cursor-pointer shadow-xs"
            title="Abrir cómputos guardados"
          >
            <FolderOpen className="w-3.5 h-3.5 text-amber-700" />
            <span>Abrir{savedList.length > 0 ? ` (${savedList.length})` : ''}</span>
          </button>

          <button
            type="button"
            onClick={() => handleClearAll()}
            disabled={isCommitting}
            className="px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 cursor-pointer shadow-xs"
            title="Limpiar planilla y reiniciar"
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-700" />
            <span className="hidden md:inline">Reiniciar</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            disabled={isCommitting}
            className="text-amber-700 hover:text-amber-900 hover:bg-amber-200/50 rounded-full p-2 transition-colors cursor-pointer"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Barra de Acciones y Controles: Vista Móvil/Tabla y Capítulo */}
      <div className="px-3 sm:px-6 py-2 bg-amber-100/90 border-b border-amber-200 flex items-center justify-between gap-2 shrink-0 flex-wrap">
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          {/* Conmutador de Vista Móvil (Apilada) vs Tabla Clásica */}
          <div className="inline-flex rounded-xl bg-white border border-amber-300 p-0.5 shadow-xs">
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                viewMode === 'cards'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-amber-900 hover:bg-amber-50'
              }`}
              title="Vista apilada ideal para teléfonos móviles sin desplazamiento horizontal"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Móvil</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-amber-900 hover:bg-amber-50'
              }`}
              title="Vista clásica en tabla de cómputos métricos"
            >
              <Table className="w-3.5 h-3.5" />
              <span>Tabla</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setChapterModalInput('');
              setShowChapterModal(true);
            }}
            className="text-xs font-bold text-amber-900 hover:text-amber-950 bg-white hover:bg-amber-50 border border-amber-300 px-2.5 py-1 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
            title="Agregar un nuevo capítulo a la planilla"
          >
            <FolderPlus className="w-3.5 h-3.5 text-amber-700" />
            <span>+ Capítulo</span>
          </button>
        </div>
      </div>

      {/* CUERPO PRINCIPAL */}
      {activeTab === 'sheet' ? (
        /* VISTA: PLANILLA DE CÓMPUTOS MÉTRICOS (TABLA CON FACTOR, DISTANCIA Y FILA LIBRE) */
        <div className="flex-1 flex flex-col min-h-0 p-3 sm:p-4 space-y-3 bg-[#FEF3C7] overflow-hidden">
          <div className="max-w-[1400px] w-full mx-auto flex flex-col flex-1 min-h-0 space-y-3">
            {/* Encabezado fijo de la Planilla de Cómputos Métricos */}
            <div className="bg-white border-2 border-amber-300 rounded-2xl py-1.5 px-4 shadow-sm text-center shrink-0">
              <h2 className="text-sm sm:text-base font-black text-amber-950 tracking-wider uppercase leading-tight">
                PLANILLA DE CÓMPUTOS MÉTRICOS
              </h2>
            </div>

            {/* CUERPO DE LA PLANILLA: VISTA MÓVIL APILADA (CARDS) O VISTA TABLA CLÁSICA */}
            {viewMode === 'cards' ? (
              /* VISTA MÓVIL APILADA: CONTENEDORES HACIA ABAJO SIN DESPLAZAMIENTO HORIZONTAL */
              <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                {capturedItems.map((it, idx) => {
                  const prevItem = idx > 0 ? capturedItems[idx - 1] : null;
                  const showChapHeader = Boolean(
                    it.chapter &&
                    it.chapter.trim() &&
                    (!prevItem || (prevItem.chapter || '').trim().toUpperCase() !== it.chapter.trim().toUpperCase())
                  );
                  const isBlankTrailing = isItemEmpty(it);
                  const hasPartials = it.partials && it.partials.length > 0;
                  const isExpanded = expandedPartials[it.id] !== false;

                  return (
                    <React.Fragment key={it.id}>
                      {showChapHeader && (
                        <div className="bg-amber-200/90 border-2 border-amber-400 rounded-2xl p-3 shadow-xs flex items-center justify-between gap-2">
                          <span className="font-black text-amber-950 text-xs sm:text-sm tracking-wide flex items-center gap-2">
                            <Layers className="w-4 h-4 text-amber-700" />
                            CAPÍTULO: {it.chapter}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleRenameChapter(it.chapter)}
                              className="text-xs font-bold text-amber-900 bg-white hover:bg-amber-50 border border-amber-300 px-2.5 py-1 rounded-xl flex items-center gap-1 cursor-pointer shadow-xs"
                              title="Renombrar este capítulo"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-amber-700" />
                              <span>Renombrar</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveChapterHeader(it.chapter)}
                              className="text-xs font-bold text-red-700 bg-white hover:bg-red-50 border border-red-300 px-2.5 py-1 rounded-xl flex items-center gap-1 cursor-pointer shadow-xs"
                              title="Eliminar encabezado del capítulo (los cómputos se conservan)"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-red-600" />
                              <span>Eliminar</span>
                            </button>
                          </div>
                        </div>
                      )}

                      <div
                        className={`bg-white border-2 ${
                          isBlankTrailing ? 'border-amber-200 bg-amber-50/20' : 'border-amber-300'
                        } rounded-2xl p-3.5 sm:p-4 shadow-sm space-y-3`}
                      >
                        {/* Fila Superior: N° Item, Capítulo y Acciones Rápidas */}
                        <div className="flex items-center justify-between border-b border-amber-200 pb-2">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-lg bg-amber-600 text-white font-extrabold text-xs flex items-center justify-center shadow-xs">
                              {idx + 1}
                            </span>
                            <span className="text-[11px] font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded-md truncate max-w-[150px] sm:max-w-[250px]">
                              {it.chapter}
                            </span>
                            {it.cod_par && (
                              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-300">
                                {it.cov_par || it.cod_par}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleInsertRowBelow(it)}
                              className="p-1.5 text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                              title="Agregar partida debajo"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDuplicateRow(it)}
                              disabled={isBlankTrailing}
                              className="p-1.5 text-amber-700 hover:bg-amber-100 rounded-lg transition-colors cursor-pointer disabled:opacity-30"
                              title="Duplicar partida"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(it.id)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                              title="Eliminar partida"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* DESCRIPCIÓN DE LA PARTIDA */}
                        <div className="space-y-1.5">
                          <label className="block text-[11px] font-bold text-amber-950 uppercase">
                            Descripción de la Partida
                          </label>
                          <div className="flex flex-col gap-1.5">
                            <input
                              type="text"
                              value={it.description}
                              onChange={(e) =>
                                handleUpdateItemField(it.id, 'description', e.target.value.toUpperCase())
                              }
                              placeholder={
                                isBlankTrailing
                                  ? 'Escribe aquí la partida (ej: Demolición de pared...)'
                                  : 'Descripción...'
                              }
                              className="w-full px-3 py-2 text-xs sm:text-sm font-bold bg-amber-50/30 border border-amber-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 rounded-xl uppercase placeholder:text-gray-400"
                            />
                            <div className="flex flex-wrap items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenCoveninModal(it)}
                                className="text-[11px] font-bold text-sky-800 bg-sky-50 hover:bg-sky-100 border border-sky-300 px-2.5 py-1 rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                              >
                                <Search className="w-3 h-3 text-sky-600" />
                                <span>Buscar en Norma COVENIN</span>
                              </button>
                              {!it.cod_par && !isBlankTrailing && it.description && it.description.trim() && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const audit = auditDescription(it.description, it.cod_par, it.unit);
                                    handleEnrichItem(it.id, audit.suggestion);
                                  }}
                                  className="text-[11px] font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-300 px-2.5 py-1 rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                                >
                                  <Sparkles className="w-3 h-3 text-amber-600" />
                                  <span>Enriquecer Especificaciones</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* CONTENEDORES DE MEDIDAS APILADOS HACIA ABAJO (SIN SCROLL HORIZONTAL) */}
                        {!hasPartials ? (
                          <div className="space-y-2.5 bg-amber-50/50 border border-amber-200 rounded-xl p-3">
                            {/* Fila 1: Unidad y N° Veces */}
                            <div className="grid grid-cols-2 gap-2.5">
                              <div>
                                <label className="block text-[10px] font-bold text-amber-900 mb-0.5">
                                  UNIDAD (UND)
                                </label>
                                <select
                                  value={it.unit || 'M2'}
                                  onChange={(e) => handleUpdateItemField(it.id, 'unit', e.target.value)}
                                  className="w-full px-2 py-1 text-[11px] font-semibold rounded-lg border border-amber-300 bg-white text-amber-950 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
                                >
                                  {COMMON_UNITS.map((u) => (
                                    <option key={u} value={u}>
                                      {u}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-amber-900 mb-0.5">
                                  N° VECES / PIEZAS
                                </label>
                                <input
                                  type="number"
                                  step="1"
                                  min="1"
                                  value={it.times ?? 1}
                                  onChange={(e) => handleUpdateItemField(it.id, 'times', e.target.value)}
                                  className="w-full px-2.5 py-1.5 text-xs text-center font-bold rounded-lg border border-amber-300 bg-white"
                                />
                              </div>
                            </div>

                            {/* Fila 2: Dimensiones Físicas (Largo, Ancho, Alto) */}
                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <label className="block text-[10px] font-bold text-amber-900 mb-0.5">
                                  LARGO (m)
                                </label>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={it.length ?? ''}
                                  onChange={(e) => handleUpdateItemField(it.id, 'length', e.target.value)}
                                  placeholder="0.00"
                                  className="w-full px-2 py-1.5 text-xs text-right font-medium rounded-lg border border-amber-300 bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-amber-900 mb-0.5">
                                  ANCHO (m)
                                </label>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={it.width ?? ''}
                                  onChange={(e) => handleUpdateItemField(it.id, 'width', e.target.value)}
                                  placeholder="0.00"
                                  className="w-full px-2 py-1.5 text-xs text-right font-medium rounded-lg border border-amber-300 bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-amber-900 mb-0.5">
                                  ALTO (m)
                                </label>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={it.height ?? ''}
                                  onChange={(e) => handleUpdateItemField(it.id, 'height', e.target.value)}
                                  placeholder="0.00"
                                  className="w-full px-2 py-1.5 text-xs text-right font-medium rounded-lg border border-amber-300 bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                                />
                              </div>
                            </div>

                            {/* Fila 3: Factor Acero y Distancia Acarreo */}
                            <div className="grid grid-cols-2 gap-2.5">
                              <div>
                                <label
                                  className="block text-[10px] font-bold text-amber-900 mb-0.5"
                                  title="Factor kg/m para acero"
                                >
                                  FACTOR (kg/m)
                                </label>
                                <input
                                  type="number"
                                  step="0.001"
                                  value={it.factor ?? ''}
                                  onChange={(e) => handleUpdateItemField(it.id, 'factor', e.target.value)}
                                  placeholder="1.000"
                                  className="w-full px-2 py-1.5 text-xs text-right font-semibold rounded-lg border border-amber-300 bg-white"
                                />
                              </div>
                              <div>
                                <label
                                  className="block text-[10px] font-bold text-amber-900 mb-0.5"
                                  title="Distancia de transporte en Km"
                                >
                                  DISTANCIA (km)
                                </label>
                                <input
                                  type="number"
                                  step="0.1"
                                  value={it.distance ?? ''}
                                  onChange={(e) => handleUpdateItemField(it.id, 'distance', e.target.value)}
                                  placeholder="—"
                                  className="w-full px-2 py-1.5 text-xs text-right font-semibold rounded-lg border border-amber-300 bg-white"
                                />
                              </div>
                            </div>

                            {/* Fila 4: Subtotal Parcial y Cantidad Total */}
                            <div className="grid grid-cols-2 gap-2.5 pt-1">
                              <div className="bg-white/80 p-2 rounded-xl border border-amber-200">
                                <span className="block text-[9px] uppercase font-bold text-amber-700">
                                  Subtotal Parcial
                                </span>
                                <span className="text-xs font-bold text-amber-900">
                                  {it.partial > 0
                                    ? Number(it.partial).toLocaleString('es-VE', { maximumFractionDigits: 3 })
                                    : '—'}
                                </span>
                              </div>
                              <div className="bg-amber-100 p-2 rounded-xl border-2 border-amber-400">
                                <span className="block text-[10px] uppercase font-black text-amber-950">
                                  CANTIDAD TOTAL ({it.unit})
                                </span>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={it.quantity}
                                  onChange={(e) => handleUpdateItemField(it.id, 'quantity', e.target.value)}
                                  className="w-full px-1.5 py-0.5 text-sm text-right font-black text-amber-950 bg-white rounded border border-amber-300 focus:outline-none focus:ring-1 focus:ring-amber-500"
                                />
                              </div>
                            </div>
                          </div>
                        ) : (
                          /* SECCIÓN CUANDO TIENE PARCIALES / FILAS */
                          <div className="bg-amber-100/60 border border-amber-300 rounded-xl p-3 flex items-center justify-between">
                            <div>
                              <span className="block text-[11px] font-extrabold text-amber-950">
                                📐 Calculado mediante {it.partials.length} parciales
                              </span>
                              <span className="text-[10px] text-amber-800">
                                La cantidad total se suma automáticamente desde el desglose inferior
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="text-xs font-bold text-amber-700 block">Total Calculado</span>
                              <span className="text-base font-black text-amber-950">
                                {Number(it.quantity).toLocaleString('es-VE', { maximumFractionDigits: 3 })} {it.unit}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* SECCIÓN DESGLOSE DE PARCIALES */}
                        <div className="space-y-2">
                          {!hasPartials ? (
                            <button
                              type="button"
                              onClick={() => handleTogglePartials(it.id)}
                              className="w-full py-2 px-3 rounded-xl bg-amber-100/80 hover:bg-amber-200/80 border border-amber-300 text-amber-950 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                            >
                              <Split className="w-3.5 h-3.5 text-amber-700" />
                              <span>+ Desglosar en parciales / filas</span>
                            </button>
                          ) : (
                            <div className="space-y-2 border border-amber-300 rounded-xl p-3 bg-amber-50/60">
                              <div className="flex items-center justify-between border-b border-amber-200 pb-2">
                                <button
                                  type="button"
                                  onClick={() => handleToggleExpandPartials(it.id)}
                                  className="flex items-center gap-1.5 text-xs font-black text-amber-950 cursor-pointer"
                                >
                                  {isExpanded ? (
                                    <ChevronUp className="w-4 h-4 text-amber-700" />
                                  ) : (
                                    <ChevronDown className="w-4 h-4 text-amber-700" />
                                  )}
                                  <span>🧱 Parciales ({it.partials.length})</span>
                                </button>

                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleAddPartial(it.id)}
                                    className="text-[11px] font-bold text-amber-900 bg-white hover:bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-lg flex items-center gap-1 cursor-pointer shadow-xs"
                                  >
                                    <Plus className="w-3.5 h-3.5 text-amber-700" />
                                    <span>Agregar fila</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleClearPartials(it.id)}
                                    className="text-[10px] text-red-600 hover:underline cursor-pointer"
                                  >
                                    Quitar
                                  </button>
                                </div>
                              </div>

                              {isExpanded && (
                                <div className="space-y-2.5 pt-1">
                                  {it.partials.map((p, pIdx) => (
                                    <div
                                      key={p.id}
                                      className="bg-white border border-amber-200 rounded-xl p-2.5 shadow-xs space-y-2"
                                    >
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5 flex-1 min-w-0 mr-2">
                                          <span className="text-[10px] font-bold text-amber-700 shrink-0">
                                            #{pIdx + 1}
                                          </span>
                                          <input
                                            type="text"
                                            value={p.description || ''}
                                            onChange={(e) =>
                                              handleUpdatePartialField(it.id, p.id, 'description', e.target.value)
                                            }
                                            placeholder={`Parcial ${pIdx + 1} (ej: Fachada, Eje 1-2, Tramo A...)`}
                                            className="w-full px-2 py-1 text-xs font-semibold bg-amber-50/30 border border-amber-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500"
                                          />
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => handleRemovePartial(it.id, p.id)}
                                          className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer shrink-0"
                                          title="Eliminar esta fila"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>

                                      <div className="grid grid-cols-4 gap-1.5">
                                        <div>
                                          <label className="block text-[9px] font-bold text-amber-800">Largo (m)</label>
                                          <input
                                            type="number"
                                            step="0.01"
                                            value={p.length ?? ''}
                                            onChange={(e) =>
                                              handleUpdatePartialField(it.id, p.id, 'length', e.target.value)
                                            }
                                            placeholder="0.00"
                                            className="w-full px-1.5 py-1 text-xs text-right bg-white border border-amber-200 rounded-lg"
                                          />
                                        </div>
                                        <div>
                                          <label className="block text-[9px] font-bold text-amber-800">Ancho (m)</label>
                                          <input
                                            type="number"
                                            step="0.01"
                                            value={p.width ?? ''}
                                            onChange={(e) =>
                                              handleUpdatePartialField(it.id, p.id, 'width', e.target.value)
                                            }
                                            placeholder="0.00"
                                            className="w-full px-1.5 py-1 text-xs text-right bg-white border border-amber-200 rounded-lg"
                                          />
                                        </div>
                                        <div>
                                          <label className="block text-[9px] font-bold text-amber-800">Alto (m)</label>
                                          <input
                                            type="number"
                                            step="0.01"
                                            value={p.height ?? ''}
                                            onChange={(e) =>
                                              handleUpdatePartialField(it.id, p.id, 'height', e.target.value)
                                            }
                                            placeholder="0.00"
                                            className="w-full px-1.5 py-1 text-xs text-right bg-white border border-amber-200 rounded-lg"
                                          />
                                        </div>
                                        <div>
                                          <label className="block text-[9px] font-bold text-amber-800">Veces</label>
                                          <input
                                            type="number"
                                            step="1"
                                            min="1"
                                            value={p.times ?? 1}
                                            onChange={(e) =>
                                              handleUpdatePartialField(it.id, p.id, 'times', e.target.value)
                                            }
                                            className="w-full px-1.5 py-1 text-xs text-center font-bold bg-white border border-amber-200 rounded-lg"
                                          />
                                        </div>
                                      </div>

                                      <div className="flex items-center justify-between bg-amber-50/80 p-2 rounded-lg text-xs">
                                        <input
                                          type="text"
                                          value={p.observations ?? ''}
                                          onChange={(e) =>
                                            handleUpdatePartialField(it.id, p.id, 'observations', e.target.value)
                                          }
                                          placeholder="Notas / Eje / Detalle..."
                                          className="flex-1 mr-2 px-1.5 py-0.5 text-[11px] bg-white border border-amber-200 rounded"
                                        />
                                        <div className="shrink-0 text-right">
                                          <span className="text-[10px] text-amber-700 block">Subtotal</span>
                                          <span className="font-extrabold text-amber-950">
                                            {Number(p.partial || 0).toLocaleString('es-VE', {
                                              maximumFractionDigits: 3,
                                            })}{' '}
                                            {it.unit}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* OBSERVACIONES */}
                        <div>
                          <label className="block text-[10px] font-bold text-amber-900 mb-0.5">
                            OBSERVACIONES / UBICACIÓN
                          </label>
                          <input
                            type="text"
                            value={it.observations ?? ''}
                            onChange={(e) => handleUpdateItemField(it.id, 'observations', e.target.value)}
                            placeholder="Notas, eje, ubicación o especificaciones especiales..."
                            className="w-full px-3 py-1.5 text-xs bg-amber-50/30 border border-amber-300 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                          />
                        </div>

                        {/* BOTÓN AGREGAR PARTIDA DEBAJO */}
                        <div className="pt-1 border-t border-amber-100 flex justify-end">
                          <button
                            type="button"
                            onClick={() => handleInsertRowBelow(it)}
                            className="text-xs font-bold text-amber-900 hover:text-amber-950 bg-amber-100/60 hover:bg-amber-200/80 px-3 py-1 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5 text-amber-700" />
                            <span>+ Agregar Partida Debajo</span>
                          </button>
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            ) : (
              /* TABLA PRINCIPAL: PLANILLA DE CÓMPUTOS MÉTRICOS CON FILA LIBRE SIEMPRE PRESENTE Y ENCABEZADO FIJO DESACOPLADO */
              <div className="flex-1 min-h-0 bg-white border-2 border-gray-400 rounded-2xl shadow-md overflow-hidden flex flex-col">
                <div className="flex-1 overflow-auto">
                  <table className="w-full text-xs text-left border-collapse border border-gray-400 min-w-[1100px]">
                  <thead className="sticky top-0 z-20 shadow-xs">
                    <tr className="bg-amber-200 text-amber-950 font-black uppercase border-b border-gray-400 text-center text-[11px] tracking-wide">
                      <th rowSpan={2} className="border border-gray-400 px-2 py-2 w-12 bg-amber-300">
                        N° DE ITEM
                      </th>
                      <th rowSpan={2} className="border border-gray-400 px-3 py-2 text-left min-w-[380px] sm:min-w-[460px] bg-amber-200">
                        DESCRIPCIÓN
                      </th>
                      <th colSpan={4} className="border border-gray-400 px-2 py-1 bg-amber-300">
                        DIMENSIONES
                      </th>
                      <th rowSpan={2} className="border border-gray-400 px-2 py-2 w-14 bg-amber-200" title="Número de repeticiones o piezas iguales">
                        N° DE VECES
                      </th>
                      <th rowSpan={2} className="border border-gray-400 px-2 py-2 w-20 bg-amber-300 text-amber-950" title="Factor de peso unitario para acero (kg/m) o factor multiplicador">
                        <div className="leading-tight">
                          <span>FACTOR</span>
                          <span className="block text-[9px] font-semibold text-amber-800 normal-case">(Acero kg/m)</span>
                        </div>
                      </th>
                      <th rowSpan={2} className="border border-gray-400 px-2 py-2 w-20 bg-amber-300 text-amber-950" title="Distancia en kilómetros para acarreos y transportes (M3-KM, TON-KM)">
                        <div className="leading-tight">
                          <span>DISTANCIA</span>
                          <span className="block text-[9px] font-semibold text-amber-800 normal-case">(Km acarreo)</span>
                        </div>
                      </th>
                      <th colSpan={2} className="border border-gray-400 px-2 py-1 bg-amber-300">
                        CANTIDAD
                      </th>
                      <th rowSpan={2} className="border border-gray-400 px-3 py-2 min-w-[150px] bg-amber-200">
                        OBSERVACIONES
                      </th>
                      <th rowSpan={2} className="border border-gray-400 px-2 py-2 w-20 text-center bg-amber-300">
                        ACCIONES
                      </th>
                    </tr>
                    <tr className="bg-amber-100 text-amber-950 font-bold text-[10px] uppercase border-b-2 border-gray-500 text-center">
                      <th className="border border-gray-400 px-0.5 py-1 w-14 text-[9px] bg-amber-100" title="Unidad de medida">UND</th>
                      <th className="border border-gray-400 px-1 py-1 w-16 bg-amber-100">Largo</th>
                      <th className="border border-gray-400 px-1 py-1 w-16 bg-amber-100">Ancho</th>
                      <th className="border border-gray-400 px-1 py-1 w-16 bg-amber-100">Alto</th>
                      <th className="border border-gray-400 px-1 py-1 w-20 bg-amber-100">PARCIAL</th>
                      <th className="border border-gray-400 px-1 py-1 w-24 bg-amber-200">TOTAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {capturedItems.map((it, idx) => {
                      const prevItem = idx > 0 ? capturedItems[idx - 1] : null;
                      const showChapHeader = Boolean(
                        it.chapter &&
                        it.chapter.trim() &&
                        (!prevItem || (prevItem.chapter || '').trim().toUpperCase() !== it.chapter.trim().toUpperCase())
                      );
                      const isBlankTrailing = isItemEmpty(it);
                      const hasPartials = Boolean(it.partials && it.partials.length > 0);

                      return (
                        <React.Fragment key={it.id}>
                          {showChapHeader && (
                            <tr className="bg-amber-200/70 border-b border-gray-400">
                              <td colSpan={13} className="px-3 py-1.5 font-black text-amber-950 text-[11px] tracking-wide border border-gray-400">
                                <div className="flex items-center justify-between">
                                  <span className="flex items-center gap-1.5">
                                    <Layers className="w-3.5 h-3.5 text-amber-700" />
                                    CAPÍTULO: {it.chapter}
                                  </span>
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => handleRenameChapter(it.chapter)}
                                      className="text-[10px] font-bold text-amber-900 bg-white/90 hover:bg-white border border-amber-300 px-2 py-0.5 rounded flex items-center gap-1 cursor-pointer shadow-xs"
                                      title="Renombrar este capítulo"
                                    >
                                      <Edit3 className="w-3 h-3 text-amber-700" />
                                      <span>Renombrar</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveChapterHeader(it.chapter)}
                                      className="text-[10px] font-bold text-red-700 bg-white/90 hover:bg-red-50 border border-red-300 px-2 py-0.5 rounded flex items-center gap-1 cursor-pointer shadow-xs hover:text-red-900"
                                      title="Eliminar encabezado del capítulo (los cómputos se conservan)"
                                    >
                                      <Trash2 className="w-3 h-3 text-red-600" />
                                      <span>Eliminar</span>
                                    </button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                          <tr
                            className={`transition-colors border-b border-gray-300 text-amber-950 ${
                              isBlankTrailing ? 'bg-amber-50/20 hover:bg-amber-50/50' : 'hover:bg-amber-50/80'
                            }`}
                          >
                            {/* N° DE ITEM */}
                            <td className="border border-gray-300 px-2 py-1 text-center font-bold text-xs bg-amber-50/40">
                              {idx + 1}
                            </td>

                            {/* DESCRIPCIÓN */}
                            <td className="border border-gray-300 px-1 py-1">
                              <div className="flex flex-col gap-0.5">
                                <input
                                  type="text"
                                  value={it.description}
                                  onChange={(e) =>
                                    handleUpdateItemField(it.id, 'description', e.target.value.toUpperCase())
                                  }
                                  placeholder={isBlankTrailing ? 'Escribe aquí la partida...' : 'Descripción de la partida...'}
                                  className="w-full px-2 py-1 text-xs font-semibold bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 rounded uppercase placeholder:text-gray-400"
                                />
                                {it.partials && it.partials.length > 0 && (
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    <button
                                      type="button"
                                      onClick={() => handleToggleExpandPartials(it.id)}
                                      className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-900 bg-amber-200/80 hover:bg-amber-300 px-1.5 py-0.5 rounded cursor-pointer"
                                    >
                                      <span>🧱 {it.partials.length} parciales</span>
                                      {expandedPartials[it.id] !== false ? (
                                        <ChevronUp className="w-3 h-3" />
                                      ) : (
                                        <ChevronDown className="w-3 h-3" />
                                      )}
                                    </button>
                                  </div>
                                )}
                                {!isBlankTrailing && it.description && it.description.trim() && (() => {
                                  const audit = auditDescription(it.description, it.cod_par, it.unit);
                                  if (audit.status === 'covenin') {
                                    return (
                                      <div className="flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-bold text-emerald-800 bg-emerald-100/90 rounded w-fit border border-emerald-300">
                                        <Database className="w-2.5 h-2.5 text-emerald-600" />
                                        <span>COVENIN: {it.cod_par}</span>
                                      </div>
                                    );
                                  }
                                  if (audit.status === 'warning') {
                                    const hasVariants = audit.materialVariants && audit.materialVariants.length > 0;
                                    return (
                                      <div className="flex flex-col gap-1 px-1.5 py-1 text-[9px] font-semibold text-amber-900 bg-amber-100/90 rounded border border-amber-300">
                                        <div className="flex items-center justify-between gap-1">
                                          <div className="flex items-center gap-1 truncate">
                                            <AlertTriangle className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                                            <span className="truncate">
                                              {hasVariants ? `Material ambiguo (${audit.materialDomain})` : `Falta detalle (${audit.missing.join(', ')})`}
                                            </span>
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => handleEnrichItem(it.id, audit.suggestion)}
                                            className="text-[9px] font-bold bg-amber-600 hover:bg-amber-700 text-white px-1.5 py-0.5 rounded shadow-xs flex items-center gap-0.5 transition-colors cursor-pointer shrink-0"
                                            title="Completar con especificación técnica estándar"
                                          >
                                            <Sparkles className="w-2.5 h-2.5" />
                                            <span>Enriquecer</span>
                                          </button>
                                        </div>
                                        {hasVariants && (
                                          <div className="flex flex-wrap items-center gap-1 pt-0.5 border-t border-amber-200/80">
                                            <span className="text-[8px] text-amber-800 font-bold shrink-0">Opciones:</span>
                                            {audit.materialVariants.slice(0, 4).map((v, vIdx) => (
                                              <button
                                                key={vIdx}
                                                type="button"
                                                onClick={() => handleEnrichItem(it.id, v.text)}
                                                className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-white hover:bg-amber-200 text-amber-950 border border-amber-300 cursor-pointer transition-colors shadow-2xs"
                                                title={v.text}
                                              >
                                                {v.name}
                                              </button>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  }
                                  return (
                                    <div className="flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-bold text-sky-800 bg-sky-100/80 rounded w-fit border border-sky-300">
                                      <CheckCircle2 className="w-2.5 h-2.5 text-sky-600" />
                                      <span>S/C Detallada</span>
                                    </div>
                                  );
                                })()}
                              </div>
                            </td>

                            {/* UNIDAD */}
                            <td className="border border-gray-300 px-0.5 py-1">
                              <select
                                value={it.unit}
                                onChange={(e) => handleUpdateItemField(it.id, 'unit', e.target.value)}
                                className="w-full px-0.5 py-0.5 text-[10px] font-semibold text-center text-amber-950 bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 rounded cursor-pointer"
                              >
                                {COMMON_UNITS.map((u) => (
                                  <option key={u} value={u}>
                                    {u}
                                  </option>
                                ))}
                              </select>
                            </td>

                            {/* LARGO */}
                            <td className="border border-gray-300 px-1 py-1">
                              {hasPartials ? (
                                <span className="block text-center text-xs text-gray-400 font-bold select-none" title="Desglosado en parciales">—</span>
                              ) : (
                                <input
                                  type="number"
                                  step="0.01"
                                  value={it.length ?? ''}
                                  onChange={(e) => handleUpdateItemField(it.id, 'length', e.target.value)}
                                  placeholder="—"
                                  className="w-full px-1 py-1 text-xs text-right font-medium bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 rounded"
                                />
                              )}
                            </td>

                            {/* ANCHO */}
                            <td className="border border-gray-300 px-1 py-1">
                              {hasPartials ? (
                                <span className="block text-center text-xs text-gray-400 font-bold select-none" title="Desglosado en parciales">—</span>
                              ) : (
                                <input
                                  type="number"
                                  step="0.01"
                                  value={it.width ?? ''}
                                  onChange={(e) => handleUpdateItemField(it.id, 'width', e.target.value)}
                                  placeholder="—"
                                  className="w-full px-1 py-1 text-xs text-right font-medium bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 rounded"
                                />
                              )}
                            </td>

                            {/* ALTO */}
                            <td className="border border-gray-300 px-1 py-1">
                              {hasPartials ? (
                                <span className="block text-center text-xs text-gray-400 font-bold select-none" title="Desglosado en parciales">—</span>
                              ) : (
                                <input
                                  type="number"
                                  step="0.01"
                                  value={it.height ?? ''}
                                  onChange={(e) => handleUpdateItemField(it.id, 'height', e.target.value)}
                                  placeholder="—"
                                  className="w-full px-1 py-1 text-xs text-right font-medium bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 rounded"
                                />
                              )}
                            </td>

                            {/* N° DE VECES */}
                            <td className="border border-gray-300 px-1 py-1">
                              {hasPartials ? (
                                <span className="block text-center text-xs text-gray-400 font-bold select-none" title="Desglosado en parciales">—</span>
                              ) : (
                                <input
                                  type="number"
                                  step="1"
                                  min="1"
                                  value={it.times ?? 1}
                                  onChange={(e) => handleUpdateItemField(it.id, 'times', e.target.value)}
                                  className="w-full px-1 py-1 text-xs text-center font-bold bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 rounded"
                                />
                              )}
                            </td>

                            {/* FACTOR (Acero kg/m o Multiplicador) */}
                            <td className="border border-gray-300 px-1 py-1 bg-amber-50/30">
                              {hasPartials ? (
                                <span className="block text-center text-xs text-gray-400 font-bold select-none" title="Desglosado en parciales">—</span>
                              ) : (
                                <input
                                  type="number"
                                  step="0.001"
                                  value={it.factor ?? ''}
                                  onChange={(e) => handleUpdateItemField(it.id, 'factor', e.target.value)}
                                  placeholder="1.000"
                                  className="w-full px-1 py-1 text-xs text-right font-semibold text-amber-950 bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 rounded"
                                  title="Factor de peso para acero (ej: 0.994 kg/m para 1/2&quot;, 1.552 para 5/8&quot;) o factor de conversión"
                                />
                              )}
                            </td>

                            {/* DISTANCIA (Km Acarreo) */}
                            <td className="border border-gray-300 px-1 py-1 bg-amber-50/30">
                              {hasPartials ? (
                                <span className="block text-center text-xs text-gray-400 font-bold select-none" title="Desglosado en parciales">—</span>
                              ) : (
                                <input
                                  type="number"
                                  step="0.1"
                                  value={it.distance ?? ''}
                                  onChange={(e) => handleUpdateItemField(it.id, 'distance', e.target.value)}
                                  placeholder="—"
                                  className="w-full px-1 py-1 text-xs text-right font-semibold text-amber-950 bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 rounded"
                                  title="Distancia en kilómetros para partidas de transporte y acarreo (M3-KM, TON-KM)"
                                />
                              )}
                            </td>

                            {/* CANTIDAD PARCIAL */}
                            <td className="border border-gray-300 px-2 py-1 text-right font-semibold text-xs text-gray-700 bg-amber-50/30">
                              {hasPartials ? (
                                <span className="block text-center text-xs text-gray-400 font-bold select-none" title="Desglosado en parciales">—</span>
                              ) : it.partial > 0 ? (
                                Number(it.partial).toLocaleString('es-VE', { maximumFractionDigits: 3 })
                              ) : (
                                '—'
                              )}
                            </td>

                            {/* CANTIDAD TOTAL */}
                            <td className="border border-gray-300 px-1 py-1 bg-amber-100/60">
                              <input
                                type="number"
                                step="0.01"
                                value={it.quantity}
                                readOnly={hasPartials}
                                onChange={(e) => handleUpdateItemField(it.id, 'quantity', e.target.value)}
                                title={hasPartials ? "Total calculado automáticamente por la suma de parciales" : ""}
                                className={`w-full px-1.5 py-1 text-xs text-right font-extrabold text-amber-950 bg-white border border-amber-300 rounded ${
                                  hasPartials ? 'bg-amber-100/50 cursor-default select-none' : 'focus:outline-none focus:ring-1 focus:ring-amber-500'
                                }`}
                              />
                            </td>

                            {/* OBSERVACIONES */}
                            <td className="border border-gray-300 px-1 py-1">
                              <input
                                type="text"
                                value={it.observations ?? ''}
                                onChange={(e) => handleUpdateItemField(it.id, 'observations', e.target.value)}
                                placeholder="Notas, eje, ubicación..."
                                className="w-full px-2 py-1 text-xs bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 rounded"
                              />
                            </td>

                            {/* ACCIONES */}
                            <td className="border border-gray-300 px-1 py-1 text-center bg-amber-50/40">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleInsertRowBelow(it)}
                                  className="p-1 text-emerald-700 hover:text-emerald-950 hover:bg-emerald-100 rounded transition-colors cursor-pointer"
                                  title="Agregar fila debajo"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenCoveninModal(it)}
                                  className="p-1 text-sky-700 hover:text-sky-950 hover:bg-sky-100 rounded transition-colors cursor-pointer"
                                  title="Buscar y seleccionar partida según Norma COVENIN"
                                >
                                  <Search className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleTogglePartials(it.id)}
                                  disabled={isBlankTrailing}
                                  className={`p-1 rounded transition-colors cursor-pointer disabled:opacity-30 ${
                                    it.partials && it.partials.length > 0
                                      ? 'text-amber-800 bg-amber-200 hover:bg-amber-300'
                                      : 'text-amber-700 hover:text-amber-950 hover:bg-amber-100'
                                  }`}
                                  title={
                                    it.partials && it.partials.length > 0
                                      ? 'Ver/Gestionar desglose de parciales'
                                      : 'Desglosar en varios parciales / filas'
                                  }
                                >
                                  <Split className="w-3.5 h-3.5" />
                                </button>
                                {!it.cod_par && !isBlankTrailing && it.description && it.description.trim() && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const audit = auditDescription(it.description, it.cod_par, it.unit);
                                      handleEnrichItem(it.id, audit.suggestion);
                                    }}
                                    className="p-1 text-amber-700 hover:text-amber-950 hover:bg-amber-100 rounded transition-colors cursor-pointer"
                                    title="Enriquecer descripción técnica"
                                  >
                                    <Sparkles className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleDuplicateRow(it)}
                                  disabled={isBlankTrailing}
                                  className="p-1 text-amber-700 hover:text-amber-950 hover:bg-amber-200 rounded transition-colors cursor-pointer disabled:opacity-30"
                                  title="Duplicar partida"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItem(it.id)}
                                  className="p-1 text-red-600 hover:text-red-800 hover:bg-red-100 rounded transition-colors cursor-pointer"
                                  title="Eliminar partida"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                          {/* FILAS HIJAS DE SUB-PARCIALES / PAREDES EN LA TABLA */}
                          {it.partials && it.partials.length > 0 && expandedPartials[it.id] !== false && (
                            <>
                              {it.partials.map((p, pIdx) => (
                                <tr
                                  key={p.id}
                                  className="bg-amber-50/70 border-b border-amber-200 text-amber-950 text-xs hover:bg-amber-100/50"
                                >
                                  <td className="border border-amber-200 px-2 py-1 text-center font-bold text-[10px] text-amber-700 bg-amber-100/40">
                                    ↳ {pIdx + 1}
                                  </td>
                                  <td className="border border-amber-200 px-2 py-1 pl-6">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[10px] font-bold text-amber-800 shrink-0">
                                        Parcial:
                                      </span>
                                      <input
                                        type="text"
                                        value={p.description || ''}
                                        onChange={(e) =>
                                          handleUpdatePartialField(
                                            it.id,
                                            p.id,
                                            'description',
                                            e.target.value
                                          )
                                        }
                                        placeholder={`Parcial ${pIdx + 1} (ej: Fachada, Eje 1-2, Tramo A...)`}
                                        className="flex-1 px-1.5 py-0.5 text-xs font-semibold bg-white border border-amber-300 rounded focus:outline-none focus:ring-1 focus:ring-amber-500"
                                      />
                                    </div>
                                  </td>
                                  <td className="border border-amber-200 px-0.5 py-1 text-center text-[10px] font-semibold text-gray-500 bg-amber-50/30">
                                    {it.unit || 'M2'}
                                  </td>
                                  <td className="border border-amber-200 px-1 py-1">
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={p.length ?? ''}
                                      onChange={(e) =>
                                        handleUpdatePartialField(it.id, p.id, 'length', e.target.value)
                                      }
                                      placeholder="0.00"
                                      className="w-full px-1 py-0.5 text-xs text-right bg-white border border-amber-200 rounded"
                                    />
                                  </td>
                                  <td className="border border-amber-200 px-1 py-1">
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={p.width ?? ''}
                                      onChange={(e) =>
                                        handleUpdatePartialField(it.id, p.id, 'width', e.target.value)
                                      }
                                      placeholder="0.00"
                                      className="w-full px-1 py-0.5 text-xs text-right bg-white border border-amber-200 rounded"
                                    />
                                  </td>
                                  <td className="border border-amber-200 px-1 py-1">
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={p.height ?? ''}
                                      onChange={(e) =>
                                        handleUpdatePartialField(it.id, p.id, 'height', e.target.value)
                                      }
                                      placeholder="0.00"
                                      className="w-full px-1 py-0.5 text-xs text-right bg-white border border-amber-200 rounded"
                                    />
                                  </td>
                                  <td className="border border-amber-200 px-1 py-1">
                                    <input
                                      type="number"
                                      step="1"
                                      min="1"
                                      value={p.times ?? 1}
                                      onChange={(e) =>
                                        handleUpdatePartialField(it.id, p.id, 'times', e.target.value)
                                      }
                                      className="w-full px-1 py-0.5 text-xs text-center font-bold bg-white border border-amber-200 rounded"
                                    />
                                  </td>
                                  <td className="border border-amber-200 px-1 py-1 bg-amber-50/30">
                                    <input
                                      type="number"
                                      step="0.001"
                                      value={p.factor ?? ''}
                                      onChange={(e) =>
                                        handleUpdatePartialField(it.id, p.id, 'factor', e.target.value)
                                      }
                                      placeholder="1.000"
                                      className="w-full px-1 py-0.5 text-xs text-right bg-white border border-amber-200 rounded"
                                    />
                                  </td>
                                  <td className="border border-amber-200 px-1 py-1 bg-amber-50/30">
                                    <input
                                      type="number"
                                      step="0.1"
                                      value={p.distance ?? ''}
                                      onChange={(e) =>
                                        handleUpdatePartialField(it.id, p.id, 'distance', e.target.value)
                                      }
                                      placeholder="—"
                                      className="w-full px-1 py-0.5 text-xs text-right bg-white border border-amber-200 rounded"
                                    />
                                  </td>
                                  <td className="border border-amber-200 px-2 py-1 text-right font-bold text-xs text-amber-900 bg-amber-100/50">
                                    {Number(p.partial || 0).toLocaleString('es-VE', {
                                      maximumFractionDigits: 3,
                                    })}
                                  </td>
                                  <td className="border border-amber-200 px-1 py-1 text-center text-xs text-gray-400 bg-amber-50/20">
                                    —
                                  </td>
                                  <td className="border border-amber-200 px-1 py-1">
                                    <input
                                      type="text"
                                      value={p.observations ?? ''}
                                      onChange={(e) =>
                                        handleUpdatePartialField(
                                          it.id,
                                          p.id,
                                          'observations',
                                          e.target.value
                                        )
                                      }
                                      placeholder="Eje, tramo, detalle..."
                                      className="w-full px-1.5 py-0.5 text-xs bg-white border border-amber-200 rounded"
                                    />
                                  </td>
                                  <td className="border border-amber-200 px-1 py-1 text-center bg-amber-100/30">
                                    <button
                                      type="button"
                                      onClick={() => handleRemovePartial(it.id, p.id)}
                                      className="p-1 text-red-600 hover:text-red-800 hover:bg-red-100 rounded transition-colors cursor-pointer"
                                      title="Eliminar esta fila"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                              <tr className="bg-amber-100/50 border-b border-amber-300">
                                <td colSpan={13} className="px-4 py-1.5 text-xs">
                                  <div className="flex items-center justify-between">
                                    <button
                                      type="button"
                                      onClick={() => handleAddPartial(it.id)}
                                      className="text-[11px] font-bold text-amber-900 hover:text-amber-950 bg-white hover:bg-amber-50 border border-amber-300 px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-xs cursor-pointer"
                                    >
                                      <Plus className="w-3 h-3 text-amber-700" />
                                      <span>Agregar fila</span>
                                    </button>
                                    <div className="flex items-center gap-3">
                                      <span className="text-xs font-bold text-amber-950">
                                        Total parciales:{' '}
                                        <strong>
                                          {Number(it.quantity).toLocaleString('es-VE', {
                                            maximumFractionDigits: 3,
                                          })}{' '}
                                          {it.unit}
                                        </strong>
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => handleClearPartials(it.id)}
                                        className="text-[10px] text-red-600 hover:underline cursor-pointer"
                                      >
                                        Quitar desglose
                                      </button>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            </>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            )}
          </div>
        </div>
      ) : (
        /* VISTA: CHAT ASISTENTE DE CAMPO */
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-[#FEF3C7]">
          <div className="max-w-3xl mx-auto space-y-4">
            {validCount > 0 && (
              <div className="sticky top-0 z-10 p-2.5 rounded-xl bg-amber-100/95 backdrop-blur-xs border border-amber-300 flex items-center justify-between gap-2 shadow-xs">
                <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                  <Table className="w-4 h-4 text-amber-600" />
                  <strong>{validCount}</strong> partida(s) en la planilla de cómputos
                </span>
                <button
                  type="button"
                  onClick={() => setActiveTab('sheet')}
                  className="text-xs font-bold text-amber-900 bg-white hover:bg-amber-50 px-3 py-1 rounded-lg border border-amber-300 shadow-xs cursor-pointer flex items-center gap-1"
                >
                  <span>Ver Planilla de Cómputos</span>
                  <Table className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

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
                    className={`max-w-[90%] sm:max-w-[85%] ${
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
                        </div>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    )}

                    {/* Tarjeta de Cómputo Anotado en el Chat con Edición en Vivo */}
                    {msg.type === 'item_captured' && relatedItem && (
                      <div className="pt-1">
                        {editingItemId === relatedItem.id && editForm ? (
                          /* FORMULARIO DE EDICIÓN EN VIVO DENTRO DEL CHAT */
                          <div className="p-3.5 rounded-xl bg-amber-100/90 border-2 border-amber-400 space-y-3 shadow-sm">
                            <div className="flex items-center justify-between border-b border-amber-300 pb-1.5">
                              <span className="text-xs font-extrabold text-amber-950 flex items-center gap-1.5">
                                <Edit3 className="w-3.5 h-3.5 text-amber-700" />
                                Editando Cómputo
                              </span>
                              <button
                                type="button"
                                onClick={handleCancelEdit}
                                className="text-amber-800 hover:text-amber-950 text-xs font-bold cursor-pointer"
                              >
                                ✕ Cancelar
                              </button>
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold text-amber-900 mb-0.5">
                                Descripción
                              </label>
                              <input
                                type="text"
                                value={editForm.description}
                                onChange={(e) =>
                                  setEditForm((prev) => ({
                                    ...prev,
                                    description: e.target.value.toUpperCase(),
                                  }))
                                }
                                className="w-full px-2.5 py-1 text-xs font-semibold rounded-lg border border-amber-300 bg-white text-amber-950 focus:outline-none focus:border-amber-500 uppercase"
                              />
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                              <div>
                                <label className="block text-[10px] font-bold text-amber-900 mb-0.5">
                                  Largo
                                </label>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={editForm.length ?? ''}
                                  onChange={(e) => handleEditFormFieldChange('length', e.target.value)}
                                  className="w-full px-2 py-1 text-xs text-right rounded-lg border border-amber-300 bg-white font-medium"
                                  placeholder="0.00"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-amber-900 mb-0.5">
                                  Ancho
                                </label>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={editForm.width ?? ''}
                                  onChange={(e) => handleEditFormFieldChange('width', e.target.value)}
                                  className="w-full px-2 py-1 text-xs text-right rounded-lg border border-amber-300 bg-white font-medium"
                                  placeholder="0.00"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-amber-900 mb-0.5">
                                  Alto
                                </label>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={editForm.height ?? ''}
                                  onChange={(e) => handleEditFormFieldChange('height', e.target.value)}
                                  className="w-full px-2 py-1 text-xs text-right rounded-lg border border-amber-300 bg-white font-medium"
                                  placeholder="0.00"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-amber-900 mb-0.5">
                                  N° Veces
                                </label>
                                <input
                                  type="number"
                                  step="1"
                                  min="1"
                                  value={editForm.times ?? 1}
                                  onChange={(e) => handleEditFormFieldChange('times', e.target.value)}
                                  className="w-full px-2 py-1 text-xs text-center font-bold rounded-lg border border-amber-300 bg-white"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-amber-900 mb-0.5" title="Factor de peso para acero (ej: 0.994 kg/m para cabilla 1/2&quot;)">
                                  Factor (kg/m)
                                </label>
                                <input
                                  type="number"
                                  step="0.001"
                                  value={editForm.factor ?? ''}
                                  onChange={(e) => handleEditFormFieldChange('factor', e.target.value)}
                                  className="w-full px-2 py-1 text-xs text-right rounded-lg border border-amber-300 bg-white font-medium"
                                  placeholder="1.000"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-amber-900 mb-0.5" title="Distancia en kilómetros para acarreos y transportes">
                                  Distancia (km)
                                </label>
                                <input
                                  type="number"
                                  step="0.1"
                                  value={editForm.distance ?? ''}
                                  onChange={(e) => handleEditFormFieldChange('distance', e.target.value)}
                                  className="w-full px-2 py-1 text-xs text-right rounded-lg border border-amber-300 bg-white font-medium"
                                  placeholder="—"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <label className="block text-[10px] font-bold text-amber-900 mb-0.5">
                                  Parcial
                                </label>
                                <div className="px-2 py-1 text-xs text-right font-medium rounded-lg border border-amber-200 bg-amber-50 text-amber-900">
                                  {editForm.partial > 0
                                    ? Number(editForm.partial).toLocaleString('es-VE', { maximumFractionDigits: 3 })
                                    : '—'}
                                </div>
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-amber-900 mb-0.5">
                                  Total *
                                </label>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={editForm.quantity}
                                  onChange={(e) => handleEditFormFieldChange('quantity', e.target.value)}
                                  className="w-full px-2 py-1 text-xs text-right font-extrabold rounded-lg border border-amber-400 bg-white text-amber-950"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-amber-900 mb-0.5">
                                  Unidad
                                </label>
                                <select
                                  value={editForm.unit}
                                  onChange={(e) => setEditForm((prev) => ({ ...prev, unit: e.target.value }))}
                                  className="w-full px-2 py-1 text-xs font-bold rounded-lg border border-amber-300 bg-white text-amber-950 cursor-pointer"
                                >
                                  {COMMON_UNITS.map((u) => (
                                    <option key={u} value={u}>
                                      {u}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold text-amber-900 mb-0.5">
                                Observaciones
                              </label>
                              <input
                                type="text"
                                value={editForm.observations ?? ''}
                                onChange={(e) => setEditForm((prev) => ({ ...prev, observations: e.target.value }))}
                                placeholder="Eje, ubicación, detalles..."
                                className="w-full px-2.5 py-1 text-xs rounded-lg border border-amber-300 bg-white text-amber-950"
                              />
                            </div>

                            <div className="flex justify-end gap-2 pt-1">
                              <button
                                type="button"
                                onClick={handleCancelEdit}
                                className="px-3 py-1 rounded-lg border border-amber-300 text-amber-900 bg-white text-xs font-bold hover:bg-amber-50 cursor-pointer"
                              >
                                Cancelar
                              </button>
                              <button
                                type="button"
                                onClick={handleSaveEdit}
                                className="px-3.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center gap-1 shadow-sm cursor-pointer"
                              >
                                <Save className="w-3.5 h-3.5" />
                                Guardar
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* TARJETA VISIBLE CON BOTÓN EDITAR */
                          <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200 space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md bg-amber-200/80 text-amber-950">
                                {relatedItem.chapter}
                              </span>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleStartEdit(relatedItem)}
                                  className="text-xs text-amber-800 hover:text-amber-950 inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded bg-white border border-amber-300 hover:bg-amber-100 cursor-pointer"
                                  title="Editar medidas o datos de esta partida"
                                >
                                  <Edit3 className="w-3 h-3" />
                                  Editar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItem(relatedItem.id)}
                                  className="text-xs text-red-600 hover:text-red-800 inline-flex items-center gap-1 font-semibold px-2 py-0.5 cursor-pointer"
                                  title="Quitar cómputo"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  Quitar
                                </button>
                              </div>
                            </div>

                            <div>
                              <p className="text-sm font-bold text-amber-950">{relatedItem.description}</p>
                            </div>

                            {/* Desglose de dimensiones, factor y distancia si están presentes */}
                            {(relatedItem.length ||
                              relatedItem.width ||
                              relatedItem.height ||
                              (relatedItem.times && relatedItem.times > 1) ||
                              relatedItem.factor ||
                              relatedItem.distance) && (
                              <div className="flex flex-wrap gap-2 text-[11px] text-amber-900 bg-white/80 p-2 rounded-lg border border-amber-200 font-medium">
                                {relatedItem.length && <span>Largo: <strong>{relatedItem.length}</strong></span>}
                                {relatedItem.width && <span>Ancho: <strong>{relatedItem.width}</strong></span>}
                                {relatedItem.height && <span>Alto: <strong>{relatedItem.height}</strong></span>}
                                {relatedItem.times && <span>Veces: <strong>{relatedItem.times}</strong></span>}
                                {relatedItem.factor && <span>Factor: <strong>{relatedItem.factor} kg/m</strong></span>}
                                {relatedItem.distance && <span>Distancia: <strong>{relatedItem.distance} km</strong></span>}
                                {relatedItem.partial > 0 && (
                                  <span>• Parcial: <strong>{Number(relatedItem.partial).toLocaleString('es-VE', { maximumFractionDigits: 3 })}</strong></span>
                                )}
                              </div>
                            )}

                            <div className="grid grid-cols-2 gap-2 pt-1">
                              <div className="bg-white p-2 rounded-lg border border-amber-200">
                                <span className="block text-[10px] uppercase font-bold text-amber-700">
                                  Cantidad Total
                                </span>
                                <span className="text-xs font-extrabold text-amber-950">
                                  {Number(relatedItem.quantity).toLocaleString('es-VE', {
                                    maximumFractionDigits: 3,
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

                            {relatedItem.observations && (
                              <p className="text-[11px] text-amber-800 italic bg-white/60 p-1.5 rounded border border-amber-200">
                                Obs: {relatedItem.observations}
                              </p>
                            )}
                          </div>
                        )}
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

      {/* BARRA INFERIOR DE ACCIÓN (Siempre accesible en ambas vistas con botón Guardar y Generar) */}
      <div className="p-3 sm:p-4 bg-[#FEF3C7] border-t border-amber-200 shrink-0">
        <div className="max-w-4xl mx-auto space-y-2.5">
          {commitError && (
            <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
              {commitError}
            </div>
          )}

          {/* Input de Chat (solo visible cuando estamos en la pestaña Chat) */}
          {activeTab === 'chat' && (
            <div className="flex items-end gap-2">
              <textarea
                ref={textareaRef}
                rows={2}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                disabled={isCommitting}
                placeholder="Escribe Descripción, Medidas (ej: 10.50*7.50 m) y Unidad (M2)... Presiona Enter"
                className="flex-1 bg-white border-2 border-amber-300 rounded-2xl px-4 py-2.5 text-sm text-amber-950 focus:outline-none focus:border-amber-500 placeholder:text-amber-700/60 shadow-inner resize-none"
              />
              <button
                type="button"
                onClick={() => handleSendMessage()}
                disabled={!inputText.trim() || isCommitting}
                className="h-11 px-4 sm:px-5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-bold flex items-center justify-center gap-1.5 disabled:opacity-50 transition-all shadow-md shadow-amber-500/20 shrink-0 cursor-pointer"
                title="Agregar partida"
              >
                <Send className="w-4 h-4" />
                <span className="hidden sm:inline text-sm">Agregar</span>
              </button>
            </div>
          )}

          {/* Barra de Guardar Borrador y Confirmación del Presupuesto */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-amber-100/90 border border-amber-300 rounded-2xl p-2.5 shadow-xs">
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

            <div className="flex items-center gap-2">
              {/* BOTÓN GUARDAR BORRADOR (Reemplaza al anterior botón de Nueva Fila) */}
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={isCommitting}
                className="px-3.5 py-2 rounded-xl bg-white hover:bg-amber-50 border border-amber-300 text-amber-950 text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                title="Guardar borrador de la planilla para pausar y continuar después"
              >
                {saveStatus ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
                    <span className="text-emerald-700 font-extrabold">{saveStatus}</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5 text-amber-700" />
                    <span>Guardar</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleConfirmAndGenerateBudget}
                disabled={isCommitting || validCount === 0}
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
                    <span>Confirmar y Generar Presupuesto ({validCount})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
