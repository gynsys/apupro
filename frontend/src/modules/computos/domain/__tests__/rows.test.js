import { describe, it, expect } from 'vitest';
import {
  createBlankRow,
  isItemEmpty,
  extractCoveninSearchKeywords,
  sanitizeItemDecimals,
  normalizeRowsWithSingleTrailingBlank,
  parseComputosInput,
} from '../rows.js';

describe('filas de cómputos', () => {
  it('crea una fila vacía con capítulo normalizado', () => {
    const row = createBlankRow(' estructura ');
    expect(row.chapter).toBe('ESTRUCTURA');
    expect(row.unit).toBe('M2');
    expect(row.quantity).toBe(0);
    expect(isItemEmpty(row)).toBe(true);
  });

  it('detecta filas con contenido', () => {
    expect(isItemEmpty({ description: 'Pared' })).toBe(false);
    expect(isItemEmpty({ quantity: 5 })).toBe(false);
    expect(isItemEmpty({ length: 2 })).toBe(false);
    expect(isItemEmpty({ observations: 'Revisar' })).toBe(false);
  });

  it('deja una sola fila vacía final', () => {
    const blank = createBlankRow('GENERAL');
    const rows = normalizeRowsWithSingleTrailingBlank([blank, createBlankRow('GENERAL'), createBlankRow('GENERAL')], 'GENERAL');
    expect(rows).toHaveLength(1);
    expect(isItemEmpty(rows[0])).toBe(true);
  });

  it('agrega fila vacía después de la última fila con contenido', () => {
    const filled = { ...createBlankRow('GENERAL'), description: 'Pared', quantity: 10 };
    const rows = normalizeRowsWithSingleTrailingBlank([filled], 'GENERAL');
    expect(rows).toHaveLength(2);
    expect(rows[0].description).toBe('Pared');
    expect(isItemEmpty(rows[1])).toBe(true);
  });

  it('extrae palabras clave para COVENIN', () => {
    expect(extractCoveninSearchKeywords('Demolición de pared de bloque')).toBe('DEMOLICIÓN PARED');
    expect(extractCoveninSearchKeywords('de la el')).toBe('');
  });

  it('interpreta una partida con medición en línea', () => {
    const result = parseComputosInput('Pared 2 x 3 m2');
    expect(result.items).toHaveLength(1);
    expect(result.items[0].quantity).toBe(6);
    expect(result.items[0].unit).toBe('M2');
  });

  it('interpreta capítulo y partida en líneas separadas', () => {
    const result = parseComputosInput('CAPITULO: ESTRUCTURAS\nViga 2 x 3 x 4');
    expect(result.activeChapter).toBe('ESTRUCTURAS');
    expect(result.items).toHaveLength(1);
    expect(result.items[0].quantity).toBe(24);
  });

  it('devuelve lista vacía con texto vacío', () => {
    expect(parseComputosInput('')).toEqual({ items: [], activeChapter: 'OBRAS PRELIMINARES' });
  });

  it('sanitiza decimales de partidas viejas a dos decimales', () => {
    const rawItem = {
      description: 'CONCRETO',
      quantity: 0.2358,
      partial: 0.2358,
      m3: 0.2358,
      partials: [{ partial: 0.2358, m3: 0.2358 }],
    };
    const sanitized = sanitizeItemDecimals(rawItem);
    expect(sanitized.quantity).toBe(0.24);
    expect(sanitized.partial).toBe(0.24);
    expect(sanitized.m3).toBe(0.24);
    expect(sanitized.partials[0].partial).toBe(0.24);
    expect(sanitized.partials[0].m3).toBe(0.24);

    const normalized = normalizeRowsWithSingleTrailingBlank([rawItem], 'ESTRUCTURAS');
    expect(normalized[0].quantity).toBe(0.24);
  });

  it('recalcula parciales con dimensiones desincronizadas al sanear filas cargadas (ej. Partida 14 M2)', () => {
    const staleItem14 = {
      id: 'item-ikatira-14',
      unit: 'M2',
      description: 'DEMOLICION DE PAREDES DE LADRILLOS MACIZO DE 15 CM DE ESPESOR',
      quantity: 1.52,
      m3: 1.75,
      partial: 1.75,
      partials: [
        { id: 'p1', length: 2.67, width: '', height: 1.97, times: 1, m3: 0.79, partial: 0.79, quantity: 0.79, formula: '' },
        { id: 'p2', length: 2.67, width: '', height: 2.4, times: 1, m3: 0.96, partial: 0.96, quantity: 0.96, formula: '' },
        { id: 'p3', length: 2.17, width: '', height: 0.7, times: -1, m3: -0.23, partial: -0.23, quantity: -0.23, formula: '' },
      ],
    };
    const sanitized = sanitizeItemDecimals(staleItem14);
    expect(sanitized.partials[0].partial).toBe(5.26);
    expect(sanitized.partials[1].partial).toBe(6.41);
    expect(sanitized.partials[2].partial).toBe(-1.52);
    expect(sanitized.quantity).toBe(10.15);
    expect(sanitized.m3).toBe(1.52);
  });
});
