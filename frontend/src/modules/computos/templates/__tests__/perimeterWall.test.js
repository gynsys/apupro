import { describe, it, expect } from 'vitest';
import {
  BLOCK_TYPES,
  DEFAULT_WALL_INPUT,
  calculatePerimeterWall,
} from '../perimeterWall.js';

describe('plantilla de pared perimetral', () => {
  it('genera partidas y cantidades para una pared completa', () => {
    const result = calculatePerimeterWall(DEFAULT_WALL_INPUT);
    expect(result.rows.length).toBeGreaterThan(8);
    expect(result.totals.area).toBe(54);
    expect(result.rows.some((row) => row.description.toLowerCase().includes('pared de bloque'))).toBe(true);
    expect(result.rows.some((row) => row.description.includes('Concreto para fundación'))).toBe(true);
    expect(result.rows.some((row) => row.description.includes('Concertina'))).toBe(true);
  });

  it('calcula bloques con desperdicio', () => {
    const result = calculatePerimeterWall({
      ...DEFAULT_WALL_INPUT,
      length: 10,
      height: 2,
      blockType: 'concreto_15',
      includeFoundation: false,
      includeColumns: false,
      frisoSides: 0,
      includeConcertina: false,
    });
    const block = BLOCK_TYPES.concreto_15;
    expect(result.totals.blocks).toBe(Math.round(20 * block.blocksPerM2 * 1.05 * 100) / 100);
  });

  it('descuenta el friso según las caras', () => {
    const base = calculatePerimeterWall({
      ...DEFAULT_WALL_INPUT,
      length: 10,
      height: 2,
      includeFoundation: false,
      includeColumns: false,
      includeConcertina: false,
      frisoSides: 0,
    });
    const dosCaras = calculatePerimeterWall({
      ...DEFAULT_WALL_INPUT,
      length: 10,
      height: 2,
      includeFoundation: false,
      includeColumns: false,
      includeConcertina: false,
      frisoSides: 2,
    });
    expect(dosCaras.rows.find((r) => r.description.startsWith('Friso'))?.quantity).toBe(40);
    expect(base.rows.some((r) => r.description.startsWith('Friso'))).toBe(false);
  });

  it('no genera filas si no hay dimensiones', () => {
    const result = calculatePerimeterWall({ ...DEFAULT_WALL_INPUT, length: 0, height: 0 });
    expect(result.rows).toEqual([]);
    expect(result.totals.area).toBe(0);
  });
});
