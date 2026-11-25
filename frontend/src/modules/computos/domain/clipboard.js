/**
 * Módulo de Copiar y Pegar para la Planilla de Cómputos Métricos.
 * 
 * Permite:
 * 1. Sombrear/seleccionar filas en una planilla y copiarlas (TSV + JSON de alta fidelidad).
 * 2. Pegar directamente desde Excel, Google Sheets u otra planilla con detección
 *    inteligente de columnas, unidades normalizadas, transportes (M3-KM) y recálculo automático.
 */

import { COMMON_UNITS, UNIT_ALIASES, normalizeUnitStr, inferUnitFromDescription } from './units.js';
import { recomputeRow, recomputeItemWithPartials, round2 } from './formulas.js';
import { createBlankRow, isItemEmpty } from './rows.js';

export const KOSTOS360_CLIPBOARD_KEY = 'kostos360_computos_clipboard_v1';

export function isRecognizedUnit(val) {
  if (!val) return false;
  const key = String(val).trim().toLowerCase();
  const cleanDash = key.replace(/[\s.\-xX×/]+/g, '-');
  return Boolean(
    UNIT_ALIASES[key] ||
    UNIT_ALIASES[cleanDash] ||
    COMMON_UNITS.includes(key.toUpperCase())
  );
}

/**
 * Limpia celdas numéricas soportando formato latino (1.250,50 o 12,50) y anglosajón (1,250.50 o 12.50)
 */
export function cleanNumericCell(val) {
  if (val === null || val === undefined) return '';
  const s = String(val).trim();
  if (!s || s === '—' || s === '-' || s === 'N/A' || s === 'n/a') return '';

  // Formato latino con miles por punto y decimales por coma: "1.250,50" -> "1250.50"
  if (/^-?\d{1,3}(?:\.\d{3})+,\d+$/.test(s)) {
    return s.replace(/\./g, '').replace(',', '.');
  }

  // Formato anglosajón con miles por coma y decimales por punto: "1,250.50" -> "1250.50"
  if (/^-?\d{1,3}(?:,\d{3})+\.\d+$/.test(s)) {
    return s.replace(/,/g, '');
  }

  // Simple decimal latino: "12,50" -> "12.50"
  if (/^-?\d+,\d+$/.test(s)) {
    return s.replace(',', '.');
  }

  // Decimal estándar o entero: "12.50" o "12"
  if (/^-?\d+(?:\.\d+)?$/.test(s)) {
    return s;
  }

  return s;
}

/**
 * Serializa filas seleccionadas a formato TSV compatible con Excel y Google Sheets
 */
export function serializeRowsToTsv(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return '';

  const headers = [
    'ITEM',
    'DESCRIPCIÓN',
    'UND',
    'LARGO',
    'ANCHO',
    'ALTO',
    'VECES',
    'FACTOR',
    'DISTANCIA',
    'M3',
    'TOTAL',
    'OBSERVACIONES',
  ];

  const lines = [headers.join('\t')];

  rows.forEach((r, idx) => {
    if (isItemEmpty(r)) return;

    const itemNum = r.cod_par || r.itemNumber || idx + 1;
    const desc = (r.description || '').replace(/[\t\r\n]+/g, ' ').trim();
    const unit = (r.unit || 'UND').toUpperCase();
    const length = r.length ?? '';
    const width = r.width ?? '';
    const height = r.height ?? '';
    const times = r.times ?? 1;
    const factor = r.factor ?? '';
    const distance = r.distance ?? '';
    const m3 = r.m3 ?? '';
    const total = r.quantity ?? 0;
    const obs = (r.observations || '').replace(/[\t\r\n]+/g, ' ').trim();

    lines.push([
      itemNum,
      desc,
      unit,
      length,
      width,
      height,
      times,
      factor,
      distance,
      m3,
      total,
      obs,
    ].join('\t'));

    // Incluir parciales si existen como sub-filas tabuladas
    if (Array.isArray(r.partials) && r.partials.length > 0) {
      r.partials.forEach((p, pIdx) => {
        const pDesc = `↳ ${(p.description || p.name || `Parcial ${pIdx + 1}`).replace(/[\t\r\n]+/g, ' ').trim()}`;
        lines.push([
          `${itemNum}.${pIdx + 1}`,
          pDesc,
          unit,
          p.length ?? '',
          p.width ?? '',
          p.height ?? '',
          p.times ?? 1,
          p.factor ?? '',
          p.distance ?? '',
          p.m3 ?? '',
          p.partial ?? 0,
          (p.observations || '').replace(/[\t\r\n]+/g, ' ').trim(),
        ].join('\t'));
      });
    }
  });

  return lines.join('\n');
}

