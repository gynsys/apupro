import { describe, it, expect } from 'vitest';
import {
  evaluateMeasurementFormula,
  computePartial,
  recomputeItemWithPartials,
  recomputeRow,
} from '../formulas.js';

describe('fórmulas de cómputos', () => {
  it('evalúa largo por ancho como área', () => {
    const result = evaluateMeasurementFormula('2 x 3');
    expect(result).not.toBeNull();
    expect(result.quantity).toBe(6);
    expect(result.length).toBe(2);
    expect(result.width).toBe(3);
    expect(result.inferredUnit).toBe('M2');
    it('calcula transporte multiplicando volumen M3 por distancia', () => {
    const base = { length: '', width: '', height: '', times: 1, factor: '1.000', distance: '', m3: '', partial: 0, quantity: 0, unit: 'M3-KM', formula: '' };
    const withM3 = recomputeRow(base, 'm3', '30.4');
    expect(withM3.partial).toBe(30.4);
    expect(withM3.quantity).toBe(30.4);

    const withDist = recomputeRow(withM3, 'distance', '4.8');
    expect(withDist.partial).toBe(30.4);
    expect(withDist.quantity).toBe(145.92);
  });
});
  it('evalúa tres dimensiones como volumen', () => {
    const result = evaluateMeasurementFormula('2 x 3 x 4');
    expect(result.quantity).toBe(24);
    expect(result.height).toBe(4);
    expect(result.inferredUnit).toBe('M3');
    it('calcula transporte multiplicando volumen M3 por distancia', () => {
    const base = { length: '', width: '', height: '', times: 1, factor: '1.000', distance: '', m3: '', partial: 0, quantity: 0, unit: 'M3-KM', formula: '' };
    const withM3 = recomputeRow(base, 'm3', '30.4');
    expect(withM3.partial).toBe(30.4);
    expect(withM3.quantity).toBe(30.4);

    const withDist = recomputeRow(withM3, 'distance', '4.8');
    expect(withDist.partial).toBe(30.4);
    expect(withDist.quantity).toBe(145.92);
  });
});
  it('respeta la unidad explícita', () => {
    const result = evaluateMeasurementFormula('2 x 3 m2');
    expect(result.explicitUnit).toBe('M2');
    expect(result.inferredUnit).toBe('M2');
    it('calcula transporte multiplicando volumen M3 por distancia', () => {
    const base = { length: '', width: '', height: '', times: 1, factor: '1.000', distance: '', m3: '', partial: 0, quantity: 0, unit: 'M3-KM', formula: '' };
    const withM3 = recomputeRow(base, 'm3', '30.4');
    expect(withM3.partial).toBe(30.4);
    expect(withM3.quantity).toBe(30.4);

    const withDist = recomputeRow(withM3, 'distance', '4.8');
    expect(withDist.partial).toBe(30.4);
    expect(withDist.quantity).toBe(145.92);
  });
});
  it('rechaza texto que no es una medición', () => {
    expect(evaluateMeasurementFormula('demolición de pared')).toBeNull();
    expect(evaluateMeasurementFormula('')).toBeNull();
    expect(evaluateMeasurementFormula('0 x 4')).toBeNull();
    it('calcula transporte multiplicando volumen M3 por distancia', () => {
    const base = { length: '', width: '', height: '', times: 1, factor: '1.000', distance: '', m3: '', partial: 0, quantity: 0, unit: 'M3-KM', formula: '' };
    const withM3 = recomputeRow(base, 'm3', '30.4');
    expect(withM3.partial).toBe(30.4);
    expect(withM3.quantity).toBe(30.4);

    const withDist = recomputeRow(withM3, 'distance', '4.8');
    expect(withDist.partial).toBe(30.4);
    expect(withDist.quantity).toBe(145.92);
  });
});
  it('calcula parciales con dimensiones y veces', () => {
    expect(computePartial({ length: 2, width: 3, times: 2 })).toBe(12);
    it('calcula transporte multiplicando volumen M3 por distancia', () => {
    const base = { length: '', width: '', height: '', times: 1, factor: '1.000', distance: '', m3: '', partial: 0, quantity: 0, unit: 'M3-KM', formula: '' };
    const withM3 = recomputeRow(base, 'm3', '30.4');
    expect(withM3.partial).toBe(30.4);
    expect(withM3.quantity).toBe(30.4);

    const withDist = recomputeRow(withM3, 'distance', '4.8');
    expect(withDist.partial).toBe(30.4);
    expect(withDist.quantity).toBe(145.92);
  });
});
  it('calcula parciales con factor y distancia', () => {
    expect(computePartial({ length: 2, width: 3, factor: 2, distance: 3 })).toBe(36);
    it('calcula transporte multiplicando volumen M3 por distancia', () => {
    const base = { length: '', width: '', height: '', times: 1, factor: '1.000', distance: '', m3: '', partial: 0, quantity: 0, unit: 'M3-KM', formula: '' };
    const withM3 = recomputeRow(base, 'm3', '30.4');
    expect(withM3.partial).toBe(30.4);
    expect(withM3.quantity).toBe(30.4);

    const withDist = recomputeRow(withM3, 'distance', '4.8');
    expect(withDist.partial).toBe(30.4);
    expect(withDist.quantity).toBe(145.92);
  });
});
  it('suma parciales de una partida', () => {
    const result = recomputeItemWithPartials({
      quantity: 0,
      m3: '',
      partials: [
        { length: 2, width: 3, times: 1 },
        { length: 1, width: 4, times: 1 },
      ],
      it('calcula transporte multiplicando volumen M3 por distancia', () => {
    const base = { length: '', width: '', height: '', times: 1, factor: '1.000', distance: '', m3: '', partial: 0, quantity: 0, unit: 'M3-KM', formula: '' };
    const withM3 = recomputeRow(base, 'm3', '30.4');
    expect(withM3.partial).toBe(30.4);
    expect(withM3.quantity).toBe(30.4);

    const withDist = recomputeRow(withM3, 'distance', '4.8');
    expect(withDist.partial).toBe(30.4);
    expect(withDist.quantity).toBe(145.92);
  });
});    expect(result.quantity).toBe(10);
    it('calcula transporte multiplicando volumen M3 por distancia', () => {
    const base = { length: '', width: '', height: '', times: 1, factor: '1.000', distance: '', m3: '', partial: 0, quantity: 0, unit: 'M3-KM', formula: '' };
    const withM3 = recomputeRow(base, 'm3', '30.4');
    expect(withM3.partial).toBe(30.4);
    expect(withM3.quantity).toBe(30.4);

    const withDist = recomputeRow(withM3, 'distance', '4.8');
    expect(withDist.partial).toBe(30.4);
    expect(withDist.quantity).toBe(145.92);
  });
});
  it('recalcula una fila al cambiar dimensiones', () => {
    const base = { length: '', width: '', height: '', times: 1, factor: '', distance: '', partial: 0, quantity: 0, unit: 'M2', formula: '' };
    const withLength = recomputeRow(base, 'length', '2');
    const withWidth = recomputeRow(withLength, 'width', '3');
    expect(withWidth.partial).toBe(6);
    expect(withWidth.quantity).toBe(6);
    it('calcula transporte multiplicando volumen M3 por distancia', () => {
    const base = { length: '', width: '', height: '', times: 1, factor: '1.000', distance: '', m3: '', partial: 0, quantity: 0, unit: 'M3-KM', formula: '' };
    const withM3 = recomputeRow(base, 'm3', '30.4');
    expect(withM3.partial).toBe(30.4);
    expect(withM3.quantity).toBe(30.4);

    const withDist = recomputeRow(withM3, 'distance', '4.8');
    expect(withDist.partial).toBe(30.4);
    expect(withDist.quantity).toBe(145.92);
  });
});
  it('recalcula una fila al cambiar cantidad manual', () => {
    const base = { length: '', width: '', height: '', times: 1, factor: '', distance: '', partial: 0, quantity: 0, unit: 'M2', formula: '' };
    const result = recomputeRow(base, 'quantity', '12');
    expect(result.quantity).toBe(12);
    expect(result.partial).toBe(12);
    it('calcula transporte multiplicando volumen M3 por distancia', () => {
    const base = { length: '', width: '', height: '', times: 1, factor: '1.000', distance: '', m3: '', partial: 0, quantity: 0, unit: 'M3-KM', formula: '' };
    const withM3 = recomputeRow(base, 'm3', '30.4');
    expect(withM3.partial).toBe(30.4);
    expect(withM3.quantity).toBe(30.4);

    const withDist = recomputeRow(withM3, 'distance', '4.8');
    expect(withDist.partial).toBe(30.4);
    expect(withDist.quantity).toBe(145.92);
  });
});  it('calcula transporte multiplicando volumen M3 por distancia', () => {
    const base = { length: '', width: '', height: '', times: 1, factor: '1.000', distance: '', m3: '', partial: 0, quantity: 0, unit: 'M3-KM', formula: '' };
    const withM3 = recomputeRow(base, 'm3', '30.4');
    expect(withM3.partial).toBe(30.4);
    expect(withM3.quantity).toBe(30.4);

    const withDist = recomputeRow(withM3, 'distance', '4.8');
    expect(withDist.partial).toBe(30.4);
    expect(withDist.quantity).toBe(145.92);
  });
});