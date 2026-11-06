/**
 * Módulo de Cómputos Vinculados (Partidas Derivadas / Efecto Cascada).
 * Permite relacionar matemáticamente partidas donde el resultado de una
 * gobierna reactivamente el cálculo de la otra (ej: Excavación -> Bote de escombros).
 */

import { round2 } from './formulas.js';

export const LINK_TEMPLATES = [
  {
    id: 'bote_escombros',
    name: 'Bote de tierra y escombros (con esponjamiento)',
    targetDescription: 'TRANSPORTE Y BOTE DE MATERIAL PROVENIENTE DE EXCAVACIONES O DEMOLICIONES',
    targetUnit: 'M3-KM',
    defaultFactor: 1.25,
    defaultDistance: 5.0,
    hasDistance: true,
    factorLabel: 'Factor de Esponjamiento',
    appliesTo: (item) => {
      const u = String(item?.unit || '').toUpperCase();
      const d = String(item?.description || '').toUpperCase();
      return (
        u === 'M3' ||
        /\b(EXCAVACION|EXCAVACIÓN|ZANJA|ZANJAS|DEMOLICION|DEMOLICIÓN|MOVIMIENTO DE TIERRA|BOTE)\b/.test(d)
      );
    },
  },
  {
    id: 'friso_2caras',
    name: 'Friso liso en paredes (ambas caras × 2)',
    targetDescription: 'FRISO ACABADO LISO SOBRE PAREDES INTERIORES Y EXTERIORES (DOS CARAS)',
    targetUnit: 'M2',
    defaultFactor: 2.0,
    defaultDistance: null,
    hasDistance: false,
    factorLabel: 'Multiplicador de Caras (×2)',
    appliesTo: (item) => {
      const u = String(item?.unit || '').toUpperCase();
      const d = String(item?.description || '').toUpperCase();
      return (
        u === 'M2' &&
        /\b(PARED|PAREDES|BLOQUE|BLOQUES|LADRILLO|TABIQUE|MAMPOSTERIA|MAMPOSTERÍA)\b/.test(d)
      );
    },
  },
  {
    id: 'friso_1cara',
    name: 'Friso liso en paredes (una cara × 1)',
    targetDescription: 'FRISO ACABADO LISO SOBRE PAREDES (UNA SOLA CARA)',
    targetUnit: 'M2',
    defaultFactor: 1.0,
    defaultDistance: null,
    hasDistance: false,
    factorLabel: 'Multiplicador de Caras (×1)',
    appliesTo: (item) => {
      const u = String(item?.unit || '').toUpperCase();
      const d = String(item?.description || '').toUpperCase();
      return (
        u === 'M2' &&
        /\b(PARED|PAREDES|BLOQUE|BLOQUES|LADRILLO|TABIQUE|MAMPOSTERIA|MAMPOSTERÍA)\b/.test(d)
      );
    },
  },
  {
    id: 'pintura_paredes',
    name: 'Pintura de caucho sobre paredes frisadas',
    targetDescription: 'PINTURA DE CAUCHO INTERIOR / EXTERIOR A DOS MANOS SOBRE PAREDES',
    targetUnit: 'M2',
    defaultFactor: 1.0,
    defaultDistance: null,
    hasDistance: false,
    factorLabel: 'Multiplicador de Área',
    appliesTo: (item) => {
      const u = String(item?.unit || '').toUpperCase();
      const d = String(item?.description || '').toUpperCase();
      return (
        u === 'M2' &&
        /\b(FRISO|PARED|PAREDES|ENLUCIDO|REVOQUE)\b/.test(d)
      );
    },
  },
  {
    id: 'encofrado_vigas',
    name: 'Encofrado de madera en vigas y columnas',
    targetDescription: 'ENCOFRADO DE MADERA TIPO RECTO EN ELEMENTOS ESTRUCTURALES',
    targetUnit: 'M2',
    defaultFactor: 10.0,
    defaultDistance: null,
    hasDistance: false,
    factorLabel: 'Relación Área de Contacto / Volumen (m²/m³)',
    appliesTo: (item) => {
      const u = String(item?.unit || '').toUpperCase();
      const d = String(item?.description || '').toUpperCase();
      return (
        u === 'M3' &&
        /\b(VIGA|VIGAS|COLUMNA|COLUMNAS|LOSA|LOSAS|CONCRETO ARMADO)\b/.test(d)
      );
    },
  },
  {
    id: 'custom',
    name: 'Vínculo personalizado con factor multiplicador',
    targetDescription: 'PARTIDA DERIVADA VINCULADA',
    targetUnit: 'UND',
    defaultFactor: 1.0,
    defaultDistance: null,
    hasDistance: false,
    factorLabel: 'Factor Multiplicador',
    appliesTo: () => true,
  },
];

