/**
 * Fórmulas y recálculo de filas de la planilla de cómputos.
 */

import { UNIT_PATTERN, normalizeUnitStr } from './units.js';
import { getRebarSpec, isSteelRow } from './steel.js';
import { computeGeometryBase, GEOMETRY_TYPES } from './geometry.js';

function round2(val) {
  if (val === null || val === undefined || isNaN(val) || val === '') return 0;
  return Math.round(Number(val) * 100) / 100;
}

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

    const quantity = round2(val);

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
        partial = round2(length * width);
      } else if (parts.length === 3) {
        length = parts[0];
        width = parts[1];
        height = parts[2];
        partial = round2(length * width * height);
      } else if (parts.length >= 4) {
        times = parts[0];
        length = parts[1];
        width = parts[2];
        height = parts[3];
        partial = round2(length * width * height);
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

function computePartial(p, parentUnit = '') {
  if (!p) return 0;
  const parseNum = (v) => {
    if (v === '' || v == null) return null;
    const n = parseFloat(String(v).replace(',', '.'));
    return isNaN(n) ? null : n;
  };

  const normUnit = String(p.unit || parentUnit || '').trim().toUpperCase();

  // Sincronizar factor de acero si tiene diámetro de cabilla seleccionado
  if (p.rebarDiameter && (!p.factor || p.factor === '')) {
    const spec = getRebarSpec(p.rebarDiameter);
    if (spec) {
      p.factor = spec.weightKgM;
    }
  }

  const l = parseNum(p.length);
  const w = parseNum(p.width);
  const h = parseNum(p.height);
  const t = parseNum(p.times) ?? 1;
  const f = parseNum(p.factor);
  const dist = parseNum(p.distance);

  const multFactor = f !== null && f > 0 ? f : 1;
  const multDist = dist !== null && dist > 0 ? dist : 1;

  // Cálculo de acero de refuerzo (Cabillas)
  const isSteel = isSteelRow(p) || Boolean(p.rebarDiameter) || normUnit === 'KG';
  if (isSteel && l !== null && h !== null && f !== null && l > 0 && h > 0 && f > 0) {
    const unitWeight = round2(l * h * f);
    const parcial = round2(unitWeight * t);
    p.partial = parcial;
    p.formula = t > 1
      ? `${t} × (${l}m × ${h} barras × ${f} kg/m) = ${parcial} kg`
      : `(${l}m × ${h} barras × ${f} kg/m) = ${parcial} kg`;
    return parcial;
  }

  // Cálculo de figuras geométricas especiales (Cilindro, Triángulo, Trapecio, Zapata piramidal, Zanja)
  if (p.geometryType && p.geometryType !== GEOMETRY_TYPES.RECTANGLE) {
    const geomResult = computeGeometryBase(p, normUnit || 'M3');
    if (geomResult.baseGeom !== null) {
      const parcial = round2(geomResult.baseGeom * multFactor * multDist * t);
      p.partial = parcial;
      p.formula = t > 1 ? `${t} × [${geomResult.formulaStr}]` : geomResult.formulaStr;
      if (normUnit === 'M3' || (!normUnit && geomResult.baseGeom > 0)) {
        p.m3 = parcial;
        p._autoM3 = parcial;
      }
      return parcial;
    }
  }

  // Auto-calcular M3 de este tramo si tiene las 3 dimensiones físicas
  if (l !== null && w !== null && h !== null && l > 0 && w > 0 && h > 0) {
    const calcM3 = round2(l * w * h * t);
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
    const parcial = round2(baseGeom * multFactor * multDist * t);
    p.partial = parcial;

    let innerParts = [dims.map((d) => `${d}m`).join(' × ')];
    if (f !== null && f !== 1) innerParts.push(`× ${f}`);
    if (dist !== null && dist > 0) innerParts.push(`× ${dist}km`);
    const innerStr = innerParts.join(' ');
    const displayUnit = normUnit || (dims.length === 3 ? 'm³' : dims.length === 2 ? 'm²' : 'm');

    p.formula = t > 1
      ? `${t} × (${innerStr}) = ${parcial} ${displayUnit}`
      : `(${innerStr}) = ${parcial} ${displayUnit}`;

    return parcial;
  }

  // Si no hay dimensiones físicas pero hay volumen M3 directo (transporte M3-KM o botes)
  const m3Val = parseNum(p.m3);
  if (m3Val !== null && !isNaN(m3Val) && m3Val > 0) {
    const parcial = round2(m3Val * multFactor * multDist * t);
    p.partial = parcial;
    p.formula = `${t > 1 ? `${t} × ` : ''}${m3Val} m³${dist !== null && dist > 0 ? ` × ${dist}km` : ''}${f !== null && f !== 1 ? ` × ${f}` : ''} = ${parcial} ${normUnit || 'm³'}`;
    return parcial;
  }

  if (p.partial !== '' && p.partial != null) {
    const pVal = parseFloat(String(p.partial).replace(',', '.'));
    if (!isNaN(pVal)) {
      const parcial = round2(pVal * multFactor * multDist * t);
      p.formula = `${parcial} ${normUnit || ''}`.trim();
      return parcial;
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
  const total = item.partials.reduce((sum, p) => sum + computePartial(p, item.unit), 0);
  const roundedTotal = round2(total);

  // Suma de M3 para botes y acarreo a partir de los parciales
  const totalM3 = item.partials.reduce((sum, p) => {
    const val = parseFloat(String(p.m3).replace(',', '.'));
    return sum + (!isNaN(val) && val > 0 ? val : 0);
  }, 0);
  const roundedM3 = totalM3 > 0 ? round2(totalM3) : (item.m3 || '');

  const partialSummary = item.partials.length <= 4
    ? item.partials.map((p) => `${p.partial || 0}`).join(' + ') + ` = ${roundedTotal} ${item.unit || ''}`
    : `Σ (${item.partials.length} parciales) = ${roundedTotal} ${item.unit || ''}`;

  return {
    ...item,
    quantity: roundedTotal,
    partial: 0,
    m3: roundedM3,
    formula: partialSummary,
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

  // Sincronizar factor de acero automáticamente al cambiar diámetro de cabilla
  if (field === 'rebarDiameter') {
    updated.rebarDiameter = value;
    const spec = getRebarSpec(value);
    if (spec) {
      updated.factor = spec.weightKgM;
    }
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
    const divisor = t;
    updated.partial = divisor > 0 ? round2(qVal / divisor) : round2(qVal);
    if (updated.unit === 'M3' && (updated.m3 === '' || updated.m3 == null || updated._autoM3 === updated.m3)) {
      updated.m3 = qVal;
      updated._autoM3 = qVal;
    }
    return updated;
  }

  // Cálculo de acero de refuerzo (Cabillas)
  const isSteel = isSteelRow(updated) || Boolean(updated.rebarDiameter) || updated.unit === 'KG';
  if (isSteel && l !== null && h !== null && f !== null && l > 0 && h > 0 && f > 0) {
    const unitWeight = round2(l * h * f);
    const total = round2(unitWeight * t);
    updated.partial = unitWeight;
    updated.quantity = total;
    updated.formula = t > 1
      ? `${t} × (${l}m × ${h} barras × ${f} kg/m) = ${total} kg`
      : `(${l}m × ${h} barras × ${f} kg/m) = ${total} kg`;
    return updated;
  }

  // Cálculo de figuras geométricas especiales (Cilindro, Triángulo, Zapata piramidal, Zanja)
  if (updated.geometryType && updated.geometryType !== GEOMETRY_TYPES.RECTANGLE) {
    const geomResult = computeGeometryBase(updated, updated.unit);
    if (geomResult.baseGeom !== null) {
      const parcial = round2(geomResult.baseGeom * multFactor * multDist);
      const total = round2(parcial * t);
      updated.partial = parcial;
      updated.quantity = total;
      updated.formula = t > 1 ? `${t} × [${geomResult.formulaStr}]` : geomResult.formulaStr;
      if (updated.unit === 'M3') {
        updated.m3 = total;
        updated._autoM3 = total;
      }
      return updated;
    }
  }

  const dims = [];
  if (l !== null && !isNaN(l) && l > 0) dims.push(l);
  if (w !== null && !isNaN(w) && w > 0) dims.push(w);
  if (h !== null && !isNaN(h) && h > 0) dims.push(h);

  if (dims.length > 0) {
    const baseGeom = dims.reduce((acc, curr) => acc * curr, 1);
    
    // Parcial = base geométrica * Factor * Distancia (para 1 vez)
    const parcial = round2(baseGeom * multFactor * multDist);
    
    // Total = Parcial * N° Veces
    const total = round2(parcial * t);

    updated.partial = parcial;
    updated.quantity = total;

    // Auto-cálculo de M3 para botes y acarreo cuando se tienen las 3 dimensiones (Largo × Ancho × Alto)
    if (l !== null && w !== null && h !== null && l > 0 && w > 0 && h > 0) {
      const calcM3 = round2(l * w * h * t);
      if (updated.m3 === '' || updated.m3 == null || updated._autoM3 === updated.m3) {
        updated.m3 = calcM3;
        updated._autoM3 = calcM3;
      }
    } else if (updated.unit === 'M3' && (updated.m3 === '' || updated.m3 == null || updated._autoM3 === updated.m3)) {
      updated.m3 = total;
      updated._autoM3 = total;
    }

    // Actualizar fórmula visible con parámetros numéricos explícitos
    let innerParts = [dims.map((d) => `${d}m`).join(' × ')];
    if (f !== null && f !== 1) innerParts.push(`× ${f}`);
    if (dist !== null && dist > 0) innerParts.push(`× ${dist}km`);
    const innerStr = innerParts.join(' ');
    const displayUnit = updated.unit || (dims.length === 3 ? 'm³' : dims.length === 2 ? 'm²' : 'm');

    updated.formula = t > 1
      ? `${t} × (${innerStr}) = ${total} ${displayUnit}`
      : `(${innerStr}) = ${total} ${displayUnit}`;
  } else if (m3Val !== null && !isNaN(m3Val) && m3Val > 0) {
    // Si no hay dimensiones pero hay volumen M3 directo (ej. transporte M3-KM o botes)
    // Parcial = volumen M3 * Factor * Distancia (para 1 vez)
    const parcial = round2(m3Val * multFactor * multDist);
    
    // Total = Parcial * N° Veces
    const total = round2(parcial * t);

    updated.partial = parcial;
    updated.quantity = total;

    updated.formula = `${t > 1 ? `${t} × ` : ''}${m3Val} m³${dist !== null && dist > 0 ? ` × ${dist}km` : ''}${f !== null && f !== 1 ? ` × ${f}` : ''} = ${total} ${updated.unit || 'm³'}`;
  } else if (field === 'partial') {
    const pVal = Math.max(0, parseFloat(String(value).replace(',', '.')) || 0);
    updated.partial = pVal;
    updated.quantity = round2(pVal * t);
    if (updated.unit === 'M3' && (updated.m3 === '' || updated.m3 == null || updated._autoM3 === updated.m3)) {
      updated.m3 = updated.quantity;
      updated._autoM3 = updated.quantity;
    }
  } else {
    // Si no hay dimensiones ni M3 pero se modifica Factor, Distancia o Veces sobre una cantidad base
    const currentBase = updated.partial > 0 ? updated.partial : (parseFloat(String(updated.quantity).replace(',', '.')) || 0);
    if (currentBase > 0) {
      const parcial = round2(currentBase * multFactor * multDist);
      const total = round2(parcial * t);
      updated.partial = parcial;
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
 * Limpia anotaciones internas o desgloses obsoletos de la fórmula para presentación visual limpia.
 * Ejemplo: "4m × 1m × 0.5m = 2m³ [Exc: 2m³ | Cama: 0m³ | Relleno: 2m³]" -> "4m × 1m × 0.5m = 2m³"
 */
function cleanFormulaDisplay(formula) {
  if (!formula || typeof formula !== 'string') return '';
  return formula.replace(/\s*\[(?:Exc|Excavaci[oó]n):[^\]]*\]/gi, '').trim();
}

/**
 * Genera una nueva fila vacía estándar
 */

export {
  round2,
  cleanFormulaDisplay,
  evaluateMeasurementFormula,
  computePartial,
  recomputeItemWithPartials,
  recomputeRow,
};