/**
 * Copia filas seleccionadas tanto al portapapeles del sistema (TSV) como al almacenamiento local (JSON)
 */
export async function copyRowsToClipboard(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { count: 0, success: false };
  }

  const validRows = rows.filter((r) => !isItemEmpty(r));
  if (validRows.length === 0) {
    return { count: 0, success: false };
  }

  const tsvText = serializeRowsToTsv(validRows);

  // 1. Guardar en portapapeles del navegador
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(tsvText);
    }
  } catch (_e) {
    // Si falla el acceso directo a navigator.clipboard, recurrimos a textarea temporal
    try {
      const textarea = document.createElement('textarea');
      textarea.value = tsvText;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    } catch (_err) {
      // ignore
    }
  }

  // 2. Guardar JSON de alta fidelidad en localStorage para transferencia interna perfecta
  try {
    const payload = {
      type: 'KOSTOS360_COMPUTOS_ROWS',
      version: 1,
      copiedAt: new Date().toISOString(),
      rows: validRows,
    };
    localStorage.setItem(KOSTOS360_CLIPBOARD_KEY, JSON.stringify(payload));
  } catch (_e) {
    // ignore
  }

  return { count: validRows.length, success: true, text: tsvText };
}

/**
 * Detecta si una fila de texto corresponde a encabezados de tabla de planilla
 */
function isHeaderRow(cells) {
  if (!Array.isArray(cells) || cells.length === 0) return false;
  const headerKeywords = [
    'item', 'nro', 'n°', 'num', 'código', 'codigo', 'cod', 'cod_par', 'covenin',
    'partida', 'descripción', 'descripcion', 'detalle', 'concepto',
    'und', 'unidad', 'u', 'medida',
    'largo', 'longitud', 'ancho', 'alto', 'altura', 'espesor', 'profundidad',
    'veces', 'factor', 'peso', 'distancia', 'dist', 'km', 'm3', 'total', 'cantidad', 'observaciones', 'obs'
  ];
  let matches = 0;
  for (const c of cells) {
    const clean = String(c).trim().toLowerCase();
    if (headerKeywords.some((k) => clean === k || clean.startsWith(k))) {
      matches += 1;
    }
  }
  return matches >= 2;
}

/**
 * Construye mapa de índices de columnas a partir de la fila de encabezados
 */
function buildHeaderMap(cells) {
  const map = {};
  cells.forEach((cell, idx) => {
    const c = String(cell).trim().toLowerCase();
    if (/^(?:item|nro|n°|num|n)$/i.test(c)) map.itemNum = idx;
    else if (/^(?:c[oó]digo|cod|cod_par|covenin)$/i.test(c)) map.code = idx;
    else if (/^(?:descripci[oó]n|descripcion|partida|detalle|concepto)$/i.test(c)) map.description = idx;
    else if (/^(?:und|unidad|u|medida)$/i.test(c)) map.unit = idx;
    else if (/^(?:largo|longitud|l)$/i.test(c)) map.length = idx;
    else if (/^(?:ancho|a)$/i.test(c)) map.width = idx;
    else if (/^(?:alto|altura|h|espesor|profundidad)$/i.test(c)) map.height = idx;
    else if (/^(?:veces|n[o°]?\s*veces|nro\s*veces|cant|repeticiones|piezas)$/i.test(c)) map.times = idx;
    else if (/^(?:factor|peso|kg\/m)$/i.test(c)) map.factor = idx;
    else if (/^(?:distancia|dist|dist\.|km|dist\s*km)$/i.test(c)) map.distance = idx;
    else if (/^(?:m3|volumen|vol|bote|m3\s*bote)$/i.test(c)) map.m3 = idx;
    else if (/^(?:total|cantidad|parcial|cant\.\s*total)$/i.test(c)) map.total = idx;
    else if (/^(?:obs|observaci[oó]n|observaciones|notas?)$/i.test(c)) map.observations = idx;
  });
  return map;
}

/**
 * Infiere la asignación de columnas cuando se copian datos sin encabezados (posicional inteligente)
 */