/**
 * Obtiene las plantillas de vinculación recomendadas para una partida dada
 */
export function getRecommendedLinkTemplates(item) {
  if (!item) return LINK_TEMPLATES.filter((t) => t.id === 'custom');
  const matched = LINK_TEMPLATES.filter((t) => t.id !== 'custom' && t.appliesTo(item));
  const custom = LINK_TEMPLATES.find((t) => t.id === 'custom');
  return [...matched, custom];
}

/**
 * Calcula la cantidad de una partida vinculada a partir de la cantidad origen
 * y los parámetros aprobados por el usuario
 */
export function computeLinkedQuantity(sourceQuantity, linkConfig) {
  const baseQty = Number(sourceQuantity || 0);
  if (baseQty <= 0) return 0;

  const multFactor = Number(linkConfig?.factor || 1);
  const multDist = Number(linkConfig?.distance || 0);

  if (multDist > 0) {
    return round2(baseQty * multFactor * multDist);
  }
  return round2(baseQty * multFactor);
}

/**
 * Obtiene la medición propia (base sin el vínculo) de una fila.
 */
export function getRowOwnQuantity(row) {
  if (!row) return 0;
  if (typeof row._ownQuantity === 'number' && Number.isFinite(row._ownQuantity)) {
    return row._ownQuantity;
  }
  if (typeof row.linkedTo?.baseQuantity === 'number' && Number.isFinite(row.linkedTo.baseQuantity)) {
    return row.linkedTo.baseQuantity;
  }
  return 0;
}

/**
 * Recorre todas las filas de la planilla y actualiza de manera reactiva aquellas
 * que se encuentren vinculadas a otra fila de la misma planilla
 */
export function applyReactiveLinks(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return rows;

  const rowMap = new Map();
  rows.forEach((r) => {
    if (r?.id) rowMap.set(r.id, r);
  });

  return rows.map((row) => {
    if (!row.linkedTo || !row.linkedTo.sourceItemId) {
      return row;
    }

    const source = rowMap.get(row.linkedTo.sourceItemId);
    const ownQty = getRowOwnQuantity(row);
    const ownFormula = row._ownFormula ?? row.linkedTo?.baseFormula ?? '';

    if (!source) {
      // Si la partida origen fue eliminada, restauramos su medición propia y quitamos el link
      const restoredQty = ownQty > 0 ? ownQty : Number(row.quantity) || 0;
      return {
        ...row,
        quantity: restoredQty,
        partial: restoredQty,
        formula: ownFormula || row.formula || '',
        linkedTo: null,
      };
    }

    const linkedQty = computeLinkedQuantity(source.quantity, row.linkedTo);
    const mode = row.linkedTo.mode || (ownQty > 0 ? 'add' : 'replace');
    const calculatedQty = mode === 'add' ? round2(ownQty + linkedQty) : linkedQty;
    const unitLabel = String(row.unit || '').toLowerCase();

    let nextFormula = row.formula || '';
    if (mode === 'add' && ownQty > 0) {
      const basePart = ownFormula ? `${ownFormula}` : `${ownQty}${unitLabel}`;
      nextFormula = `${basePart} + [Vinculado: ${linkedQty}${unitLabel}] = ${calculatedQty}${unitLabel}`;
    } else if (ownFormula) {
      nextFormula = ownFormula;
    }

    if (row.quantity === calculatedQty && row.formula === nextFormula) {
      return row;
    }

    return {
      ...row,
      quantity: calculatedQty,
      partial: calculatedQty,
      formula: nextFormula,
    };
  });
}
