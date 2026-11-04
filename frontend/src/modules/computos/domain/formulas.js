/**
 * Fórmulas y recálculo de filas de la planilla de cómputos.
 */

import { UNIT_PATTERN, normalizeUnitStr } from './units.js';

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

function computePartial(p) {
  if (!p) return 0;
  const parseNum = (v) => {
    if (v === '' || v == null) return null;
    const n = parseFloat(String(v).replace(',', '.'));
    return isNaN(n) ? null : n;
  };
  const l = parseNum(p.length);
  const w = parseNum(p.width);
  const h = parseNum(p.height);
  const t = parseNum(p.times) ?? 1;
  const f = parseNum(p.factor);
  const dist = parseNum(p.distance);

  const multFactor = f !== null && f > 0 ? f : 1;
  const multDist = dist !== null && dist > 0 ? dist : 1;

  // Auto-calcular M3 de este tramo si tiene las 3 dimensiones físicas
  if (l !== null && w !== null && h !== null && l > 0 && w > 0 && h > 0) {
    const calcM3 = Math.round(l * w * h * t * 1000) / 1000;
    if (p.m3 === '' || p.m3 == null || p._autoM3 === p.m3) {
      p.m3 = calcM3;
      p._autoM3 = calcM3;
    }
  }

  const dims = [];
  if (l !== null && !isNaN(l) && l > 0) dims.push(l);
  if (w !== null && !isNaN(w) && w > 0) dims.push(w);
  if (h !== null && !isNaN(h) && h > 0) dims.push(h);

  if (dims.length > 0) {
    const baseGeom = dims.reduce((acc, curr) => acc * curr, 1);
    return Math.round(baseGeom * multFactor * multDist * t * 10000) / 10000;
  }

  // Si no hay dimensiones físicas pero hay volumen M3 directo (transporte M3-KM o botes)
  const m3Val = parseNum(p.m3);
  if (m3Val !== null && !isNaN(m3Val) && m3Val > 0) {
    return Math.round(m3Val * multFactor * multDist * t * 10000) / 10000;
  }

  if (p.partial !== '' && p.partial != null) {
    const pVal = parseFloat(String(p.partial).replace(',', '.'));
    if (!isNaN(pVal)) {
      return Math.round(pVal * multFactor * multDist * t * 10000) / 10000;
    }
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

  // Suma de M3 para botes y acarreo a partir de los parciales
  const totalM3 = item.partials.reduce((sum, p) => {
    const val = parseFloat(String(p.m3).replace(',', '.'));
    return sum + (!isNaN(val) && val > 0 ? val : 0);
  }, 0);
  const roundedM3 = totalM3 > 0 ? Math.round(totalM3 * 1000) / 1000 : (item.m3 || '');

  return {
    ...item,
    quantity: roundedTotal,
    partial: 0,
    m3: roundedM3,
    length: '',
    width: '',
    height: '',
    factor: '',
    distance: '',
  };
}

/**
 * Recalcula dinámicamente las dimensiones, factor de acero, distancia de acarreo
 * y volumen en M3 (botes y acarreo) según el estándar completo de la Planilla de Cómputos Métricos.
 */

function recomputeRow(row, field, value) {
  const updated = { ...row, [field]: value };

  if (field === 'description' || field === 'chapter' || field === 'observations') {
    return updated;
  }

  // Modificación manual directa de la columna M3 (Botes y Acarreo)
  if (field === 'm3') {
    const parsedM3 = value === '' || value == null ? '' : (parseFloat(String(value).replace(',', '.')) || value);
    updated.m3 = parsedM3;
    updated._autoM3 = null;
  }

  // Si la partida tiene parciales (paredes/tramos), su cantidad total está gobernada por la suma de parciales
  if (updated.partials && updated.partials.length > 0) {
    return recomputeItemWithPartials(updated);
  }

  const parseNum = (v) => {
    if (v === '' || v == null) return null;
    const n = parseFloat(String(v).replace(',', '.'));
    return isNaN(n) ? null : n;
  };

  const l = parseNum(updated.length);
  const w = parseNum(updated.width);
  const h = parseNum(updated.height);
  const t = Math.max(1, parseNum(updated.times) || 1);
  const f = parseNum(updated.factor);
  const dist = parseNum(updated.distance);
  const m3Val = parseNum(updated.m3);

  const multFactor = f !== null && f > 0 ? f : 1;
  const multDist = dist !== null && dist > 0 ? dist : 1;

  if (field === 'quantity') {
    const qVal = Math.max(0, parseFloat(String(value).replace(',', '.')) || 0);
    updated.quantity = qVal;
    const divisor = t * multDist;
    updated.partial = divisor > 0 ? Math.round((qVal / divisor) * 10000) / 10000 : qVal;
    if (updated.unit === 'M3' && (updated.m3 === '' || updated.m3 == null || updated._autoM3 === updated.m3)) {
      updated.m3 = qVal;
      updated._autoM3 = qVal;
    }
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

    // Auto-cálculo de M3 para botes y acarreo cuando se tienen las 3 dimensiones (Largo × Ancho × Alto)
    if (l !== null && w !== null && h !== null && l > 0 && w > 0 && h > 0) {
      const calcM3 = Math.round(l * w * h * t * 1000) / 1000;
      if (updated.m3 === '' || updated.m3 == null || updated._autoM3 === updated.m3) {
        updated.m3 = calcM3;
        updated._autoM3 = calcM3;
      }
    } else if (updated.unit === 'M3' && (updated.m3 === '' || updated.m3 == null || updated._autoM3 === updated.m3)) {
      updated.m3 = total;
      updated._autoM3 = total;
    }

    // Actualizar fórmula visible
    let formulaParts = [];
    if (t > 1) formulaParts.push(`${t} ×`);
    const dimsStr = dims.map((d) => String(d)).join(' × ');
    formulaParts.push(dimsStr);
    if (f !== null) formulaParts.push(`× ${f}`);
    if (dist !== null) formulaParts.push(`× ${dist}km`);
    updated.formula = formulaParts.join(' ');
  } else if (m3Val !== null && !isNaN(m3Val) && m3Val > 0) {
    // Si no hay dimensiones pero hay volumen M3 directo (ej. transporte M3-KM o botes)
    // Parcial = volumen M3 * Factor
    const parcial = Math.round(m3Val * multFactor * 10000) / 10000;
    
    // Total = Parcial * N° Veces * Distancia (M3 * km para transporte)
    const total = Math.round(parcial * t * multDist * 10000) / 10000;

    updated.partial = parcial;
    updated.quantity = total;

    let formulaParts = [];
    if (t > 1) formulaParts.push(`${t} ×`);
    formulaParts.push(`${m3Val} m³`);
    if (f !== null) formulaParts.push(`× ${f}`);
    if (dist !== null) formulaParts.push(`× ${dist}km`);
    updated.formula = formulaParts.join(' ');
  } else if (field === 'partial') {
    const pVal = Math.max(0, parseFloat(String(value).replace(',', '.')) || 0);
    updated.partial = pVal;
    updated.quantity = Math.round(pVal * t * multDist * 10000) / 10000;
    if (updated.unit === 'M3' && (updated.m3 === '' || updated.m3 == null || updated._autoM3 === updated.m3)) {
      updated.m3 = updated.quantity;
      updated._autoM3 = updated.quantity;
    }
  } else {
    // Si no hay dimensiones ni M3 pero se modifica Factor, Distancia o Veces sobre una cantidad base
    const currentBase = updated.partial > 0 ? updated.partial : (parseFloat(String(updated.quantity).replace(',', '.')) || 0);
    if (currentBase > 0) {
      const total = Math.round(currentBase * t * multFactor * multDist * 10000) / 10000;
      updated.quantity = total;
      if (updated.unit === 'M3' && (updated.m3 === '' || updated.m3 == null || updated._autoM3 === updated.m3)) {
        updated.m3 = total;
        updated._autoM3 = total;
      }
    }
  }

  return updated;
}

/**
 * Genera una nueva fila vacía estándar
 */

export {
  evaluateMeasurementFormula,
  computePartial,
  recomputeItemWithPartials,
  recomputeRow,
};