function inferPositionalMap(firstRowCells) {
  const len = firstRowCells.length;
  const isUnit = (val) => isRecognizedUnit(val);

  const isNumeric = (val) => {
    if (!val) return false;
    const clean = cleanNumericCell(val);
    return !isNaN(parseFloat(clean));
  };

  // Buscar en qué columna está la unidad (usualmente col 1 o col 2)
  let unitCol = -1;
  for (let i = 0; i < Math.min(len, 4); i++) {
    if (isUnit(firstRowCells[i])) {
      unitCol = i;
      break;
    }
  }

  // Si la unidad está en la columna 2: [Item, Descripción, Und, Largo, Ancho, Alto, ...]
  if (unitCol === 2) {
    return {
      itemNum: 0,
      description: 1,
      unit: 2,
      length: 3,
      width: 4,
      height: 5,
      times: 6,
      factor: 7,
      distance: 8,
      m3: 9,
      total: 10,
      observations: 11,
    };
  }

  // Si la unidad está en la columna 1: [Descripción, Und, Largo, Ancho, Alto, ...]
  if (unitCol === 1) {
    return {
      description: 0,
      unit: 1,
      length: 2,
      width: 3,
      height: 4,
      times: 5,
      factor: 6,
      distance: 7,
      m3: 8,
      total: 9,
      observations: 10,
    };
  }

  // Caso genérico estándar (12 columnas)
  if (len >= 11) {
    return {
      itemNum: 0,
      description: 1,
      unit: 2,
      length: 3,
      width: 4,
      height: 5,
      times: 6,
      factor: 7,
      distance: 8,
      m3: 9,
      total: 10,
      observations: 11,
    };
  }

  // Caso compacto (8 columnas): [Descripción, Und, Largo, Ancho, Alto, Veces, Factor, Total]
  if (len >= 7) {
    return {
      description: 0,
      unit: 1,
      length: 2,
      width: 3,
      height: 4,
      times: 5,
      factor: 6,
      total: 7,
    };
  }

  // Caso mínimo (5 columnas): [Descripción, Und, Largo, Ancho, Alto]
  return {
    description: 0,
    unit: 1,
    length: 2,
    width: 3,
    height: 4,
  };
}

/**
 * Parsea texto de portapapeles proveniente de Excel, Google Sheets o Kostos360
 */
