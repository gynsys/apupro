import { describe, expect, it } from 'vitest';
import { calculatePerimeterWall } from './perimeterWall.js';

describe('perimeterWall', () => {
  it('incluye bloques y mortero dentro de la partida de pared, no como filas separadas', () => {
    const { rows, totals } = calculatePerimeterWall({
      length: 20,
      height: 2.7,
      includeFoundation: false,
      includeColumns: false,
      includeRebar: false,
      includeConcertina: false,
      frisoSides: 0,
    });

    const wall = rows.find((row) => row.key === 'wall');
    expect(wall).toBeTruthy();
    expect(rows.some((row) => row.key === 'blocks')).toBe(false);
    expect(rows.some((row) => row.key === 'mortar')).toBe(false);

    expect(wall.breakdown.map((line) => line.label)).toContain('Bloques');
    expect(wall.breakdown.map((line) => line.label)).toContain('Mortero');
    expect(wall.quantity).toBe(totals.area);
    expect(totals.blocks).toBeGreaterThan(0);
  });
});