export function parseTabularComputosClipboard(text, defaultChapter = 'GENERAL') {
  if (!text || typeof text !== 'string') {
    return { rows: [], chapter: defaultChapter };
  }

  const trimmed = text.trim();

  // 1. Verificar si es JSON de alta fidelidad copiado desde Kostos360
  if (trimmed.startsWith('{') && trimmed.includes('KOSTOS360_COMPUTOS_ROWS')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed.rows) && parsed.rows.length > 0) {
        const recomputed = parsed.rows.map((r, idx) => ({
          ...r,
          id: `item-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
          chapter: r.chapter || defaultChapter,
        }));
        return { rows: recomputed, chapter: recomputed[0]?.chapter || defaultChapter };
      }
    } catch (_e) {
      // Fallback a parser tabular si falla JSON
    }
  }

  // 2. Parser para tablas HTML copiadas desde Excel web, Google Sheets o páginas
  if (/<tr[\s>]/i.test(trimmed) && /<(?:td|th)[\s>]/i.test(trimmed)) {
    try {
      const rowMatches = trimmed.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi);
      if (rowMatches && rowMatches.length > 0) {
        const tsvLines = rowMatches.map((tr) => {
          const cellMatches = tr.match(/<(?:td|th)[^>]*>([\s\S]*?)<\/(?:td|th)>/gi) || [];
          return cellMatches
            .map((cell) => cell.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim())
            .join('\t');
        });
        return parseTabularComputosClipboard(tsvLines.join('\n'), defaultChapter);
      }
    } catch (_e) {
      // Fallback a parser de texto plano
    }
  }

  // 3. Parser tabular (TSV / CSV / Excel)
  const lines = trimmed.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) {
    return { rows: [], chapter: defaultChapter };
  }

  // Detectar delimitador (tabulador \t preferente para Excel/Sheets, o punto y coma ;)
  let delimiter = '\t';
  if (!lines[0].includes('\t') && lines[0].includes(';')) {
    delimiter = ';';
  }

  const rawGrid = lines.map((line) => line.split(delimiter).map((c) => c.trim()));
  if (rawGrid.length === 0) {
    return { rows: [], chapter: defaultChapter };
  }

  let startIndex = 0;
  let colMap = null;

  // Comprobar si la primera línea contiene encabezados
  if (isHeaderRow(rawGrid[0])) {
    colMap = buildHeaderMap(rawGrid[0]);
    startIndex = 1;
  } else {
    colMap = inferPositionalMap(rawGrid[0]);
    startIndex = 0;
  }

  const parsedRows = [];
  let currentChapter = defaultChapter;

  for (let i = startIndex; i < rawGrid.length; i++) {
    const cells = rawGrid[i];
    if (cells.length === 0 || cells.every((c) => !c)) continue;

    // Detectar si la fila es un encabezado de capítulo (ej: "CAPÍTULO I: MOVIMIENTO DE TIERRA")
    const joinedLine = cells.join(' ').trim();
    if (/^(?:cap[ií]tulo|cap\.)\s*[\w\d.\-:]*\s*(.*)/i.test(joinedLine)) {
      currentChapter = joinedLine.toUpperCase();
      continue;
    }

    const getVal = (colKey) => {
      const idx = colMap[colKey];
      return idx !== undefined && idx < cells.length ? cells[idx] : '';
    };

    const descRaw = getVal('description') || '';
    if (!descRaw && !getVal('length') && !getVal('width') && !getVal('height') && !getVal('m3')) {
      continue;
    }

    const itemNum = getVal('itemNum') || getVal('code') || '';
    const unitRaw = getVal('unit') || '';
    const normUnit = normalizeUnitStr(unitRaw) || inferUnitFromDescription(descRaw);

    const length = cleanNumericCell(getVal('length'));
    const width = cleanNumericCell(getVal('width'));
    const height = cleanNumericCell(getVal('height'));
    const timesRaw = cleanNumericCell(getVal('times'));
    const times = timesRaw !== '' && !isNaN(parseFloat(timesRaw)) ? parseFloat(timesRaw) : 1;
    const factor = cleanNumericCell(getVal('factor'));
    const distance = cleanNumericCell(getVal('distance'));
    const m3 = cleanNumericCell(getVal('m3'));
    const obs = getVal('observations') || '';

    // Detectar si esta línea corresponde a un parcial / tramo subordinado
    const isSubPartial =
      /^(?:↳|\s*[-*•])\s*(.*)/.test(descRaw) ||
      /^(?:parcial\s*\d+|tramo\s*\d+|pared\s*\d+|viene\s*de)/i.test(descRaw) ||
      /^\d+\.\d+$/.test(String(itemNum).trim());

    if (isSubPartial && parsedRows.length > 0) {
      const parentRow = parsedRows[parsedRows.length - 1];
      const cleanDesc = descRaw.replace(/^[↳\s*-•]+/, '').trim();
      const isM3OrTransport =
        parentRow.unit === 'M3' ||
        parentRow.unit === 'M3-KM' ||
        parentRow.unit === 'M3-M' ||
        parentRow.unit === 'M3X50' ||
        parentRow.unit === 'TON-KM';

      const partialObj = {
        id: `part-${Date.now()}-${i}`,
        description: cleanDesc,
        length,
        width,
        height,
        times,
        factor,
        distance,
        m3: isM3OrTransport ? m3 : '',
        observations: obs,
      };

      if (!Array.isArray(parentRow.partials)) {
        parentRow.partials = [];
      }
      parentRow.partials.push(partialObj);
      parsedRows[parsedRows.length - 1] = recomputeItemWithPartials(parentRow);
      continue;
    }

    const isM3OrTransport =
      normUnit === 'M3' ||
      normUnit === 'M3-KM' ||
      normUnit === 'M3-M' ||
      normUnit === 'M3X50' ||
      normUnit === 'TON-KM';

    // Crear base de fila
    const blank = createBlankRow(currentChapter);
    let row = {
      ...blank,
      id: `item-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
      cod_par: itemNum,
      cov_par: itemNum,
      chapter: currentChapter,
      description: descRaw.toUpperCase(),
      unit: normUnit,
      length,
      width,
      height,
      times,
      factor,
      distance,
      m3: isM3OrTransport ? m3 : '',
      observations: obs,
    };

    // Recalcular dimensiones y fórmulas
    row = recomputeRow(row, 'unit', normUnit);

    parsedRows.push(row);
  }

  return { rows: parsedRows, chapter: currentChapter };
}
